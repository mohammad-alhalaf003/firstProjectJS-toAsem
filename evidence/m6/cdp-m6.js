const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m6-' + Date.now();
const PORT = 9372;
const URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const OUT = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\m6';
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

async function endpoint() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json`); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(150);
  }
  throw new Error('CDP endpoint not ready');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 1;
    const pending = new Map();
    const consoleCalls = [];
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const n = id++;
        return new Promise((res, rej) => { pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
      },
      consoleCalls,
      close() { ws.close(); }
    });
    ws.onerror = reject;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled') consoleCalls.push({ type: m.params.type, args: m.params.args.map(a => a.value ?? a.description ?? null) });
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
  });
}

(async () => {
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, URL], { stdio: 'ignore' });
  let c;
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`);
  };
  try {
    const targets = await endpoint();
    c = await connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__errs=[];window.addEventListener('error',e=>__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));`
    });

    const ev = async expression => {
      const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(expression.slice(0, 120) + ' -> ' + (r.exceptionDetails.exception?.description || 'error'));
      return r.result.value;
    };
    const click = async selector => ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true;})()`);
    const setSelect = async (selector, value) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
    const typeSearch = async text => ev(`(()=>{const e=document.getElementById('search-input');e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
    const snap = () => ev(`({
      cards: document.querySelectorAll('#product-grid:not([hidden]) .card').length,
      rows: document.querySelectorAll('#product-table-body tr').length,
      gridHidden: document.getElementById('product-grid').hidden,
      tableHidden: document.getElementById('table-wrap').hidden,
      status: document.getElementById('page-status').innerText.trim(),
      result: document.getElementById('result-count').innerText.trim(),
      current: document.querySelector('#page-list [aria-current="page"]')?.textContent.trim() || null,
      prevDisabled: document.getElementById('page-prev').disabled,
      nextDisabled: document.getElementById('page-next').disabled,
      navHidden: document.getElementById('pagination').hidden,
      stateHidden: document.getElementById('state-box').hidden,
      gridPressed: document.getElementById('view-grid').getAttribute('aria-pressed'),
      tablePressed: document.getElementById('view-table').getAttribute('aria-pressed'),
      perPage: document.getElementById('per-page-select').value,
      errs: window.__errs.slice()
    })`);
    const shot = async file => {
      const r = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64'));
    };

    for (const width of [320, 768, 1280]) {
      await ev('localStorage.clear();sessionStorage.clear();true');
      await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await c.send('Page.reload', { ignoreCache: true });
      await sleep(1700);

      let s = await snap();
      check(`W${width} initial 20 cards`, s.cards === 20 && s.rows === 0 && !s.gridHidden, s);
      check(`W${width} initial range + first/last disabled`, s.status.includes('Showing 1–20 of 20') && s.prevDisabled && s.nextDisabled && s.current === '1', s);

      await setSelect('#per-page-select', 5);
      s = await snap();
      check(`W${width} per page 5 resets to page 1`, s.perPage === '5' && s.cards === 5 && s.current === '1' && s.status.includes('Showing 1–5 of 20') && s.prevDisabled && !s.nextDisabled, s);
      check(`W${width} page size in localStorage`, await ev(`localStorage.getItem('storepulse_page_size')`) === '5', await ev(`localStorage.getItem('storepulse_page_size')`));

      await click('#page-next');
      s = await snap();
      check(`W${width} next → page 2`, s.current === '2' && s.cards === 5 && s.status.includes('Showing 6–10 of 20') && !s.prevDisabled, s);
      check(`W${width} page in sessionStorage`, await ev(`sessionStorage.getItem('storepulse_current_page')`) === '2', await ev(`sessionStorage.getItem('storepulse_current_page')`));

      await click('#page-list button[data-page="4"]');
      s = await snap();
      check(`W${width} middle/last page 4`, s.current === '4' && s.status.includes('Showing 16–20 of 20') && s.nextDisabled && !s.prevDisabled, s);

      await click('#page-prev');
      s = await snap();
      check(`W${width} previous → page 3`, s.current === '3' && s.status.includes('Showing 11–15 of 20'), s);

      await typeSearch('backpack');
      await sleep(550);
      s = await snap();
      check(`W${width} search resets to page 1`, s.current === '1' && s.cards > 0 && s.cards <= 5 && s.status.startsWith('Showing 1–'), s);
      await typeSearch('');
      await sleep(550);

      await click('#page-list button[data-page="4"]');
      await ev(`(()=>{const e=document.getElementById('sort-select');e.value='price-desc';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
      s = await snap();
      const prices = await ev(`[...document.querySelectorAll('#product-grid .price')].map(e=>parseFloat(e.textContent.replace(/[^0-9.]/g,'')))`);
      check(`W${width} local sort resets to page 1`, s.current === '1' && prices.every((v, i, a) => i === 0 || a[i - 1] >= v), { s, prices });
      await ev(`(()=>{const e=document.getElementById('sort-select');e.value='default';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);

      await click('#page-list button[data-page="4"]');
      await click('#category-chips button[data-category="electronics"]');
      await sleep(1000);
      s = await snap();
      const chipUrl = await ev(`document.getElementById('request-url').innerText`);
      check(`W${width} category resets to page 1`, s.current === '1' && s.status.includes('of 6') && chipUrl.includes('/products/category/electronics'), { s, chipUrl });
      await click('#category-chips button[data-category="all"]');
      await sleep(1000);

      await click('#page-list button[data-page="4"]');
      await setSelect('#limit-select', 5);
      await sleep(900);
      s = await snap();
      check(`W${width} API limit resets to page 1`, s.current === '1' && s.cards === 5 && s.status.includes('of 5'), s);
      await click('#page-list button[data-page="2"]').catch(() => {});
      await setSelect('#id-sort-select', 'desc');
      await sleep(900);
      s = await snap();
      const sortUrl = await ev(`document.getElementById('request-url').innerText`);
      check(`W${width} server ID sort resets to page 1`, s.current === '1' && sortUrl.includes('sort=desc'), { s, sortUrl });
      await setSelect('#limit-select', 20);
      await sleep(700);
      await setSelect('#id-sort-select', 'asc');
      await sleep(900);

      await click('#product-grid .btn-fav');
      await click('#page-list button[data-page="4"]');
      await click('#btn-favorites');
      s = await snap();
      check(`W${width} favorites filter resets to page 1`, s.current === '1' && s.cards === 1 && s.status.includes('of 1'), s);
      await click('#btn-favorites');
      await ev(`document.querySelectorAll('#product-grid .btn-fav').forEach(b=>{if(b.getAttribute('aria-pressed')==='true')b.click();})`);

      await setSelect('#per-page-select', 5);
      await click('#view-table');
      s = await snap();
      const tableShape = await ev(`({
        caption: document.getElementById('table-caption').innerText.trim().length > 0,
        colScopes: document.querySelectorAll('#product-table thead th[scope="col"]').length,
        rowScopes: document.querySelectorAll('#product-table tbody th[scope="row"]').length,
        firstCells: document.querySelectorAll('#product-table tbody tr:first-child > *').length,
        hasImage: !!document.querySelector('#product-table tbody img'),
        hasRating: !!document.querySelector('#product-table tbody .rating'),
        overflowX: getComputedStyle(document.getElementById('table-wrap')).overflowX,
        wrapScroll: document.getElementById('table-wrap').scrollWidth,
        wrapClient: document.getElementById('table-wrap').clientWidth,
        pageScroll: document.documentElement.scrollWidth,
        inner: innerWidth
      })`);
      check(`W${width} table view shares same 5 items`, s.rows === 5 && s.cards === 0 && s.gridHidden && !s.tableHidden && s.tablePressed === 'true' && s.gridPressed === 'false', { s, tableShape });
      check(`W${width} real table semantics`, tableShape.caption && tableShape.colScopes === 6 && tableShape.rowScopes === 5 && tableShape.firstCells === 6 && tableShape.hasImage && tableShape.hasRating, tableShape);
      check(`W${width} no page-level horizontal scroll`, tableShape.pageScroll <= tableShape.inner + 1 && tableShape.overflowX === 'auto', tableShape);
      check(`W${width} view stored in localStorage`, await ev(`localStorage.getItem('storepulse_view_mode')`) === '"table"', await ev(`localStorage.getItem('storepulse_view_mode')`));

      await click('#product-table tbody tr:first-child button[data-action="details"]');
      await sleep(400);
      const detailOpen = await ev(`document.getElementById('product-dialog').open`);
      await ev(`document.getElementById('product-dialog').close()`);
      await click('#product-table tbody tr:first-child button[data-action="favorite"]');
      const rowFav = await ev(`document.querySelector('#product-table tbody tr:first-child button[data-action="favorite"]').getAttribute('aria-pressed')`);
      const cartBefore = Number(await ev(`document.getElementById('cart-count').textContent`));
      await click('#product-table tbody tr:first-child button[data-action="add"]');
      const cartAfter = Number(await ev(`document.getElementById('cart-count').textContent`));
      check(`W${width} details/favorite/cart work in table`, detailOpen && rowFav === 'true' && cartAfter === cartBefore + 1, { detailOpen, rowFav, cartBefore, cartAfter });

      await shot(`table-${width}.png`);
      await click('#view-grid');
      await shot(`grid-${width}.png`);

      await click('#page-list button[data-page="2"]');
      await click('#view-table');
      await c.send('Page.reload', { ignoreCache: true });
      await sleep(1700);
      const restored = await ev(`({
        perPage: document.getElementById('per-page-select').value,
        current: document.querySelector('#page-list [aria-current="page"]')?.textContent.trim() || null,
        rows: document.querySelectorAll('#product-table-body tr').length,
        tablePressed: document.getElementById('view-table').getAttribute('aria-pressed'),
        ls: localStorage.getItem('storepulse_page_size'),
        ss: sessionStorage.getItem('storepulse_current_page'),
        view: localStorage.getItem('storepulse_view_mode')
      })`);
      check(`W${width} storage restore after reload`, restored.perPage === '5' && restored.current === '2' && restored.rows === 5 && restored.tablePressed === 'true' && restored.ls === '5' && restored.ss === '2' && restored.view === '"table"', restored);

      await typeSearch('zzzz-no-match');
      await sleep(550);
      s = await snap();
      check(`W${width} empty state without errors`, s.cards === 0 && s.rows === 0 && !s.stateHidden && s.navHidden && s.status.includes('0–0 of 0') && s.errs.length === 0, s);
      await typeSearch('');
      await sleep(550);

      check(`W${width} console clean`, (await ev(`window.__errs`)).length === 0, await ev(`window.__errs`));
    }

    const consoleErrors = c.consoleCalls.filter(x => x.type === 'error');
    check('no console API errors', consoleErrors.length === 0, consoleErrors);
  } finally {
    fs.writeFileSync(path.join(OUT, 'runtime-tests.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results, summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length } }, null, 2));
    if (c) c.close();
    child.kill('SIGKILL');
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`M6 runtime: ${results.length - failed}/${results.length} PASS`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });

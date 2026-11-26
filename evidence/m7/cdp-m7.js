const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m7-' + Date.now();
const PORT = 9374;
const URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const OUT = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\m7';
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
    const productRequests = [];
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const n = id++;
        return new Promise((res, rej) => { pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
      },
      consoleCalls,
      productRequests,
      clearRequests() { productRequests.length = 0; },
      close() { ws.close(); }
    });
    ws.onerror = reject;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.consoleAPICalled') {
        consoleCalls.push({ type: m.params.type, args: m.params.args.map(a => a.value ?? a.description ?? null), timestamp: m.params.timestamp });
      }
      if (m.method === 'Network.requestWillBeSent' && String(m.params.request.url).includes('fakestoreapi.com/products')) {
        productRequests.push(m.params.request.url);
      }
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
    await c.send('Network.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__errs=[];window.addEventListener('error',e=>__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));`
    });

    const ev = async expression => {
      const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(expression.slice(0, 140) + ' -> ' + (r.exceptionDetails.exception?.description || 'error'));
      return r.result.value;
    };
    const setSelect = async (selector, value) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`);
    const click = async selector => ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true;})()`);
    const setInput = async value => ev(`(()=>{const e=document.getElementById('search-input');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));return e.value;})()`);
    const enter = () => ev(`(()=>{document.getElementById('search-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);
    const stats = () => ev(`({inputEvents:StorePulseSearchStats.inputEvents,filterRuns:StorePulseSearchStats.filterRuns})`);
    const searchLogs = () => c.consoleCalls.filter(x => String(x.args[0] || '').includes('[StorePulse] Search stats')).map(x => String(x.args[0]));
    const view = () => ev(`({
      result: document.getElementById('result-count').innerText.trim(),
      status: document.getElementById('page-status').innerText.trim(),
      cards: document.querySelectorAll('#product-grid:not([hidden]) .card').length,
      rows: document.querySelectorAll('#product-table-body tr').length,
      current: document.querySelector('#page-list [aria-current="page"]')?.textContent.trim() || null,
      stateHidden: document.getElementById('state-box').hidden,
      stateTitle: document.getElementById('state-title').innerText.trim(),
      errs: window.__errs.slice()
    })`);
    const typeFast = async text => {
      for (const ch of text) { await ev(`(()=>{const e=document.getElementById('search-input');e.value+=${JSON.stringify(ch)};e.dispatchEvent(new Event('input',{bubbles:true}));return e.value;})()`); await sleep(40); }
    };
    const typeSlow = async text => {
      for (const ch of text) { await ev(`(()=>{const e=document.getElementById('search-input');e.value+=${JSON.stringify(ch)};e.dispatchEvent(new Event('input',{bubbles:true}));return e.value;})()`); await sleep(450); }
    };
    const shot = async file => {
      const r = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64'));
    };

    for (const width of [320, 768, 1280]) {
      await ev('localStorage.clear();sessionStorage.clear();true');
      await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await c.send('Page.reload', { ignoreCache: true });
      await sleep(1800);
      await ev(`document.getElementById('search-input').value='';StorePulseSearchStats.reset();true`);
      c.clearRequests();
      const baseline = await view();

      // 7.2/7.3 — كتابة سريعة: أحداث أكثر من عمليات فلترة، وصفر طلبات API.
      await typeFast('backpack');
      await sleep(600);
      const fastStats = await stats();
      const fastView = await view();
      const fastLogs = searchLogs();
      check(`W${width} fast typing debounced`, fastStats.inputEvents === 8 && fastStats.filterRuns === 1 && fastStats.filterRuns < fastStats.inputEvents, { fastStats, fastLogs });
      check(`W${width} fast typing made no API request`, c.productRequests.length === 0, c.productRequests);
      check(`W${width} title search + result count`, fastView.cards > 0 && fastView.result.includes(String(fastView.cards)), fastView);
      await shot(`search-fast-${width}.png`);

      // 7.1 — case-insensitive والبحث العربي.
      await ev(`StorePulseSearchStats.reset();true`);
      await setInput('');
      await sleep(450);
      await typeFast('BACKPACK');
      await sleep(600);
      const upperView = await view();
      check(`W${width} case-insensitive title search`, upperView.cards === fastView.cards && upperView.cards > 0, { fast: fastView.cards, upper: upperView.cards });

      await setInput('');
      await sleep(450);
      await typeFast('حقيبة');
      await sleep(600);
      const arabicView = await view();
      check(`W${width} existing Arabic keyword still works`, arabicView.cards > 0 && arabicView.cards === fastView.cards, { arabic: arabicView.cards, english: fastView.cards });

      // 7.1 — البحث في التصنيف.
      await setInput('');
      await sleep(450);
      await typeFast('electronics');
      await sleep(600);
      const categoryView = await view();
      check(`W${width} category search finds all electronics`, categoryView.cards === 6 && categoryView.result.includes('6'), categoryView);

      // 7.1 — Empty state.
      await setInput('zzzz-no-match');
      await sleep(600);
      const emptyView = await view();
      check(`W${width} empty state + zero results`, emptyView.cards === 0 && !emptyView.stateHidden && emptyView.stateTitle.includes('No matches') && emptyView.status.includes('0–0 of 0'), emptyView);
      await shot(`search-empty-${width}.png`);

      // 7.1 — المسح يعيد نتائج الفلاتر الحالية ولا يترك نتائج قديمة.
      await setInput('');
      await sleep(600);
      const clearedView = await view();
      check(`W${width} clearing search restores baseline`, clearedView.cards === baseline.cards && clearedView.result === baseline.result && clearedView.stateHidden, { baseline, clearedView });

      // 7.3 — كتابة بطيئة: كل حرف ينفّذ فلترة بعد 350ms.
      await ev(`StorePulseSearchStats.reset();true`);
      await typeSlow('bag');
      await sleep(500);
      const slowStats = await stats();
      check(`W${width} slow typing runs filter per pause`, slowStats.inputEvents === 3 && slowStats.filterRuns === 3, slowStats);

      // 7.2/7.3 — Enter يلغي المؤقت ولا يكرر التنفيذ.
      await setInput('');
      await sleep(500);
      await ev(`StorePulseSearchStats.reset();true`);
      const logIndexBeforeEnter = searchLogs().length;
      c.clearRequests();
      await typeFast('bag');
      await enter();
      await sleep(700);
      const enterStats = await stats();
      const enterLogs = searchLogs().slice(logIndexBeforeEnter);
      check(`W${width} Enter cancels pending debounce`, enterStats.inputEvents === 3 && enterStats.filterRuns === 1 && enterLogs.length === 1 && enterLogs[0].includes('(Enter)'), { enterStats, enterLogs });
      check(`W${width} Enter search stays local`, c.productRequests.length === 0, c.productRequests);
      await setInput('');
      await sleep(600);
      check(`W${width} no stale results after Enter + clear`, (await view()).cards === baseline.cards, await view());

      // 7.1 — تكامل مع Pagination وCategory وSort وAPI Limit وGrid/Table.
      await setSelect('#per-page-select', 5);
      await click('#page-list button[data-page="3"]');
      await ev(`StorePulseSearchStats.reset();true`);
      await typeFast('backpack');
      await sleep(600);
      let integrated = await view();
      check(`W${width} search resets pagination to page 1`, integrated.current === '1' && integrated.cards > 0, integrated);

      await setInput('');
      await sleep(500);
      await setSelect('#per-page-select', 20);
      await click('#category-chips button[data-category="electronics"]');
      await sleep(1000);
      await typeFast('electronics');
      await sleep(600);
      integrated = await view();
      check(`W${width} category + search share result count`, integrated.cards === 6 && integrated.current === '1' && integrated.status.includes('of 6') && integrated.result.includes('6'), integrated);
      await click('#category-chips button[data-category="all"]');
      await sleep(1000);

      await setInput('');
      await sleep(500);
      await setSelect('#sort-select', 'price-desc');
      await typeFast('backpack');
      await sleep(600);
      const prices = await ev(`[...document.querySelectorAll('#product-grid .price')].map(e=>parseFloat(e.textContent.replace(/[^0-9.]/g,'')))`);
      check(`W${width} search + local sort stays ordered`, prices.length > 0 && prices.every((v, i, a) => i === 0 || a[i - 1] >= v), prices);
      await setSelect('#sort-select', 'default');

      await setInput('');
      await sleep(500);
      await setSelect('#limit-select', 5);
      await sleep(900);
      await typeFast('backpack');
      await sleep(600);
      const limitedMatch = await view();
      check(`W${width} search respects API limit`, limitedMatch.cards === 1 && limitedMatch.status.includes('of 1'), limitedMatch);
      await setInput('');
      await sleep(500);
      await typeFast('Hard Drive');
      await sleep(600);
      const outsideLimit = await view();
      check(`W${width} search cannot find item outside API limit`, outsideLimit.cards === 0 && outsideLimit.status.includes('0–0 of 0'), outsideLimit);
      await setSelect('#limit-select', 20);
      await sleep(900);

      await setInput('');
      await sleep(500);
      await typeFast('backpack');
      await sleep(600);
      const gridMatches = (await view()).cards;
      await click('#view-table');
      await shot(`search-table-${width}.png`);
      const tableView = await view();
      check(`W${width} search works in Table view`, tableView.rows === gridMatches && tableView.cards === 0, { gridMatches, tableView });
      await click('#view-grid');

      await setInput('');
      await sleep(600);
      const finalStats = await stats();
      await ev(`StorePulseSearchStats.log();true`);
      check(`W${width} Console could print final counters`, searchLogs().some(x => x.includes(`input events: ${finalStats.inputEvents}`) && x.includes(`filter runs: ${finalStats.filterRuns}`)), finalStats);
      check(`W${width} console clean`, (await ev(`window.__errs`)).length === 0 && c.consoleCalls.filter(x => x.type === 'error').length === 0, await ev(`window.__errs`));
    }
  } finally {
    const consoleErrors = c ? c.consoleCalls.filter(x => x.type === 'error') : [];
    fs.writeFileSync(path.join(OUT, 'debounce-tests.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'PDF page 16, M7.1–M7.3',
      tool: 'Google Chrome headless via CDP; DOM input/keydown events dispatched with Runtime.evaluate',
      constantMs: 350,
      results,
      summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length },
      consoleErrors: consoleErrors.map(x => x.args),
      screenshots: ['search-fast-320.png', 'search-fast-768.png', 'search-fast-1280.png', 'search-empty-320.png', 'search-empty-768.png', 'search-empty-1280.png', 'search-table-320.png', 'search-table-768.png', 'search-table-1280.png']
    }, null, 2));
    if (c) c.close();
    child.kill('SIGKILL');
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`M7 debounce/search: ${results.length - failed}/${results.length} PASS`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });

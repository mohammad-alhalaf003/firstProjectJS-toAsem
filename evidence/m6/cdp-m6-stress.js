const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m6-stress-' + Date.now();
const PORT = 9373;
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
      if (m.method === 'Runtime.consoleAPICalled') {
        consoleCalls.push({
          type: m.params.type,
          args: m.params.args.map(a => a.value ?? a.description ?? null),
          timestamp: m.params.timestamp
        });
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
  try {
    const targets = await endpoint();
    c = await connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__errs=[];window.addEventListener('error',e=>__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));`
    });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.reload', { ignoreCache: true });
    await sleep(1800);

    const ev = async expression => {
      const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(expression.slice(0, 140) + ' -> ' + (r.exceptionDetails.exception?.description || 'error'));
      return r.result.value;
    };

    const generated = await ev(`(() => {
      const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      const categories = ['electronics','jewelery',"men's clothing","women's clothing"];
      window.__fake5000 = Array.from({ length: 5000 }, (_, index) => {
        const id = 100000 + index;
        return {
          id,
          title: 'Stress product ' + (index + 1),
          price: Number(((index % 900) + 1.99).toFixed(2)),
          description: 'Synthetic product used only for the M6 stress test.',
          category: categories[index % categories.length],
          image,
          rating: { rate: Number(((index % 50) / 10 + 0.5).toFixed(1)), count: index + 1 }
        };
      });
      return { count: window.__fake5000.length, firstId: window.__fake5000[0].id, lastId: window.__fake5000.at(-1).id };
    })()`);

    const measure = (label, pageSize, restoreFirst = false) => ev(`(async () => {
      ${restoreFirst ? 'window.StorePulseStress.restore();' : ''}
      const t0 = performance.now();
      console.time(${JSON.stringify(label)});
      const rendered = window.StorePulseStress.render(window.__fake5000, ${pageSize});
      console.timeEnd(${JSON.stringify(label)});
      const tJs = performance.now();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const tVisual = performance.now();
      return {
        jsMs: Number((tJs - t0).toFixed(2)),
        visualMs: Number((tVisual - t0).toFixed(2)),
        rendered,
        cards: document.querySelectorAll('#product-grid .card').length,
        pageCount: document.querySelectorAll('#page-list button[data-page]').length,
        status: document.getElementById('page-status').innerText.trim(),
        current: document.querySelector('#page-list [aria-current="page"]')?.textContent.trim() || null
      };
    })()`);

    const all = await measure('m6-render-all-5000', 5000);
    const overlay = async (title, data) => ev(`(() => {
      const old = document.getElementById('stress-overlay');
      if (old) old.remove();
      const box = document.createElement('div');
      box.id = 'stress-overlay';
      box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;max-width:420px;padding:12px 16px;border-radius:12px;background:#0a0e18;color:#fff;font:600 13px/1.6 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35)';
      box.textContent = ${JSON.stringify(title)} + ' | JS ' + ${JSON.stringify(String(data.jsMs))} + ' ms | visual ' + ${JSON.stringify(String(data.visualMs))} + ' ms | cards ' + ${JSON.stringify(String(data.cards))};
      document.body.append(box);
      return true;
    })()`);
    await overlay('5000 all at once', all);
    const shot = async file => {
      const r = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64'));
    };
    await shot('stress-5000.png');

    const page = await measure('m6-render-page-20', 20, true);
    await overlay('One page of 20', page);
    await shot('stress-page20.png');
    await ev(`document.getElementById('stress-overlay')?.remove();window.StorePulseStress.restore();true`);
    await sleep(200);

    const restored = await ev(`({
      cards: document.querySelectorAll('#product-grid .card').length,
      status: document.getElementById('page-status').innerText.trim(),
      perPage: document.getElementById('per-page-select').value,
      lsPageSize: localStorage.getItem('storepulse_page_size'),
      fakeTitles: [...document.querySelectorAll('.card-title')].filter(e => e.textContent.includes('Stress product')).length,
      errs: window.__errs.slice()
    })`);

    const timings = c.consoleCalls.filter(x => x.type === 'timeEnd').map(x => {
      const raw = String(x.args[0] ?? '');
      const separator = raw.lastIndexOf(': ');
      return { label: separator >= 0 ? raw.slice(0, separator) : raw, raw };
    });
    const consoleErrors = c.consoleCalls.filter(x => x.type === 'error').map(x => x.args);
    const report = {
      generatedAt: new Date().toISOString(),
      environment: {
        browser: 'Google Chrome headless via CDP',
        viewport: '1280×900',
        data: '5000 synthetic products generated in Browser Console; image is a 1×1 data URI so Network is not distorted',
        caveat: 'console.time measures JavaScript DOM construction; visualMs is a double-requestAnimationFrame upper bound until the next paint, not a Lighthouse paint metric.'
      },
      generated,
      measurements: { all5000: all, page20: page },
      consoleTimings: timings,
      comparison: {
        jsTimesFaster: Number((all.jsMs / Math.max(page.jsMs, 0.01)).toFixed(2)),
        visualTimesFaster: Number((all.visualMs / Math.max(page.visualMs, 0.01)).toFixed(2))
      },
      restored,
      consoleErrors,
      screenshots: ['stress-5000.png', 'stress-page20.png'],
      checks: {
        all5000Rendered: all.cards === 5000 && all.status.includes('1–5000 of 5000'),
        page20Rendered: page.cards === 20 && page.status.includes('1–20 of 5000'),
        noFakeDataLeft: restored.fakeTitles === 0 && restored.cards === 20,
        consoleClean: consoleErrors.length === 0 && restored.errs.length === 0
      }
    };
    fs.writeFileSync(path.join(OUT, 'stress-test.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ generated, all, page, comparison: report.comparison, checks: report.checks, timings }, null, 2));
    const failed = Object.values(report.checks).some(x => !x);
    if (failed) process.exitCode = 1;
  } finally {
    if (c) c.close();
    child.kill('SIGKILL');
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error(e); process.exit(1); });

const { spawn } = require('child_process');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m2-' + Date.now();
const PORT = 9368;
const URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json`); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(150);
  }
  throw new Error('CDP endpoint not ready');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 1; const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        const n = id++;
        return new Promise((res, rej) => { pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
      }, close() { ws.close(); }
    });
    ws.onerror = reject;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    };
  });
}

(async () => {
  const child = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, URL], { stdio: 'ignore' });
  let c;
  try {
    const targets = await endpoint();
    c = await connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await c.send('Runtime.enable'); await c.send('Page.enable');
    const ev = async expression => {
      const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(expression.slice(0, 120) + ' -> ' + (r.exceptionDetails.exception?.description || 'error'));
      return r.result.value;
    };
    const report = {};
    for (const w of [320, 768, 1280]) {
      await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
      await c.send('Page.reload', { ignoreCache: true });
      await sleep(1800);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const ready = await ev(`document.querySelectorAll('.card').length > 0`);
        if (ready) break;
        await sleep(250);
      }
      const R = {};
      R.layout = await ev(`(() => {
        const cs = s => getComputedStyle(document.querySelector(s));
        const grid = document.querySelector('#product-grid');
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
        const lh = s => { const c = cs(s); return +(parseFloat(c.lineHeight) / parseFloat(c.fontSize)).toFixed(2); };
        return {
          headerPosition: cs('.app-header').position,
          boxSizing: cs('.card').boxSizing,
          headerFlex: cs('.header-container').display,
          chipsFlex: cs('.chips').display,
          cardFooterFlex: cs('.card-footer').display,
          gridDisplay: cs('#product-grid').display,
          gridColumns: cols.length,
          minColumnPx: Math.min(...cols.map(parseFloat)),
          lineHeightBody: lh('body'),
          lineHeightTitle: lh('.card-title'),
          lineHeightDesc: lh('.card-desc'),
          lineHeightLead: lh('.hero-lead'),
          btnBeforeContent: getComputedStyle(document.querySelector('.btn'), '::before').content,
          footerAfterContent: getComputedStyle(document.querySelector('.footer a'), '::after').content,
          clampedTitles: [...document.querySelectorAll('.card-title')].filter(e => e.scrollHeight > e.clientHeight + 1).length,
          lineClamp: cs('.card-title').webkitLineClamp,
          overflow: document.documentElement.scrollWidth <= innerWidth
        };
      })()`);
      R.sticky = await ev(`(() => {
        const h = document.querySelector('.app-header');
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo({ top: 1200, behavior: 'instant' });
        const r = h.getBoundingClientRect();
        return {
          scrollY: Math.round(scrollY),
          headerTop: Math.round(r.top),
          headerBottom: Math.round(r.bottom),
          offsetTop: h.offsetTop,
          bodyPaddingTop: getComputedStyle(document.body).paddingTop,
          hiddenClass: h.classList.contains('header-hidden'),
          transform: getComputedStyle(h).transform,
          zIndex: getComputedStyle(h).zIndex,
          progressZ: getComputedStyle(document.querySelector('#scroll-progress')).zIndex
        };
      })()`);
      R.contrast = await ev(`(() => {
        const lum = str => {
          const m = str.match(/[\\d.]+/g).slice(0,3).map(Number).map(v => { v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); });
          return .2126*m[0]+.7152*m[1]+.0722*m[2];
        };
        const ratio = (a,b) => { const x=lum(a), y=lum(b); return +(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)); };
        const cs = s => getComputedStyle(document.querySelector(s));
        return {
          textOnSurface: ratio(cs('body').color, cs('.card').backgroundColor),
          mutedOnSurface: ratio(cs('.card-desc').color, cs('.card').backgroundColor),
          mutedOnSubtle: ratio(cs('.card-desc').color, cs('.search-field').backgroundColor),
          linkOnSurface: ratio(cs('.footer a').color, cs('.footer').backgroundColor),
          primaryButton: ratio(cs('.btn-primary').color, cs('.btn-primary').backgroundColor)
        };
      })()`);
      R.contrastThemes = await ev(`(async () => {
        const lum = str => {
          const m = str.match(/[\\d.]+/g).slice(0,3).map(Number).map(v => { v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); });
          return .2126*m[0]+.7152*m[1]+.0722*m[2];
        };
        const ratio = (a,b) => { const x=lum(a), y=lum(b); return +(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)); };
        const cs = s => getComputedStyle(document.querySelector(s));
        const measure = () => ({
          text: ratio(cs('body').color, cs('.card').backgroundColor),
          mutedSurface: ratio(cs('.card-desc').color, cs('.card').backgroundColor),
          mutedSubtle: ratio(cs('.card-desc').color, cs('.search-field').backgroundColor),
          primaryButton: ratio(cs('.btn-primary').color, cs('.btn-primary').backgroundColor)
        });
        const root = document.documentElement;
        root.setAttribute('data-theme', 'light'); await new Promise(r => setTimeout(r, 500)); const light = measure();
        root.setAttribute('data-theme', 'dark'); await new Promise(r => setTimeout(r, 500)); const dark = measure();
        return { light, dark };
      })()`);
      report[w] = R;
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (c) c.close();
    child.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });

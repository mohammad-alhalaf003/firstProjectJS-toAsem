const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\final';
const TEMP_ROOT = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode';
const APP_URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const BROWSERS = [
  { name: 'chrome', exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'edge', exe: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' }
];
const THEMES = ['light', 'dark', 'ocean'];
const WIDTHS = [320, 768, 1280];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(OUT, { recursive: true });

const ERROR_HOOK = [
  'window.__errs=[];',
  "window.addEventListener('error',e=>__errs.push(String(e.message)));",
  "window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));"
].join('');

const READY = `(()=>{
  const grid=document.getElementById('product-grid');
  return !!grid && !grid.hasAttribute('aria-busy') &&
    grid.querySelectorAll('.card').length>0 && document.getElementById('state-box').hidden;
})()`;

function connect(url, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 1;
    const pending = new Map();
    const consoleCalls = [];
    ws.onopen = () => resolve({
      label,
      consoleCalls,
      send(method, params = {}) {
        const requestId = id++;
        return new Promise((res, rej) => {
          pending.set(requestId, { res, rej });
          ws.send(JSON.stringify({ id: requestId, method, params }));
        });
      },
      close() { ws.close(); }
    });
    ws.onerror = reject;
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled') {
        consoleCalls.push({ tab: label, type: message.params.type,
          args: message.params.args.map((arg) => arg.value ?? arg.description ?? null) });
      }
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        message.error ? entry.rej(new Error(JSON.stringify(message.error))) : entry.res(message.result);
      }
    };
  });
}

async function version(port) {
  for (let index = 0; index < 120; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch (error) {}
    await sleep(150);
  }
  throw new Error(`CDP not ready on ${port}`);
}

async function targets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  return response.ok ? response.json() : [];
}

(async () => {
  const results = [];
  const screenshots = [];
  const consoleEvidence = [];
  const children = [];
  const check = (name, ok, detail) => {
    results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`);
  };
  const ev = async (client, expression) => {
    const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(`${client.label}: ${expression.slice(0, 100)} -> ${response.exceptionDetails.exception?.description || 'error'}`);
    return response.result.value;
  };
  const waitFor = async (client, expression, timeout = 20000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try { if (await ev(client, expression)) return true; } catch (error) {}
      await sleep(120);
    }
    return false;
  };
  const capture = async (client, file) => {
    const response = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(response.data, 'base64'));
    screenshots.push(file);
  };
  const key = async (client, name, code, vk, text) => {
    const base = { key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text } : {}) });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(35);
  };
  const tabUntil = async (client, predicateSource, max = 100) => {
    for (let index = 0; index < max; index += 1) {
      const active = await ev(client, `({id:document.activeElement?.id||'',tag:document.activeElement?.tagName||'',cls:String(document.activeElement?.className||'')})`);
      if (await ev(client, predicateSource)) return { found: true, steps: index, active };
      await key(client, 'Tab', 'Tab', 9);
    }
    return { found: false, steps: max, active: await ev(client, `({id:document.activeElement?.id||'',tag:document.activeElement?.tagName||''})`) };
  };

  for (let browserIndex = 0; browserIndex < BROWSERS.length; browserIndex += 1) {
    const browserInfo = BROWSERS[browserIndex];
    const port = 9400 + browserIndex;
    const profile = path.join(TEMP_ROOT, `profile-${browserInfo.name}-${Date.now()}`);
    let child = null;
    let browser = null;
    let client = null;
    try {
      child = spawn(browserInfo.exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, APP_URL], { stdio: 'ignore' });
      children.push(child);
      browser = await connect((await version(port)).webSocketDebuggerUrl, `${browserInfo.name}-browser`);
      const page = (await targets(port)).find((entry) => entry.type === 'page');
      if (!page) throw new Error(`${browserInfo.name}: no page target`);
      client = await connect(page.webSocketDebuggerUrl, browserInfo.name);
      await client.send('Runtime.enable');
      await client.send('Page.enable');
      await client.send('Network.enable');
      await client.send('Page.addScriptToEvaluateOnNewDocument', { source: ERROR_HOOK });
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor(client, READY)) throw new Error(`${browserInfo.name}: products did not render`);
      await ev(client, 'localStorage.clear();sessionStorage.clear();true');
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor(client, READY)) throw new Error(`${browserInfo.name}: products did not render after storage clear`);

      check(`${browserInfo.name}: clean load has no page errors`,
        (await ev(client, 'window.__errs.slice()')).length === 0,
        await ev(client, 'window.__errs.slice()'));

      for (const width of WIDTHS) {
        await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await sleep(200);
        for (const theme of THEMES) {
          await ev(client, `(()=>{const r=document.getElementById('theme-${theme}');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
          await sleep(160);
          const metrics = await ev(client, `(()=>{
            const visible=(element)=>{const r=element.getBoundingClientRect();const s=getComputedStyle(element);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight&&!element.classList.contains('sr-only')};
            const interactive=[...document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea,label[for]')].filter(visible);
            const target=(element)=>{
              if (element.matches('input') && element.closest('.search-field')) return element.closest('.search-field');
              if (element.matches('input[type=radio]') && element.nextElementSibling?.tagName === 'LABEL') return element.nextElementSibling;
              return element;
            };
            const small=interactive.map((element)=>{const t=target(element);const r=t.getBoundingClientRect();return {id:element.id||'',tag:element.tagName,cls:String(element.className||'').slice(0,60),target:t.className||t.tagName,w:Math.round(r.width),h:Math.round(r.height)}}).filter((entry)=>entry.w<44||entry.h<44);
            return {theme:document.documentElement.dataset.theme,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,interactiveCount:interactive.length,small};
          })()`);
          check(`${browserInfo.name}: ${width}px ${theme} no horizontal overflow`,
            !metrics.overflow && metrics.theme === theme, metrics);
          check(`${browserInfo.name}: ${width}px ${theme} touch targets >=44px`,
            metrics.small.length === 0, metrics.small);
          const contrast = await ev(client, `(()=>{
            const css=getComputedStyle(document.documentElement);
            const pairs=[['--text-primary','--bg-page'],['--text-secondary','--bg-surface'],['--text-muted','--bg-surface'],['--text-inverse','--color-primary']];
            const rgb=(value)=>{const v=value.trim();if(v.startsWith('#')){const h=v.slice(1);return [0,2,4].map((i)=>parseInt(h.slice(i,i+2),16))}const m=v.match(/[\\d.]+/g);return m?m.slice(0,3).map(Number):[0,0,0]};
            const lum=(value)=>{const [r,g,b]=rgb(value).map((n)=>{const x=n/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
            return pairs.map(([a,b])=>{const l1=lum(css.getPropertyValue(a)),l2=lum(css.getPropertyValue(b));const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);return {pair:a+' on '+b,ratio:Number(ratio.toFixed(2)),pass:ratio>=4.5}});
          })()`);
          check(`${browserInfo.name}: ${width}px ${theme} text contrast >=4.5:1`,
            contrast.every((entry) => entry.pass), contrast);
          await capture(client, `${browserInfo.name}-${width}-${theme}.png`);
        }
      }

      // Hamburger test starts after a reload so keyboard focus begins at the document start.
      await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor(client, READY)) throw new Error(`${browserInfo.name}: products did not render before menu test`);
      const menuTab = await tabUntil(client, "document.activeElement && document.activeElement.id === 'menu-toggle'", 30);
      check(`${browserInfo.name}: keyboard reaches hamburger at 320px`, menuTab.found, menuTab);
      await key(client, 'Enter', 'Enter', 13, '\r');
      await sleep(180);
      check(`${browserInfo.name}: hamburger opens with Enter`,
        (await ev(client, "document.getElementById('menu-toggle').getAttribute('aria-expanded')")) === 'true', {});
      await key(client, 'Escape', 'Escape', 27);
      await sleep(180);

      await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor(client, READY)) throw new Error(`${browserInfo.name}: products did not render before keyboard test`);
      await ev(client, `(()=>{const r=document.getElementById('theme-light');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
      await sleep(180);

      // Keyboard-only: reach the search field with Tab, type and submit without mouse events.
      const searchTab = await tabUntil(client, "document.activeElement && document.activeElement.id === 'search-input'", 80);
      check(`${browserInfo.name}: keyboard reaches search input`, searchTab.found, searchTab);
      for (const char of 'bag') {
        await key(client, char, `Key${char.toUpperCase()}`, char.toUpperCase().charCodeAt(0), char);
      }
      await sleep(500);
      await key(client, 'Enter', 'Enter', 13, '\r');
      await sleep(350);
      const searchResult = await ev(client, `({
        value:document.getElementById('search-input').value,
        count:document.getElementById('result-count').textContent,
        focus:document.activeElement?.id||''
      })`);
      check(`${browserInfo.name}: keyboard typing and Enter filter products`,
        searchResult.value === 'bag' && /1/.test(searchResult.count), searchResult);
      const focusStyle = await ev(client, `(()=>{
        const element=document.activeElement, s=getComputedStyle(element);
        const wrapper=element.closest('.search-field');
        const ws=wrapper?getComputedStyle(wrapper):null;
        return {id:element.id,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,searchFieldShadow:ws?ws.boxShadow:'',parentFocused:!!wrapper};
      })()`);
      check(`${browserInfo.name}: keyboard focus has visible outline or search-field ring`,
        (focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) > 0) ||
        (focusStyle.parentFocused && focusStyle.searchFieldShadow !== 'none'), focusStyle);

      await ev(client, `document.getElementById('search-input').value='';document.getElementById('search-input').dispatchEvent(new Event('input',{bubbles:true}));true`);
      await key(client, 'Enter', 'Enter', 13, '\r');
      await sleep(350);

      const addTab = await tabUntil(client, "document.activeElement && document.activeElement.id === 'btn-add-product'", 120);
      check(`${browserInfo.name}: keyboard reaches add-product button`, addTab.found, addTab);
      await key(client, 'Enter', 'Enter', 13, '\r');
      await sleep(200);
      check(`${browserInfo.name}: Enter opens the product dialog`,
        await ev(client, "document.getElementById('product-form-dialog').open"), {});
      await key(client, 'Escape', 'Escape', 27);
      await sleep(200);
      check(`${browserInfo.name}: Escape closes the product dialog`,
        !(await ev(client, "document.getElementById('product-form-dialog').open")), {});

      const aria = await ev(client, `({
        headerNav:!!document.querySelector('nav[aria-label]'),
        paginationNav:!!document.querySelector('#pagination[aria-label]'),
        viewPressed:document.getElementById('view-grid').getAttribute('aria-pressed')!==null && document.getElementById('view-table').getAttribute('aria-pressed')!==null,
        tableCaption:!!document.querySelector('#product-table caption'),
        tableScopedHeaders:document.querySelectorAll('#product-table th[scope="col"]').length,
        dialogLabelled:document.getElementById('product-form-dialog').hasAttribute('aria-labelledby') || document.getElementById('product-form-dialog').hasAttribute('aria-label'),
        iconLabels:[...document.querySelectorAll('button.btn-icon')].every((e)=>e.hasAttribute('aria-label'))
      })`);
      check(`${browserInfo.name}: ARIA landmarks, labels and table headers present`,
        Object.values(aria).every((value) => value === true || value >= 1), aria);

      const errs = await ev(client, 'window.__errs.slice()');
      check(`${browserInfo.name}: no unhandled errors after keyboard and responsive tests`, errs.length === 0, errs);
      consoleEvidence.push({ browser: browserInfo.name, errors: errs, console: client.consoleCalls.slice(-20) });
    } catch (error) {
      check(`${browserInfo.name}: harness completed`, false, { error: error.message });
    } finally {
      try { await browser?.send('Browser.close'); } catch (error) {}
      await Promise.race([new Promise((resolve) => { if (child) child.once('exit', resolve); else resolve(); }), sleep(5000)]);
      if (child && child.exitCode === null) child.kill();
    }
  }

  fs.writeFileSync(path.join(OUT, 'runtime-tests.json'), JSON.stringify({
    totals: { pass: results.filter((entry) => entry.status === 'PASS').length, fail: results.filter((entry) => entry.status === 'FAIL').length },
    failures: results.filter((entry) => entry.status === 'FAIL'),
    results
  }, null, 2));
  fs.writeFileSync(path.join(OUT, 'console-evidence.json'), JSON.stringify(consoleEvidence, null, 2));
  fs.writeFileSync(path.join(OUT, 'screenshots.json'), JSON.stringify(screenshots, null, 2));
  console.log(JSON.stringify({
    totals: { pass: results.filter((entry) => entry.status === 'PASS').length, fail: results.filter((entry) => entry.status === 'FAIL').length },
    failures: results.filter((entry) => entry.status === 'FAIL')
  }, null, 2));
})();

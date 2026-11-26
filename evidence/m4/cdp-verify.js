const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-verify-' + Date.now();
const PORT = 9366;
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
      },
      close() { ws.close(); }
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
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__errs=[]; window.addEventListener('error',e=>__errs.push(String(e.message))); window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));`
    });

    const ev = async expression => {
      const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(expression.slice(0,90) + ' -> ' + (r.exceptionDetails.exception?.description||'error'));
      return r.result.value;
    };
    const click = async (x, y) => {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    const pt = async selector => ev(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    const clickSel = async selector => { const p = await pt(selector); if (p) await click(p.x, p.y); return !!p; };

    const report = {};
    for (const w of [320, 768, 1280]) {
      await c.send('Emulation.setDeviceMetricsOverride', { width:w, height:900, deviceScaleFactor:1, mobile:false });
      await c.send('Page.reload', { ignoreCache:true });
      await sleep(1800);
      const R = {};

      R.load = await ev(`({cards:document.querySelectorAll('#product-grid .card').length, chips:document.querySelectorAll('#category-chips li').length, errs:window.__errs})`);

      R.hit = await ev(`(() => {
        const sel='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
        const els=[...document.querySelectorAll(sel)].filter(e=>!e.closest('.skip-link')&&!e.closest('dialog:not([open])'));
        const bad=[]; let checked=0;
        for(const e of els){
          const cs=getComputedStyle(e);
          if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) continue;
          const r=e.getBoundingClientRect(); if(!r.width||!r.height) continue;
          e.scrollIntoView({block:'center',behavior:'instant'});
          const rr=e.getBoundingClientRect(); const x=rr.left+rr.width/2,y=rr.top+rr.height/2;
          if(x<0||y<0||x>innerWidth||y>innerHeight) continue;
          checked++;
          const hit=document.elementFromPoint(x,y);
          if(!hit||!(hit===e||e.contains(hit)||hit.contains(e))) bad.push(e.id||String(e.className||e.tagName).slice(0,40)+' <- '+(hit?.className||hit?.tagName));
        }
        return {checked,bad};
      })()`);

      // بحث بحركة فأرة حقيقية
      await clickSel('#search-input');
      await c.send('Input.insertText', { text:'backpack' }); await sleep(600);
      R.search = await ev(`({value:document.getElementById('search-input').value, cards:document.querySelectorAll('#product-grid .card').length, focused:document.activeElement?.id})`);
      await ev(`(()=>{const s=document.getElementById('search-input');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`); await sleep(500);

      // ترتيب محلي
      await clickSel('#sort-select');
      R.sortFocus = await ev(`document.activeElement?.id||''`);
      const pricesBefore = await ev(`[...document.querySelectorAll('#product-grid .price')].map(e=>parseFloat(e.textContent.replace(/[^0-9.]/g,''))).slice(0,5)`);
      await ev(`(()=>{const s=document.getElementById('sort-select');s.value='price-desc';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`); await sleep(500);
      const pricesAfter = await ev(`[...document.querySelectorAll('#product-grid .price')].map(e=>parseFloat(e.textContent.replace(/[^0-9.]/g,''))).slice(0,5)`);
      R.sort = { before:pricesBefore, after:pricesAfter, descending:pricesAfter.every((v,i,a)=>i===0||a[i-1]>=v) };
      await ev(`(()=>{const s=document.getElementById('sort-select');s.value='default';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`); await sleep(400);

      // limit + id sort (معاملات الـ API)
      await clickSel('#limit-select'); R.limitFocus = await ev(`document.activeElement?.id||''`);
      await ev(`(()=>{const s=document.getElementById('limit-select');s.value='5';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`); await sleep(700);
      R.limit = await ev(`({url:document.getElementById('request-url').textContent, cards:document.querySelectorAll('#product-grid .card').length})`);
      await clickSel('#id-sort-select'); R.idSortFocus = await ev(`document.activeElement?.id||''`);
      await ev(`(()=>{const s=document.getElementById('id-sort-select');s.value='desc';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`); await sleep(700);
      R.idSort = await ev(`document.getElementById('request-url').textContent`);
      await ev(`(()=>{const l=document.getElementById('limit-select');l.value='20';l.dispatchEvent(new Event('change',{bubbles:true}));const s=document.getElementById('id-sort-select');s.value='asc';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`); await sleep(800);

      // شريحة فئة
      await clickSel('#category-chips button[data-category="electronics"]'); await sleep(1000);
      R.chip = await ev(`({active:document.querySelector('.chip-active')?.dataset.category, url:document.getElementById('request-url').textContent, cards:document.querySelectorAll('#product-grid .card').length})`);
      await clickSel('#category-chips button[data-category="all"]'); await sleep(900);

      // بطاقة: تفاصيل + مفضلة + إضافة
      await clickSel('#product-grid .card-media'); await sleep(250);
      R.detail = await ev(`document.getElementById('product-dialog').open`);
      await ev(`document.getElementById('product-dialog').close()`); await sleep(150);
      await clickSel('#product-grid .btn-fav'); await sleep(250);
      R.fav = await ev(`({pressed:document.querySelector('#product-grid .btn-fav')?.getAttribute('aria-pressed'),count:document.getElementById('fav-count').textContent})`);
      await clickSel('#product-grid .add-btn'); await sleep(250);
      R.cart = await ev(`({count:document.getElementById('cart-count').textContent,label:document.querySelector('#product-grid .add-btn')?.textContent.trim()})`);

      // هيدر — M3.3: على الشاشات الضيقة نفتح قائمة الهامبرغر أولاً.
      const menuVisible = await ev(`getComputedStyle(document.getElementById('menu-toggle')).display !== 'none'`);
      if (menuVisible) { await clickSel('#menu-toggle'); await sleep(200); }
      R.menu = await ev(`({expanded:document.getElementById('menu-toggle').getAttribute('aria-expanded'),panel:getComputedStyle(document.getElementById('header-actions')).display})`);

      const themeBefore = await ev(`document.documentElement.dataset.theme`);
      const themeTarget = themeBefore === 'dark' ? 'light' : 'dark';
      const themePoint = await pt(`label[for="theme-${themeTarget}"]`);
      const themeHit = themePoint && await ev(`(()=>{const e=document.elementFromPoint(${themePoint.x},${themePoint.y});return e?(e.tagName+'.'+String(e.className)).slice(0,70):null})()`);
      await clickSel(`label[for="theme-${themeTarget}"]`); await sleep(250);
      R.theme = { before:themeBefore, after:await ev(`document.documentElement.dataset.theme`), target:themeTarget, point:themePoint, hit:themeHit, expanded:await ev(`document.getElementById('menu-toggle').getAttribute('aria-expanded')`) };
      await clickSel('#btn-login'); await sleep(250);
      R.loginDialog = await ev(`document.getElementById('login-dialog').open`);
      await ev(`document.getElementById('login-dialog').close()`); await sleep(100);
      await clickSel('#btn-cart'); await sleep(250);
      R.cartDialog = await ev(`document.getElementById('cart-dialog').open`);
      await ev(`document.getElementById('cart-dialog').close()`); await sleep(100);

      // skip-link بالكيبورد
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      R.skipFirst = await ev(`document.activeElement?.className||''`);
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await sleep(200);
      R.skipHash = await ev(`location.hash`);

      R.overflow = await ev(`({scrollWidth:document.documentElement.scrollWidth, innerWidth})`);
      R.finalErrs = await ev(`window.__errs`);
      report[w] = R;
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (c) c.close();
    child.kill('SIGKILL');
    try { fs.rmSync(PROFILE, { recursive:true, force:true }); } catch (e) {}
  }
})().catch(e => { console.error(e); process.exit(1); });

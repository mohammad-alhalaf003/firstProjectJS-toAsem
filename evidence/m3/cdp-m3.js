const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m3-' + Date.now();
const PORT = 9372;
const URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function endpoint() {
  for (let i=0;i<80;i++) { try { const r=await fetch(`http://127.0.0.1:${PORT}/json`); if(r.ok) return await r.json(); } catch(e){} await sleep(150); }
  throw new Error('CDP endpoint timeout');
}
function connect(url) {
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(url); let id=1; const pending=new Map();
    ws.onopen=()=>resolve({
      send(method,params={}) { const n=id++; return new Promise((res,rej)=>{ pending.set(n,{res,rej}); ws.send(JSON.stringify({id:n,method,params})); }); },
      close(){ ws.close(); }
    });
    ws.onerror=reject;
    ws.onmessage=e=>{ const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); } };
  });
}

(async()=>{
  const child=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,`--user-data-dir=${PROFILE}`,URL],{stdio:'ignore'});
  let c;
  try {
    const targets=await endpoint();
    c=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await c.send('Runtime.enable'); await c.send('Page.enable');
    const ev=async expression=>{
      const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(r.exceptionDetails) throw new Error(expression.slice(0,120)+' -> '+(r.exceptionDetails.exception?.description||'error'));
      return r.result.value;
    };
    const click=async(x,y)=>{
      await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
      await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
      await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    };
    const pt=async(sel)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()`);
    const clickSel=async sel=>{const p=await pt(sel); if(p) await click(p.x,p.y); return !!p;};
    const reload=async()=>{ await c.send('Page.reload',{ignoreCache:true}); await sleep(1600); };
    const media=features=>c.send('Emulation.setEmulatedMedia',{features});
    const report={ widths:{}, static:{}, firstVisit:{}, motion:{}, hover:{} };

    /* ---------- M3.1 / M3.2 فحص ثابت للـ CSS ----------
       ملاحظة حقيقية: chrome يمنع cssRules لملف file:// (SecurityError)،
       لذلك نقرأ النص من القرص ونحلّله في Node بدل CSSOM. */
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await reload();
    {
      const css=fs.readFileSync('C:\\projects\\firstProjectJS-toAsem\\style.css','utf8');
      const token=name=>{const m=css.match(new RegExp('--'+name+':\\s*(\\d+(?:\\.\\d+)?)ms'));return m?Number(m[1]):null;};
      const tokens={fast:token('fast'),normal:token('normal'),bounce:token('bounce')};
      const durations=new Set();
      for (const m of css.matchAll(/transition:\s*([^;}]+)/g)) {
        let text=m[1];
        for (const [name,ms] of Object.entries(tokens)) text=text.split('var(--'+name+')').join(ms+'ms');
        for (const d of text.matchAll(/(\d+(?:\.\d+)?)ms/g)) durations.add(Number(d[1]));
      }
      const lines=css.split(/\r?\n/);
      let inHover=false, hoverTotal=0, hoverOutside=[];
      for (const raw of lines) {
        const line=raw.trim();
        if (line.startsWith('/*')||line.startsWith('*')) continue;
        if (line.startsWith('@media (hover: hover)')) { inHover=true; continue; }
        if (inHover && line==='}') { inHover=false; continue; }
        if (line.includes(':hover')) { hoverTotal++; if(!inHover) hoverOutside.push(line.slice(0,70)); }
      }
      report.static={
        transitionDurations:[...durations].sort((a,b)=>a-b),
        hoverRulesTotal:hoverTotal,
        hoverOutsideMedia:hoverOutside,
        keyframes:[...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m=>m[1]),
        focusVisibleRule:/:focus-visible\s*\{/.test(css),
        reducedMotionBlocks:(css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)||[]).length,
        tokens
      };
    }

    /* ---------- M3.3 / M3.4 / M3.5 لكل عرض ---------- */
    for (const w of [320,768,1280]) {
      const R={};
      await c.send('Emulation.setDeviceMetricsOverride',{width:w,height:900,deviceScaleFactor:1,mobile:false});
      await reload();
      R.meta = await ev(`document.querySelector('meta[name=viewport]').content`);
      R.headerSticky = await ev(`getComputedStyle(document.querySelector('.app-header')).position`);
      R.stickyAfterScroll = await ev(`(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:1200,behavior:'instant'});const r=document.querySelector('.app-header').getBoundingClientRect();return {scrollY:Math.round(scrollY),top:Math.round(r.top)}})()`);
      R.overflow = await ev(`({scrollWidth:document.documentElement.scrollWidth,innerWidth})`);
      await ev(`scrollTo({top:0,behavior:'instant'});document.getElementById('toast-container').replaceChildren();true`);

      const toggleVisible = await ev(`getComputedStyle(document.getElementById('menu-toggle')).display!=='none'`);
      R.menu={toggleVisible};
      if (toggleVisible) {
        await clickSel('#menu-toggle'); await sleep(200);
        R.menu.opened = await ev(`({expanded:document.getElementById('menu-toggle').getAttribute('aria-expanded'),panel:getComputedStyle(document.getElementById('header-actions')).display,bodyClass:document.body.classList.contains('menu-open'),scrollWidth:document.documentElement.scrollWidth,innerWidth})`);
        await clickSel('#menu-toggle'); await sleep(200);
        R.menu.closedByToggle = await ev(`document.getElementById('menu-toggle').getAttribute('aria-expanded')`);
        await clickSel('#menu-toggle'); await sleep(200);
        await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await sleep(200);
        R.menu.closedByEscape = await ev(`document.getElementById('menu-toggle').getAttribute('aria-expanded')`);
        await clickSel('#menu-toggle'); await sleep(200);
        await click(w/2, 700); await sleep(200);
        R.menu.closedByOutside = await ev(`document.getElementById('menu-toggle').getAttribute('aria-expanded')`);
      } else {
        R.menu.panelWide = await ev(`getComputedStyle(document.getElementById('header-actions')).display`);
      }

      if (toggleVisible) { await clickSel('#menu-toggle'); await sleep(200); }
      R.touchTargets = await ev(`(()=>{
        const sels=['#menu-toggle','#btn-cart','#btn-login',
          'label[for="theme-light"]','label[for="theme-dark"]','label[for="theme-ocean"]',
          'label[for="lang-both"]','label[for="lang-ar"]','label[for="lang-en"]',
          '.search-field','#sort-select','#limit-select','#id-sort-select','#btn-favorites','.chip'];
        const bad=[],seen=new Set();
        for (const s of sels) for (const e of document.querySelectorAll(s)) {
          if (seen.has(e)) continue; seen.add(e);
          // الراديو المخفي بصرياً ليس هدف لمس؛ الـ label هو الهدف ويُقاس بدلاً منه.
          if (e.matches('input[type=radio]')) continue;
          const r=e.getBoundingClientRect();
          if (r.width===0||r.height===0) continue;
          if (r.width<44||r.height<44) bad.push(s+':'+Math.round(r.width)+'x'+Math.round(r.height));
        }
        return {checked:seen.size,bad};
      })()`);

      // focus-visible حقيقي بالكيبورد
      await ev(`document.activeElement.blur();scrollTo({top:0,behavior:'instant'});true`);
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      R.focusVisible = await ev(`({tag:document.activeElement.tagName,visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineWidth})`);

      // hover و active و disabled بفأرة حقيقية + حالة معطّلة
      const cartPoint = await pt('#btn-cart');
      await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:cartPoint.x,y:cartPoint.y}); await sleep(120);
      const hoverTransform = await ev(`getComputedStyle(document.getElementById('btn-cart')).transform`);
      await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:cartPoint.x,y:cartPoint.y,button:'left',clickCount:1}); await sleep(120);
      const activeTransform = await ev(`getComputedStyle(document.getElementById('btn-cart')).transform`);
      await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:cartPoint.x,y:cartPoint.y,button:'left',clickCount:1});
      await ev(`document.getElementById('cart-dialog').close();document.getElementById('toast-container').replaceChildren();true`);
      const disabledState = await ev(`(()=>{const b=document.getElementById('btn-cart');b.disabled=true;const d=getComputedStyle(b);const out={cursor:d.cursor,opacity:d.opacity};b.disabled=false;return out})()`);
      R.states = { hoverTransform, activeTransform, disabled: disabledState };

      // الثلاث ثيمات من نفس المتغيرات
      const themes=[];
      for (const t of ['light','dark','ocean']) {
        await clickSel(`label[for="theme-${t}"]`); await sleep(320);
        themes.push(await ev(`(()=>{const r=getComputedStyle(document.documentElement);const s=getComputedStyle(document.querySelector('.card'));return {theme:document.documentElement.dataset.theme,stored:JSON.parse(localStorage.getItem('storepulse_theme')),meta:document.querySelector('meta[name=theme-color]').content,primary:r.getPropertyValue('--color-primary').trim(),surface:s.backgroundColor,checked:document.querySelector('input[name=shop-theme]:checked').value}})()`));
      }
      R.themes=themes;

      await ev(`document.getElementById('toast-container').replaceChildren();true`);
      // تباين الثيمات الثلاثة
      R.contrast = await ev(`(async ()=>{
        const lum=str=>{const m=str.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*m[0]+.7152*m[1]+.0722*m[2]};
        const ratio=(a,b)=>{const x=lum(a),y=lum(b);return +(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2))};
        const out={};const root=document.documentElement;
        for(const t of ['light','dark','ocean']){
          root.setAttribute('data-theme',t);
          await new Promise(r=>setTimeout(r,350)); // ننتظر انتهاء transition 240ms قبل القراءة
          const b=getComputedStyle(document.body),card=getComputedStyle(document.querySelector('.card')),btn=getComputedStyle(document.querySelector('.btn-primary'));
          out[t]={text:ratio(b.color,card.backgroundColor),button:ratio(btn.color,btn.backgroundColor)};
        }
        root.setAttribute('data-theme','light');
        return out;
      })()`);
      report.widths[w]=R;
    }

    /* ---------- M3.4 الزيارة الأولى ---------- */
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    for (const pref of ['dark','light']) {
      await media([{name:'prefers-color-scheme',value:pref}]);
      await ev(`localStorage.clear();true`);
      await reload(); await sleep(300);
      await sleep(500);
      report.firstVisit[pref]=await ev(`({theme:document.documentElement.dataset.theme,stored:localStorage.getItem('storepulse_theme'),keys:Object.keys(localStorage),pref:matchMedia('(prefers-color-scheme: dark)').matches})`);
    }
    await ev(`localStorage.setItem('storepulse_theme',JSON.stringify('ocean'));true`);
    await media([{name:'prefers-color-scheme',value:'light'}]);
    await reload();
    report.firstVisit.savedOceanAfterReload=await ev(`document.documentElement.dataset.theme`);
    await media([]);

    /* ---------- M3.2 تقليل الحركة ---------- */
    await media([{name:'prefers-reduced-motion',value:'reduce'}]);
    report.motion.reduced = await ev(`(()=>{
      const d=document.createElement('div');d.className='skeleton-img';document.body.append(d);
      const a=getComputedStyle(d,'::after'),sp=document.createElement('span');sp.className='btn-spinner';document.body.append(sp);
      const b=getComputedStyle(sp);const out={pseudoAnimation:a.animationName,pseudoDuration:a.animationDuration,spinnerAnimation:b.animationName};
      d.remove();sp.remove();return out;
    })()`);
    await media([]);
    report.motion.normal = await ev(`(()=>{const d=document.createElement('div');d.className='skeleton-img';document.body.append(d);const a=getComputedStyle(d,'::after');const out={pseudoAnimation:a.animationName,pseudoDuration:a.animationDuration};d.remove();return out})()`);

    /* ---------- M3.1 hover فقط حيث يوجد ---------- */
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    await sleep(300);
    report.hover.touch = await ev(`({hoverFine:matchMedia('(hover: hover) and (pointer: fine)').matches,hoverNone:matchMedia('(hover: none)').matches,coarse:matchMedia('(pointer: coarse)').matches,btnMinHeight:getComputedStyle(document.querySelector('.btn')).minHeight})`);
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await sleep(300);
    report.hover.mouse = await ev(`({hoverFine:matchMedia('(hover: hover) and (pointer: fine)').matches})`);

    console.log(JSON.stringify(report,null,2));
  } finally {
    if(c)c.close();
    child.kill('SIGKILL');
    try{fs.rmSync(PROFILE,{recursive:true,force:true})}catch(e){}
  }
})().catch(e=>{console.error(e);process.exit(1)});

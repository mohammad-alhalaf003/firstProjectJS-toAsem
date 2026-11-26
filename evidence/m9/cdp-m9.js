const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m9-' + Date.now();
const PORT = 9384;
const APP_URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const API_URL = 'file:///C:/projects/firstProjectJS-toAsem/api.html';
const OUT = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\m9';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(OUT, { recursive: true });

// EN: Never write credential values to evidence. AR: لا تُكتب قيم بيانات الدخول في الأدلة.
function redact(value) {
  if (typeof value === 'string') {
    return value
      .replace(/("?(?:password|token|authorization|username)"?\s*[:=]\s*"?)[^",}\s]+/gi, '$1[redacted]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
      .replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted-token]');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /^(password|token|authorization|username|storepulse_token|storepulse_username)$/i.test(key) ? '[redacted]' : redact(item)
    ]));
  }
  return value;
}

const ERROR_HOOK = [
  'window.__errs=[];',
  "window.addEventListener('error',e=>__errs.push(String(e.message)));",
  "window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));"
].join('');

const DENY_STORAGE_HOOK = [
  ERROR_HOOK,
  "Storage.prototype.getItem=function(){throw new Error('storage blocked')};",
  "Storage.prototype.setItem=function(){throw new Error('storage blocked')};",
  "Storage.prototype.removeItem=function(){throw new Error('storage blocked')};"
].join('');

const PRODUCTS_READY = `(()=>{
  const grid=document.getElementById('product-grid');
  const rows=document.getElementById('product-table-body');
  return !!grid && !grid.hasAttribute('aria-busy') &&
    (grid.querySelectorAll('.card').length + (rows ? rows.querySelectorAll('tr').length : 0)) > 0 &&
    document.getElementById('state-box').hidden;
})()`;

const STATE_SNAPSHOT_JS = `(()=>{
  const read=(store,key)=>{try{return JSON.parse(store.getItem(key)||'null')}catch(e){return '[invalid JSON]'}};
  const cart=read(localStorage,'storepulse_cart');
  const fav=read(localStorage,'storepulse_favorites');
  const recent=read(localStorage,'storepulse_recent_searches');
  const input=document.getElementById('search-input');
  return {
    theme:document.documentElement.dataset.theme||'',
    favoriteIds:Array.isArray(fav)?fav.slice():null,
    cartIds:Array.isArray(cart)?cart.map(item=>item&&item.productId):null,
    cartQuantities:Array.isArray(cart)?cart.map(item=>item&&item.quantity):null,
    recentCount:Array.isArray(recent)?recent.length:0,
    recentTerms:Array.isArray(recent)?recent.slice():null,
    view:read(localStorage,'storepulse_view_mode'),
    pageSize:read(localStorage,'storepulse_page_size'),
    filters:read(sessionStorage,'storepulse_filters'),
    currentPage:read(sessionStorage,'storepulse_current_page'),
    tokenPresent:sessionStorage.getItem('storepulse_token')!==null,
    usernamePresent:sessionStorage.getItem('storepulse_username')!==null,
    draftPresent:sessionStorage.getItem('storepulse_product_draft')!==null,
    searchInput:input?input.value:'',
    currentUrl:document.getElementById('request-url')?.textContent||'',
    pageStatus:document.getElementById('page-status')?.innerText||''
  };
})()`;

async function version() {
  for (let index = 0; index < 120; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return await response.json();
    } catch (error) {}
    await sleep(150);
  }
  throw new Error('CDP version endpoint not ready');
}

async function targets() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return response.ok ? response.json() : [];
}

function connect(url, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 1;
    const pending = new Map();
    const consoleCalls = [];
    const requests = new Map();
    const responses = new Map();

    ws.onopen = () => resolve({
      label,
      consoleCalls,
      requests,
      responses,
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
        consoleCalls.push({
          tab: label,
          type: message.params.type,
          args: message.params.args.map((arg) => arg.value ?? arg.description ?? null),
          timestamp: message.params.timestamp
        });
      }
      if (message.method === 'Network.requestWillBeSent' && String(message.params.request.url).includes('fakestoreapi.com')) {
        const headers = message.params.request.headers || {};
        requests.set(message.params.requestId, {
          tab: label,
          url: message.params.request.url,
          method: message.params.request.method,
          headers: redact(headers),
          bearerSent: /^Bearer\s+\S+$/.test(headers.authorization || headers.Authorization || ''),
          postData: redact(message.params.request.postData || ''),
          timestamp: message.params.timestamp
        });
      }
      if (message.method === 'Network.responseReceived' && String(message.params.response.url).includes('fakestoreapi.com')) {
        responses.set(message.params.requestId, {
          status: message.params.response.status,
          statusText: message.params.response.statusText,
          mimeType: message.params.response.mimeType,
          headers: redact(message.params.response.headers || {})
        });
      }
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        message.error ? entry.rej(new Error(JSON.stringify(message.error))) : entry.res(message.result);
      }
    };
  });
}

(async () => {
  let child = null;
  let browser = null;
  const tabs = [];
  const results = [];
  const snapshots = [];
  const pageErrors = [];
  const allConsole = [];

  const check = (name, ok, detail) => {
    results.push({ name, status: ok ? 'PASS' : 'FAIL', detail: redact(detail) });
    if (!ok) console.error(`FAIL ${name}: ${JSON.stringify(redact(detail))}`);
  };
  const ev = async (client, expression) => {
    const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) {
      throw new Error(`${client.label}: ${expression.slice(0, 120)} -> ${response.exceptionDetails.exception?.description || 'error'}`);
    }
    return response.result.value;
  };
  const waitFor = async (client, expression, timeout = 18000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try { if (await ev(client, expression)) return true; } catch (error) {}
      await sleep(120);
    }
    return false;
  };
  const reloadReady = async (client) => {
    await client.send('Page.reload', { ignoreCache: true });
    if (!await waitFor(client, PRODUCTS_READY, 22000)) throw new Error(`${client.label}: products did not render after reload`);
    if (!await waitFor(client, "document.querySelectorAll('#category-chips button').length === 5", 12000)) {
      throw new Error(`${client.label}: categories did not render after reload`);
    }
  };
  const click = async (client, selector) => ev(client, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`);
  const setField = async (client, id, value) => ev(client, `(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const setSelect = async (client, id, value) => ev(client, `(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const setRadio = async (client, name, value) => ev(client, `(()=>{const e=document.querySelector('input[name=${JSON.stringify(name)}][value=${JSON.stringify(value)}]');if(!e)return false;e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const pressEnter = async (client, selector) => ev(client, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));return true})()`);
  const submit = async (client, formId) => ev(client, `document.getElementById(${JSON.stringify(formId)}).dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));true`);
  const errors = async (client) => {
    let list;
    try { list = await ev(client, 'window.__errs.slice()'); } catch (error) { list = [`unreachable tab: ${error.message}`]; }
    client.__collectedErrors = Array.isArray(list) ? list : [String(list)];
    return client.__collectedErrors;
  };
  const collect = (client) => {
    if (Array.isArray(client.__collectedErrors)) pageErrors.push(...client.__collectedErrors);
    allConsole.push(...client.consoleCalls.map((entry) => ({ tab: client.label, ...entry })));
    client.__collected = true;
  };
  const capture = async (client, file) => {
    const response = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(response.data, 'base64'));
  };
  // يخفي اسم المستخدم في اللقطات التي تُؤخذ بعد الدخول دون تغيير حالة التطبيق.
  const captureRedactingUser = async (client, file) => {
    const original = await ev(client, "document.getElementById('login-label') ? document.getElementById('login-label').innerHTML : null");
    if (typeof original !== 'string') return capture(client, file);
    await ev(client, "(()=>{const e=document.getElementById('login-label');if(e)e.textContent='[redacted]';return true})()");
    try {
      await capture(client, file);
    } finally {
      await ev(client, `(()=>{const e=document.getElementById('login-label');if(e)e.innerHTML=${JSON.stringify(original)};return true})()`);
    }
  };
  const storage = async (client) => ev(client, `(()=>{
    const dump=(store)=>Object.fromEntries(Object.keys(store).sort().map(key=>[key,store.getItem(key)]));
    return {localStorage:dump(localStorage),sessionStorage:dump(sessionStorage)};
  })()`);
  const snapshot = async (client, label) => {
    const raw = await storage(client);
    const shape = (box) => Object.fromEntries(Object.entries(box).map(([key, value]) => {
      let kind = 'string';
      try {
        const parsed = JSON.parse(value);
        kind = Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed;
      } catch (error) {}
      return [key, { kind, length: String(value).length }];
    }));
    const selected = await ev(client, STATE_SNAPSHOT_JS);
    snapshots.push({
      tab: client.label,
      label,
      keys: { localStorage: Object.keys(raw.localStorage), sessionStorage: Object.keys(raw.sessionStorage) },
      shape: { localStorage: shape(raw.localStorage), sessionStorage: shape(raw.sessionStorage) },
      selected: redact(selected)
    });
  };
  const enablePage = async (client, source = ERROR_HOOK) => {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Network.enable');
    const hook = await client.send('Page.addScriptToEvaluateOnNewDocument', { source });
    client.hookId = hook.identifier;
    return client;
  };
  const launch = async () => {
    child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-session-crashed-bubble', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, APP_URL], { stdio: 'ignore' });
    browser = await connect((await version()).webSocketDebuggerUrl, 'browser');
    const page = (await targets()).find((target) => target.type === 'page');
    if (!page) throw new Error('No page target after Chrome launch');
    const client = await connect(page.webSocketDebuggerUrl, 'main');
    await enablePage(client);
    client.targetId = page.id;
    tabs.push(client);
    return client;
  };
  const openTab = async (label, url = APP_URL, readyExpression = PRODUCTS_READY) => {
    const created = await browser.send('Target.createTarget', { url: 'about:blank' });
    let target = null;
    for (let index = 0; index < 60; index += 1) {
      target = (await targets()).find((entry) => entry.id === created.targetId);
      if (target) break;
      await sleep(100);
    }
    if (!target) throw new Error('New tab target not found');
    const client = await connect(target.webSocketDebuggerUrl, label);
    await enablePage(client);
    client.targetId = created.targetId;
    tabs.push(client);
    await client.send('Page.navigate', { url });
    if (!await waitFor(client, readyExpression, 22000)) throw new Error(`${label}: ready expression did not become true`);
    if (url === APP_URL && !await waitFor(client, "document.querySelectorAll('#category-chips button').length === 5", 12000)) {
      throw new Error(`${label}: categories did not render`);
    }
    return client;
  };
  const closeBrowser = async () => {
    try { await browser.send('Browser.close'); } catch (error) {}
    await Promise.race([
      new Promise((resolve) => { if (child) child.once('exit', resolve); else resolve(); }),
      sleep(6000)
    ]);
    if (child && child.exitCode === null) child.kill();
  };
  const commitSearch = async (client, term) => {
    await setField(client, 'search-input', term);
    await pressEnter(client, '#search-input');
  };

  let main = null;
  try {
    main = await launch();
    await main.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await ev(main, 'localStorage.clear();sessionStorage.clear();true');
    await reloadReady(main);

    // 9.1/9.2 — old project keys and invalid JSON must not break startup.
    await ev(main, `(()=>{
      localStorage.setItem('storepulse_shop_lang', JSON.stringify('ar'));
      localStorage.setItem('storepulse_orders', JSON.stringify([{id:1}]));
      localStorage.setItem('storepulse_api_lang', JSON.stringify('en'));
      localStorage.setItem('other_site_data', JSON.stringify('keep-me'));
      sessionStorage.setItem('storepulse_orders', JSON.stringify([{id:2}]));
      sessionStorage.setItem('storepulse_legacy', JSON.stringify('x'));
      localStorage.setItem('storepulse_cart', '{broken json');
      sessionStorage.setItem('storepulse_filters', '{broken json');
      sessionStorage.setItem('storepulse_product_draft', 'not json');
      return true;
    })()`);
    await reloadReady(main);
    const cleanupKeys = await ev(main, `({localStorage:Object.keys(localStorage).sort(),sessionStorage:Object.keys(sessionStorage).sort()})`);
    check('legacy language and orders keys removed from both boxes',
      !cleanupKeys.localStorage.includes('storepulse_shop_lang') &&
      !cleanupKeys.localStorage.includes('storepulse_orders') &&
      !cleanupKeys.localStorage.includes('storepulse_api_lang') &&
      !cleanupKeys.sessionStorage.includes('storepulse_orders') &&
      !cleanupKeys.sessionStorage.includes('storepulse_legacy'), cleanupKeys);
    check('unrelated site data not deleted', cleanupKeys.localStorage.includes('other_site_data'), cleanupKeys);
    const invalidJsonFallback = await ev(main, `({
      ready:${PRODUCTS_READY},
      search:document.getElementById('search-input').value,
      sort:document.getElementById('sort-select').value,
      limit:document.getElementById('limit-select').value,
      idSort:document.getElementById('id-sort-select').value,
      theme:document.documentElement.dataset.theme
    })`);
    check('invalid JSON falls back to safe defaults without crashing',
      invalidJsonFallback.ready && invalidJsonFallback.search === '' && invalidJsonFallback.sort === 'default' &&
      invalidJsonFallback.limit === '20' && invalidJsonFallback.idSort === 'asc' &&
      (await errors(main)).length === 0, invalidJsonFallback);
    await ev(main, "localStorage.removeItem('other_site_data');true");
    await snapshot(main, 'legacy-cleanup-and-invalid-json');

    // 9.2 — Storage itself can throw; the app must continue with defaults.
    const denyHook = await main.send('Page.addScriptToEvaluateOnNewDocument', { source: DENY_STORAGE_HOOK });
    await reloadReady(main);
    const deniedState = await ev(main, `({
      ready:${PRODUCTS_READY},
      theme:document.documentElement.dataset.theme,
      search:document.getElementById('search-input').value,
      sort:document.getElementById('sort-select').value
    })`);
    check('unavailable Storage does not crash the app',
      deniedState.ready && ['light', 'dark'].includes(deniedState.theme) && deniedState.search === '' &&
      deniedState.sort === 'default' && (await errors(main)).length === 0, deniedState);
    await main.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: denyHook.identifier });
    await reloadReady(main);
    await ev(main, 'localStorage.clear();sessionStorage.clear();true');
    await reloadReady(main);

    // M9 recent searches: no per-keystroke writes, max 5, duplicate handling, clear, reuse.
    await ev(main, `(async()=>{const input=document.getElementById('search-input');for(const ch of 'abcdef'){input.value+=ch;input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,45));}return true})()`);
    await sleep(520);
    check('typing does not save recent searches',
      !(await ev(main, "!!localStorage.getItem('storepulse_recent_searches')")) &&
      (await ev(main, 'StorePulseSearchStats.inputEvents')) >= 6,
      { inputEvents: await ev(main, 'StorePulseSearchStats.inputEvents') });
    await commitSearch(main, '   ');
    check('empty search is not saved', !(await ev(main, "!!localStorage.getItem('storepulse_recent_searches')")), {});
    for (const term of ['bag', 'watch', 'ring', 'jeans', 'hat', 'shirt']) await commitSearch(main, term);
    const capped = await ev(main, "JSON.parse(localStorage.getItem('storepulse_recent_searches')||'[]')");
    check('only last five searches are kept, newest first',
      capped.length === 5 && capped.join(',') === 'shirt,hat,jeans,ring,watch', { capped });
    await commitSearch(main, 'bag');
    const deduped = await ev(main, "JSON.parse(localStorage.getItem('storepulse_recent_searches')||'[]')");
    check('duplicate search moves to top without growing the list',
      deduped.length === 5 && deduped[0] === 'bag' && deduped.filter((term) => term === 'bag').length === 1, { deduped });
    const recentButtons = await ev(main, "[...document.querySelectorAll('#recent-searches-list button[data-search]')].map(b=>({text:b.textContent,label:b.getAttribute('aria-label')}))");
    check('recent searches are displayed clearly as reusable buttons',
      recentButtons.length === 5 && recentButtons.every((entry) => entry.text && /Search again/.test(entry.label)), { recentButtons });
    await click(main, '#recent-searches-list button[data-search="hat"]');
    check('clicking a recent search reuses it',
      (await ev(main, "document.getElementById('search-input').value")) === 'hat' &&
      (await ev(main, "JSON.parse(localStorage.getItem('storepulse_recent_searches')||'[]')[0]")) === 'hat', {});
    await click(main, '#btn-clear-recent');
    check('Clear removes recent searches and hides the box',
      !(await ev(main, "!!localStorage.getItem('storepulse_recent_searches')")) &&
      (await ev(main, "document.getElementById('recent-searches-box').hidden")), {});
    await snapshot(main, 'recent-search-limit-and-reuse');

    // Build one complete mapped state for all lifecycle checks.
    await ev(main, 'localStorage.clear();sessionStorage.clear();true');
    await reloadReady(main);
    for (const term of ['watch', 'ring', 'jeans', 'hat', 'shirt']) await commitSearch(main, term);
    await commitSearch(main, '');
    if (!await waitFor(main, PRODUCTS_READY, 12000)) throw new Error('clearing recent-search filter did not restore the grid');
    await setRadio(main, 'shop-theme', 'ocean');
    await click(main, '#product-grid .card[data-id="1"] [data-action="favorite"]');
    await click(main, '#product-grid .card[data-id="3"] [data-action="add"]');
    await sleep(1100);
    await click(main, '#product-grid .card[data-id="3"] [data-action="add"]');
    await sleep(1100);
    await click(main, '#view-table');
    await setSelect(main, 'per-page-select', '5');
    await click(main, '#category-chips button[data-category="women\'s clothing"]');
    if (!await waitFor(main, PRODUCTS_READY, 12000)) throw new Error('category request did not finish');
    await setSelect(main, 'limit-select', '10');
    if (!await waitFor(main, PRODUCTS_READY, 12000)) throw new Error('limit request did not finish');
    await setSelect(main, 'id-sort-select', 'desc');
    if (!await waitFor(main, PRODUCTS_READY, 12000)) throw new Error('id-sort request did not finish');
    // id-sort resets the local sort, so the local sort is set last and must be restored too.
    await setSelect(main, 'sort-select', 'price-asc');
    await commitSearch(main, 'e');
    if (!await waitFor(main, "!!document.querySelector('#page-list button[data-page=\"2\"]')", 8000)) {
      throw new Error('page 2 was not available for the restore test');
    }
    await click(main, '#page-list button[data-page="2"]');
    await click(main, '#btn-add-product');
    await setField(main, 'product-title', 'M9 unsent draft');
    await setField(main, 'product-price', '15.75');
    await setField(main, 'product-description', 'Draft text that must survive reload');
    await setField(main, 'product-image', 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg');
    await setSelect(main, 'product-category', 'electronics');
    await click(main, '#btn-cancel-product-form');
    await click(main, '#btn-login');
    await click(main, '#btn-fill-demo');
    await submit(main, 'login-form');
    if (!await waitFor(main, "sessionStorage.getItem('storepulse_token')!==null && !document.getElementById('login-dialog').open", 15000)) {
      throw new Error('initial login did not finish');
    }
    const keySets = await ev(main, `({localStorage:Object.keys(localStorage).sort(),sessionStorage:Object.keys(sessionStorage).sort()})`);
    const expectedLocal = ['storepulse_cart', 'storepulse_favorites', 'storepulse_page_size', 'storepulse_recent_searches', 'storepulse_theme', 'storepulse_view_mode'];
    const expectedSession = ['storepulse_current_page', 'storepulse_filters', 'storepulse_product_draft', 'storepulse_token', 'storepulse_username'];
    check('exact localStorage map is used',
      keySets.localStorage.join(',') === expectedLocal.join(','), keySets);
    check('exact sessionStorage map is used',
      keySets.sessionStorage.join(',') === expectedSession.join(','), keySets);
    check('never-stored keys are absent',
      !keySets.localStorage.some((key) => /password|secret|lang|orders|products|catalog/i.test(key)) &&
      !keySets.sessionStorage.some((key) => /password|secret|lang|orders|products|catalog/i.test(key)), keySets);
    await captureRedactingUser(main, 'm9-stored-state-1280.png');
    await snapshot(main, 'complete-mapped-state');

    // Reload: localStorage and this tab's sessionStorage both survive.
    await reloadReady(main);
    const afterReload = await ev(main, STATE_SNAPSHOT_JS);
    check('reload restores localStorage choices',
      afterReload.theme === 'ocean' && afterReload.favoriteIds.includes(1) &&
      afterReload.cartIds.join(',') === '3' && afterReload.cartQuantities.join(',') === '2' &&
      afterReload.recentCount === 5 &&
      afterReload.view === 'table' && afterReload.pageSize === 5, afterReload);
    check('reload restores filters, page, auth and draft in the same tab',
      afterReload.filters && afterReload.filters.category === "women's clothing" &&
      afterReload.filters.sort === 'price-asc' && afterReload.filters.idSort === 'desc' &&
      afterReload.filters.limit === 10 && afterReload.filters.search === 'e' &&
      afterReload.currentPage === 2 && afterReload.tokenPresent && afterReload.usernamePresent &&
      afterReload.draftPresent, afterReload);
    check('reload restores visible controls and page 2',
      (await ev(main, "document.querySelector('#category-chips button[data-category=\"women\\'s clothing\"]').getAttribute('aria-pressed')")) === 'true' &&
      (await ev(main, "document.getElementById('sort-select').value")) === 'price-asc' &&
      (await ev(main, "document.getElementById('limit-select').value")) === '10' &&
      (await ev(main, "document.getElementById('id-sort-select').value")) === 'desc' &&
      (await ev(main, "document.getElementById('search-input').value")) === 'e' &&
      (await ev(main, "document.querySelector('#page-list button[data-page=\"2\"]').getAttribute('aria-current')")) === 'page' &&
      (await ev(main, "document.getElementById('view-table').getAttribute('aria-pressed')")) === 'true' &&
      (await ev(main, "document.getElementById('per-page-select').value")) === '5', {});
    await click(main, '#btn-add-product');
    const restoredDraft = await ev(main, `({
      title:document.getElementById('product-title').value,
      price:document.getElementById('product-price').value,
      description:document.getElementById('product-description').value,
      image:document.getElementById('product-image').value,
      category:document.getElementById('product-category').value
    })`);
    check('unsent add-product draft is restored on reopen after reload',
      restoredDraft.title === 'M9 unsent draft' && restoredDraft.price === '15.75' &&
      restoredDraft.description === 'Draft text that must survive reload' &&
      restoredDraft.category === 'electronics' && restoredDraft.image.startsWith('https://'), restoredDraft);
    await captureRedactingUser(main, 'm9-draft-restored-1280.png');
    await click(main, '#btn-cancel-product-form');
    await snapshot(main, 'after-reload');

    // Independent new tab: localStorage is shared, sessionStorage is not copied.
    const second = await openTab('independent-tab');
    const secondState = await ev(second, STATE_SNAPSHOT_JS);
    check('independent new tab sees localStorage choices',
      secondState.theme === 'ocean' && secondState.favoriteIds.includes(1) &&
      secondState.cartIds.join(',') === '3' && secondState.cartQuantities.join(',') === '2' &&
      secondState.recentCount === 5 &&
      secondState.view === 'table' && secondState.pageSize === 5, secondState);
    check('independent new tab does not inherit sessionStorage',
      !secondState.tokenPresent && !secondState.usernamePresent && !secondState.draftPresent &&
      secondState.currentPage === 1 && secondState.searchInput === '' &&
      secondState.filters && secondState.filters.category === 'all' &&
      secondState.filters.sort === 'default' && secondState.filters.limit === 20, secondState);
    await capture(second, 'm9-independent-tab-1280.png');
    await snapshot(second, 'independent-new-tab');
    await errors(second);
    collect(second);
    await browser.send('Target.closeTarget', { targetId: second.targetId });
    await sleep(300);
    const afterTabClose = await ev(main, STATE_SNAPSHOT_JS);
    check('closing the independent tab leaves localStorage and the original tab intact',
      afterTabClose.theme === 'ocean' && afterTabClose.cartIds.join(',') === '3' &&
      afterTabClose.cartQuantities.join(',') === '2' &&
      afterTabClose.tokenPresent && afterTabClose.currentPage === 2, afterTabClose);
    await snapshot(main, 'after-independent-tab-closed');

    // Logout clears only the session auth pair.
    await click(main, '#btn-logout');
    const afterLogout = await ev(main, STATE_SNAPSHOT_JS);
    check('logout removes token and username but keeps mapped session data',
      !afterLogout.tokenPresent && !afterLogout.usernamePresent && afterLogout.draftPresent &&
      afterLogout.currentPage === 2 && afterLogout.filters.search === 'e' &&
      afterLogout.theme === 'ocean' && afterLogout.cartIds.join(',') === '3' &&
      afterLogout.cartQuantities.join(',') === '2', afterLogout);
    check('logout updates the header without printing credentials',
      (await ev(main, "document.getElementById('btn-logout').hidden")) &&
      (await ev(main, "document.getElementById('login-label').innerText")).includes('Sign in'), {});
    await snapshot(main, 'after-logout');

    // Re-login, then close and reopen the whole browser with the same profile.
    await click(main, '#btn-login');
    await click(main, '#btn-fill-demo');
    await submit(main, 'login-form');
    if (!await waitFor(main, "sessionStorage.getItem('storepulse_token')!==null && !document.getElementById('login-dialog').open", 15000)) {
      throw new Error('re-login did not finish');
    }
    await snapshot(main, 'before-browser-close');
    await errors(main);
    collect(main);
    await closeBrowser();

    const reopened = await launch();
    await reopened.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await reloadReady(reopened);
    const afterBrowser = await ev(reopened, STATE_SNAPSHOT_JS);
    check('browser close/reopen keeps every localStorage item',
      afterBrowser.theme === 'ocean' && afterBrowser.favoriteIds.includes(1) &&
      afterBrowser.cartIds.join(',') === '3' && afterBrowser.cartQuantities.join(',') === '2' &&
      afterBrowser.recentCount === 5 &&
      afterBrowser.view === 'table' && afterBrowser.pageSize === 5, afterBrowser);
    check('browser close/reopen clears sessionStorage',
      !afterBrowser.tokenPresent && !afterBrowser.usernamePresent && !afterBrowser.draftPresent &&
      afterBrowser.currentPage === 1 && afterBrowser.searchInput === '' &&
      afterBrowser.filters && afterBrowser.filters.category === 'all' &&
      afterBrowser.filters.sort === 'default' && afterBrowser.filters.idSort === 'asc' &&
      afterBrowser.filters.limit === 20 && afterBrowser.filters.search === '', afterBrowser);
    check('reopened tab renders saved table view and page size',
      (await ev(reopened, "document.getElementById('view-table').getAttribute('aria-pressed')")) === 'true' &&
      (await ev(reopened, "document.getElementById('per-page-select').value")) === '5' &&
      (await ev(reopened, "document.querySelector('#table-wrap').hidden")) === false, {});
    await capture(reopened, 'm9-after-browser-reopen-1280.png');
    await snapshot(reopened, 'after-browser-reopen');

    // Draft clear rules: success and explicit discard; edit mode never saves a draft.
    await click(reopened, '#btn-add-product');
    await setField(reopened, 'product-title', 'M9 draft cleared after success');
    await setField(reopened, 'product-price', '18.25');
    await setField(reopened, 'product-description', 'This draft must be removed after the API accepts the post');
    await setField(reopened, 'product-image', 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg');
    await setSelect(reopened, 'product-category', 'electronics');
    await submit(reopened, 'product-form');
    if (!await waitFor(reopened, "!document.getElementById('write-result').hidden && document.getElementById('write-result').innerText.includes('Created')", 15000)) {
      throw new Error('successful add did not finish');
    }
    check('draft is cleared after a successful add',
      !(await ev(reopened, "!!sessionStorage.getItem('storepulse_product_draft')")) &&
      (await ev(reopened, "document.getElementById('write-result').innerText")).includes('Created'), {});
    await click(reopened, '#btn-cancel-product-form');
    await click(reopened, '#btn-add-product');
    await setField(reopened, 'product-title', 'M9 draft discarded explicitly');
    await setField(reopened, 'product-price', '19.25');
    await setField(reopened, 'product-description', 'This draft must be removed by the Discard draft button');
    await setField(reopened, 'product-image', 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg');
    await setSelect(reopened, 'product-category', 'electronics');
    check('discard button is available in add mode',
      !(await ev(reopened, "document.getElementById('btn-discard-draft').hidden")) &&
      !(await ev(reopened, "document.getElementById('draft-note').hidden")), {});
    await click(reopened, '#btn-discard-draft');
    check('explicit discard clears and resets the add form',
      !(await ev(reopened, "!!sessionStorage.getItem('storepulse_product_draft')")) &&
      (await ev(reopened, "document.getElementById('product-title').value")) === '' &&
      (await ev(reopened, "document.getElementById('product-price').value")) === '', {});
    await click(reopened, '#btn-cancel-product-form');
    await click(reopened, '#product-table-body tr[data-id="1"] [data-action="edit"]');
    await setField(reopened, 'product-title', 'M9 edit must not become a draft');
    check('edit mode never writes the add-product draft',
      !(await ev(reopened, "!!sessionStorage.getItem('storepulse_product_draft')")) &&
      (await ev(reopened, "document.getElementById('product-form').dataset.mode")) === 'edit' &&
      (await ev(reopened, "document.getElementById('btn-discard-draft').hidden")), {});
    await click(reopened, '#btn-cancel-product-form');
    await snapshot(reopened, 'after-draft-clear-rules');

    const finalKeys = await ev(reopened, `({localStorage:Object.keys(localStorage).sort(),sessionStorage:Object.keys(sessionStorage).sort()})`);
    check('final storage contains only mapped keys',
      finalKeys.localStorage.join(',') === expectedLocal.join(',') &&
      finalKeys.sessionStorage.join(',') === 'storepulse_current_page,storepulse_filters', finalKeys);

    // M9 UI is checked at phone and tablet widths too, not only at 1280 px.
    for (const width of [320, 768]) {
      await reopened.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(180);
      const recentLayout = await ev(reopened, `({
        scrollWidth:document.documentElement.scrollWidth,
        innerWidth:innerWidth,
        recentVisible:!document.getElementById('recent-searches-box').hidden,
        recentButtons:document.querySelectorAll('#recent-searches-list button[data-search]').length
      })`);
      check(`recent-search UI fits ${width}px without page overflow`,
        recentLayout.scrollWidth <= recentLayout.innerWidth && recentLayout.recentVisible &&
        recentLayout.recentButtons === 5, recentLayout);
      await click(reopened, '#btn-add-product');
      const draftLayout = await ev(reopened, `({
        scrollWidth:document.documentElement.scrollWidth,
        innerWidth:innerWidth,
        dialogOpen:document.getElementById('product-form-dialog').open,
        discardVisible:!document.getElementById('btn-discard-draft').hidden,
        noteVisible:!document.getElementById('draft-note').hidden
      })`);
      check(`draft controls are reachable at ${width}px`,
        draftLayout.scrollWidth <= draftLayout.innerWidth && draftLayout.dialogOpen &&
        draftLayout.discardVisible && draftLayout.noteVisible, draftLayout);
      await capture(reopened, `m9-draft-${width}.png`);
      await click(reopened, '#btn-cancel-product-form');
    }
    await reopened.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    // api.html is part of the same site: language is outside the map, theme is shared and allowed.
    await ev(reopened, `(()=>{
      localStorage.clear();sessionStorage.clear();
      localStorage.setItem('storepulse_theme', JSON.stringify('ocean'));
      localStorage.setItem('storepulse_api_lang', JSON.stringify('en'));
      return true;
    })()`);
    const apiPage = await openTab('api-page', API_URL,
      "document.documentElement.getAttribute('data-lang') === 'both' && !localStorage.getItem('storepulse_api_lang')");
    check('api.html deletes the legacy language key and starts bilingual',
      (await ev(apiPage, "document.documentElement.getAttribute('data-lang')")) === 'both' &&
      !(await ev(apiPage, "!!localStorage.getItem('storepulse_api_lang')")) &&
      (await ev(apiPage, "localStorage.getItem('storepulse_theme')")) === JSON.stringify('ocean'), {});
    await click(apiPage, '#lang-ar');
    const apiKeys = await ev(apiPage, `({localStorage:Object.keys(localStorage).sort(),sessionStorage:Object.keys(sessionStorage).sort()})`);
    check('api.html language switch writes no language key',
      (await ev(apiPage, "document.documentElement.getAttribute('data-lang')")) === 'ar' &&
      !apiKeys.localStorage.some((key) => /lang/i.test(key)) &&
      !apiKeys.sessionStorage.some((key) => /lang/i.test(key)) &&
      apiKeys.localStorage.join(',') === 'storepulse_theme', apiKeys);
    await capture(apiPage, 'm9-api-language-storage-1280.png');
    await snapshot(apiPage, 'api-language-no-storage');
    await errors(apiPage);
    collect(apiPage);

    await errors(reopened);
    collect(reopened);
    check('no unhandled page or console errors',
      pageErrors.length === 0 && allConsole.filter((entry) => entry.type === 'error').length === 0,
      { pageErrors: redact(pageErrors), consoleErrors: redact(allConsole.filter((entry) => entry.type === 'error').map((entry) => entry.args)) });
  } catch (error) {
    check('Harness completed without exception', false, { message: String(error && error.message || error) });
  } finally {
    for (const client of tabs) {
      if (!client.__collected) collect(client);
    }
    const network = [];
    for (const client of tabs) {
      for (const [requestId, request] of client.requests) {
        network.push({ requestId, ...request, response: client.responses.get(requestId) || null });
      }
    }
    fs.writeFileSync(path.join(OUT, 'runtime-tests.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'PDF pages 10-11 and 17, M9.1-M9.3',
      tool: 'Google Chrome headless via CDP; real Chrome Storage API and real tab/browser lifecycles',
      redaction: 'No password, token, username value or Authorization header value is stored in evidence.',
      totals: {
        pass: results.filter((entry) => entry.status === 'PASS').length,
        fail: results.filter((entry) => entry.status === 'FAIL').length
      },
      results
    }, null, 2));
    fs.writeFileSync(path.join(OUT, 'storage-evidence.json'), JSON.stringify({
      note: 'Shapes, key names and selected redacted state only; no credential values.',
      snapshots
    }, null, 2));
    fs.writeFileSync(path.join(OUT, 'console-evidence.json'), JSON.stringify(redact(allConsole), null, 2));
    fs.writeFileSync(path.join(OUT, 'network-evidence.json'), JSON.stringify({
      note: 'Credential values and Authorization headers are redacted; bearerSent is a boolean.',
      requests: redact(network)
    }, null, 2));
    if (browser) { try { browser.close(); } catch (error) {} }
    if (child && child.exitCode === null) child.kill();
    console.log(JSON.stringify({
      totals: {
        pass: results.filter((entry) => entry.status === 'PASS').length,
        fail: results.filter((entry) => entry.status === 'FAIL').length
      },
      failures: results.filter((entry) => entry.status === 'FAIL')
    }, null, 2));
  }
})();

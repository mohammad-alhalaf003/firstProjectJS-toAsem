const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m8-' + Date.now();
const PORT = 9376;
const APP_URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const OUT = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\m8';
const DEMO_USERNAME = process.env.STOREDEMO_USER;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(OUT, { recursive: true });
if (!DEMO_USERNAME) {
  throw new Error('Set STOREDEMO_USER to the public FakeStoreAPI demo username before running this harness.');
}

function redact(value) {
  if (typeof value === 'string') {
    return value
      .replace(/("?(?:password|token|authorization|username|email|phone)"?\s*[:=]\s*"?)[^",}\s]+/gi, '$1[redacted]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
      .replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted-token]');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /password|token|authorization|username|email|phone|firstname|lastname/i.test(key) ? '[redacted]' : redact(item)
    ]));
  }
  return value;
}

async function endpoint() {
  for (let index = 0; index < 100; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`);
      if (response.ok) return await response.json();
    } catch (error) {}
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
    const requests = new Map();
    const responses = new Map();

    ws.onopen = () => resolve({
      send(method, params = {}) {
        const requestId = id++;
        return new Promise((res, rej) => {
          pending.set(requestId, { res, rej });
          ws.send(JSON.stringify({ id: requestId, method, params }));
        });
      },
      consoleCalls,
      requests,
      responses,
      close() { ws.close(); }
    });
    ws.onerror = reject;
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled') {
        consoleCalls.push({
          type: message.params.type,
          args: message.params.args.map((arg) => arg.value ?? arg.description ?? null),
          timestamp: message.params.timestamp
        });
      }
      if (message.method === 'Network.requestWillBeSent' && String(message.params.request.url).includes('fakestoreapi.com')) {
        requests.set(message.params.requestId, {
          url: message.params.request.url,
          method: message.params.request.method,
          headers: redact(message.params.request.headers || {}),
          bearerSent: /^Bearer\s+\S+$/.test(message.params.request.headers.authorization || message.params.request.headers.Authorization || ''),
          postData: redact(message.params.request.postData || ''),
          type: message.params.type,
          timestamp: message.params.timestamp
        });
      }
      if (message.method === 'Network.responseReceived' && responses.has(message.params.requestId) === false) {
        if (String(message.params.response.url).includes('fakestoreapi.com')) {
          responses.set(message.params.requestId, {
            url: message.params.response.url,
            status: message.params.response.status,
            statusText: message.params.response.statusText,
            mimeType: message.params.response.mimeType,
            headers: redact(message.params.response.headers || {})
          });
        }
      }
      if (message.id && pending.has(message.id)) {
        const { res, rej } = pending.get(message.id);
        pending.delete(message.id);
        message.error ? rej(new Error(JSON.stringify(message.error))) : res(message.result);
      }
    };
  });
}

(async () => {
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, APP_URL], { stdio: 'ignore' });
  let client;
  const results = [];
  const storageSnapshots = [];
  const check = (name, ok, detail) => {
    results.push({ name, status: ok ? 'PASS' : 'FAIL', detail: redact(detail) });
    if (!ok) console.error(`FAIL ${name}: ${JSON.stringify(redact(detail))}`);
  };

  try {
    const targets = await endpoint();
    client = await connect(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Network.enable');
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "window.__errs=[];window.addEventListener('error',e=>__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));"
    });

    const ev = async (expression) => {
      const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(expression.slice(0, 160) + ' -> ' + (response.exceptionDetails.exception?.description || 'error'));
      return response.result.value;
    };
    const sleepPage = (ms) => sleep(ms);
    const waitFor = async (expression, timeout = 12000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await ev(expression)) return true;
        await sleep(120);
      }
      return false;
    };
    const click = async (selector) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`);
    const setField = async (id, value) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    const setSelect = async (id, value) => ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
    const submitForm = async (times = 1) => ev(`(()=>{const f=document.getElementById('product-form');let n=0;for(let i=0;i<${times};i++){f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));n++}return n})()`);
    const screenshot = async (file) => {
      const response = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(response.data, 'base64'));
    };
    // تخفي اسم المستخدم داخل أي لقطة بعد الدخول؛ الدليل لا يحفظ قيم الدخول الحقيقية.
    const screenshotRedactingUser = async (file) => {
      const original = await ev("document.getElementById('login-label') ? document.getElementById('login-label').innerHTML : null");
      if (typeof original !== 'string') return screenshot(file);
      await ev("(()=>{const e=document.getElementById('login-label');if(e)e.textContent='[redacted]';return true})()");
      try {
        await screenshot(file);
      } finally {
        await ev(`(()=>{const e=document.getElementById('login-label');if(e)e.innerHTML=${JSON.stringify(original)};return true})()`);
      }
    };
    const matches = (method, urlPart) => [...client.requests.values()].filter((request) =>
      request.method === method && request.url.includes(urlPart));
    const responseFor = (request) => {
      for (const [requestId, response] of client.responses) {
        const candidate = client.requests.get(requestId);
        if (candidate && candidate.url === request.url && candidate.method === request.method && candidate.timestamp === request.timestamp) return response;
      }
      return null;
    };
    const storage = () => ev(`(()=>{
      const dump=(s)=>Object.fromEntries(Object.keys(s).sort().map(k=>[k,s.getItem(k)]));
      return {localStorage:dump(localStorage),sessionStorage:dump(sessionStorage)};
    })()`);
    const storageShape = async () => {
      const raw = await storage();
      const shape = (box) => Object.fromEntries(Object.entries(box).map(([key, value]) => {
        let kind = 'string';
        try { const parsed = JSON.parse(value); kind = Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed; } catch (e) {}
        return [key, { kind, length: String(value).length }];
      }));
      return { localStorage: shape(raw.localStorage), sessionStorage: shape(raw.sessionStorage) };
    };
    const snapshot = async (label) => storageSnapshots.push({ width: await ev('innerWidth'), label, ...(await storageShape()) });
    const errs = () => ev('window.__errs.slice()');
    const consoleErrors = () => client.consoleCalls.filter((entry) => entry.type === 'error');
    const cardCount = () => ev("document.querySelectorAll('#product-grid .card').length");

    for (const width of [320, 768, 1280]) {
      await ev('localStorage.clear();sessionStorage.clear();true');
      await client.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor("document.querySelectorAll('#product-grid .card').length >= 20")) throw new Error(`Products did not load at ${width}px`);
      await sleepPage(300);

      check(`W${width} previous catalogue baseline kept`, (await cardCount()) === 20 && (await ev("document.querySelectorAll('#category-chips button').length")) === 5,
        { cards: await cardCount(), chips: await ev("document.querySelectorAll('#category-chips button').length") });
      await snapshot('before-writes');

      // 8.4 — Two invalid saved quantities (0 and over the maximum) are dropped before use.
      await ev("localStorage.setItem('storepulse_cart', JSON.stringify([{productId:3,quantity:0},{productId:4,quantity:100},{productId:5,quantity:2}]));true");
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor("document.querySelectorAll('#product-grid .card').length >= 20")) throw new Error(`Sanitization reload failed at ${width}px`);
      const sanitizedCart = await ev("JSON.parse(localStorage.getItem('storepulse_cart')||'[]')");
      check(`W${width} invalid saved quantities removed`, sanitizedCart.length === 1 && sanitizedCart[0].quantity === 2, { sanitizedCart });
      await ev("localStorage.removeItem('storepulse_cart');true");

      // 8.1 — Add Product: semantic form, validation, single POST, returned id.
      await click('#btn-add-product');
      await screenshot(`m8-add-form-${width}.png`);
      check(`W${width} add dialog + semantic fields`, await ev(`(()=>{
        const d=document.getElementById('product-form-dialog'); const f=document.getElementById('product-form');
        const ids=['product-title','product-price','product-description','product-image','product-category'];
        const types=['text','number','url'];
        return d.open && ids.every(id=>!!document.getElementById(id)) &&
          f.querySelectorAll('label').length===5 && types.includes(document.getElementById('product-price').type) &&
          document.getElementById('product-image').type==='url' && document.getElementById('product-description').tagName==='TEXTAREA' &&
          document.getElementById('product-category').tagName==='SELECT';
      })()`), { dialog: await ev("document.getElementById('product-form-dialog').open") });

      const postBefore = matches('POST', '/products').length;
      await submitForm(1);
      const validationVisible = await ev(`['product-title-error','product-price-error','product-description-error','product-image-error'].every(id=>!document.getElementById(id).hidden)`);
      check(`W${width} empty form blocked before network`, validationVisible && matches('POST', '/products').length === postBefore,
        { validationVisible, categoryHasDefault: await ev("!!document.getElementById('product-category').value"), posts: matches('POST', '/products').length - postBefore });

      const title = `M8 probe ${width}`;
      await setField('product-title', title);
      await setField('product-price', '0');
      await setField('product-description', 'M8 validation description');
      await setField('product-image', 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg');
      await setSelect('product-category', 'electronics');
      await submitForm(1);
      check(`W${width} invalid price blocked`, matches('POST', '/products').length === postBefore && !(await ev("document.getElementById('product-price-error').hidden")),
        { posts: matches('POST', '/products').length - postBefore });

      await setField('product-price', '12.50');
      const doubleBefore = matches('POST', '/products').length;
      await submitForm(2);
      if (!await waitFor("!document.getElementById('write-result').hidden")) throw new Error(`Add did not finish at ${width}px`);
      const addRequests = matches('POST', '/products').slice(doubleBefore);
      const addResponse = addRequests.length ? responseFor(addRequests[0]) : null;
      const resultText = await ev("document.getElementById('write-result').innerText");
      const firstTitles = await ev("[...document.querySelectorAll('#product-grid .card .card-title')].slice(0,3).map(e=>e.textContent)");
      const addedVisible = await ev(`[...document.querySelectorAll('#product-grid .card')].some(c=>c.querySelector('.card-title').textContent===${JSON.stringify(title)} && !!c.querySelector('.session-flag'))`);
      check(`W${width} double submit sent one POST`, addRequests.length === 1, { count: addRequests.length });
      check(`W${width} POST payload + content-type`, addRequests.length === 1 &&
        String(addRequests[0].headers['content-type'] || addRequests[0].headers['Content-Type']).includes('application/json') &&
        JSON.parse(addRequests[0].postData).title === title &&
        JSON.parse(addRequests[0].postData).price === 12.5 &&
        Object.keys(JSON.parse(addRequests[0].postData)).sort().join(',') === 'category,description,image,price,title',
        addRequests[0] ? { headers: addRequests[0].headers, postData: addRequests[0].postData } : null);
      check(`W${width} POST 201 + returned id shown`, addResponse && addResponse.status === 201 && /id:\s*\d+/i.test(resultText) && /Session-only/i.test(resultText),
        { status: addResponse && addResponse.status, resultText });
      check(`W${width} session-only product rendered`, addedVisible, { addedVisible, cards: await cardCount(), firstTitles, resultText, resultCount: await ev("document.getElementById('result-count').innerText") });
      await screenshot(`m8-add-result-${width}.png`);
      await snapshot('after-add');
      await click('#btn-cancel-product-form');

      // 8.2 — Edit: prefill, cancel sends nothing, confirm sends PUT.
      await click('#product-grid .card[data-id="1"] [data-action="edit"]');
      const prefill = await ev(`({
        title: document.getElementById('product-title').value,
        price: document.getElementById('product-price').value,
        description: document.getElementById('product-description').value,
        image: document.getElementById('product-image').value,
        category: document.getElementById('product-category').value,
        mode: document.getElementById('product-form').dataset.mode,
        id: document.getElementById('product-form').dataset.productId
      })`);
      check(`W${width} edit form prefilled from product`, prefill.mode === 'edit' && prefill.id === '1' && prefill.title.length > 3 && prefill.price !== '' && prefill.image.startsWith('http'), prefill);

      const putBefore = matches('PUT', '/products/').length;
      await setField('product-title', `M8 edited ${width}`);
      await submitForm(1);
      const confirmOpened = await ev("document.getElementById('confirm-dialog').open");
      await click('#confirm-no');
      check(`W${width} edit cancel sends no PUT`, confirmOpened && matches('PUT', '/products/').length === putBefore,
        { confirmOpened, requests: matches('PUT', '/products/').length - putBefore });

      await submitForm(1);
      await click('#confirm-yes');
      if (!await waitFor("!document.getElementById('write-result').hidden && document.getElementById('write-result').innerText.includes('Updated')")) throw new Error(`Edit did not finish at ${width}px`);
      const putRequests = matches('PUT', '/products/').slice(putBefore);
      const putResponse = putRequests.length ? responseFor(putRequests[0]) : null;
      check(`W${width} PUT id extracted + status 200`, putRequests.length === 1 && putRequests[0].url.endsWith('/products/1') && putResponse && putResponse.status === 200,
        { url: putRequests[0] && putRequests[0].url, status: putResponse && putResponse.status });
      check(`W${width} PUT payload validated`, putRequests.length === 1 && JSON.parse(putRequests[0].postData).title === `M8 edited ${width}` &&
        String(putRequests[0].headers['content-type'] || putRequests[0].headers['Content-Type']).includes('application/json'),
        putRequests[0] ? { postData: putRequests[0].postData } : null);
      check(`W${width} edited copy marked session-only`, await ev(`(()=>{const c=document.querySelector('#product-grid .card[data-id="1"]');return !!c && c.querySelector('.card-title').textContent===${JSON.stringify(`M8 edited ${width}`)} && !!c.querySelector('.session-flag')})()`), {});
      await click('#btn-cancel-product-form');

      // 8.2 — Delete: cancel sends nothing, confirm sends DELETE.
      const deleteBefore = matches('DELETE', '/products/').length;
      await click('#product-grid .card[data-id="2"] [data-action="delete"]');
      await click('#confirm-no');
      check(`W${width} delete cancel sends no DELETE`, matches('DELETE', '/products/').length === deleteBefore,
        { requests: matches('DELETE', '/products/').length - deleteBefore });
      await click('#product-grid .card[data-id="2"] [data-action="delete"]');
      await click('#confirm-yes');
      if (!await waitFor("!document.querySelector('#product-grid .card[data-id=\"2\"]')")) throw new Error(`Delete did not finish at ${width}px`);
      const deleteRequests = matches('DELETE', '/products/').slice(deleteBefore);
      const deleteResponse = deleteRequests.length ? responseFor(deleteRequests[0]) : null;
      check(`W${width} DELETE 200 + local removal only`, deleteRequests.length === 1 && deleteRequests[0].url.endsWith('/products/2') && deleteResponse && deleteResponse.status === 200,
        { url: deleteRequests[0] && deleteRequests[0].url, status: deleteResponse && deleteResponse.status });
      await screenshot(`m8-crud-result-${width}.png`);

      // 8.3 — Login: 401 with wrong credentials, then 201 with real token.
      await click('#btn-login');
      await setField('login-username', DEMO_USERNAME);
      await setField('login-password', 'definitely-wrong');
      const loginBefore = matches('POST', '/auth/login').length;
      await ev("document.getElementById('login-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));true");
      if (!await waitFor("!document.getElementById('login-error').hidden")) throw new Error(`Wrong login did not finish at ${width}px`);
      const badLogin = matches('POST', '/auth/login').slice(loginBefore);
      const badResponse = badLogin.length ? responseFor(badLogin[0]) : null;
      check(`W${width} wrong login 401 handled`, badResponse && badResponse.status === 401 &&
        (await ev("document.getElementById('login-error').innerText")).length > 5 &&
        !(await ev("!!JSON.parse(sessionStorage.getItem('storepulse_token')||'null')")),
        { status: badResponse && badResponse.status });
      check(`W${width} button re-enabled after 401`, await ev("!document.querySelector('#login-form button[type=submit]').disabled"), {});

      await click('#btn-fill-demo');
      const goodBefore = matches('POST', '/auth/login').length;
      await ev("document.getElementById('login-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));true");
      if (!await waitFor("document.getElementById('login-dialog').open===false && !!sessionStorage.getItem('storepulse_token')")) throw new Error(`Login did not finish at ${width}px`);
      const goodLogin = matches('POST', '/auth/login').slice(goodBefore);
      const goodResponse = goodLogin.length ? responseFor(goodLogin[0]) : null;
      const sessionShape = await storageShape();
      check(`W${width} login 201 + token/username in sessionStorage`, goodResponse && goodResponse.status === 201 &&
        sessionShape.sessionStorage.storepulse_token?.kind === 'string' &&
        sessionShape.sessionStorage.storepulse_username?.kind === 'string' &&
        !sessionShape.localStorage.storepulse_token && !sessionShape.localStorage.storepulse_password &&
        !sessionShape.sessionStorage.storepulse_password,
        { status: goodResponse && goodResponse.status, sessionStorage: sessionShape.sessionStorage });
      check(`W${width} auth UI updated`, await ev(`!document.getElementById('btn-logout').hidden && !document.getElementById('btn-bearer-check').hidden && document.getElementById('login-label').innerText.includes(${JSON.stringify(DEMO_USERNAME)})`), {});
      await screenshotRedactingUser(`m8-signed-in-${width}.png`);
      await snapshot('after-login');

      // Bearer header on a later FakeStoreAPI request (value redacted in evidence).
      const bearerBefore = matches('GET', '/products/1').length;
      await click('#btn-bearer-check');
      if (!await waitFor(`[...document.querySelectorAll('.toast')].some(t=>t.innerText.includes('Bearer'))`, 8000)) throw new Error(`Bearer check did not finish at ${width}px`);
      const bearerRequests = matches('GET', '/products/1').slice(bearerBefore);
      const bearerSent = bearerRequests.length ? bearerRequests[0].bearerSent : false;
      check(`W${width} Authorization: Bearer sent to API`, bearerRequests.length === 1 && bearerSent,
        { header: bearerSent ? 'Bearer [redacted]' : '', url: bearerRequests[0] && bearerRequests[0].url });
      check(`W${width} no token printed in console`, !client.consoleCalls.some((entry) => entry.args.some((arg) => String(arg || '').includes('eyJ'))), {});
      const externalBlock = await ev("StorePulseErrorLab.request('https://example.com/products').then(r=>({blocked:!!r.blocked,status:r.status}))");
      check(`W${width} external origin blocked before token send`, externalBlock.blocked && externalBlock.status === 0 &&
        ![...client.requests.values()].some((request) => request.url.includes('example.com')), externalBlock);

      // Reload in same tab restores state; then logout clears it.
      await client.send('Page.reload', { ignoreCache: true });
      if (!await waitFor("document.querySelectorAll('#product-grid .card').length >= 20 && !!sessionStorage.getItem('storepulse_token')")) throw new Error(`Reload restore failed at ${width}px`);
      check(`W${width} reload restores login in same tab`, await ev(`!document.getElementById('btn-logout').hidden && document.getElementById('login-label').innerText.includes(${JSON.stringify(DEMO_USERNAME)})`), {});
      await click('#btn-logout');
      const afterLogout = await storageShape();
      check(`W${width} logout clears session auth`, !afterLogout.sessionStorage.storepulse_token && !afterLogout.sessionStorage.storepulse_username &&
        await ev("document.getElementById('btn-logout').hidden && document.getElementById('btn-bearer-check').hidden && document.getElementById('login-label').innerText.includes('Sign in')"),
        { sessionStorage: afterLogout.sessionStorage });
      await snapshot('after-logout');

      // Re-login for checkout using real API.
      await click('#btn-login');
      await click('#btn-fill-demo');
      await ev("document.getElementById('login-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));true");
      if (!await waitFor("!!sessionStorage.getItem('storepulse_token') && document.getElementById('login-dialog').open===false")) throw new Error(`Second login failed at ${width}px`);

      // 8.4 — Cart: add, quantity, remove, total via reduce, then checkout.
      await ev('localStorage.removeItem("storepulse_cart");true');
      await click('#btn-cart');
      await ev("document.getElementById('cart-dialog').close();true");
      await click('#product-grid .card[data-id="3"] [data-action="add"]');
      await sleepPage(1100);
      await click('#product-grid .card[data-id="3"] [data-action="add"]');
      await sleepPage(1100);
      const cartTwo = await ev(`({count:document.getElementById('cart-count').textContent,total:document.getElementById('cart-total').textContent,stored:JSON.parse(localStorage.getItem('storepulse_cart')||'[]')})`);
      check(`W${width} add + quantity + total(reduce)`, cartTwo.count === '2' && cartTwo.stored[0]?.quantity === 2 && cartTwo.total.startsWith('$'),
        cartTwo);
      await click('#btn-cart');
      await click('#cart-items .cart-row .qty-btn[aria-label^="Decrease"]');
      const cartOne = await ev(`({count:document.getElementById('cart-count').textContent,total:document.getElementById('cart-total').textContent,stored:JSON.parse(localStorage.getItem('storepulse_cart')||'[]')})`);
      check(`W${width} quantity change keeps valid value`, cartOne.count === '1' && cartOne.stored[0]?.quantity === 1, cartOne);
      await ev("document.getElementById('cart-dialog').close();true");
      await click('#product-grid .card[data-id="4"] [data-action="add"]');
      await sleepPage(1100);
      await click('#btn-cart');
      const removeButtons = await ev("document.querySelectorAll('#cart-items .remove-btn').length");
      await ev("document.querySelectorAll('#cart-items .remove-btn')[1].click();true");
      const afterRemove = await ev(`({count:document.getElementById('cart-count').textContent,stored:JSON.parse(localStorage.getItem('storepulse_cart')||'[]')})`);
      check(`W${width} remove product from cart`, removeButtons === 2 && afterRemove.count === '1' && afterRemove.stored.length === 1 && afterRemove.stored[0].productId === 3,
        { removeButtons, afterRemove });

      const checkoutBefore = matches('POST', '/carts').length;
      await click('#btn-checkout');
      if (!await waitFor("document.getElementById('order-dialog').open || [...document.querySelectorAll('.toast')].some(t=>t.innerText.includes('Could not') || t.innerText.includes('Network'))", 10000)) throw new Error(`Checkout did not finish at ${width}px`);
      const checkoutRequests = matches('POST', '/carts').slice(checkoutBefore);
      const checkoutResponse = checkoutRequests.length ? responseFor(checkoutRequests[0]) : null;
      const checkoutBody = checkoutRequests.length ? JSON.parse(checkoutRequests[0].postData) : null;
      const userId = await ev(`JSON.parse(sessionStorage.getItem('storepulse_username')||'""')===${JSON.stringify(DEMO_USERNAME)} ? 1 : null`);
      check(`W${width} POST /carts body matches API docs`, checkoutBody && Number.isInteger(checkoutBody.userId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(checkoutBody.date) && Array.isArray(checkoutBody.products) &&
        checkoutBody.products.length === 1 && checkoutBody.products[0].productId === 3 && checkoutBody.products[0].quantity === 1 &&
        Object.keys(checkoutBody).sort().join(',') === 'date,products,userId',
        { body: checkoutBody, expectedUserIdFromUsers: userId });
      check(`W${width} checkout success keeps/clears cart correctly`, checkoutResponse && checkoutResponse.ok !== false && checkoutResponse.status < 300 &&
        (await ev("document.getElementById('cart-count').textContent")) === '0' && (await ev("document.getElementById('order-dialog').open")),
        { status: checkoutResponse && checkoutResponse.status });
      await snapshot('after-checkout');

      // 8.5 — Live 404 / empty body and mocked 400 / 500 / offline / invalid JSON.
      const notFound = await ev("StorePulseErrorLab.request('/this-route-does-not-exist').then(r=>({status:r.status,empty:r.empty,message:StorePulseErrorLab.message(r)}))");
      check(`W${width} wrong URL 404 message`, notFound.status === 404 && notFound.message[0].toLowerCase().includes('not found'), notFound);
      const emptyBody = await ev("StorePulseErrorLab.request('/products/999999').then(r=>({status:r.status,empty:r.empty,message:StorePulseErrorLab.message(r)}))");
      check(`W${width} empty response body message`, emptyBody.status === 200 && emptyBody.empty === true && emptyBody.message[0].toLowerCase().includes('empty'), emptyBody);
      const invalidJson = await ev(`(async()=>{
        const originalFetch = window.fetch;
        window.fetch = async () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } });
        try {
          const result = await StorePulseErrorLab.request('/products');
          return { status: result.status, invalidJson: !!result.invalidJson, message: StorePulseErrorLab.message(result) };
        } finally { window.fetch = originalFetch; }
      })()`);
      check(`W${width} invalid JSON message through real apiRequest`, invalidJson.status === 200 && invalidJson.invalidJson && invalidJson.message[0].includes('Non-JSON'), invalidJson);
      await ev("StorePulseErrorLab.renderWrite({ok:true,status:200,text:'not json',data:'not json',empty:false,invalidJson:true});true");
      check(`W${width} invalid JSON rendered in real form error box`, await ev("!document.getElementById('product-form-error').hidden && document.getElementById('product-form-error').innerText.includes('Non-JSON')"), {});
      await ev("document.getElementById('product-form-dialog').close();true");
      const mocked400 = await ev("StorePulseErrorLab.message({ok:false,status:400,text:'bad',empty:false})");
      const mocked500 = await ev("StorePulseErrorLab.message({ok:false,status:500,text:'oops',empty:false})");
      check(`W${width} mocked 400/500 messages`, mocked400[0].includes('Bad request') && mocked500[0].includes('Server error'), { mocked400, mocked500 });
      check(`W${width} 200/201 are not errors`, await ev("StorePulseErrorLab.isSuccess({ok:true,status:200,data:{}}) && StorePulseErrorLab.isSuccess({ok:true,status:201,data:{}}) && !StorePulseErrorLab.isSuccess({ok:false,status:400,data:null})"), {});
      await ev("StorePulseErrorLab.renderWrite({ok:false,status:400,text:'bad',empty:false});true");
      check(`W${width} mocked 400 rendered in real form error box`, await ev("!document.getElementById('product-form-error').hidden && document.getElementById('product-form-error').innerText.includes('Bad request')"), {});
      await ev("document.getElementById('product-form-dialog').close();true");
      await ev("StorePulseErrorLab.renderLogin({ok:false,status:500,text:'oops',empty:false});true");
      check(`W${width} mocked 500 rendered in real login error box`, await ev("!document.getElementById('login-error').hidden && document.getElementById('login-error').innerText.includes('Server error')"), {});
      await ev("document.getElementById('login-dialog').close();true");
      await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
      const offline = await ev("StorePulseErrorLab.request('/products').then(r=>({status:r.status,kind:r.errorKind,message:StorePulseErrorLab.message(r)}))");
      await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      check(`W${width} offline message`, offline.status === 0 && offline.kind === 'offline' && offline.message[0].toLowerCase().includes('offline'), offline);

      check(`W${width} no unhandled console errors`, (await errs()).length === 0 && consoleErrors().length === 0,
        { pageErrors: await errs(), consoleErrors: consoleErrors().map((entry) => entry.args) });
    }
  } catch (error) {
    check('Harness completed without exception', false, { message: String(error && error.message || error) });
  } finally {
    const bodyEntries = [];
    for (const [requestId, response] of client ? client.responses : []) {
      try {
        const body = await client.send('Network.getResponseBody', { requestId });
        bodyEntries.push({ requestId, url: response.url, status: response.status, body: redact(body.body) });
      } catch (error) {
        bodyEntries.push({ requestId, url: response.url, status: response.status, bodyError: String(error.message) });
      }
    }
    const networkEvidence = [...client.requests.entries()].map(([requestId, request]) => ({
      requestId,
      ...request,
      response: client.responses.get(requestId) || null
    }));
    fs.writeFileSync(path.join(OUT, 'runtime-tests.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'PDF pages 16–17, M8.1–M8.5',
      tool: 'Google Chrome headless via CDP; real fetch to FakeStoreAPI + explicitly labelled mocked cases',
      viewportWidths: [320, 768, 1280],
      totals: { pass: results.filter((entry) => entry.status === 'PASS').length, fail: results.filter((entry) => entry.status === 'FAIL').length },
      results
    }, null, 2));
    fs.writeFileSync(path.join(OUT, 'network-evidence.json'), JSON.stringify({
      note: 'All token/password values and Authorization header values are redacted. Live requests only; mocked cases are in runtime-tests.json.',
      requests: redact(networkEvidence),
      responseBodies: bodyEntries
    }, null, 2));
    fs.writeFileSync(path.join(OUT, 'storage-evidence.json'), JSON.stringify({
      note: 'Shapes and lengths only; no token or password values are recorded.',
      snapshots: storageSnapshots
    }, null, 2));
    fs.writeFileSync(path.join(OUT, 'console-evidence.json'), JSON.stringify(redact(client ? client.consoleCalls : []), null, 2));
    try {
      await ev(`(()=>({localStorage,sessionStorage}))()`);
    } catch (error) {}
    if (client) client.close();
    child.kill();
    console.log(JSON.stringify({ totals: { pass: results.filter((entry) => entry.status === 'PASS').length, fail: results.filter((entry) => entry.status === 'FAIL').length }, failures: results.filter((entry) => entry.status === 'FAIL') }, null, 2));
  }
})();

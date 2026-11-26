const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m5-runtime-' + Date.now();
const PORT = 9382;
const PAGE_URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const EVIDENCE_DIR = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\m5';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function endpoint() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`);
      if (response.ok) return await response.json();
    } catch (error) {}
    await sleep(150);
  }
  throw new Error('CDP endpoint not ready');
}

(async () => {
  const net = { requests: new Map(), responses: new Map(), order: [] };
  const consoleErrors = [];
  const exceptions = [];
  let fulfillHandler = null;
  let connection;

  const onEvent = message => {
    const params = message.params || {};
    if (message.method === 'Network.requestWillBeSent') {
      net.requests.set(params.requestId, params.request);
      net.order.push(params.requestId);
    }
    if (message.method === 'Network.responseReceived') net.responses.set(params.requestId, params.response);
    if (message.method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      consoleErrors.push((params.args || []).map(arg => arg.value || arg.description || '').join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text);
    }
    if (message.method === 'Fetch.requestPaused' && fulfillHandler) fulfillHandler(params);
  };

  function connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      let id = 1;
      const pending = new Map();
      socket.onopen = () => resolve({
        send(method, params = {}) {
          const number = id++;
          return new Promise((res, rej) => {
            pending.set(number, { res, rej });
            socket.send(JSON.stringify({ id: number, method, params }));
          });
        },
        close() { socket.close(); }
      });
      socket.onerror = reject;
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          const { res, rej } = pending.get(message.id);
          pending.delete(message.id);
          message.error ? rej(new Error(JSON.stringify(message.error))) : res(message.result);
        } else if (message.method) onEvent(message);
      };
    });
  }

  const results = [];
  function record(name, pass, details) {
    results.push({ name, status: pass ? 'PASS' : 'FAIL', details });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(details)}`);
  }

  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, PAGE_URL], { stdio: 'ignore' });

  try {
    const targets = await endpoint();
    connection = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await connection.send('Runtime.enable');
    await connection.send('Page.enable');
    await connection.send('Network.enable');
    await sleep(1200);

    const evaluate = async expression => {
      const result = await connection.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'evaluate failed');
      return result.result.value;
    };
    const waitFor = async (expression, timeout = 20000) => {
      const deadline = Date.now() + timeout;
      let value = false;
      while (Date.now() < deadline) {
        value = await evaluate(expression);
        if (value) return value;
        await sleep(150);
      }
      throw new Error(`Timeout waiting for ${expression}; last=${JSON.stringify(value)}`);
    };
    const shot = async filename => {
      const result = await connection.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      fs.writeFileSync(path.join(EVIDENCE_DIR, filename), Buffer.from(result.data, 'base64'));
    };
    const clearNet = () => { net.requests.clear(); net.responses.clear(); net.order.length = 0; };
    const apiUrls = () => net.order.map(id => net.requests.get(id)?.url || '').filter(url => url.startsWith('https://fakestoreapi.com'));
    const reload = async () => {
      clearNet();
      await connection.send('Page.navigate', { url: PAGE_URL });
      await waitFor("document.readyState === 'complete'", 20000);
      await waitFor("document.querySelectorAll('#product-grid .card').length > 0 || !document.getElementById('state-box').hidden", 20000);
    };
    const closeDialogs = async () => {
      await evaluate("document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close())");
    };
    const throttle = async (on) => {
      if (on) {
        await connection.send('Network.emulateNetworkConditions', {
          offline: false, latency: 2000,
          downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8,
          connectionType: 'cellular3g'
        });
      } else {
        await connection.send('Network.emulateNetworkConditions', {
          offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none'
        });
      }
    };

    // 5.3 + 5.5: GET /products/{id} actually reaches the Network and drives the dialog.
    await reload();
    await closeDialogs();
    clearNet();
    await evaluate("document.querySelector('#product-grid [data-action=\"details\"]').click()");
    await waitFor("!!document.querySelector('#product-dialog-body .product-detail')", 20000);
    const detailUrls = apiUrls();
    const detailInfo = await evaluate(`(() => {
      const view = document.querySelector('#product-dialog-body .product-detail');
      return {
        open: document.getElementById('product-dialog').open,
        title: view.querySelector('h2').textContent,
        price: view.querySelector('.detail-price').textContent,
        busy: document.getElementById('product-dialog-body').hasAttribute('aria-busy')
      };
    })()`);
    const independent = await evaluate(`(async () => {
      const response = await fetch('https://fakestoreapi.com/products/1');
      const product = await response.json();
      return { status: response.status, title: product.title, price: product.price };
    })()`);
    record('5.5 details fetched from GET /products/{id}',
      detailUrls.includes('https://fakestoreapi.com/products/1') && detailInfo.open && !detailInfo.busy &&
      detailInfo.title === independent.title && detailInfo.price.includes(String(independent.price)),
      { detailUrls, detailInfo, independent, networkStatus: net.responses.get(net.order.find(id => net.requests.get(id)?.url === 'https://fakestoreapi.com/products/1'))?.status });

    // 5.4: category path parameter + server-side query parameters in the Network tab.
    clearNet();
    await evaluate("document.querySelector('#category-chips [data-category=\"electronics\"]').click()");
    await waitFor("document.querySelectorAll('#product-grid .card').length > 0 && document.querySelector('#category-chips [data-category=\"electronics\"]').classList.contains('chip-active')", 20000);
    const categoryUrl = apiUrls().find(url => url.includes('/products/category/'));
    const parsedCategory = categoryUrl ? new URL(categoryUrl) : null;
    record('5.4 path + query params in Network',
      !!parsedCategory && parsedCategory.pathname === '/products/category/electronics' &&
      parsedCategory.searchParams.get('limit') === '20' && parsedCategory.searchParams.get('sort') === 'asc',
      { categoryUrl, path: parsedCategory?.pathname, query: parsedCategory ? Object.fromEntries(parsedCategory.searchParams) : null });
    await shot('network-category.png');

    // 5.3: Slow 3G loading states for the grid and the detail dialog.
    await throttle(true);
    clearNet();
    // نقر حقيقي على شريحة "الكل" يبدأ طلباً جديداً؛ الهيكل يُرسم فوراً قبل انتظار الـ API.
    await evaluate("document.querySelector('#category-chips [data-category=\"all\"]').click()");
    await waitFor("document.getElementById('product-grid').getAttribute('aria-busy') === 'true' && document.querySelectorAll('#product-grid .skeleton-card').length > 0", 10000);
    await shot('loading-grid-3g.png');
    const slowGridLoading = await evaluate(`(() => ({
      busy: document.getElementById('product-grid').getAttribute('aria-busy'),
      skeletons: document.querySelectorAll('#product-grid .skeleton-card').length,
      cards: document.querySelectorAll('#product-grid .card').length
    }))()`);
    await waitFor("document.querySelectorAll('#product-grid .card').length === 20 && !document.getElementById('product-grid').hasAttribute('aria-busy')", 40000);
    const slowGridDone = await evaluate(`(() => ({
      busy: document.getElementById('product-grid').hasAttribute('aria-busy'),
      cards: document.querySelectorAll('#product-grid .card').length,
      stateHidden: document.getElementById('state-box').hidden
    }))()`);
    record('5.3 Slow 3G grid loading then cleanup',
      slowGridLoading.busy === 'true' && slowGridLoading.skeletons > 0 &&
      slowGridDone.busy === false && slowGridDone.cards === 20 && slowGridDone.stateHidden === true,
      { slowGridLoading, slowGridDone });

    clearNet();
    await evaluate("document.querySelector('#product-grid [data-action=\"details\"]').click()");
    await waitFor("document.getElementById('product-dialog-body').getAttribute('aria-busy') === 'true' && !!document.querySelector('#product-dialog-body .skeleton-line')", 25000);
    await shot('loading-details-3g.png');
    const slowDetailLoading = await evaluate(`(() => ({
      busy: document.getElementById('product-dialog-body').getAttribute('aria-busy'),
      skeletons: document.querySelectorAll('#product-dialog-body .skeleton-line').length
    }))()`);
    await waitFor("!!document.querySelector('#product-dialog-body .product-detail') && !document.getElementById('product-dialog-body').hasAttribute('aria-busy')", 40000);
    const slowDetailDone = await evaluate(`(() => ({
      busy: document.getElementById('product-dialog-body').hasAttribute('aria-busy'),
      title: document.querySelector('#product-dialog-body h2').textContent
    }))()`);
    record('5.3 + 5.5 Slow 3G detail loading then cleanup',
      slowDetailLoading.busy === 'true' && slowDetailLoading.skeletons > 0 &&
      slowDetailDone.busy === false && slowDetailDone.title === independent.title,
      { slowDetailLoading, slowDetailDone, detailUrls: apiUrls() });
    await throttle(false);
    await closeDialogs();

    // 5.3: network interruption on /products, then the real Retry button.
    await connection.send('Network.setBlockedURLs', { urls: ['*fakestoreapi.com/products?*'] });
    await reload();
    await waitFor("!document.getElementById('state-box').hidden && !document.getElementById('btn-retry').hidden && document.querySelectorAll('#product-grid .card').length === 0 && !document.getElementById('product-grid').hasAttribute('aria-busy')", 25000);
    await shot('error-grid.png');
    const failedState = await evaluate(`(() => ({
      title: document.getElementById('state-title').textContent,
      retryVisible: !document.getElementById('btn-retry').hidden,
      busy: document.getElementById('product-grid').hasAttribute('aria-busy'),
      cards: document.querySelectorAll('#product-grid .card').length
    }))()`);
    await connection.send('Network.setBlockedURLs', { urls: [] });
    clearNet();
    await evaluate("document.getElementById('btn-retry').click()");
    await waitFor("document.querySelectorAll('#product-grid .card').length === 20 && document.getElementById('state-box').hidden && !document.getElementById('product-grid').hasAttribute('aria-busy')", 25000);
    const retriedState = await evaluate(`(() => ({
      busy: document.getElementById('product-grid').hasAttribute('aria-busy'),
      cards: document.querySelectorAll('#product-grid .card').length,
      stateHidden: document.getElementById('state-box').hidden
    }))()`);
    record('5.3 network interruption + retry',
      failedState.retryVisible && failedState.busy === false && failedState.cards === 0 &&
      retriedState.busy === false && retriedState.cards === 20 && retriedState.stateHidden === true,
      { failedState, retriedState, retryUrl: apiUrls()[0] });

    // 5.5: detail error state + retry inside the dialog.
    await closeDialogs();
    await connection.send('Network.setBlockedURLs', { urls: ['*fakestoreapi.com/products/1'] });
    clearNet();
    await evaluate("document.querySelector('#product-grid [data-action=\"details\"]').click()");
    await waitFor("!!document.querySelector('#product-dialog-body .state-box') && !document.getElementById('product-dialog-body').hasAttribute('aria-busy')", 25000);
    await shot('error-details.png');
    const detailFailed = await evaluate(`(() => ({
      text: document.getElementById('product-dialog-body').textContent.trim(),
      retry: !!document.querySelector('#product-dialog-body .state-box button'),
      busy: document.getElementById('product-dialog-body').hasAttribute('aria-busy')
    }))()`);
    await connection.send('Network.setBlockedURLs', { urls: [] });
    await evaluate("document.querySelector('#product-dialog-body .state-box button').click()");
    await waitFor("!!document.querySelector('#product-dialog-body .product-detail')", 25000);
    const detailRetried = await evaluate(`(() => ({
      title: document.querySelector('#product-dialog-body h2').textContent,
      busy: document.getElementById('product-dialog-body').hasAttribute('aria-busy')
    }))()`);
    record('5.5 detail error + retry',
      /Could not load details|تعذّر تحميل التفاصيل/.test(detailFailed.text) && detailFailed.retry && !detailFailed.busy &&
      detailRetried.title === independent.title && !detailRetried.busy,
      { detailFailed, detailRetried });
    await closeDialogs();

    // 5.5: empty response for a missing id (real 200 with an empty body).
    fulfillHandler = params => {
      connection.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'application/json' },
          { name: 'content-length', value: '0' },
          { name: 'access-control-allow-origin', value: '*' }
        ],
        body: ''
      }).catch(() => {});
    };
    await connection.send('Fetch.enable', { patterns: [{ urlPattern: '*fakestoreapi.com/products/1', requestStage: 'Request' }] });
    clearNet();
    await evaluate("document.querySelector('#product-grid [data-action=\"details\"]').click()");
    await waitFor("!!document.querySelector('#product-dialog-body .state-box') && !document.getElementById('product-dialog-body').hasAttribute('aria-busy')", 25000);
    const emptyDetail = await evaluate(`(() => ({
      text: document.getElementById('product-dialog-body').textContent.trim(),
      busy: document.getElementById('product-dialog-body').hasAttribute('aria-busy')
    }))()`);
    await connection.send('Fetch.disable');
    fulfillHandler = null;
    record('5.5 missing id / empty response',
      /No product for this id|لا يوجد منتج بهذا المعرّف/.test(emptyDetail.text) && !emptyDetail.busy,
      { emptyDetail });
    await closeDialogs();

    // 5.3: a category returning [] shows the Empty state, not a loading grid.
    fulfillHandler = params => {
      connection.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'application/json' },
          { name: 'access-control-allow-origin', value: '*' }
        ],
        body: Buffer.from(JSON.stringify(['electronics', 'unknown'])).toString('base64')
      }).catch(() => {});
    };
    await connection.send('Fetch.enable', { patterns: [{ urlPattern: '*fakestoreapi.com/products/categories', requestStage: 'Request' }] });
    await reload();
    await waitFor("!!document.querySelector('#category-chips [data-category=\"unknown\"]')", 25000);
    await connection.send('Fetch.disable');
    fulfillHandler = null;
    await evaluate("document.querySelector('#category-chips [data-category=\"unknown\"]').click()");
    await waitFor("!document.getElementById('state-box').hidden && document.querySelectorAll('#product-grid .card').length === 0 && !document.getElementById('product-grid').hasAttribute('aria-busy')", 25000);
    await shot('empty-grid.png');
    const emptyGrid = await evaluate(`(() => ({
      title: document.getElementById('state-title').textContent,
      cards: document.querySelectorAll('#product-grid .card').length,
      busy: document.getElementById('product-grid').hasAttribute('aria-busy')
    }))()`);
    record('5.3 empty list state',
      /Nothing here|لا يوجد شيء هنا/.test(emptyGrid.title) && emptyGrid.cards === 0 && !emptyGrid.busy,
      { emptyGrid });

    record('Console clean', consoleErrors.length === 0 && exceptions.length === 0, { consoleErrors, exceptions });

    const evidence = {
      generatedAt: new Date().toISOString(),
      tool: 'Google Chrome headless via CDP (Runtime.evaluate, Network, Fetch, Slow 3G emulation)',
      results,
      screenshots: ['network-category.png', 'loading-grid-3g.png', 'loading-details-3g.png', 'error-grid.png', 'error-details.png', 'empty-grid.png']
    };
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'runtime-tests.json'), JSON.stringify(evidence, null, 2));
    const failed = results.filter(entry => entry.status === 'FAIL');
    console.log(`\n${results.length - failed.length}/${results.length} PASS; saved ${path.join(EVIDENCE_DIR, 'runtime-tests.json')}`);
    if (failed.length) process.exitCode = 1;
  } finally {
    if (connection) connection.close();
    child.kill();
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (error) {}
  }
})().catch(error => { console.error('M5 runtime harness error:', error); process.exitCode = 1; });

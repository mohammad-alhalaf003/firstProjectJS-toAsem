const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m5-api-' + Date.now();
const PORT = 9381;
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
function connect(url, onEvent) {
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

(async () => {
  const source = fs.readFileSync('C:\\projects\\firstProjectJS-toAsem\\script.js', 'utf8');
  const demoUser = (source.match(/login-username'\)\.value = '([^']+)'/) || [])[1];
  const demoPassword = (source.match(/login-password'\)\.value = '([^']+)'/) || [])[1];
  if (!demoUser || !demoPassword) throw new Error('Could not locate demo credentials for the login probe');

  const network = { requests: new Map(), responses: new Map(), finished: new Map(), order: [] };
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, PAGE_URL], { stdio: 'ignore' });
  let connection;
  try {
    const targets = await endpoint();
    connection = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl, message => {
      const params = message.params || {};
      if (message.method === 'Network.requestWillBeSent') {
        network.requests.set(params.requestId, params.request);
        network.order.push(params.requestId);
      }
      if (message.method === 'Network.responseReceived') network.responses.set(params.requestId, params.response);
      if (message.method === 'Network.loadingFinished') network.finished.set(params.requestId, params);
    });
    await connection.send('Runtime.enable');
    await connection.send('Network.enable');
    await sleep(1500);

    const evaluate = async expression => {
      const result = await connection.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'evaluate error');
      return result.result.value;
    };
    const redact = value => (value === demoUser || value === demoPassword || /^\$?[a-zA-Z0-9_-]{20,}$/.test(String(value || '')) ? '[redacted]' : value);

    async function probe(label, expression, sensitive = false, expectedMethod = 'GET') {
      const before = network.order.length;
      const consoleResult = await evaluate(expression);
      await sleep(250);
      const ids = network.order.slice(before).filter(id => {
        const request = network.requests.get(id);
        return request && request.method === expectedMethod;
      });
      const requestId = ids[ids.length - 1];
      const request = network.requests.get(requestId) || {};
      const response = network.responses.get(requestId) || {};
      const finished = network.finished.get(requestId) || {};
      const url = new URL(request.url || 'https://fakestoreapi.com/');
      const query = {};
      for (const [key, value] of url.searchParams.entries()) query[key] = value;
      const payload = sensitive ? '[redacted]' : (request.postData || null);
      const timing = finished.timing || {};
      return {
        label,
        consoleFetch: consoleResult,
        network: {
          request: {
            method: request.method,
            url: request.url,
            headers: Object.fromEntries(Object.entries(request.headers || {}).filter(([key]) =>
              ['accept', 'content-type', 'origin', 'referer', 'sec-fetch-mode', 'sec-fetch-site', 'user-agent'].includes(key.toLowerCase())))
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            mimeType: response.mimeType,
            headers: Object.fromEntries(Object.entries(response.headers || {}).filter(([key]) =>
              ['content-type', 'content-length', 'access-control-allow-origin', 'cache-control', 'date', 'server'].includes(key.toLowerCase())).map(([key, value]) => [key, sensitive ? '[redacted]' : value]))
          },
          payload: { path: url.pathname, query, body: payload },
          preview: consoleResult.preview,
          timing: {
            cdpSendStart: timing.sendStart,
            cdpReceiveHeadersEnd: timing.receiveHeadersEnd,
            wallMs: consoleResult.ms,
            resourceTiming: consoleResult.resourceTiming
          }
        }
      };
    }

    function fetchExpression(url, options) {
      const optionsText = options === undefined ? 'undefined' : JSON.stringify(options);
      return `(async () => {
        const started = performance.now();
        const response = await fetch(${JSON.stringify(url)}, ${optionsText});
        const text = await response.text();
        let data; try { data = JSON.parse(text); } catch (error) { data = text; }
        const preview = Array.isArray(data)
          ? { arrayLength: data.length, firstItemKeys: data[0] && typeof data[0] === 'object' ? Object.keys(data[0]) : [] }
          : (data && typeof data === 'object' ? { objectKeys: Object.keys(data), sampleTitle: data.title || null, sampleCategory: data.category || null, rating: data.rating || null } : { textLength: String(data).length });
        const timingEntry = performance.getEntriesByName(${JSON.stringify(url)}).slice(-1)[0];
        const resourceTiming = timingEntry ? {
          startTime: Math.round(timingEntry.startTime),
          responseEnd: Math.round(timingEntry.responseEnd),
          duration: Math.round(timingEntry.duration),
          transferSize: timingEntry.transferSize
        } : null;
        return { status: response.status, ok: response.ok, contentType: response.headers.get('content-type'), cors: response.headers.get('access-control-allow-origin'), ms: Math.round(performance.now() - started), preview, resourceTiming };
      })()`;
    }

    const results = [];
    results.push(await probe('GET /products?limit=5&sort=desc', fetchExpression('https://fakestoreapi.com/products?limit=5&sort=desc')));
    results.push(await probe('GET /products/1', fetchExpression('https://fakestoreapi.com/products/1')));
    results.push(await probe('GET /products/9999 (missing id)', fetchExpression('https://fakestoreapi.com/products/9999')));
    results.push(await probe('GET /products/categories', fetchExpression('https://fakestoreapi.com/products/categories')));
    results.push(await probe('GET /products/category/jewelery?limit=3&sort=asc', fetchExpression('https://fakestoreapi.com/products/category/jewelery?limit=3&sort=asc')));
    results.push(await probe('GET /products/category/unknown (empty)', fetchExpression('https://fakestoreapi.com/products/category/unknown')));
    results.push(await probe('GET /users?limit=2', fetchExpression('https://fakestoreapi.com/users?limit=2')));
    const wrongOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'invalid-user-for-probe', password: 'invalid-password-for-probe' }) };
    results.push(await probe('POST /auth/login (invalid credentials)', fetchExpression('https://fakestoreapi.com/auth/login', wrongOptions), false, 'POST'));
    const validOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: demoUser, password: demoPassword }) };
    results.push(await probe('POST /auth/login (valid credentials, redacted)', fetchExpression('https://fakestoreapi.com/auth/login', validOptions), true, 'POST'));
    results.push(await probe('POST /carts', fetchExpression('https://fakestoreapi.com/carts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 1, date: '2026-11-25', products: [{ productId: 1, quantity: 1 }] }) }), false, 'POST'));

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const evidence = {
      generatedAt: new Date().toISOString(),
      tool: 'Google Chrome headless via CDP; requests issued with fetch() in Runtime.evaluate (browser Console equivalent)',
      note: 'Credentials and tokens are redacted. Postman/Apidog were not installed on this machine.',
      probes: results
    };
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'api-probe.json'), JSON.stringify(evidence, null, 2));

    console.log(JSON.stringify(results.map(entry => ({
      label: entry.label,
      status: entry.consoleFetch.status,
      contentType: entry.consoleFetch.contentType,
      cors: entry.consoleFetch.cors,
      networkCors: Object.entries(entry.network.response.headers).find(([key]) => key.toLowerCase() === 'access-control-allow-origin'),
      ms: entry.consoleFetch.ms,
      preview: entry.consoleFetch.preview,
      method: entry.network.request.method,
      networkStatus: entry.network.response.status,
      query: entry.network.payload.query,
      path: entry.network.payload.path,
      timingEnd: entry.network.timing.receiveHeadersEnd
    })), null, 2));
    console.log('\nSaved ' + path.join(EVIDENCE_DIR, 'api-probe.json'));
  } finally {
    if (connection) connection.close();
    child.kill();
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (error) {}
  }
})().catch(error => { console.error('M5 API probe error:', error); process.exitCode = 1; });

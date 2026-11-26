const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\final';
const APP_URL = 'file:///C:/projects/firstProjectJS-toAsem/index.html';
const TEMP_ROOT = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode';
const PORT = 9412;
const PROFILE = path.join(TEMP_ROOT, `profile-network-${Date.now()}`);
const DEMO_USERNAME = process.env.STOREDEMO_USER;
const DEMO_PASSWORD = process.env.STOREDEMO_PASS;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(OUT, { recursive: true });
if (!DEMO_USERNAME || !DEMO_PASSWORD) {
  throw new Error('Set STOREDEMO_USER and STOREDEMO_PASS to the public FakeStoreAPI demo credentials before running this harness.');
}

function redact(value, key = '') {
  if (/^(password|token|authorization|username|email|phone|name|firstname|lastname)$/i.test(key)) return '[redacted]';
  if (typeof value === 'string') {
    return value
      .replace(/("?(?:password|token|authorization|username|email|phone)"?\s*[:=]\s*"?)[^",}\s]+/gi, '$1[redacted]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
      .replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted-token]');
  }
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]));
  }
  return value;
}

function parseBody(text) {
  try {
    const parsed = JSON.parse(text);
    return redact(parsed);
  } catch (error) {
    return redact(text);
  }
}

function connect(url, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 1;
    const pending = new Map();
    const requests = [];
    ws.onopen = () => resolve({
      label, requests,
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
      if (message.method === 'Network.requestWillBeSent' && String(message.params.request.url).includes('fakestoreapi.com')) {
        requests.push({
          url: message.params.request.url,
          method: message.params.request.method,
          headers: redact(message.params.request.headers || {}),
          postData: redact(message.params.request.postData || '')
        });
      }
      if (message.method === 'Network.responseReceived' && String(message.params.response.url).includes('fakestoreapi.com')) {
        const match = [...requests].reverse().find((entry) => entry.url === message.params.response.url);
        if (match) {
          match.status = message.params.response.status;
          match.statusText = message.params.response.statusText;
          match.mimeType = message.params.response.mimeType;
          match.responseHeaders = redact(message.params.response.headers || {});
        }
      }
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        message.error ? entry.rej(new Error(JSON.stringify(message.error))) : entry.res(message.result);
      }
    };
  });
}

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

(async () => {
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`, APP_URL], { stdio: 'ignore' });
  let browser = null;
  let client = null;
  const endpoints = [];
  try {
    browser = await connect((await version()).webSocketDebuggerUrl, 'browser');
    const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const page = (await response.json()).find((entry) => entry.type === 'page');
    client = await connect(page.webSocketDebuggerUrl, 'network');
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Network.enable');
    await client.send('Page.navigate', { url: APP_URL });
    await sleep(3500);

    const ev = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'evaluate failed');
      return result.result.value;
    };

    const probe = async (label, method, url, body, options = {}) => {
      const before = client.requests.length;
      const expression = `(async()=>{
        const response=await fetch(${JSON.stringify(url)},{
          method:${JSON.stringify(method)},
          headers:${JSON.stringify(body ? { 'Content-Type': 'application/json' } : {})},
          body:${body ? JSON.stringify(JSON.stringify(body)) : 'undefined'}
        });
        const text=await response.text();
        return {status:response.status,statusText:response.statusText,contentType:response.headers.get('content-type')||'',body:text.slice(0,4000)};
      })()`;
      const outcome = await ev(expression);
      await sleep(180);
      const captured = client.requests.slice(before).reverse().find((entry) => entry.url === url && entry.method === method) || {};
      endpoints.push({
        label,
        request: { url: captured.url || url, method: captured.method || method, headers: captured.headers || {}, postData: captured.postData || (body ? redact(body) : '') },
        response: { status: outcome.status, statusText: outcome.statusText, contentType: outcome.contentType, body: options.noBody ? '[shape only]' : parseBody(outcome.body) }
      });
    };

    await probe('GET products with query', 'GET', 'https://fakestoreapi.com/products?limit=20&sort=asc');
    await probe('GET product by id', 'GET', 'https://fakestoreapi.com/products/1');
    await probe('GET categories', 'GET', 'https://fakestoreapi.com/products/categories');
    await probe('GET category with path + query', 'GET', 'https://fakestoreapi.com/products/category/electronics?limit=5&sort=desc');
    await probe('GET users (shape only, no PII)', 'GET', 'https://fakestoreapi.com/users?limit=2', null, { noBody: true });
    await probe('POST products', 'POST', 'https://fakestoreapi.com/products', {
      title: 'Audit product', price: 9.99, description: 'final audit', image: 'https://fakestoreapi.com/img/x.jpg', category: 'electronics'
    });
    await probe('PUT products/1', 'PUT', 'https://fakestoreapi.com/products/1', {
      title: 'Audit edit', price: 12.5, description: 'final audit', image: 'https://fakestoreapi.com/img/x.jpg', category: 'electronics'
    });
    await probe('DELETE products/2', 'DELETE', 'https://fakestoreapi.com/products/2');
    await probe('POST auth/login valid', 'POST', 'https://fakestoreapi.com/auth/login', { username: DEMO_USERNAME, password: DEMO_PASSWORD });
    await probe('POST auth/login invalid', 'POST', 'https://fakestoreapi.com/auth/login', { username: 'invalid-user-for-probe', password: 'invalid-password-for-probe' });
    await probe('POST carts', 'POST', 'https://fakestoreapi.com/carts', {
      userId: 1, date: new Date().toISOString().slice(0, 10), products: [{ productId: 3, quantity: 2 }]
    });
    await probe('GET unknown id (empty body)', 'GET', 'https://fakestoreapi.com/products/999999');
    await probe('GET wrong URL (404)', 'GET', 'https://fakestoreapi.com/this-endpoint-does-not-exist');

    fs.writeFileSync(path.join(OUT, 'network-evidence.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'All bodies are actual fetch() responses. Login token and public demo user PII are redacted.',
      endpoints
    }, null, 2));
    console.log(JSON.stringify({ endpoints: endpoints.length, statuses: endpoints.map((entry) => `${entry.label}: ${entry.response.status}`) }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try { await browser?.send('Browser.close'); } catch (error) {}
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(5000)]);
    if (child.exitCode === null) child.kill();
  }
})();

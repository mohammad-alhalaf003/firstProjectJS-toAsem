const { spawn } = require('child_process');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\cdp-m4-' + Date.now();
const PORT = 9369;
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
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
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
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, URL], { stdio: 'ignore' });
  let connection;
  try {
    const targets = await endpoint();
    connection = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await connection.send('Runtime.enable');
    await connection.send('Page.enable');
    await connection.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__errs = [];
        window.addEventListener('error', e => __errs.push(String(e.message)));
        window.addEventListener('unhandledrejection', e => __errs.push(String(e.reason)));
        window.__m4 = { registrations: [] };
        const nativeAdd = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, handler, options) {
          let label = 'other';
          if (this && this.id) label = '#' + this.id;
          else if (this && this.classList && this.classList.contains('card')) label = '.card';
          else if (this && typeof this.matches === 'function' && this.matches('.detail-meta .btn')) label = '.detail-add-btn';
          else if (this && this.nodeName) label = this.nodeName;
          window.__m4.registrations.push({ label, type: String(type) });
          return nativeAdd.call(this, type, handler, options);
        };
      `
    });

    const evaluate = async expression => {
      const result = await connection.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(expression.slice(0, 100) + ' -> ' + (result.exceptionDetails.exception?.description || 'error'));
      return result.result.value;
    };
    const point = async selector => evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    const clickSelector = async selector => {
      const position = await point(selector);
      if (!position) return false;
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await connection.send('Input.dispatchMouseEvent', { type, x: position.x, y: position.y, button: 'left', clickCount: 1 });
      }
      return true;
    };
    const counts = () => evaluate(`(() => {
      const rows = window.__m4.registrations;
      return {
        gridClick: rows.filter(row => row.label === '#product-grid' && row.type === 'click').length,
        gridPointerMove: rows.filter(row => row.label === '#product-grid' && row.type === 'pointermove').length,
        cardListeners: rows.filter(row => row.label === '.card').length,
        detailAddListeners: rows.filter(row => row.label === '.detail-add-btn').length,
        total: rows.length
      };
    })()`);
    const rerenderMany = times => evaluate(`(() => {
      const control = document.getElementById('sort-select');
      for (let index = 0; index < ${times}; index += 1) {
        control.value = index % 2 === 0 ? 'price-asc' : 'price-desc';
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
      control.value = 'default';
      control.dispatchEvent(new Event('change', { bubbles: true }));
      return document.querySelectorAll('#product-grid .card').length;
    })()`);

    const report = {};
    for (const width of [320, 1280]) {
      await connection.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await connection.send('Page.reload', { ignoreCache: true });
      await sleep(1800);

      const result = {};
      result.loadedCards = await evaluate(`document.querySelectorAll('#product-grid .card').length`);
      result.listenersBefore = await counts();
      result.cardsAfterRerender = await rerenderMany(12);
      result.listenersAfter = await counts();

      // Counts must be identical across re-renders — this is the M4 no-duplicate-listener claim.
      const stableAcrossRerenders = JSON.stringify(result.listenersBefore) === JSON.stringify(result.listenersAfter);

      result.favoriteBeforeClick = Number(await evaluate(`document.getElementById('fav-count').textContent`));
      result.favoriteClicked = await clickSelector('#product-grid .card .btn-fav');
      await sleep(250);
      result.favoriteCountAfterOneClick = Number(await evaluate(`document.getElementById('fav-count').textContent`));

      result.cartBeforeClick = Number(await evaluate(`document.getElementById('cart-count').textContent`));
      result.addClicked = await clickSelector('#product-grid .card .add-btn');
      await sleep(250);
      result.cartCountAfterOneClick = Number(await evaluate(`document.getElementById('cart-count').textContent`));

      result.detailsClicked = await clickSelector('#product-grid .card .card-media');
      await sleep(250);
      result.detail = await evaluate(`({
        open: document.getElementById('product-dialog').open,
        views: document.querySelectorAll('#product-dialog-body .product-detail').length
      })`);
      await evaluate(`document.getElementById('product-dialog').close()`);

      await rerenderMany(12);
      result.favoriteClickedAgain = await clickSelector('#product-grid .card .btn-fav');
      await sleep(250);
      result.favoriteCountAfterSecondClick = Number(await evaluate(`document.getElementById('fav-count').textContent`));
      result.listenersFinal = await counts();
      result.errors = await evaluate(`window.__errs`);

      result.checks = {
        loadedTwentyCards: result.loadedCards === 20 && result.cardsAfterRerender === 20,
        oneGridClickListener: result.listenersBefore.gridClick === 1 && result.listenersFinal.gridClick === 1,
        noCardListeners: result.listenersBefore.cardListeners === 0
          && result.listenersAfter.cardListeners === 0 && result.listenersFinal.cardListeners === 0,
        listenerCountsStableAcrossRerenders: stableAcrossRerenders,
        onlyDetailButtonAdded: result.listenersFinal.total - result.listenersBefore.total === result.listenersFinal.detailAddListeners,
        favoriteFiresOnce: result.favoriteCountAfterOneClick === result.favoriteBeforeClick + 1
          && result.favoriteCountAfterSecondClick === result.favoriteBeforeClick,
        cartFiresOnce: result.cartCountAfterOneClick === result.cartBeforeClick + 1,
        detailFiresOnce: result.detail.open === true && result.detail.views === 1,
        noErrors: Array.isArray(result.errors) && result.errors.length === 0
      };
      result.status = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
      report[width] = result;
    }
    console.log(JSON.stringify(report, null, 2));
    const allPass = Object.values(report).every(entry => entry.status === 'PASS');
    console.log('\nM4 runtime delegation test: ' + (allPass ? 'PASS' : 'FAIL'));
    if (!allPass) process.exitCode = 1;
  } catch (error) {
    console.error('M4 runtime test error:', error);
    process.exitCode = 1;
  } finally {
    if (connection) connection.close();
    child.kill();
  }
})();

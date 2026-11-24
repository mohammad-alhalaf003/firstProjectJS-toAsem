/* ==========================================================================
   StorePulse — script.js
   كل السلوك هنا: طلبات الـ API، اللغة، الثيم، السلة، المفضلة، الدخول، النوافذ،
   والتفاعلات الصغيرة (مؤشر ماوس مخصص، إمالة البطاقات، شريط التقدم، الإشعارات).
   لا مكتبات خارجية — fetch الأصلية فقط.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- 1) الثوابت ---------- */
  const BASE_URL = 'https://fakestoreapi.com';
  const TIMEOUT_MS = 15000;
  const LANGS = ['both', 'ar', 'en'];

  const KEYS = {
    theme: 'storepulse_theme',
    lang: 'storepulse_shop_lang',
    cart: 'storepulse_cart',
    favorites: 'storepulse_favorites',
    orders: 'storepulse_orders'
  };

  // أسماء الفئات كما هي في الـ API + ترجمة للعرض والبحث العربي.
  const CATEGORY_AR = {
    electronics: 'إلكترونيات',
    jewelery: 'مجوهرات',
    "men's clothing": 'ملابس رجالية',
    "women's clothing": 'ملابس نسائية'
  };

  // كلمات عربية مساعدة للبحث في عناوين المنتجات (الإنجليزية).
  const AR_KEYWORDS = {
    backpack: 'حقيبة ظهر حقيبة',
    bag: 'حقيبة',
    shirt: 'قميص تيشيرت ملابس',
    't-shirt': 'تيشيرت قميص',
    watch: 'ساعة',
    ring: 'خاتم مجوهرات',
    bracelet: 'سوار مجوهرات',
    earring: 'أقراط مجوهرات',
    shoes: 'حذاء',
    jeans: 'بنطال جينز',
    jacket: 'جاكيت ستره',
    dress: 'فستان',
    speaker: 'مكبر صوت سماعة',
    headphone: 'سماعة رأس',
    laptop: 'لابتوب حاسوب',
    phone: 'هاتف جوال',
    mouse: 'ماوس فأرة',
    keyboard: 'لوحة مفاتيح'
  };

  /* ---------- 2) أدوات صغيرة ---------- */
  const $ = (id) => document.getElementById(id);

  // localStorageHelper: قد يرمي خطأ في الوضع الخاص، لذلك نغلّفه بـ try/catch.
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* نتجاهل */ }
    }
  };

  // إنشاء عنصر بسطر واحد. نستخدم textContent دائماً (لا innerHTML مع بيانات الـ API).
  function el(tag, opts, ...children) {
    const node = document.createElement(tag);
    const o = opts || {};
    if (o.cls) node.className = o.cls;
    if (o.text !== undefined) node.textContent = String(o.text);
    if (o.attrs) Object.entries(o.attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    children.forEach((child) => { if (child) node.append(child); });
    return node;
  }

  // نسختان من كل نص: إنجليزية وعربية. الـ CSS يقرر أيهما يظهر حسب data-lang.
  function bi(en, ar, block) {
    const frag = document.createDocumentFragment();
    const extra = block ? ' bi-block' : '';
    frag.append(
      el('span', { cls: 'bi-en' + extra, text: en, attrs: { lang: 'en' } }),
      el('span', { cls: 'bi-ar' + extra, text: ar, attrs: { lang: 'ar', dir: 'rtl' } })
    );
    return frag;
  }

  const money = (value) => '$' + Number(value || 0).toFixed(2);
  const categoryAr = (cat) => CATEGORY_AR[cat] || cat;

  /* ---------- 3) الحالة ---------- */
  // حماية من أي قيمة تالفة في localStorage (مثلاً نص بدل مصفوفة).
  const savedFavorites = store.get(KEYS.favorites, []);
  const savedCart = store.get(KEYS.cart, []);
  const savedOrders = store.get(KEYS.orders, []);

  const state = {
    lang: 'both',
    theme: 'light',
    products: [],       // كل المنتجات من /products
    viewProducts: [],   // المنتجات المعروضة حالياً (كلها أو فئة واحدة)
    categories: [],
    category: 'all',
    search: '',
    sort: 'default',
    favoritesOnly: false,
    favorites: new Set(Array.isArray(savedFavorites) ? savedFavorites : []),
    cart: Array.isArray(savedCart) ? savedCart : [],
    orders: Array.isArray(savedOrders) ? savedOrders : [],
    users: [],
    user: null,
    token: null,        // الـ token في الذاكرة فقط — لا يُحفظ أبداً
    pendingCheckout: false,
    loadToken: 0,
    currentUrl: BASE_URL + '/products',
    lastFocus: null
  };

  /* ---------- 4) اللغة والثيم ---------- */
  function applyLang(mode) {
    const m = LANGS.includes(mode) ? mode : 'both';
    state.lang = m;
    document.documentElement.setAttribute('data-lang', m);
    document.documentElement.setAttribute('lang', m === 'ar' ? 'ar' : 'en');
    document.documentElement.setAttribute('dir', m === 'ar' ? 'rtl' : 'ltr');
    const radio = $('lang-' + m);
    if (radio) radio.checked = true;
    store.set(KEYS.lang, m);
  }

  function applyTheme(mode) {
    const m = mode === 'dark' ? 'dark' : 'light';
    state.theme = m;
    document.documentElement.setAttribute('data-theme', m);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', m === 'dark' ? '#0a0e18' : '#4f46e5');
    store.set(KEYS.theme, m);
  }

  function setupLanguageAndTheme() {
    const savedLang = store.get(KEYS.lang, null);
    applyLang(savedLang === null ? 'both' : savedLang);

    const savedTheme = store.get(KEYS.theme, null);
    applyTheme(savedTheme === null
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : savedTheme);

    document.querySelectorAll('input[name="shop-lang"]').forEach((input) => {
      input.addEventListener('change', () => applyLang(input.value));
    });

    $('btn-theme-toggle').addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------- 5) الإشعارات ---------- */
  function toast(en, ar, kind) {
    const box = $('toast-container');
    const type = kind || 'success';
    const icon = type === 'error' ? '!' : type === 'info' ? 'i' : '✓';
    const node = el('div', { cls: 'toast ' + type },
      el('span', { cls: 'toast-icon', text: icon, attrs: { 'aria-hidden': 'true' } }),
      el('span', {}, bi(en, ar, true))
    );
    box.append(node);
    while (box.children.length > 3) box.firstElementChild.remove();

    setTimeout(() => {
      node.classList.add('toast-leaving');
      setTimeout(() => node.remove(), 260);
    }, 3200);
  }

  /* ---------- 6) طلبات الـ API ---------- */
  async function apiRequest(url, options) {
    // فحص بسيط: لا نرسل إلا إلى الخادم المسموح.
    if (new URL(url, BASE_URL).origin !== BASE_URL) {
      return { ok: false, status: 0, data: null, isJson: false, text: '', blocked: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
      const text = await response.text();
      let data = null;
      let isJson = false;
      if (text) {
        try { data = JSON.parse(text); isJson = true; } catch (e) { data = text; }
      }
      return { ok: response.ok, status: response.status, data: data, isJson: isJson, text: text };
    } catch (err) {
      return { ok: false, status: 0, data: null, isJson: false, text: '', error: err, networkError: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- 7) الحالات المرئية ---------- */
  function showSkeleton(count) {
    const grid = $('product-grid');
    grid.setAttribute('aria-busy', 'true');
    grid.replaceChildren();
    for (let i = 0; i < (count || 8); i += 1) {
      grid.append(
        el('div', { cls: 'skeleton-card', attrs: { 'aria-hidden': 'true' } },
          el('div', { cls: 'skeleton-img' }),
          el('div', { cls: 'skeleton-line' }),
          el('div', { cls: 'skeleton-line short' }),
          el('div', { cls: 'skeleton-line tall' })
        )
      );
    }
  }

  function setState(titleEn, titleAr, textEn, textAr, showRetry) {
    const box = $('state-box');
    $('state-title').replaceChildren(bi(titleEn, titleAr));
    $('state-text').replaceChildren(bi(textEn, textAr, true));
    $('btn-retry').hidden = showRetry === false;
    box.hidden = false;
  }

  function hideState() { $('state-box').hidden = true; }

  /* ---------- 8) الفئات والمنتجات ---------- */
  function renderChips() {
    const wrap = $('category-chips');
    wrap.replaceChildren();

    const all = el('button', {
      cls: 'chip' + (state.category === 'all' ? ' chip-active' : ''),
      attrs: { type: 'button', 'data-category': 'all', 'aria-pressed': String(state.category === 'all') }
    }, bi('All products', 'كل المنتجات'));
    all.addEventListener('click', () => selectCategory('all'));
    wrap.append(all);

    state.categories.forEach((cat) => {
      const chip = el('button', {
        cls: 'chip' + (state.category === cat ? ' chip-active' : ''),
        attrs: { type: 'button', 'data-category': cat, 'aria-pressed': String(state.category === cat) }
      }, bi(cat, categoryAr(cat)));
      chip.addEventListener('click', () => selectCategory(cat));
      wrap.append(chip);
    });
  }

  async function loadCategories() {
    const result = await apiRequest(BASE_URL + '/products/categories');
    if (result.ok && Array.isArray(result.data)) {
      state.categories = result.data;
      renderChips();
    }
  }

  function selectCategory(cat) {
    state.category = cat;
    renderChips();
    const url = cat === 'all'
      ? BASE_URL + '/products'
      : BASE_URL + '/products/category/' + encodeURIComponent(cat);
    loadProducts(url);
  }

  function searchableText(product) {
    let text = [product.title, product.description, product.category, categoryAr(product.category)].join(' ').toLowerCase();
    Object.entries(AR_KEYWORDS).forEach(([key, words]) => {
      if (String(product.title).toLowerCase().includes(key)) text += ' ' + words;
    });
    return text;
  }

  function visibleProducts() {
    let list = state.viewProducts.slice();

    if (state.favoritesOnly) {
      list = list.filter((p) => state.favorites.has(p.id));
    }

    if (state.search) {
      const words = state.search.split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const text = searchableText(p);
        return words.every((w) => text.includes(w));
      });
    }

    if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (state.sort === 'rating-desc') list.sort((a, b) => (b.rating ? b.rating.rate : 0) - (a.rating ? a.rating.rate : 0));
    if (state.sort === 'title-asc') list.sort((a, b) => String(a.title).localeCompare(String(b.title)));

    return list;
  }

  function renderProducts() {
    const list = visibleProducts();
    const grid = $('product-grid');
    grid.removeAttribute('aria-busy');
    grid.replaceChildren();

    $('result-count').replaceChildren(bi(
      list.length + (state.category === 'all' ? ' products' : ' in this category'),
      list.length + (state.category === 'all' ? ' منتج' : ' منتج في هذه الفئة')
    ));

    if (list.length === 0) {
      if (state.favoritesOnly && state.favorites.size === 0) {
        setState('No favorites yet', 'لا توجد مفضلة بعد', 'Tap the heart on any product to save it here.', 'اضغط على القلب في أي منتج لحفظه هنا.', false);
      } else if (state.search) {
        setState('No matches', 'لا توجد نتائج', 'Try a different word or clear the search.', 'جرّب كلمة أخرى أو امسح البحث.', false);
      } else {
        setState('Nothing here', 'لا يوجد شيء هنا', 'This category returned an empty list.', 'أعادت هذه الفئة قائمة فارغة.', false);
      }
      return;
    }

    hideState();
    list.forEach((p) => grid.append(createCard(p)));
  }

  function createCard(product) {
    const card = el('article', { cls: 'card', attrs: { 'data-id': product.id } });

    const media = el('button', {
      cls: 'card-media',
      attrs: { type: 'button', 'aria-label': 'View details • عرض التفاصيل' }
    }, el('img', {
      attrs: { src: product.image, alt: product.title, loading: 'lazy' }
    }));
    media.addEventListener('click', () => openProductDialog(product));
    card.append(media);

    const badge = el('span', {
      cls: 'card-badge',
      attrs: { 'data-category': product.category }
    }, bi(product.category, categoryAr(product.category)));
    card.append(badge);

    const fav = el('button', {
      cls: 'btn-fav',
      attrs: { type: 'button', 'aria-pressed': String(state.favorites.has(product.id)), 'aria-label': 'Add to favorites • أضف للمفضلة' }
    }, el('svg', { attrs: { viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' } },
      el('path', { attrs: { d: 'M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z' } })
    ));
    fav.addEventListener('click', () => toggleFavorite(product.id, fav));
    card.append(fav);

    const rating = el('div', { cls: 'rating' },
      el('svg', { attrs: { viewBox: '0 0 24 24', width: '14', height: '14', 'aria-hidden': 'true' } },
        el('path', { attrs: { d: 'm12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8L2.2 9.2 9 8.2z' } })
      ),
      el('span', { cls: 'rate', text: product.rating ? product.rating.rate.toFixed(1) : '—' }),
      el('span', { text: product.rating ? '(' + product.rating.count + ')' : '' })
    );

    const add = el('button', { cls: 'btn btn-primary add-btn', attrs: { type: 'button' } },
      bi('Add', 'أضف'),
      el('svg', { attrs: { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'aria-hidden': 'true' } },
        el('path', { attrs: { d: 'M12 5v14M5 12h14' } })
      )
    );
    add.addEventListener('click', () => addToCart(product, add));

    card.append(
      el('div', { cls: 'card-body' },
        el('h3', { cls: 'card-title', text: product.title }),
        el('p', { cls: 'card-desc', text: product.description }),
        rating,
        el('div', { cls: 'card-footer' },
          el('span', { cls: 'price', text: money(product.price) }),
          add
        )
      )
    );

    // إمالة خفيفة للبطاقة مع الفأرة (تفاصيل فرونت-end بسيطة).
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    }

    return card;
  }

  async function loadProducts(url) {
    const token = ++state.loadToken;
    state.currentUrl = url;
    showSkeleton();
    hideState();
    $('result-count').textContent = '';

    const result = await apiRequest(url);
    if (token !== state.loadToken) return; // طلب أحدث حلّ محل هذا

    if (!result.ok || !Array.isArray(result.data)) {
      const msg = result.blocked
        ? ['Blocked request', 'طلب محجوب']
        : result.error && result.error.name === 'AbortError'
          ? ['Timeout: no answer after 15 seconds.', 'انتهت المهلة: لا إجابة بعد 15 ثانية.']
          : ['Could not load products.', 'تعذّر تحميل المنتجات.'];
      setState(msg[0], msg[1], 'Check your connection and try again.', 'تحقق من اتصالك ثم أعد المحاولة.', true);
      $('product-grid').replaceChildren();
      return;
    }

    // نخزّن كل المنتجات فقط عندما نجلب القائمة الكاملة (لنستخدمها في السلة والتفاصيل).
    if (url === BASE_URL + '/products') state.products = result.data;
    state.viewProducts = result.data;
    renderProducts();
  }

  /* ---------- 9) المفضلة ---------- */
  function toggleFavorite(id, button) {
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      toast('Removed from favorites', 'أُزيل من المفضلة', 'info');
    } else {
      state.favorites.add(id);
      toast('Saved to favorites', 'حُفظ في المفضلة');
    }
    store.set(KEYS.favorites, Array.from(state.favorites));
    button.setAttribute('aria-pressed', String(state.favorites.has(id)));
    $('fav-count').textContent = String(state.favorites.size);
    if (state.favoritesOnly) renderProducts();
  }

  /* ---------- 10) السلة ---------- */
  function cartQuantity() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function cartTotal() {
    return state.cart.reduce((sum, item) => {
      const product = state.products.find((p) => p.id === item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
  }

  function renderCartBadge(bump) {
    const badge = $('cart-count');
    badge.textContent = String(cartQuantity());
    if (bump) {
      badge.classList.remove('bump');
      void badge.offsetWidth; // إعادة تشغيل الأنيميشن
      badge.classList.add('bump');
    }
    $('fav-count').textContent = String(state.favorites.size);
  }

  function addToCart(product, button) {
    const existing = state.cart.find((item) => item.productId === product.id);
    if (existing) existing.quantity += 1;
    else state.cart.push({ productId: product.id, quantity: 1 });

    store.set(KEYS.cart, state.cart);
    renderCartBadge(true);
    toast('Added to cart', 'أُضيف إلى السلة');

    if (button) {
      button.classList.add('btn-added-state');
      button.replaceChildren(bi('Added', 'تمت الإضافة'));
      setTimeout(() => {
        button.classList.remove('btn-added-state');
        button.replaceChildren(bi('Add', 'أضف'),
          el('svg', { attrs: { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'aria-hidden': 'true' } },
            el('path', { attrs: { d: 'M12 5v14M5 12h14' } })
          )
        );
      }, 950);
    }
  }

  function changeQty(productId, delta) {
    const item = state.cart.find((i) => i.productId === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart = state.cart.filter((i) => i.productId !== productId);
    store.set(KEYS.cart, state.cart);
    renderCartBadge(true);
    renderCartDialog();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter((i) => i.productId !== productId);
    store.set(KEYS.cart, state.cart);
    renderCartBadge();
    renderCartDialog();
    toast('Removed from cart', 'أُزيل من السلة', 'info');
  }

  function renderCartDialog() {
    const box = $('cart-items');
    box.replaceChildren();

    if (state.cart.length === 0) {
      box.append(
        el('div', { cls: 'cart-empty' },
          el('svg', { attrs: { viewBox: '0 0 24 24', width: '46', height: '46', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' } },
            el('circle', { attrs: { cx: '9', cy: '20', r: '1.4' } }),
            el('circle', { attrs: { cx: '18', cy: '20', r: '1.4' } }),
            el('path', { attrs: { d: 'M2 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 7H5.3' } })
          ),
          el('p', {}, bi('Your cart is empty', 'سلتك فارغة')),
          el('p', { cls: 'simulation-note' }, bi('Add a product to get started.', 'أضف منتجاً للبدء.'))
        )
      );
    } else {
      state.cart.forEach((item) => {
        const product = state.products.find((p) => p.id === item.productId);
        if (!product) return;

        const minus = el('button', { cls: 'qty-btn', attrs: { type: 'button', 'aria-label': 'Decrease • تقليل' }, text: '−' });
        minus.addEventListener('click', () => changeQty(item.productId, -1));

        const plus = el('button', { cls: 'qty-btn', attrs: { type: 'button', 'aria-label': 'Increase • زيادة' }, text: '+' });
        plus.addEventListener('click', () => changeQty(item.productId, 1));

        const remove = el('button', { cls: 'remove-btn', attrs: { type: 'button', 'aria-label': 'Remove • حذف' } },
          el('svg', { attrs: { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'aria-hidden': 'true' } },
            el('path', { attrs: { d: 'M6 6l12 12M18 6 6 18' } })
          )
        );
        remove.addEventListener('click', () => removeFromCart(item.productId));

        box.append(
          el('div', { cls: 'cart-row' },
            el('img', { cls: 'cart-thumb', attrs: { src: product.image, alt: product.title } }),
            el('div', { cls: 'cart-row-info' },
              el('p', { cls: 'cart-row-title', text: product.title }),
              el('p', { cls: 'cart-row-price', text: money(product.price) + ' × ' + item.quantity })
            ),
            el('div', { cls: 'cart-row-actions' }, minus, el('span', { cls: 'qty-value', text: item.quantity }), plus, remove)
          )
        );
      });
    }

    $('cart-total').textContent = money(cartTotal());
    renderOrders();
  }

  function renderOrders() {
    const box = $('orders-list');
    box.replaceChildren();

    if (state.orders.length === 0) {
      box.append(el('p', { cls: 'simulation-note' }, bi('No saved orders yet.', 'لا توجد طلبات محفوظة بعد.')));
      return;
    }

    state.orders.slice(0, 10).forEach((order) => {
      box.append(
        el('div', { cls: 'order-item' },
          el('span', { text: order.date + ' • #' + order.apiId }),
          el('strong', { text: order.items.length + ' × ' + money(order.total) })
        )
      );
    });
  }

  /* ---------- 11) النوافذ ---------- */
  function openDialog(dialog) {
    // لا نستعيد التركيز لعنصر داخل نافذة أخرى أُغلقت.
    if (document.activeElement && !document.activeElement.closest('dialog')) {
      state.lastFocus = document.activeElement;
    }
    if (!dialog.open) dialog.showModal();
  }

  function setupDialogs() {
    document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => btn.closest('dialog').close());
    });
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => {
        if (state.lastFocus && state.lastFocus.isConnected) state.lastFocus.focus();
      });
    });

    $('btn-cart').addEventListener('click', () => {
      renderCartDialog();
      openDialog($('cart-dialog'));
    });
    $('btn-login').addEventListener('click', () => openLogin());
  }

  function openProductDialog(product) {
    const body = $('product-dialog-body');
    body.replaceChildren();

    const view = el('div', { cls: 'product-detail' },
      el('div', { cls: 'detail-media' }, el('img', { attrs: { src: product.image, alt: product.title } })),
      el('div', { cls: 'detail-info' },
        el('span', { cls: 'chip detail-badge', attrs: { 'data-category': product.category } }, bi(product.category, categoryAr(product.category))),
        el('h2', { text: product.title }),
        el('div', { cls: 'rating' },
          el('span', { text: '★', attrs: { 'aria-hidden': 'true' } }),
          el('span', { text: product.rating ? product.rating.rate.toFixed(1) + ' / 5' : '—' }),
          el('span', { text: product.rating ? '(' + product.rating.count + ')' : '' })
        ),
        el('p', { cls: 'detail-price', text: money(product.price) }),
        el('p', { cls: 'detail-desc', text: product.description }),
        el('div', { cls: 'detail-meta' },
          el('button', { cls: 'btn btn-primary btn-lg', attrs: { type: 'button' } },
            bi('Add to cart', 'أضف إلى السلة')
          )
        )
      )
    );

    const addBtn = view.querySelector('.detail-meta .btn');
    addBtn.addEventListener('click', () => addToCart(product, addBtn));
    body.append(view);
    openDialog($('product-dialog'));
  }

  /* ---------- 12) الدخول التجريبي ---------- */
  function openLogin() {
    $('login-error').hidden = true;
    $('login-error').replaceChildren();
    $('login-username').removeAttribute('aria-invalid');
    $('login-password').removeAttribute('aria-invalid');
    openDialog($('login-dialog'));
  }

  async function ensureUsers() {
    if (state.users.length) return;
    const result = await apiRequest(BASE_URL + '/users');
    if (result.ok && Array.isArray(result.data)) state.users = result.data;
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    const errorBox = $('login-error');

    if (!username || !password) {
      errorBox.hidden = false;
      errorBox.replaceChildren(bi('Fill in both fields.', 'عبّئ الحقلين معاً.', true));
      $('login-username').setAttribute('aria-invalid', String(!username));
      $('login-password').setAttribute('aria-invalid', String(!password));
      return;
    }

    const submit = $('login-form').querySelector('button[type="submit"]');
    submit.classList.add('is-loading');
    submit.disabled = true;

    // ملاحظة مهمة: عند الخطأ الـ API يرجع 401 بنص عادي وليس JSON — apiRequest يتعامل مع ذلك.
    const result = await apiRequest(BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });

    submit.classList.remove('is-loading');
    submit.disabled = false;

    if (!result.ok || !result.data || !result.data.token) {
      const text = result.status === 401 && result.text
        ? result.text
        : 'Login failed. Please try again.';
      errorBox.hidden = false;
      errorBox.replaceChildren(bi(text, 'فشل الدخول. حاول مرة أخرى.', true));
      $('login-username').setAttribute('aria-invalid', 'true');
      $('login-password').setAttribute('aria-invalid', 'true');
      return;
    }

    state.token = result.data.token; // في الذاكرة فقط، لا localStorage
    await ensureUsers();
    const found = state.users.find((u) => u.username === username);
    state.user = found
      ? { id: found.id, username: found.username, name: found.name }
      : { id: 1, username: username, name: { firstname: username, lastname: '' } };

    $('login-label').replaceChildren(bi('Hi, ' + username, 'مرحباً، ' + username));
    $('login-username').value = '';
    $('login-password').value = '';
    errorBox.hidden = true;
    $('login-username').removeAttribute('aria-invalid');
    $('login-password').removeAttribute('aria-invalid');
    $('login-dialog').close();
    toast('Signed in (demo)', 'تم الدخول (تجريبي)');

    if (state.pendingCheckout) {
      state.pendingCheckout = false;
      placeOrder();
    }
  }

  /* ---------- 13) الطلب التجريبي ---------- */
  async function placeOrder() {
    if (state.cart.length === 0) {
      toast('Your cart is empty', 'سلتك فارغة', 'info');
      return;
    }

    if (!state.user) {
      state.pendingCheckout = true;
      $('cart-dialog').close();
      openLogin();
      toast('Sign in first (demo)', 'سجّل الدخول أولاً (تجريبي)', 'info');
      return;
    }

    const button = $('btn-checkout');
    button.classList.add('is-loading');
    button.disabled = true;

    const items = state.cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      title: (state.products.find((p) => p.id === item.productId) || {}).title || '#' + item.productId,
      price: (state.products.find((p) => p.id === item.productId) || {}).price || 0
    }));

    // هذه هي الصيغة المطلوبة في POST /carts حسب المرجع.
    const body = {
      userId: state.user.id,
      date: new Date().toISOString().slice(0, 10),
      products: items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
    };

    const result = await apiRequest(BASE_URL + '/carts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    button.classList.remove('is-loading');
    button.disabled = false;

    if (!result.ok || !result.data) {
      toast('Could not place the demo order', 'تعذّر إنشاء الطلب التجريبي', 'error');
      return;
    }

    const order = {
      localId: Date.now(),
      apiId: result.data.id || '—',
      userId: state.user.id,
      date: body.date,
      items: items,
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    };

    state.orders.unshift(order);
    store.set(KEYS.orders, state.orders.slice(0, 20));
    state.cart = [];
    store.set(KEYS.cart, state.cart);
    renderCartBadge();
    renderCartDialog();
    $('cart-dialog').close();
    openOrderDialog(order);
    toast('Demo order created', 'تم إنشاء الطلب التجريبي');
  }

  function openOrderDialog(order) {
    const box = $('order-summary');
    box.replaceChildren(
      el('div', {}, bi('API order id', 'معرّف الطلب في الـ API'), el('strong', { text: '#' + order.apiId })),
      el('div', {}, bi('Products', 'عدد المنتجات'), el('strong', { text: String(order.items.reduce((s, i) => s + i.quantity, 0)) })),
      el('div', {}, bi('Total', 'المجموع'), el('strong', { text: money(order.total) })),
      el('div', {}, bi('Saved locally', 'محفوظ محلياً'), el('strong', { text: order.date }))
    );
    openDialog($('order-dialog'));
  }

  /* ---------- 14) تفاصيل الواجهة ---------- */
  function setupScrollEffects() {
    const progress = $('scroll-progress');
    const header = $('app-header');
    const topBtn = $('back-to-top');

    // ثوابت بسيطة وواضحة: الهيدر يبقى ظاهراً في أول 120 بكسل،
    // ويكفي نزول أو صعود 5 بكسل (من آخر نقطة تبدّل) لتغيير الحالة.
    const SHOW_AT_TOP = 120;
    const SCROLL_THRESHOLD = 5;
    // المتصفح قد يعطي scrollY قيماً كسرية (595.4 مثلاً)، نقرّبها لتكون المقارنة دقيقة.
    let anchorY = Math.round(window.scrollY);

    function setHeaderHidden(hidden) {
      header.classList.toggle('header-hidden', hidden);
    }

    function updateHeader(y) {
      if (y <= SHOW_AT_TOP) {
        setHeaderHidden(false);
        anchorY = y;
        return;
      }

      const delta = y - anchorY;
      if (delta >= SCROLL_THRESHOLD) {
        // نزلنا 5 بكسل أو أكثر → أخفِ الهيدر
        setHeaderHidden(true);
        anchorY = y;
      } else if (delta <= -SCROLL_THRESHOLD) {
        // صعدنا 5 بكسل أو أكثر → أظهِره فوراً
        setHeaderHidden(false);
        anchorY = y;
      }
      // حركة أقل من 5 بكسل لا تغيّر شيئاً (تمنع الاهتزاز).
    }

    function onScroll() {
      const y = Math.round(window.scrollY);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0).toFixed(4) + ')';
      topBtn.classList.toggle('is-visible', y > 420);
      updateHeader(y);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function setupControls() {
    let searchTimer;
    $('search-input').addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = event.target.value.trim().toLowerCase();
        renderProducts();
      }, 120);
    });

    $('sort-select').addEventListener('change', (event) => {
      state.sort = event.target.value;
      renderProducts();
    });

    $('btn-favorites').addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      $('btn-favorites').setAttribute('aria-pressed', String(state.favoritesOnly));
      renderProducts();
    });

    $('btn-retry').addEventListener('click', () => loadProducts(state.currentUrl));

    $('btn-checkout').addEventListener('click', placeOrder);

    $('btn-fill-demo').addEventListener('click', () => {
      $('login-username').value = 'johnd';
      $('login-password').value = 'm38rmF$';
      $('login-error').hidden = true;
      $('login-username').removeAttribute('aria-invalid');
      $('login-password').removeAttribute('aria-invalid');
    });

    $('login-form').addEventListener('submit', handleLogin);
    ['login-username', 'login-password'].forEach((id) => {
      $(id).addEventListener('input', () => $(id).removeAttribute('aria-invalid'));
    });
  }

  /* ---------- 15) البدء ---------- */
  function init() {
    setupLanguageAndTheme();
    setupDialogs();
    setupControls();
    setupScrollEffects();
    renderCartBadge();
    renderCartDialog();
    loadCategories();
    loadProducts(BASE_URL + '/products');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

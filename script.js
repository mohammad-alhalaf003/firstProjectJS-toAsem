/* ==========================================================================
   StorePulse — script.js
   كل السلوك هنا: طلبات الـ API، اللغة، الثيم، السلة، المفضلة، الدخول، النوافذ،
   والتفاعلات الصغيرة (إمالة البطاقات، شريط التقدم، الإشعارات).
   لا مكتبات خارجية — fetch الأصلية فقط.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- 1) الثوابت ---------- */
  const BASE_URL = 'https://fakestoreapi.com';
  const TIMEOUT_MS = 15000;
  const TIMEOUT_SECONDS = TIMEOUT_MS / 1000; // Q3: رسالة المهلة تتغيّر تلقائياً لو تغيّر الثابت.
  // Debounce: ننتظر 350ms بعد آخر حرف قبل الفلترة (ما نعيد الرسم مع كل ضغطة مفتاح).
  const SEARCH_DEBOUNCE_MS = 350;
  const LANGS = ['both', 'ar', 'en'];
  // M3.4 / M3.5: ثلاث ثيمات فقط؛ أي قيمة محفوظة غير معروفة تُعاد إلى light.
  const THEMES = ['light', 'dark', 'ocean'];
  const THEME_META = { light: '#4f46e5', dark: '#0a0e18', ocean: '#0f766e' };

  // أرقام ونصوص لها معنى: أسماء بدل القيم المبعثرة داخل الدوال (Q3).
  const SKELETON_COUNT = 8;
  const MAX_TOASTS = 3;
  const TOAST_DURATION_MS = 3200;
  const TOAST_EXIT_MS = 260;
  const ADD_FEEDBACK_MS = 950;
  const MAX_SAVED_ORDERS = 20;
  const RECENT_ORDERS_SHOWN = 10;
  const SCROLL_TOP_THRESHOLD_PX = 420;
  const TILT_DEGREES = 6;
  const RATING_SCALE = 5;
  const DATE_PART_LENGTH = 10;
  const HOVER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
  const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
  const CARD_ACTION = Object.freeze({ DETAILS: 'details', FAVORITE: 'favorite', ADD: 'add', EDIT: 'edit', DELETE: 'delete' });
  // M6: حجم الصفحة محلي، أما limit فهو ما يُرسل للسيرفر — لا نخلط بينهما.
  const PAGE_SIZES = [5, 10, 20];
  const VIEW_MODES = ['grid', 'table'];
  const MAX_PAGE_BUTTONS = 7;
  // M8: حدود بسيطة للتحقق من نموذج المنتج قبل الإرسال.
  const MIN_TITLE_LENGTH = 3;
  const MIN_DESCRIPTION_LENGTH = 5;
  const MAX_IMAGE_URL_LENGTH = 500;
  const MAX_CART_QUANTITY = 99;
  const PRODUCT_FORM_MODE = Object.freeze({ ADD: 'add', EDIT: 'edit' });
  // M9: خريطة التخزين صفحتا 10–11 — آخر خمس عمليات بحث فقط، لا كل حرف.
  const RECENT_SEARCH_LIMIT = 5;
  const MAX_SEARCH_LENGTH = 80;
  const ALLOWED_IMAGE_HOST = 'fakestoreapi.com'; // Q7/CSP: الصور المسموحة من نفس نطاق الـ API فقط.
  const ALLOWED_IMAGE_PATH = '/img/';
  const LOCAL_SORTS = ['default', 'price-asc', 'price-desc', 'rating-desc', 'title-asc'];
  const SERVER_SORTS = ['asc', 'desc'];
  const STORAGE_PREFIX = 'storepulse_';

  // المفاتيح الوحيدة المسموحة في كل صندوق؛ أي مفتاح آخر بهذا البادئة يُحذف عند البدء.
  const KEYS = {
    // localStorage — ما يجب أن يبقى بعد إغلاق المتصفح.
    theme: 'storepulse_theme',
    favorites: 'storepulse_favorites',
    cart: 'storepulse_cart',
    recentSearches: 'storepulse_recent_searches',
    view: 'storepulse_view_mode',
    pageSize: 'storepulse_page_size',
    // sessionStorage — ما يخص التبويب الحالي فقط.
    token: 'storepulse_token',
    username: 'storepulse_username',
    filters: 'storepulse_filters',
    currentPage: 'storepulse_current_page',
    productDraft: 'storepulse_product_draft'
  };
  const ALLOWED_LOCAL_KEYS = new Set([
    KEYS.theme, KEYS.favorites, KEYS.cart, KEYS.recentSearches, KEYS.view, KEYS.pageSize
  ]);
  const ALLOWED_SESSION_KEYS = new Set([
    KEYS.token, KEYS.username, KEYS.filters, KEYS.currentPage, KEYS.productDraft
  ]);
  const DEFAULT_FILTERS = Object.freeze({
    category: 'all', sort: 'default', idSort: 'asc', limit: 20, search: ''
  });

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
  // كل الوصول إلى DOM بالمعرف يمرّ من هنا.
  const getElement = (id) => document.getElementById(id);

  /* تعبير دالة: يقرأ التخزين بأمان ويعيد القيمة الافتراضية عند الفشل. */
  const readStorage = function (key, fallback, storage = localStorage) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      // الوضع الخاص قد يمنع التخزين؛ نُسجّل التحذير ونكمل بالقيمة الافتراضية.
      console.warn(`[StorePulse] Could not read "${key}".`, error);
      return fallback;
    }
  };

  /* تعبير دالة: يكتب التخزين دون أن يوقف التطبيق عند امتلاء الحصة. */
  const writeStorage = function (key, value, storage = localStorage) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[StorePulse] Could not save "${key}".`, error);
    }
  };

  /* تحذف مفتاح مشروع واحد بأمان؛ لا تمس مفاتيح المواقع الأخرى. */
  const removeStorage = function (key, storage = localStorage) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`[StorePulse] Could not remove "${key}".`, error);
    }
  };

  /*
   * تُنظّف المفاتيح القديمة أو الموضوعة في الصندوق الخطأ (اللغة وسجل الطلبات مثلًا).
   * نحذف فقط ما يبدأ بـ storepulse_ ولا يوجد في خريطة هذا الصندوق، فلا نتعرض لبيانات موقع آخر.
   */
  function purgeConflictingStorageKeys() {
    [{ storage: localStorage, allowed: ALLOWED_LOCAL_KEYS },
     { storage: sessionStorage, allowed: ALLOWED_SESSION_KEYS }].forEach(({ storage, allowed }) => {
      try {
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
        keys.filter((key) => key && key.startsWith(STORAGE_PREFIX) && !allowed.has(key))
          .forEach((key) => removeStorage(key, storage));
      } catch (error) {
        console.warn('[StorePulse] Could not clean conflicting storage keys.', error);
      }
    });
  }

  /* ينشئ عنصراً ويُلحق به أبناءه؛ النصوص كلها تمرّ عبر textContent لا innerHTML. */
  function createNode(tag, options = {}, ...children) {
    const node = document.createElement(tag);
    if (options.cls) node.className = options.cls;
    if (options.text !== undefined) node.textContent = String(options.text);
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([name, value]) => { node.dataset[name] = String(value); });
    }
    children.forEach((child) => { if (child) node.append(child); });
    return node;
  }

  /* يبني نصاً ثنائي اللغة؛ CSS يختار النسخة الظاهرة عبر data-lang. */
  function createBilingual(english, arabic, block = false) {
    const fragment = document.createDocumentFragment();
    const extra = block ? ' bi-block' : '';
    fragment.append(
      createNode('span', { cls: 'bi-en' + extra, text: english, attrs: { lang: 'en' } }),
      createNode('span', { cls: 'bi-ar' + extra, text: arabic, attrs: { lang: 'ar', dir: 'rtl' } })
    );
    return fragment;
  }

  const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;
  const translateCategory = (category) => CATEGORY_AR[category] || category;

  /* ---------- 3) الحالة ---------- */
  // M9: قبل قراءة أي قيمة، أزل مفاتيح المشروع القديمة أو الموضوعة في الصندوق الخطأ.
  purgeConflictingStorageKeys();

  /* يرفض القيم التالفة في التخزين (مثلاً نص بدل مصفوفة) قبل بناء الحالة. */
  function toSavedList(value, key) {
    if (Array.isArray(value)) return value;
    if (value !== null && value !== undefined) console.warn(`[StorePulse] Ignored invalid ${key} in storage.`);
    return [];
  }

  /* يتحقق من كميات السلة المحفوظة ويتجاهل العناصر غير الصالحة. */
  function sanitizeCartItems(items) {
    const isValid = (item) => item && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= MAX_CART_QUANTITY;
    const hasInvalidItems = items.some((item) => !isValid(item));
    if (hasInvalidItems) console.warn('[StorePulse] Removed invalid items from saved cart.');
    return hasInvalidItems ? items.filter(isValid) : items;
  }

  /* يُبقي خمس عبارات بحث فريدة وغير فارغة، الأحدث أولاً. */
  function sanitizeRecentSearches(value) {
    const rawList = toSavedList(value, KEYS.recentSearches);
    const seen = new Set();
    const clean = [];
    rawList.forEach((entry) => {
      if (typeof entry !== 'string') return;
      const term = entry.trim().toLowerCase().slice(0, MAX_SEARCH_LENGTH);
      if (!term || seen.has(term)) return;
      seen.add(term);
      if (clean.length < RECENT_SEARCH_LIMIT) clean.push(term);
    });
    if (clean.length !== rawList.length) writeStorage(KEYS.recentSearches, clean);
    return clean;
  }

  /* يقرأ الفلاتر الأربعة+ترتيب المعرّف من كائن واحد صغير في sessionStorage. */
  function readSavedFilters() {
    const raw = readStorage(KEYS.filters, null, sessionStorage);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_FILTERS };
    const category = typeof raw.category === 'string' && raw.category.trim().length > 0
      && raw.category.length <= MAX_SEARCH_LENGTH ? raw.category.trim() : DEFAULT_FILTERS.category;
    const limit = PAGE_SIZES.includes(Number(raw.limit)) ? Number(raw.limit) : DEFAULT_FILTERS.limit;
    return {
      category,
      sort: LOCAL_SORTS.includes(raw.sort) ? raw.sort : DEFAULT_FILTERS.sort,
      idSort: SERVER_SORTS.includes(raw.idSort) ? raw.idSort : DEFAULT_FILTERS.idSort,
      limit,
      search: typeof raw.search === 'string' ? raw.search.trim().toLowerCase().slice(0, MAX_SEARCH_LENGTH) : ''
    };
  }

  /* يقرأ مسودة الإضافة غير المرسلة؛ أي حقل تالف يعني تجاهل المسودة كلها. */
  function readProductDraft() {
    const raw = readStorage(KEYS.productDraft, null, sessionStorage);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const fields = ['title', 'price', 'description', 'image', 'category'];
    if (fields.some((field) => typeof raw[field] !== 'string')) return null;
    return Object.fromEntries(fields.map((field) => [field, raw[field].slice(0, 500)]));
  }

  const savedFavorites = toSavedList(readStorage(KEYS.favorites, []), KEYS.favorites);
  const savedCartRaw = toSavedList(readStorage(KEYS.cart, []), KEYS.cart);
  const savedCart = sanitizeCartItems(savedCartRaw);
  // اكتب النسخة المنظّفة حتى لا تبقى الكميات المرفوضة ظاهرة في Application.
  if (savedCart.length !== savedCartRaw.length) writeStorage(KEYS.cart, savedCart);
  const savedRecentSearches = sanitizeRecentSearches(readStorage(KEYS.recentSearches, []));
  const savedFilters = readSavedFilters();
  const storedPageSize = Number(readStorage(KEYS.pageSize, 20));
  const savedPageSize = PAGE_SIZES.includes(storedPageSize) ? storedPageSize : 20;
  const storedView = readStorage(KEYS.view, 'grid');
  const savedView = VIEW_MODES.includes(storedView) ? storedView : 'grid';
  const storedPage = Number(readStorage(KEYS.currentPage, 1, sessionStorage));
  const savedPage = Number.isInteger(storedPage) && storedPage > 0 ? storedPage : 1;

  // كائن الحالة الوحيد: كل ما ترسمه الواجهة مشتق من هنا.
  const state = {
    theme: 'light',
    products: [],       // كل المنتجات التي رآها التطبيق من /products
    viewProducts: [],   // المنتجات المعروضة حالياً (كلها أو فئة واحدة)
    categories: [],
    category: savedFilters.category,
    search: savedFilters.search,
    sort: savedFilters.sort,      // ترتيب محلي إضافي (سعر/تقييم/اسم)
    limit: savedFilters.limit,    // يُرسل للـ API كـ ?limit= — عدد المنتجات المستلمة
    idSort: savedFilters.idSort,  // يُرسل للـ API كـ ?sort=asc|desc
    pageSize: savedPageSize, // M6.2: عدد المنتجات المعروضة في الصفحة محلياً
    page: savedPage,      // M6.2: من sessionStorage، يُقصّ بعد معرفة عدد الصفحات
    view: savedView,      // M6.3: grid أو table
    favoritesOnly: false,
    favorites: new Set([...savedFavorites]),
    recentSearches: savedRecentSearches,
    cart: savedCart,
    orders: [],           // M9: ذاكرة التبويب فقط؛ لا يُكتب في Browser Storage
    users: [],
    user: null,
    token: null,        // يُقرأ من sessionStorage: تبويب واحد فقط، ولا يُطبع أبداً
    username: '',       // اسم المستخدم المرافق للتوكن في sessionStorage
    pendingCheckout: false,
    // M8.2: نسخ مؤقتة في الذاكرة فقط؛ لا تُكتب في Browser Storage أبداً.
    sessionChanges: { added: [], edited: new Map(), deleted: new Set() },
    writePending: false,
    loadToken: 0,
    detailToken: 0,       // يمنع استجابة تفاصيل قديمة من الكتابة فوق أحدث نافذة
    currentUrl: '',       // يُملأ عند أول طلب ويُستخدم لإعادة المحاولة
    lastFocus: null
  };

  /* ---------- 4) اللغة والثيم ---------- */
  /* يطبّق لغة واحدة صالحة على الصفحة؛ اللغة خارج خريطة M9 فلا تُحفظ. */
  function applyLang(mode) {
    const langMode = LANGS.includes(mode) ? mode : 'both';
    document.documentElement.setAttribute('data-lang', langMode);
    document.documentElement.setAttribute('lang', langMode === 'ar' ? 'ar' : 'en');
    document.documentElement.setAttribute('dir', langMode === 'ar' ? 'rtl' : 'ltr');
    const radio = getElement(`lang-${langMode}`);
    if (radio) radio.checked = true;
    // M9: اللغة ليست في خريطة التخزين، لذلك لا تُحفظ في أي من الصندوقين.
  }

  /* يطبّق ثيماً صالحاً ويعكسه على meta والراديو، ويحفظه فقط عند اختيار المستخدم. */
  function applyTheme(mode, shouldPersist = true) {
    // M3.4: قيمة واحدة صالحة فقط تصل إلى DOM — حماية من تلف localStorage.
    const themeMode = THEMES.includes(mode) ? mode : 'light';
    state.theme = themeMode;
    document.documentElement.setAttribute('data-theme', themeMode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_META[themeMode]);
    // M3.5: مبدّل الثلاث ثيمات يعكس الحالة دائماً (بعد الاستعادة وبعد النقر).
    document.querySelectorAll('input[name="shop-theme"]').forEach((input) => {
      input.checked = input.value === themeMode;
    });
    // M3.4/M9: الزيارة الأولى تتبع النظام دون كتابة مفتاح؛ الحفظ يبدأ بأول تغيير صريح.
    if (shouldPersist) writeStorage(KEYS.theme, themeMode);
  }

  /* يطبّق اللغة الافتراضية والثيم المحفوظ ثم يربط مستمعيات المبدّلين. */
  function setupLanguageAndTheme() {
    // اللغة تبدأ دائماً بـ both لأنها غير مسموحة في خريطة M9.
    applyLang('both');

    // M3.4: الزيارة الأولى تحترم تفضيل النظام؛ أول تغيير من المستخدم هو ما يُحفظ.
    const savedTheme = readStorage(KEYS.theme, null);
    const firstVisitTheme = matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
    applyTheme(savedTheme === null ? firstVisitTheme : savedTheme, savedTheme !== null);

    document.querySelectorAll('input[name="shop-lang"]').forEach((input) => {
      input.addEventListener('change', () => applyLang(input.value));
    });
    document.querySelectorAll('input[name="shop-theme"]').forEach((input) => {
      input.addEventListener('change', () => applyTheme(input.value));
    });
  }

  /* M3.3: يبني قائمة الهامبرغر بمصدر حالة واحد هو aria-expanded. */
  function setupMenu() {
    const menuButton = getElement('menu-toggle');
    const menuPanel = getElement('header-actions');
    if (!menuButton || !menuPanel) return;

    /* يحدّث حالة القائمة في ARIA وفي الصنف الذي يقرأه CSS. */
    function setMenuOpen(isOpen) {
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Close menu • إغلاق القائمة' : 'Open menu • فتح القائمة');
      // M3.3: الإشعارات طبقتها 200؛ أثناء فتح القائمة نخفضها ونلغي نقرها كي لا تحجب خياراتها.
      document.body.classList.toggle('menu-open', isOpen);
    }

    menuButton.addEventListener('click', () => {
      setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    // الروابط/زر الدخول يغلقون القائمة؛ مبدّلا اللغة والثيم يبقيان مفتوحين للتجربة.
    menuPanel.addEventListener('click', (event) => {
      if (event.target.closest('a, #btn-login')) setMenuOpen(false);
    });

    document.addEventListener('click', (event) => {
      if (menuButton.getAttribute('aria-expanded') === 'true' && !event.target.closest('.app-header')) {
        setMenuOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        menuButton.focus();
      }
    });

    // العودة إلى الشاشة العريضة تُغلق القائمة حتى لا تبقى حالة قديمة مخفية.
    const wideScreen = matchMedia('(min-width: 48.0625rem)');
    if (wideScreen.addEventListener) {
      wideScreen.addEventListener('change', (event) => { if (event.matches) setMenuOpen(false); });
    }
  }

  /* ---------- 5) الإشعارات ---------- */
  /* يعرض إشعاراً مؤقتاً ويحدّد عدد الإشعارات الظاهرة. */
  function toast(english, arabic, kind = 'success') {
    const box = getElement('toast-container');
    const icon = kind === 'error' ? '!' : kind === 'info' ? 'i' : '✓';
    const node = createNode('div', { cls: `toast ${kind}` },
      createNode('span', { cls: 'toast-icon', text: icon, attrs: { 'aria-hidden': 'true' } }),
      createNode('span', {}, createBilingual(english, arabic, true))
    );
    box.append(node);
    while (box.children.length > MAX_TOASTS) box.firstElementChild.remove();

    setTimeout(() => {
      node.classList.add('toast-leaving');
      setTimeout(() => node.remove(), TOAST_EXIT_MS);
    }, TOAST_DURATION_MS);
  }

  /* ---------- 6) طلبات الـ API ---------- */
  /* يوحّد طلبات الـ API: يمنع الخوادم الأخرى، يضبط المهلة، ويقرأ response.ok. */
  async function apiRequest(url, options = {}) {
    // فحص بسيط: لا نرسل إلا إلى الخادم المسموح.
    if (new URL(url, BASE_URL).origin !== BASE_URL) {
      console.warn('[StorePulse] Blocked request to another origin:', url);
      return { ok: false, status: 0, data: null, empty: true, blocked: true, errorKind: 'blocked' };
    }

    const controller = new AbortController();
    // breakpoint: تابع هنا عند محاكاة Slow 3G أو انتهاء المهلة.
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const text = await response.text();
      let data = null;
      let invalidJson = false;
      if (text) {
        try { data = JSON.parse(text); } catch (error) { data = text; invalidJson = true; }
      }
      return { ok: response.ok,
        status: response.status,
        data,
        empty: text === '',
        invalidJson
      };
    } catch (error) {
      // الخطأ مُعالج هنا؛ لذلك لا يصل إلى Console كاستثناء غير مفسّر.
      console.warn('[StorePulse] Request failed:', error.message);
      const offline = !navigator.onLine || (error && error.name === 'TypeError');
      const errorKind = error && error.name === 'AbortError' ? 'timeout' : (offline ? 'offline' : 'network');
      return { ok: false, status: 0, data: null, empty: true, error, errorKind };
    } finally {
      // finally تعمل حتى عند return المبكر من try أو catch.
      clearTimeout(timer);
    }
  }

  /* ---------- 7) الحالات المرئية ---------- */
  /* يرسم بطاقات هيكل مؤقتة أثناء انتظار الـ API. */
  function showSkeleton() {
    const grid = getElement('product-grid');
    // أثناء التحميل نُظهر هيكل الشبكة حتى لو كان العرض المحفوظ جدولاً.
    getElement('table-wrap').hidden = true;
    grid.hidden = false;
    grid.setAttribute('aria-busy', 'true');
    grid.replaceChildren();
    for (let index = 0; index < SKELETON_COUNT; index += 1) {
      grid.append(
        createNode('div', { cls: 'skeleton-card', attrs: { 'aria-hidden': 'true' } },
          createNode('div', { cls: 'skeleton-img' }),
          createNode('div', { cls: 'skeleton-line' }),
          createNode('div', { cls: 'skeleton-line short' }),
          createNode('div', { cls: 'skeleton-line tall' })
        )
      );
    }
  }

  /* يعرض عنوان الحالة ونصها، مع إظهار زر إعادة المحاولة اختيارياً. */
  function setState(titleEn, titleAr, textEn, textAr, showRetry) {
    const box = getElement('state-box');
    getElement('state-title').replaceChildren(createBilingual(titleEn, titleAr));
    getElement('state-text').replaceChildren(createBilingual(textEn, textAr, true));
    getElement('btn-retry').hidden = showRetry === false;
    box.hidden = false;
  }

  /* يخفي صندوق الحالة عند وجود نتائج. */
  function hideState() { getElement('state-box').hidden = true; }

  /* ---------- 8) الفئات والمنتجات ---------- */
  // M1.3: كل شريحة داخل li حتى تكون الفئات قائمة حقيقية (ul/li) لا مجرد أزرار في div.
  function appendChipItem(wrapper, chip) {
    const item = createNode('li');
    item.append(chip);
    wrapper.append(item);
  }

  /* يعيد بناء شرائح الفئات من state.categories. */
  function renderChips() {
    const wrapper = getElement('category-chips');
    wrapper.replaceChildren();

    const all = createNode('button', {
      cls: `chip${state.category === 'all' ? ' chip-active' : ''}`,
      attrs: { type: 'button', 'data-category': 'all', 'aria-pressed': String(state.category === 'all') }
    }, createBilingual('All products', 'كل المنتجات'));
    all.addEventListener('click', () => selectCategory('all'));
    appendChipItem(wrapper, all);

    state.categories.forEach((category) => {
      const chip = createNode('button', {
        cls: `chip${state.category === category ? ' chip-active' : ''}`,
        attrs: { type: 'button', 'data-category': category, 'aria-pressed': String(state.category === category) }
      }, createBilingual(category, translateCategory(category)));
      chip.addEventListener('click', () => selectCategory(category));
      appendChipItem(wrapper, chip);
    });
  }

  /* يجلب الفئات مرة واحدة عند البدء. */
  async function loadCategories() {
    const result = await apiRequest(`${BASE_URL}/products/categories`);
    if (result.ok && Array.isArray(result.data)) {
      state.categories = result.data;
      renderChips();
    } else {
      console.warn('[StorePulse] Categories could not be loaded.');
    }
  }

  /* يبني الرابط بالمعاملات المطلوبة؛ URLSearchParams يظهرها في Network → Payload. */
  function buildProductsUrl() {
    const path = state.category === 'all'
      ? '/products'
      : `/products/category/${encodeURIComponent(state.category)}`;
    const params = new URLSearchParams({
      limit: String(state.limit),
      sort: state.idSort
    });
    return `${BASE_URL}${path}?${params.toString()}`;
  }

  /* يغيّر الفئة المختارة ويطلب نتائجها من السيرفر. */
  function selectCategory(category) {
    state.category = category;
    writeFilters();
    goToFirstPage();
    renderChips();
    loadProducts(buildProductsUrl());
  }

  /* يضيف كلمات عربية مساعدة حين يكون عنوان المنتج إنجليزياً. */
  function searchableText(product) {
    let text = [product.title, product.description, product.category, translateCategory(product.category)].join(' ').toLowerCase();
    for (const [keyword, arabicWords] of Object.entries(AR_KEYWORDS)) {
      if (String(product.title).toLowerCase().includes(keyword)) text = `${text} ${arabicWords}`;
    }
    return text;
  }

  const getRating = (product) => (product.rating ? product.rating.rate : 0);

  /* مقارنات الترتيب المحلي: دوال صغيرة تُمرّر مباشرة إلى Array.sort. */
  const SORT_COMPARATORS = {
    'price-asc': (first, second) => first.price - second.price,
    'price-desc': (first, second) => second.price - first.price,
    'rating-desc': (first, second) => getRating(second) - getRating(first),
    'title-asc': (first, second) => String(first.title).localeCompare(String(second.title))
  };

  /* يشتق قائمة العرض من الحالة دون تعديل مصفوفة state.viewProducts. */
  function visibleProducts() {
    let result = state.viewProducts.slice();

    if (state.favoritesOnly) {
      result = result.filter((product) => state.favorites.has(product.id));
    }

    if (state.search) {
      const searchWords = state.search.split(/\s+/).filter(Boolean);
      result = result.filter((product) => {
        const text = searchableText(product);
        for (const word of searchWords) {
          if (!text.includes(word)) return false;
        }
        return true;
      });
    }

    // الترتيب المحلي يطبّق على نسخة فقط؛ ?sort= يبقى ترتيب السيرفر في الرابط.
    const compare = SORT_COMPARATORS[state.sort];
    if (compare) result.sort(compare);
    return result;
  }

  /* يحفظ رقم الصفحة الحالية في جلسة التصفح فقط. */
  function writeCurrentPage() {
    writeStorage(KEYS.currentPage, state.page, sessionStorage);
  }

  /* يحفظ الفلاتر الأربعة وترتيب السيرفر معاً في كائن sessionStorage واحد. */
  function writeFilters() {
    writeStorage(KEYS.filters, {
      category: state.category,
      sort: state.sort,
      idSort: state.idSort,
      limit: state.limit,
      search: state.search
    }, sessionStorage);
  }

  /* يضيف بحثاً غير فارغ إلى أعلى القائمة ويحذف تكراره؛ لا شيء يُحفظ أثناء الكتابة. */
  function rememberSearch(rawTerm) {
    const term = String(rawTerm || '').trim().toLowerCase().slice(0, MAX_SEARCH_LENGTH);
    if (!term) return;
    state.recentSearches = [term, ...state.recentSearches.filter((entry) => entry !== term)]
      .slice(0, RECENT_SEARCH_LIMIT);
    writeStorage(KEYS.recentSearches, state.recentSearches);
    renderRecentSearches();
  }

  /* يعرض آخر خمس عمليات بحث كأزرار قابلة لإعادة الاستخدام. */
  function renderRecentSearches() {
    const box = getElement('recent-searches-box');
    const list = getElement('recent-searches-list');
    if (!box || !list) return;
    box.hidden = state.recentSearches.length === 0;
    list.replaceChildren();
    state.recentSearches.forEach((term) => {
      const button = createNode('button', {
        cls: 'chip chip-recent',
        attrs: { type: 'button', 'data-search': term, 'aria-label': `Search again: ${term} • إعادة البحث: ${term}` },
        text: term
      });
      list.append(createNode('li', {}, button));
    });
  }

  /* يمسح سجل البحث صراحةً عند طلب المستخدم زر Clear. */
  function clearRecentSearches() {
    state.recentSearches = [];
    removeStorage(KEYS.recentSearches);
    renderRecentSearches();
  }

  /* يعيد التصفح إلى الصفحة الأولى بعد تغيير حجم الصفحة أو أي فلتر. */
  function goToFirstPage() {
    state.page = 1;
    writeCurrentPage();
  }

  /* ينتقل إلى صفحة صالحة ثم يعيد الرسم. */
  function setPage(number) {
    const requested = Number(number);
    if (!Number.isInteger(requested) || requested < 1) return;
    state.page = requested;
    writeCurrentPage();
    renderProducts();
  }

  /* يبني أرقام الصفحات القريبة من الحالية مع نقطتين للصفحات البعيدة. */
  function getPageWindow(current, total) {
    if (total <= MAX_PAGE_BUTTONS) return Array.from({ length: total }, (_, index) => index + 1);
    const sideCount = Math.floor((MAX_PAGE_BUTTONS - 3) / 2);
    const innerStart = Math.max(2, current - sideCount);
    const innerEnd = Math.min(total - 1, current + sideCount);
    const pages = [1];
    if (innerStart > 2) pages.push('…');
    for (let page = innerStart; page <= innerEnd; page += 1) pages.push(page);
    if (innerEnd < total - 1) pages.push('…');
    pages.push(total);
    return pages;
  }

  /* يضبط حالة المفضلة على زر مشترك بين الشبكة والجدول. */
  function setFavoriteState(button, productId) {
    button.setAttribute('aria-pressed', String(state.favorites.has(productId)));
  }

  /* يبني زر إجراء يحمل data-action ليعمل في الشبكة والجدول معاً. */
  function createProductActionButton(action, labelEn, labelAr, extraClass = '') {
    return createNode('button', {
      cls: `btn ${extraClass}`.trim(),
      attrs: { type: 'button', 'data-action': action }
    }, createBilingual(labelEn, labelAr));
  }

  /* يبني صفاً حقيقياً في الجدول من نفس بيانات بطاقة المنتج. */
  function createProductRow(product) {
    const favoriteButton = createProductActionButton(CARD_ACTION.FAVORITE, 'Favorite', 'مفضلة', 'btn-fav');
    setFavoriteState(favoriteButton, product.id);
    const editButton = createProductActionButton(CARD_ACTION.EDIT, 'Edit', 'تعديل', 'btn-xs');
    const deleteButton = createProductActionButton(CARD_ACTION.DELETE, 'Delete', 'حذف', 'btn-xs btn-danger');
    editButton.setAttribute('aria-label', `Edit ${product.title} • تعديل ${product.title}`);
    deleteButton.setAttribute('aria-label', `Delete ${product.title} • حذف ${product.title}`);
    const categoryCell = createNode('td', { cls: 'table-category' }, createBilingual(product.category, translateCategory(product.category)));
    if (product.sessionStatus) categoryCell.append(createNode('span', { cls: 'session-flag', text: ' • session • مؤقت' }));
    return createNode('tr', { dataset: { id: product.id } },
      createNode('td', {}, createNode('img', {
        cls: 'table-image',
        attrs: { src: product.image, alt: product.title, loading: 'lazy' }
      })),
      createNode('th', { attrs: { scope: 'row' }, text: product.title }),
      categoryCell,
      createNode('td', { text: formatMoney(product.price) }),
      createNode('td', {}, createDetailRating(product)),
      createNode('td', { cls: 'table-actions' },
        createProductActionButton(CARD_ACTION.DETAILS, 'Details', 'تفاصيل'),
        favoriteButton,
        createProductActionButton(CARD_ACTION.ADD, 'Add', 'أضف'),
        editButton,
        deleteButton
      )
    );
  }

  /* يرسم أرقام الصفحات وأزرار السابق/التالي ونص النطاق. */
  function renderPagination(total, pageCount) {
    const nav = getElement('pagination');
    const list = getElement('page-list');
    list.replaceChildren();

    if (total === 0) {
      nav.hidden = true;
      getElement('page-status').replaceChildren(createBilingual('Showing 0–0 of 0', 'عرض 0–0 من 0'));
      return;
    }

    nav.hidden = false;
    getElement('page-prev').disabled = state.page === 1;
    getElement('page-next').disabled = state.page === pageCount;

    for (const entry of getPageWindow(state.page, pageCount)) {
      if (entry === '…') {
        list.append(createNode('li', { cls: 'page-ellipsis', text: '…', attrs: { 'aria-hidden': 'true' } }));
        continue;
      }
      const button = createNode('button', {
        cls: 'page-btn',
        attrs: { type: 'button', 'data-page': entry },
        text: entry
      });
      if (entry === state.page) button.setAttribute('aria-current', 'page');
      list.append(createNode('li', {}, button));
    }

    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(total, state.page * state.pageSize);
    getElement('page-status').replaceChildren(createBilingual(
      `Showing ${start}–${end} of ${total}`,
      `عرض ${start}–${end} من ${total}`
    ));
    getElement('table-caption').replaceChildren(createBilingual(
      `Products — page ${state.page} of ${pageCount}`,
      `المنتجات — صفحة ${state.page} من ${pageCount}`
    ));
  }

  /* دالة الرسم المركزية: كل تحديث للواجهة يبدأ من كائن الحالة state. */
  function renderProducts() {
    // التغييرات المؤقتة تُطبَّق وقت الرسم أيضاً حتى لا يفقدها أي طلب API لاحق.
    const list = applySessionChanges(visibleProducts());
    const total = list.length;
    const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), pageCount);
    writeCurrentPage();

    const startIndex = (state.page - 1) * state.pageSize;
    const pageProducts = list.slice(startIndex, startIndex + state.pageSize);
    const grid = getElement('product-grid');
    const tableWrap = getElement('table-wrap');
    grid.removeAttribute('aria-busy');
    grid.replaceChildren();
    getElement('product-table-body').replaceChildren();

    const englishSuffix = state.category === 'all' ? 'products' : 'in this category';
    const arabicSuffix = state.category === 'all' ? 'منتج' : 'منتج في هذه الفئة';
    getElement('result-count').replaceChildren(createBilingual(
      `${total} ${englishSuffix}`,
      `${total} ${arabicSuffix}`
    ));

    renderPagination(total, pageCount);

    if (total === 0) {
      grid.hidden = true;
      tableWrap.hidden = true;
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
    const showTable = state.view === 'table';
    grid.hidden = showTable;
    tableWrap.hidden = !showTable;
    const target = showTable ? getElement('product-table-body') : grid;
    pageProducts.forEach((product) => target.append(showTable ? createProductRow(product) : createCard(product)));
  }

  /* تنسّق الرسم بعد تغييرات الحالة التي تمسّ أكثر من جزء في الواجهة. */
  function renderApp() {
    renderChips();
    renderProducts();
    renderCartBadge();
  }

  /* M1.6: ينسخ البطاقة من <template> ويملؤها؛ المستمعات كلها على الشبكة. */
  function createCard(product) {
    const card = getElement('product-card-template').content.firstElementChild.cloneNode(true);
    card.dataset.id = String(product.id);
    fillCardMedia(card, product);
    fillCardBadge(card, product);
    fillCardText(card, product);
    fillCardFavoriteState(card, product);
    return card;
  }

  /* يملأ صورة البطاقة من بيانات المنتج عبر property لا innerHTML. */
  function fillCardMedia(card, product) {
    const image = card.querySelector('.card-media img');
    image.src = product.image;
    image.alt = product.title;
  }

  /* يملأ شارة الفئة بنص ثنائي اللغة. */
  function fillCardBadge(card, product) {
    const badge = card.querySelector('.card-badge');
    badge.dataset.category = product.category;
    badge.replaceChildren(createBilingual(product.category, translateCategory(product.category)));
    if (product.sessionStatus) badge.append(createNode('span', { cls: 'session-flag', text: ' • session • مؤقت' }));
  }

  /* يملأ العنوان والوصف والتقييم والسعر بـ textContent. */
  function fillCardText(card, product) {
    card.querySelector('.card-title').textContent = product.title;
    card.querySelector('.card-desc').textContent = product.description;
    card.querySelector('.rate').textContent = product.rating ? product.rating.rate.toFixed(1) : '—';
    card.querySelector('.rating-count').textContent = product.rating ? `(${product.rating.count})` : '';
    card.querySelector('.price').textContent = formatMoney(product.price);
    card.querySelector('.add-label').replaceChildren(createBilingual('Add', 'أضف'));
  }

  /* يعكس حالة المفضلة على زر القلب عند كل إعادة رسم. */
  function fillCardFavoriteState(card, product) {
    setFavoriteState(card.querySelector('.btn-fav'), product.id);
  }

  /* يبحث عن منتج من data-id داخل العرض الحالي ثم داخل دليل المنتجات. */
  function findProductById(productId) {
    const numericId = Number(productId);
    return state.viewProducts.find((product) => product.id === numericId)
      || state.products.find((product) => product.id === numericId);
  }

  /* يوزّع نقرة واحدة على الشبكة أو الجدول حسب data-action؛ closest يصل من الابن للزر. */
  function handleProductGridClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    // نفس المعالج يخدم .card وصف الجدول — لا نسخة ثانية من منطق الإجراءات.
    const card = actionButton.closest('.card, tr');
    if (!card) return;
    const product = findProductById(card.dataset.id);
    if (!product) return;

    if (actionButton.dataset.action === CARD_ACTION.DETAILS) openProductDialog(product.id);
    else if (actionButton.dataset.action === CARD_ACTION.FAVORITE) toggleFavorite(product.id, actionButton);
    else if (actionButton.dataset.action === CARD_ACTION.ADD) addToCart(product, actionButton);
    else if (actionButton.dataset.action === CARD_ACTION.EDIT) openProductForm(PRODUCT_FORM_MODE.EDIT, product);
    else if (actionButton.dataset.action === CARD_ACTION.DELETE) confirmDeleteProduct(product);
  }

  /* يعيد ميل البطاقة إلى الصفر عند مغادرة المؤشر أو الانتقال لبطاقة أخرى. */
  function resetCardTilt(card) {
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--rx', '0deg');
  }

  let tiltedCard = null;

  /* يميل البطاقة التي تحت المؤشر؛ مستمع واحد يخدم كل البطاقات. */
  function handleGridPointerMove(event) {
    const card = event.target.closest('.card');
    if (!card) return;
    if (tiltedCard && tiltedCard !== card) resetCardTilt(tiltedCard);
    tiltedCard = card;
    const rect = card.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width - .5;
    const yRatio = (event.clientY - rect.top) / rect.height - .5;
    card.style.setProperty('--ry', `${(xRatio * TILT_DEGREES).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-yRatio * TILT_DEGREES).toFixed(2)}deg`);
  }

  /* ينظّف أثر الإمالة عند خروج المؤشر من الشبكة. */
  function handleGridPointerLeave() {
    if (tiltedCard) resetCardTilt(tiltedCard);
    tiltedCard = null;
  }

  /* يربط مستمعات الشبكة مرة واحدة؛ إعادة الرسم لا تضيف مستمعات جديدة. */
  function setupProductGrid() {
    const grid = getElement('product-grid');
    grid.addEventListener('click', handleProductGridClick);
    // مستمع ثانٍ على tbody فقط؛ نفس الدالة تعني نفس المنطق للعرضين.
    getElement('product-table-body').addEventListener('click', handleProductGridClick);
    if (matchMedia(HOVER_MEDIA_QUERY).matches) {
      grid.addEventListener('pointermove', handleGridPointerMove);
      grid.addEventListener('pointerleave', handleGridPointerLeave);
    }
  }

  /* ---------- 8a) نسخ الجلسة المؤقتة لعمليات الكتابة ---------- */
  /* يعيد تطبيق تغييرات الجلسة على أي قائمة قادمة من الـ API بعد تغيير فئة أو limit. */
  function applySessionChanges(list, includeAllAdded = false) {
    const edits = state.sessionChanges.edited;
    const deleted = state.sessionChanges.deleted;
    let result = list
      .filter((product) => !deleted.has(product.id))
      .map((product) => edits.get(product.id) || product);

    state.sessionChanges.added.forEach((product) => {
      const belongsHere = includeAllAdded || state.category === 'all' || product.category === state.category;
      if (belongsHere && !result.some((entry) => entry.id === product.id)) result = [product].concat(result);
    });
    return result;
  }

  /* يضيف علامة واضحة للمنتج المؤقت حتى لا يُفهم كبيانات محفوظة في الـ API. */
  function markSessionProduct(product, status) {
    return { ...product, sessionStatus: status };
  }

  /* يسجّل نسخة الإضافة في الذاكرة فقط؛ لا localStorage ولا sessionStorage. */
  function rememberAddedProduct(product) {
    const copy = markSessionProduct(product, 'added');
    state.sessionChanges.added.push(copy);
    state.sessionChanges.deleted.delete(copy.id);
    state.sessionChanges.edited.delete(copy.id);
    return copy;
  }

  /* يسجّل نسخة التعديل في الذاكرة فقط ويحدّث دليل المنتجات فوراً. */
  function rememberEditedProduct(product) {
    const copy = markSessionProduct(product, 'edited');
    state.sessionChanges.edited.set(copy.id, copy);
    state.sessionChanges.added = state.sessionChanges.added.filter((entry) => entry.id !== copy.id);
    state.sessionChanges.deleted.delete(copy.id);
    return copy;
  }

  /* يسجّل حذف الجلسة؛ إعادة التحميل تعيد المنتج من الـ API كما هو. */
  function rememberDeletedProduct(productId) {
    state.sessionChanges.deleted.add(productId);
    state.sessionChanges.edited.delete(productId);
    state.sessionChanges.added = state.sessionChanges.added.filter((entry) => entry.id !== productId);
  }

  /* يستخرج معرّفاً صالحاً؛ أي قيمة أخرى تُرفض قبل بناء المسار. */
  function safeProductId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /* يجلب المنتجات ويرسمها؛ رقم الطلب يمنع نتائج قديمة من الكتابة فوق الحالية. */
  async function loadProducts(url) {
    const requestToken = ++state.loadToken;
    state.currentUrl = url;
    getElement('request-url').textContent = `GET ${url.replace(BASE_URL, '')}`;
    showSkeleton();
    hideState();
    getElement('result-count').textContent = '';

    const result = await apiRequest(url);
    if (requestToken !== state.loadToken) return; // طلب أحدث حلّ محل هذا

    if (!result.ok || !Array.isArray(result.data)) {
      console.warn('[StorePulse] Product request failed with status', result.status);
      const message = getLoadErrorMessage(result);
      setState(message[0], message[1], 'Check your connection and try again.', 'تحقق من اتصالك ثم أعد المحاولة.', true);
      const failedGrid = getElement('product-grid');
      failedGrid.replaceChildren();
      failedGrid.removeAttribute('aria-busy'); // M5.3: لا تبقى حالة تحميل بعد الفشل
      return;
    }

    // الـ limit قد يرجّع جزءاً من المنتجات فقط، ندمج النتائج في دليل محلي
    // عشان السلة وتفاصيل الطلب تظل تعرف أسعار كل المنتجات اللي أُضيفت.
    const catalog = new Map(state.products.map((product) => [product.id, product]));
    result.data.forEach((product) => catalog.set(product.id, product));
    state.products = applySessionChanges([...catalog.values()], true);
    state.viewProducts = applySessionChanges(result.data);
    renderApp();
  }

  /* يختار رسالة الخطأ المناسبة لسبب الفشل. */
  function getLoadErrorMessage(result) {
    if (result.blocked) return ['Blocked request', 'طلب محجوب'];
    if (result.error && result.error.name === 'AbortError') {
      return [`Timeout: no answer after ${TIMEOUT_SECONDS} seconds.`, `انتهت المهلة: لا إجابة بعد ${TIMEOUT_SECONDS} ثانية.`];
    }
    return ['Could not load products.', 'تعذّر تحميل المنتجات.'];
  }

  /* ---------- 8b) رسائل أخطاء M8.5 ---------- */
  /* جدول صغير يحوّل الحالة أو نوع الخطأ إلى رسالة ثنائية اللغة واضحة. */
  const API_STATUS_MESSAGES = {
    400: ['Bad request — check the JSON body.', 'طلب غير صالح — تحقق من جسم JSON.'],
    401: ['Unauthorized — sign in again or check credentials.', 'غير مصرح — سجّل الدخول مجدداً أو تحقق من البيانات.'],
    404: ['Not found — wrong URL or missing product id.', 'غير موجود — رابط خاطئ أو معرّف منتج غير موجود.'],
    500: ['Server error (500). Try again later.', 'خطأ في السيرفر (500). حاول مرة أخرى لاحقاً.']
  };

  const API_ERROR_KIND_MESSAGES = {
    blocked: ['Blocked: only FakeStoreAPI is allowed.', 'محجوب: يُسمح فقط بـ FakeStoreAPI.'],
    offline: ['You appear offline. Check your connection.', 'يبدو أنك غير متصل. تحقق من اتصالك.'],
    timeout: [`The request timed out after ${TIMEOUT_SECONDS} seconds.`, `انتهت المهلة بعد ${TIMEOUT_SECONDS} ثانية.`],
    network: ['Network failed before any response arrived.', 'فشلت الشبكة قبل وصول أي استجابة.']
  };

  /* يُرجع زوجاً [إنجليزي، عربي]؛ 200 و201 يُعاملان كنجاح ولا يدخلان هنا. */
  function getApiErrorMessage(result) {
    if (!result) return API_ERROR_KIND_MESSAGES.network;
    if (result.blocked || API_ERROR_KIND_MESSAGES[result.errorKind]) {
      return API_ERROR_KIND_MESSAGES[result.errorKind] || API_ERROR_KIND_MESSAGES.blocked;
    }
    if (API_STATUS_MESSAGES[result.status]) return API_STATUS_MESSAGES[result.status];
    if (result.empty) return ['The API returned an empty response body.', 'أعاد الـ API استجابة بجسم فارغ.'];
    if (result.invalidJson) return ['Non-JSON text response — could not read the data.', 'استجابة نصية غير JSON — تعذّرت قراءة البيانات.'];
    if (result.status === 0) return API_ERROR_KIND_MESSAGES.network;
    return [`Request failed with status ${result.status}.`, `فشل الطلب بحالة ${result.status}.`];
  }

  /* يضيف سياق العملية حتى يعرف المستخدم أين حدث الخطأ دون كشف أي بيانات حساسة. */
  function apiErrorText(result, context) {
    const [english] = getApiErrorMessage(result);
    return `${english} (${context} · ${result.status || 'offline'})`;
  }

  /* يعرض خطأ الكتابة داخل نموذج المنتج ويُبقي الأزرار صالحة لإعادة المحاولة. */
  function showFormWriteError(result, context) {
    const [english, arabic] = getApiErrorMessage(result);
    const box = getElement('product-form-error');
    box.hidden = false;
    box.replaceChildren(createBilingual(apiErrorText(result, context), arabic, true));
    toast(english, arabic, 'error');
  }

  /* يعرض خطأ الدخول؛ كلمة المرور لا تظهر في الرسالة ولا في Console. */
  function showLoginFailure(result) {
    const [english, arabic] = getApiErrorMessage(result);
    showLoginError(apiErrorText(result, 'login'), arabic);
    getElement('login-username').setAttribute('aria-invalid', 'true');
    getElement('login-password').setAttribute('aria-invalid', 'true');
  }

  /* فشل الطلب لا يفرغ السلة؛ نكتفي برسالة واضحة تبقيها محفوظة. */
  function showCheckoutFailure(result) {
    const [english, arabic] = getApiErrorMessage(result);
    toast(english, arabic, 'error');
    console.warn('[StorePulse] Checkout failed; cart was kept:', result.status);
  }

  /* ---------- 9) المفضلة ---------- */
  /* يضيف أو يحذف معرّف المنتج من المفضلة ويحدّث الزر والعدّاد. */
  function toggleFavorite(productId, button) {
    const isFavorite = state.favorites.has(productId);
    if (isFavorite) {
      state.favorites.delete(productId);
      toast('Removed from favorites', 'أُزيل من المفضلة', 'info');
    } else {
      state.favorites.add(productId);
      toast('Saved to favorites', 'حُفظ في المفضلة');
    }
    writeStorage(KEYS.favorites, [...state.favorites]);
    button.setAttribute('aria-pressed', String(state.favorites.has(productId)));
    getElement('fav-count').textContent = String(state.favorites.size);
    if (state.favoritesOnly) renderProducts();
  }

  /* ---------- 10) السلة ---------- */
  /* يجمع كميات السلة بـ reduce. */
  function cartQuantity() {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
  }

  /* يحسب المجموع من أسعار دليل المنتجات وكميات السلة. */
  function cartTotal() {
    return state.cart.reduce((total, item) => {
      const product = state.products.find((entry) => entry.id === item.productId);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  }

  /* يحدّث عدّادي السلة والمفضلة، مع أنيميشن اختياري لعدّاد السلة. */
  function renderCartBadge(bump = false) {
    const badge = getElement('cart-count');
    badge.textContent = String(cartQuantity());
    if (bump) {
      badge.classList.remove('bump');
      void badge.offsetWidth; // إعادة تشغيل الأنيميشن
      badge.classList.add('bump');
    }
    getElement('fav-count').textContent = String(state.favorites.size);
  }

  /* يعيد زر الإضافة إلى شكله الأصلي بعد ردّ الفعل المؤقت. */
  function resetAddButton(button) {
    button.classList.remove('btn-added-state');
    button.replaceChildren(createBilingual('Add', 'أضف'),
      createNode('svg', { attrs: { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'aria-hidden': 'true' } },
        createNode('path', { attrs: { d: 'M12 5v14M5 12h14' } })
      )
    );
  }

  /* يضيف منتجاً أو يزيد كميته، ثم يحفظ السلة ويحدّث الواجهة. */
  function addToCart(product, button) {
    const existingItem = state.cart.find((item) => item.productId === product.id);
    if (existingItem && existingItem.quantity >= MAX_CART_QUANTITY) {
      toast(`Maximum quantity is ${MAX_CART_QUANTITY}`, `الحد الأقصى للكمية ${MAX_CART_QUANTITY}`, 'info');
      return;
    }
    if (existingItem) existingItem.quantity += 1;
    else state.cart.push({ productId: product.id, quantity: 1 });

    writeStorage(KEYS.cart, state.cart);
    renderCartBadge(true);
    toast('Added to cart', 'أُضيف إلى السلة');

    if (!button) return;
    button.classList.add('btn-added-state');
    button.replaceChildren(createBilingual('Added', 'تمت الإضافة'));
    setTimeout(() => resetAddButton(button), ADD_FEEDBACK_MS);
  }

  /* يغيّر كمية عنصر؛ الصفر يحذفه، والقيم غير الصالحة تُرفض قبل الحفظ. */
  function changeCartQuantity(productId, quantityDelta) {
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) return;
    const item = state.cart.find((entry) => entry.productId === productId);
    if (!item || !Number.isInteger(item.quantity)) return;
    const nextQuantity = item.quantity + quantityDelta;
    if (nextQuantity < 1) {
      state.cart = state.cart.filter((entry) => entry.productId !== productId);
    } else if (nextQuantity > MAX_CART_QUANTITY) {
      toast(`Maximum quantity is ${MAX_CART_QUANTITY}`, `الحد الأقصى للكمية ${MAX_CART_QUANTITY}`, 'info');
      return;
    } else {
      item.quantity = nextQuantity;
    }
    writeStorage(KEYS.cart, state.cart);
    renderCartBadge(true);
    renderCartDialog();
  }

  /* يحذف عنصراً من السلة ويُحدّث الحالة المحفوظة. */
  function removeFromCart(productId) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
    writeStorage(KEYS.cart, state.cart);
    renderCartBadge();
    renderCartDialog();
    toast('Removed from cart', 'أُزيل من السلة', 'info');
  }

  /* يبني حالة السلة الفارغة. */
  function createEmptyCartState() {
    return createNode('div', { cls: 'cart-empty' },
      createNode('svg', { attrs: { viewBox: '0 0 24 24', width: '46', height: '46', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' } },
        createNode('circle', { attrs: { cx: '9', cy: '20', r: '1.4' } }),
        createNode('circle', { attrs: { cx: '18', cy: '20', r: '1.4' } }),
        createNode('path', { attrs: { d: 'M2 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 7H5.3' } })
      ),
      createNode('p', {}, createBilingual('Your cart is empty', 'سلتك فارغة')),
      createNode('p', { cls: 'simulation-note' }, createBilingual('Add a product to get started.', 'أضف منتجاً للبدء.'))
    );
  }

  /* يبني زر زيادة أو تقليل الكمية. */
  function createQuantityButton(productId, quantityDelta, label, text) {
    const button = createNode('button', { cls: 'qty-btn', attrs: { type: 'button', 'aria-label': label }, text });
    button.addEventListener('click', () => changeCartQuantity(productId, quantityDelta));
    return button;
  }

  /* يبني زر حذف عنصر من السلة. */
  function createRemoveButton(productId) {
    const button = createNode('button', { cls: 'remove-btn', attrs: { type: 'button', 'aria-label': 'Remove • حذف' } },
      createNode('svg', { attrs: { viewBox: '0 0 24 24', width: '15', height: '15', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'aria-hidden': 'true' } },
        createNode('path', { attrs: { d: 'M6 6l12 12M18 6 6 18' } })
      )
    );
    button.addEventListener('click', () => removeFromCart(productId));
    return button;
  }

  /* يبني صفاً واحداً في نافذة السلة من عنصر المخزون. */
  function createCartRow(item) {
    const product = state.products.find((entry) => entry.id === item.productId);
    if (!product) return null;
    return createNode('div', { cls: 'cart-row' },
      createNode('img', { cls: 'cart-thumb', attrs: { src: product.image, alt: product.title, loading: 'lazy', width: '56', height: '56' } }),
      createNode('div', { cls: 'cart-row-info' },
        createNode('p', { cls: 'cart-row-title', text: product.title }),
        createNode('p', { cls: 'cart-row-price', text: `${formatMoney(product.price)} × ${item.quantity}` })
      ),
      createNode('div', { cls: 'cart-row-actions' },
        createQuantityButton(item.productId, -1, 'Decrease • تقليل', '−'),
        createNode('span', { cls: 'qty-value', text: item.quantity }),
        createQuantityButton(item.productId, 1, 'Increase • زيادة', '+'),
        createRemoveButton(item.productId)
      )
    );
  }

  /* يعيد رسم نافذة السلة والمجموع انطلاقاً من state.cart. */
  function renderCartDialog() {
    const box = getElement('cart-items');
    box.replaceChildren();

    if (state.cart.length === 0) {
      box.append(createEmptyCartState());
    } else {
      state.cart.forEach((item) => {
        const row = createCartRow(item);
        if (row) box.append(row);
      });
    }

    getElement('cart-total').textContent = formatMoney(cartTotal());
    renderOrders();
  }

  /* يعرض طلبات التبويب الحالية في الذاكرة فقط؛ سجل الطلبات خارج خريطة M9. */
  function renderOrders() {
    const box = getElement('orders-list');
    box.replaceChildren();

    if (state.orders.length === 0) {
      box.append(createNode('p', { cls: 'simulation-note' }, createBilingual('No orders in this tab yet.', 'لا توجد طلبات في هذه التبويب بعد.')));
      return;
    }

    for (const order of state.orders.slice(0, RECENT_ORDERS_SHOWN)) {
      box.append(
        createNode('div', { cls: 'order-item' },
          createNode('span', { text: `${order.date} • #${order.apiId}` }),
          createNode('strong', { text: `${order.items.length} × ${formatMoney(order.total)}` })
        )
      );
    }
  }

  /* ---------- 11) النوافذ ---------- */
  function openDialog(dialog) {
    // لا نستعيد التركيز لعنصر داخل نافذة أخرى أُغلقت.
    if (document.activeElement && !document.activeElement.closest('dialog')) {
      state.lastFocus = document.activeElement;
    }
    if (!dialog.open) dialog.showModal();
  }

  /* يربط إغلاق النوافذ وفتح السلة والدخول مرة واحدة عند البدء. */
  function setupDialogs() {
    document.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => button.closest('dialog').close());
    });
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => {
        if (state.lastFocus && state.lastFocus.isConnected) state.lastFocus.focus();
      });
    });

    getElement('btn-cart').addEventListener('click', () => {
      renderCartDialog();
      openDialog(getElement('cart-dialog'));
    });
    getElement('btn-login').addEventListener('click', () => openLogin());
  }

  /* ---------- 11b) تأكيد عمليات M8.2 ---------- */
  let pendingConfirmAction = null;

  /* يضبط حالة زر التأكيد أثناء انتظار DELETE حتى لا يُضغط مرتين. */
  function setConfirmLoading(isLoading) {
    const yes = getElement('confirm-yes');
    yes.disabled = isLoading;
    yes.classList.toggle('is-loading', isLoading);
  }

  /* يفتح نافذة تأكيد؛ الإلغاء أو Escape لا ينفّذ الكallback أبداً. */
  function askConfirmation(question, handler) {
    pendingConfirmAction = handler;
    setConfirmLoading(false);
    getElement('confirm-title').replaceChildren(createBilingual(question.titleEn, question.titleAr));
    getElement('confirm-message').replaceChildren(createBilingual(question.messageEn, question.messageAr, true));
    openDialog(getElement('confirm-dialog'));
  }

  /* يربط أزرار التأكيد مرة واحدة عند البدء؛ الإلغاء الصريح فقط يمسح الكallback. */
  function setupConfirmationDialog() {
    const dialog = getElement('confirm-dialog');
    getElement('confirm-yes').addEventListener('click', () => {
      const handler = pendingConfirmAction;
      pendingConfirmAction = null;
      dialog.close();
      if (handler) handler();
    });
    getElement('confirm-no').addEventListener('click', () => {
      pendingConfirmAction = null;
      setConfirmLoading(false);
      dialog.close();
    });
    dialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => {
        pendingConfirmAction = null;
        setConfirmLoading(false);
      });
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        pendingConfirmAction = null;
        setConfirmLoading(false);
      }
    });
    dialog.addEventListener('cancel', () => {
      pendingConfirmAction = null;
      setConfirmLoading(false);
    });
  }

  /* ---------- 11c) نموذج إضافة/تعديل المنتج (M8.1 وM8.2) ---------- */
  /* يملأ قائمة الفئات من الـ API مع بديل محلي إذا تعذّر تحميلها. */
  function fillProductCategorySelect() {
    const select = getElement('product-category');
    select.replaceChildren();
    const categories = state.categories.length ? state.categories : Object.keys(CATEGORY_AR);
    categories.forEach((category) => {
      select.append(createNode('option', { attrs: { value: category }, text: category }));
    });
  }

  /* يمسح أخطاء الحقول ورسائل النتيجة قبل كل محاولة جديدة. */
  function clearProductFormErrors() {
    ['product-title', 'product-price', 'product-description', 'product-image', 'product-category'].forEach((fieldId) => {
      getElement(fieldId).removeAttribute('aria-invalid');
    });
    ['product-title-error', 'product-price-error', 'product-description-error', 'product-image-error', 'product-category-error'].forEach((errorId) => {
      const box = getElement(errorId);
      box.hidden = true;
      box.replaceChildren();
    });
    getElement('product-form-error').hidden = true;
    getElement('product-form-error').replaceChildren();
    getElement('write-result').hidden = true;
    getElement('write-result').replaceChildren();
  }

  /* يضع خطأً مرئياً وaria-invalid على حقل واحد فقط. */
  function setProductFieldError(fieldId, errorId, english, arabic) {
    getElement(fieldId).setAttribute('aria-invalid', 'true');
    const box = getElement(errorId);
    box.hidden = false;
    box.replaceChildren(createBilingual(english, arabic));
  }

  /* يتحقق من الحقول محلياً قبل أي طلب؛ يمنع الإرسال عند عدم صحة القيم. */
  function readValidatedProductForm() {
    clearProductFormErrors();
    const title = getElement('product-title').value.trim();
    const priceRaw = getElement('product-price').value.trim();
    const price = Number(priceRaw);
    const description = getElement('product-description').value.trim();
    const image = getElement('product-image').value.trim();
    const category = getElement('product-category').value;
    const errors = {};

    if (title.length < MIN_TITLE_LENGTH) {
      errors.title = [`Use at least ${MIN_TITLE_LENGTH} characters.`, `استخدم ${MIN_TITLE_LENGTH} أحرف على الأقل.`];
    }
    if (!priceRaw || !Number.isFinite(price) || price <= 0) {
      errors.price = ['Enter a price greater than zero.', 'أدخل سعراً أكبر من صفر.'];
    }
    if (description.length < MIN_DESCRIPTION_LENGTH) {
      errors.description = [`Use at least ${MIN_DESCRIPTION_LENGTH} characters.`, `استخدم ${MIN_DESCRIPTION_LENGTH} أحرف على الأقل.`];
    }
    let imageOk = false;
    try {
      const parsed = new URL(image);
      // Q7: القبول مطابق لـ CSP في index.html؛ رابط خارجي آخر كان سيُرفض بعد الإرسال.
      imageOk = parsed.protocol === 'https:' && parsed.hostname === ALLOWED_IMAGE_HOST &&
        parsed.pathname.startsWith(ALLOWED_IMAGE_PATH) && image.length <= MAX_IMAGE_URL_LENGTH;
    } catch (error) { imageOk = false; }
    if (!imageOk) errors.image = [
      `Enter an https://${ALLOWED_IMAGE_HOST}${ALLOWED_IMAGE_PATH} image URL.`,
      `أدخل رابط صورة يبدأ بـ https://${ALLOWED_IMAGE_HOST}${ALLOWED_IMAGE_PATH}.`
    ];
    if (!category || !state.categories.includes(category) && !Object.keys(CATEGORY_AR).includes(category)) {
      errors.category = ['Choose a category from the list.', 'اختر تصنيفاً من القائمة.'];
    }

    const fieldMap = {
      title: ['product-title', 'product-title-error'],
      price: ['product-price', 'product-price-error'],
      description: ['product-description', 'product-description-error'],
      image: ['product-image', 'product-image-error'],
      category: ['product-category', 'product-category-error']
    };
    Object.entries(errors).forEach(([name, message]) => {
      setProductFieldError(fieldMap[name][0], fieldMap[name][1], message[0], message[1]);
    });
    if (Object.keys(errors).length) return null;
    return { title, price, description, image, category };
  }

  /* يمنع تكرار الإرسال أثناء انتظار الاستجابة ويُنهي الحالة في finally. */
  function setProductFormLoading(isLoading) {
    state.writePending = isLoading;
    const submit = getElement('product-form-submit');
    const cancel = getElement('btn-cancel-product-form');
    const discard = getElement('btn-discard-draft');
    submit.disabled = isLoading;
    cancel.disabled = isLoading;
    if (discard) discard.disabled = isLoading;
    submit.classList.toggle('is-loading', isLoading);
    getElement('product-form').setAttribute('aria-busy', String(isLoading));
  }

  /* يعرض معرّف المنتج الذي أعاده الـ API بوضوح داخل النافذة. */
  function showWriteResult(english, arabic) {
    const box = getElement('write-result');
    box.hidden = false;
    box.replaceChildren(createBilingual(english, arabic, true));
  }

  /* يحفظ مسودة الإضافة غير المرسلة في sessionStorage فقط، لا في localStorage. */
  function saveProductDraft() {
    const form = getElement('product-form');
    if (form.dataset.mode !== PRODUCT_FORM_MODE.ADD) return;
    writeStorage(KEYS.productDraft, {
      title: getElement('product-title').value,
      price: getElement('product-price').value,
      description: getElement('product-description').value,
      image: getElement('product-image').value,
      category: getElement('product-category').value
    }, sessionStorage);
  }

  /* يمسح المسودة بعد الإضافة الناجحة أو عند طلب المستخدم إلغاءها صراحةً. */
  function clearProductDraft() {
    removeStorage(KEYS.productDraft, sessionStorage);
  }

  /* يفتح النموذج في وضع الإضافة أو يملؤه ببيانات المنتج عند التعديل. */
  function openProductForm(mode, product = null) {
    const isEdit = mode === PRODUCT_FORM_MODE.EDIT && product;
    const form = getElement('product-form');
    form.dataset.mode = isEdit ? PRODUCT_FORM_MODE.EDIT : PRODUCT_FORM_MODE.ADD;
    form.dataset.productId = isEdit ? String(product.id) : '';
    clearProductFormErrors();
    fillProductCategorySelect();
    getElement('product-form-title').replaceChildren(createBilingual(
      isEdit ? `Edit product #${product.id}` : 'Add a new product',
      isEdit ? `تعديل المنتج #${product.id}` : 'إضافة منتج جديد'
    ));
    getElement('product-form-submit-label').replaceChildren(createBilingual(
      isEdit ? 'Save changes' : 'Create product',
      isEdit ? 'حفظ التعديل' : 'إنشاء المنتج'
    ));

    const draft = isEdit ? null : readProductDraft();
    const categoryOptions = [...getElement('product-category').options].map((option) => option.value);
    const draftCategory = draft && categoryOptions.includes(draft.category) ? draft.category : '';
    getElement('product-title').value = isEdit ? product.title : (draft ? draft.title : '');
    getElement('product-price').value = isEdit ? product.price : (draft ? draft.price : '');
    getElement('product-description').value = isEdit ? product.description : (draft ? draft.description : '');
    getElement('product-image').value = isEdit ? product.image : (draft ? draft.image : '');
    getElement('product-category').value = isEdit && state.categories.includes(product.category)
      ? product.category
      : (draftCategory || categoryOptions[0] || '');
    getElement('btn-discard-draft').hidden = isEdit;
    getElement('draft-note').hidden = isEdit;
    setProductFormLoading(false);
    openDialog(getElement('product-form-dialog'));
    getElement('product-title').focus();
  }

  /* يرسل POST أو PUT بالصيغة المطلوبة ويعالج كل حالات الفشل قبل إعادة تمكين الأزرار. */
  async function sendProductWrite(mode, payload, productId) {
    const isAdd = mode === PRODUCT_FORM_MODE.ADD;
    const context = isAdd ? 'add product' : 'edit product';
    setProductFormLoading(true);
    try {
      const url = isAdd ? `${BASE_URL}/products` : buildProductUrl(productId);
      const options = {
        method: isAdd ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      };
      const result = await apiRequest(url, options);
      if (!result.ok || !result.data || typeof result.data !== 'object' || safeProductId(result.data.id) === null) {
        showFormWriteError(result, context);
        return false;
      }

      const returnedId = safeProductId(result.data.id);
      let successEn = '';
      let successAr = '';
      if (isAdd) {
        rememberAddedProduct(result.data); // يُضاف تلقائياً داخل applySessionChanges
        clearProductDraft(); // M9: المسودة تُزال فقط بعد نجاح الإضافة
        state.products = applySessionChanges(state.products, true);
        state.viewProducts = applySessionChanges(state.viewProducts);
        successEn = `Created (${result.status}) — API id: ${returnedId}.`;
        successAr = `أُنشئ (${result.status}) — معرّف الـ API: ${returnedId}.`;
        toast(`Created • id ${returnedId}`, 'تم الإنشاء', 'success');
      } else {
        const original = findProductById(productId);
        const merged = { ...result.data, rating: original && original.rating ? original.rating : result.data.rating };
        const copy = rememberEditedProduct(merged);
        state.products = applySessionChanges(state.products.map((entry) => entry.id === copy.id ? copy : entry), true);
        state.viewProducts = applySessionChanges(state.viewProducts.map((entry) => entry.id === copy.id ? copy : entry));
        successEn = `Updated (${result.status}) — API id: ${returnedId}.`;
        successAr = `حُدّث (${result.status}) — معرّف الـ API: ${returnedId}.`;
        toast(`Updated • id ${returnedId}`, 'تم التعديل', 'success');
      }
      showWriteResult(
        `${successEn} Session-only copy: FakeStoreAPI does not persist writes; reload restores API data.`,
        `${successAr} نسخة مؤقتة: FakeStoreAPI لا يحفظ عمليات الكتابة؛ إعادة التحميل تستعيد بيانات الـ API.`
      );
      renderApp();
      return true;
    } catch (error) {
      console.error('[StorePulse] Unexpected product write error:', error);
      showFormWriteError({ ok: false, status: 0, empty: true, errorKind: 'network' }, context);
      return false;
    } finally {
      setProductFormLoading(false);
    }
  }

  /* يقرأ النموذج ثم يطلب تأكيد التعديل فقط؛ الإضافة لا تحتاج تأكيداً. */
  async function submitProductForm(event) {
    event.preventDefault();
    if (state.writePending) return;
    const mode = getElement('product-form').dataset.mode;
    const payload = readValidatedProductForm();
    if (!payload) return;

    if (mode === PRODUCT_FORM_MODE.EDIT) {
      const productId = safeProductId(getElement('product-form').dataset.productId);
      if (productId === null) {
        showFormWriteError({ ok: false, status: 0, empty: true, errorKind: 'network' }, 'edit product');
        return;
      }
      askConfirmation({
        titleEn: 'Save these changes?',
        titleAr: 'حفظ هذه التعديلات؟',
        messageEn: `PUT /products/${productId} will be sent only after you confirm. FakeStoreAPI simulates the write; the local copy is session-only.`,
        messageAr: `لن يُرسل PUT /products/${productId} إلا بعد التأكيد. FakeStoreAPI يحاكي الكتابة والنسخة المحلية مؤقتة للجلسة.`
      }, () => sendProductWrite(mode, payload, productId));
      return;
    }
    await sendProductWrite(mode, payload, null);
  }

  /* يطلب تأكيداً صريحاً قبل DELETE؛ الإلغاء لا يرسل أي طلب. */
  function confirmDeleteProduct(product) {
    const productId = safeProductId(product.id);
    if (productId === null) {
      toast('Invalid product id', 'معرّف المنتج غير صالح', 'error');
      return;
    }
    askConfirmation({
      titleEn: 'Delete this product?',
      titleAr: 'حذف هذا المنتج؟',
      messageEn: `DELETE /products/${productId} will be sent only after confirmation. The API does not really delete it, so reload restores it.`,
      messageAr: `لن يُرسل DELETE /products/${productId} إلا بعد التأكيد. الـ API لا يحذفه فعلياً، لذلك تعيد إعادة التحميل إظهاره.`
    }, () => performDeleteProduct(productId));
  }

  /* ينفّذ DELETE بعد التأكيد ويُحدّث النسخة المؤقتة في الذاكرة فقط. */
  async function performDeleteProduct(productId) {
    setConfirmLoading(true);
    try {
      const result = await apiRequest(buildProductUrl(productId), { method: 'DELETE' });
      if (!result.ok || !result.data || typeof result.data !== 'object' || !result.data.id) {
        const [english, arabic] = getApiErrorMessage(result);
        toast(english, arabic, 'error');
        console.warn('[StorePulse] Delete failed; catalogue was kept:', result.status);
        return false;
      }
      rememberDeletedProduct(productId);
      state.products = applySessionChanges(state.products.filter((entry) => entry.id !== productId), true);
      state.viewProducts = applySessionChanges(state.viewProducts.filter((entry) => entry.id !== productId));
      renderApp();
      toast(`Deleted (${result.status}) • id ${result.data.id}`, 'تم الحذف', 'success');
      return true;
    } catch (error) {
      console.error('[StorePulse] Unexpected delete error:', error);
      toast('Network failed before delete could finish.', 'فشلت الشبكة قبل اكتمال الحذف.', 'error');
      return false;
    } finally {
      setConfirmLoading(false);
    }
  }

  /* يربط زر الإضافة ونموذج المنتج وتنظيف أخطاء الحقول أثناء الكتابة. */
  function setupProductForm() {
    getElement('btn-add-product').addEventListener('click', () => openProductForm(PRODUCT_FORM_MODE.ADD));
    getElement('product-form').addEventListener('submit', submitProductForm);
    // Cancel يغلق النافذة فقط ويحتفظ بالمسودة؛ Discard هو الإلغاء الصريح للمسودة.
    getElement('btn-cancel-product-form').addEventListener('click', () => getElement('product-form-dialog').close());
    getElement('btn-discard-draft').addEventListener('click', () => {
      clearProductDraft();
      openProductForm(PRODUCT_FORM_MODE.ADD);
      toast('Draft discarded', 'تم تجاهل المسودة', 'info');
    });
    getElement('product-form-dialog').addEventListener('cancel', (event) => {
      if (state.writePending) event.preventDefault();
    });
    ['product-title', 'product-price', 'product-description', 'product-image', 'product-category'].forEach((fieldId) => {
      const field = getElement(fieldId);
      const clearFieldError = () => {
        field.removeAttribute('aria-invalid');
        const errorId = `${fieldId}-error`;
        const box = getElement(errorId);
        if (box) { box.hidden = true; box.replaceChildren(); }
      };
      field.addEventListener('input', () => { clearFieldError(); saveProductDraft(); });
      field.addEventListener('change', () => { clearFieldError(); saveProductDraft(); });
    });
  }

  /* يبني مسار منتج آمناً: المعرّف يُشفَّر قبل إلحاقه بالمسار. */
  function buildProductUrl(productId) {
    return `${BASE_URL}/products/${encodeURIComponent(productId)}`;
  }

  /* يبني سطر التقييم داخل نافذة التفاصيل. */
  function createDetailRating(product) {
    return createNode('div', { cls: 'rating' },
      createNode('span', { text: '★', attrs: { 'aria-hidden': 'true' } }),
      createNode('span', { text: product.rating ? `${product.rating.rate.toFixed(1)} / ${RATING_SCALE}` : '—' }),
      createNode('span', { text: product.rating ? `(${product.rating.count})` : '' })
    );
  }

  /* يبني محتوى نافذة التفاصيل من استجابة الـ API بلا innerHTML. */
  function createProductDetailView(product, sessionOnly = false) {
    const info = createNode('div', { cls: 'detail-info' },
      createNode('span', { cls: 'chip detail-badge', dataset: { category: product.category } }, createBilingual(product.category, translateCategory(product.category))),
      createNode('h2', { text: product.title }),
      createDetailRating(product),
      createNode('p', { cls: 'detail-price', text: formatMoney(product.price) }),
      createNode('p', { cls: 'detail-desc', text: product.description }),
      createNode('div', { cls: 'detail-meta' },
        createNode('button', { cls: 'btn btn-primary btn-lg', attrs: { type: 'button' } },
          createBilingual('Add to cart', 'أضف إلى السلة')
        )
      )
    );
    if (sessionOnly) {
      info.append(createNode('p', { cls: 'simulation-note' }, createBilingual(
        'Session-only copy: FakeStoreAPI does not store this product, so GET /products/{id} cannot retrieve it after reload.',
        'نسخة مؤقتة في الجلسة: FakeStoreAPI لا يحفظ هذا المنتج، لذلك لا يمكن استرجاعه عبر GET /products/{id} بعد إعادة التحميل.'
      )));
    }
    return createNode('div', { cls: 'product-detail' },
      createNode('div', { cls: 'detail-media' }, createNode('img', { attrs: { src: product.image, alt: product.title, loading: 'lazy', width: '500', height: '500' } })),
      info
    );
  }

  /* يبني حالة تحميل داخل نافذة التفاصيل بنفس تنسيق حالات الصفحة. */
  function createDetailLoading() {
    return createNode('div', { cls: 'state-box' },
      createNode('h3', {}, createBilingual('Loading product…', 'جارٍ تحميل المنتج…')),
      createNode('div', { cls: 'skeleton-line' }),
      createNode('div', { cls: 'skeleton-line short' })
    );
  }

  /* يبني حالة خطأ أو استجابة فارغة مع زر إعادة محاولة. */
  function createDetailError(productId, isEmpty) {
    const retryButton = createNode('button', { cls: 'btn btn-primary', attrs: { type: 'button' } },
      createBilingual('Retry', 'إعادة المحاولة')
    );
    retryButton.addEventListener('click', () => openProductDialog(productId));
    return createNode('div', { cls: 'state-box' },
      createNode('h3', {}, isEmpty
        ? createBilingual('No product for this id', 'لا يوجد منتج بهذا المعرّف')
        : createBilingual('Could not load details', 'تعذّر تحميل التفاصيل')),
      createNode('p', {}, createBilingual(
        isEmpty ? 'The API returned an empty response.' : 'Check your connection and try again.',
        isEmpty ? 'أعاد الـ API استجابة فارغة.' : 'تحقق من اتصالك ثم أعد المحاولة.'
      )),
      retryButton
    );
  }

  /* يرسم تفاصيل المنتج القادمة من الـ API أو من نسخة الجلسة المؤقتة. */
  function renderProductDetail(product, sessionOnly = false) {
    const body = getElement('product-dialog-body');
    body.replaceChildren();
    const view = createProductDetailView(product, sessionOnly);
    const addButton = view.querySelector('.detail-meta .btn');
    addButton.addEventListener('click', () => addToCart(product, addButton));
    body.append(view);
  }

  /* يفتح النافذة ثم يجلب GET /products/{id} ويعرض بياناته الفعلية. */
  async function openProductDialog(productId) {
    const body = getElement('product-dialog-body');
    const id = safeProductId(productId);
    if (id === null) return;

    // المنتج المؤقت لا يوجد في الـ API؛ نعرض نسخة الذاكرة ونقول ذلك صراحةً.
    const localProduct = findProductById(id);
    if (localProduct && localProduct.sessionStatus) {
      renderProductDetail(localProduct, true);
      openDialog(getElement('product-dialog'));
      return;
    }

    const requestToken = ++state.detailToken;
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(createDetailLoading());
    openDialog(getElement('product-dialog'));

    const result = await apiRequest(buildProductUrl(id));
    if (requestToken !== state.detailToken) return; // نافذة أحدث حلّت محل هذه
    body.removeAttribute('aria-busy');

    const product = result.data;
    const hasProduct = result.ok && product && typeof product === 'object' && !Array.isArray(product) && product.id && product.title;
    if (!hasProduct) {
      console.warn('[StorePulse] Detail request failed for id', productId, 'status', result.status);
      body.replaceChildren(createDetailError(productId, result.ok));
      return;
    }
    renderProductDetail(product);
    console.info('[StorePulse] Detail loaded from API for id', product.id);
  }

  /* ---------- 12) الدخول التجريبي ---------- */
  /* يفتح نافذة الدخول ويمسح رسائلها وعلامات أخطائها. */
  function openLogin() {
    getElement('login-error').hidden = true;
    getElement('login-error').replaceChildren();
    clearLoginInvalidState();
    openDialog(getElement('login-dialog'));
  }

  /* يزيل علامات الخطأ عن حقلي الدخول. */
  function clearLoginInvalidState() {
    getElement('login-username').removeAttribute('aria-invalid');
    getElement('login-password').removeAttribute('aria-invalid');
  }

  /* يضبط حالة زر الإرسال أثناء طلب الدخول. */
  function setLoginLoading(isLoading) {
    const submitButton = getElement('login-form').querySelector('button[type="submit"]');
    submitButton.classList.toggle('is-loading', isLoading);
    submitButton.disabled = isLoading;
  }

  /* يعرض رسالة خطأ ثنائية اللغة داخل نافذة الدخول. */
  function showLoginError(english, arabic) {
    const errorBox = getElement('login-error');
    errorBox.hidden = false;
    errorBox.replaceChildren(createBilingual(english, arabic, true));
  }

  /* يجلب قائمة المستخدمين مرة واحدة لإكمال بيانات المستخدم بعد الدخول. */
  async function ensureUsers() {
    if (state.users.length) return;
    const result = await apiRequest(`${BASE_URL}/users`);
    if (result.ok && Array.isArray(result.data)) state.users = result.data;
  }

  /* يستخرج معرّف المستخدم من /users؛ لا يخترع معرّفاً عند غياب المستخدم. */
  function deriveUser(username) {
    const match = state.users.find((user) => user.username === username);
    return match
      ? { id: match.id, username: match.username }
      : { id: null, username };
  }

  /* يبني رأس التوكن للطلبات اللاحقة داخل نطاق الـ API فقط. */
  function authHeaders() {
    return state.token ? { Authorization: `Bearer ${state.token}` } : {};
  }

  /* يعكس حالة الجلسة على الهيدر؛ لا يعرض التوكن نفسه أبداً. */
  function syncAuthUi() {
    const signedIn = Boolean(state.token);
    getElement('login-label').replaceChildren(createBilingual(
      signedIn ? `Hi, ${state.username}` : 'Sign in',
      signedIn ? `مرحباً، ${state.username}` : 'دخول'
    ));
    getElement('btn-logout').hidden = !signedIn;
    getElement('btn-bearer-check').hidden = !signedIn;
    getElement('btn-login').setAttribute('aria-label', signedIn
      ? `Signed in as ${state.username} • تم الدخول`
      : 'Sign in • تسجيل الدخول');
  }

  /* يستعيد الدخول بعد Reload في نفس التبويب من sessionStorage فقط. */
  async function restoreSession() {
    const token = readStorage(KEYS.token, '', sessionStorage);
    const username = readStorage(KEYS.username, '', sessionStorage);
    if (typeof token !== 'string' || !token || typeof username !== 'string' || !username) return;
    state.token = token;
    state.username = username;
    syncAuthUi();
    await ensureUsers();
    state.user = deriveUser(username);
    console.info('[StorePulse] Restored demo session for this tab');
  }

  /* يمسح المصادقة من الذاكرة ومن sessionStorage دون لمس localStorage. */
  function clearAuthState() {
    state.token = '';
    state.username = '';
    state.user = null;
    state.pendingCheckout = false;
    try {
      sessionStorage.removeItem(KEYS.token);
      sessionStorage.removeItem(KEYS.username);
    } catch (error) {
      console.warn('[StorePulse] Could not clear session auth:', error.message);
    }
    getElement('login-password').value = '';
    syncAuthUi();
  }

  /* يخرج من الجلسة التجريبية ويحدّث الواجهة فوراً. */
  function logout() {
    clearAuthState();
    toast('Signed out (demo)', 'تم الخروج (تجريبي)', 'info');
    console.info('[StorePulse] Demo session cleared');
  }

  /* يرسل طلباً لاحقاً بAuthorization: Bearer للتحقق من الإرسال فقط، لا من الصلاحيات. */
  async function checkBearerHeader() {
    if (!state.token) {
      toast('Sign in first (demo)', 'سجّل الدخول أولاً (تجريبي)', 'info');
      return;
    }
    const button = getElement('btn-bearer-check');
    button.disabled = true;
    button.classList.add('is-loading');
    try {
      const result = await apiRequest(`${BASE_URL}/products/1`, { headers: authHeaders() });
      if (!result.ok) {
        const [english, arabic] = getApiErrorMessage(result);
        toast(english, arabic, 'error');
        return;
      }
      toast('Bearer header sent to FakeStoreAPI', 'تم إرسال رأس التوكن إلى FakeStoreAPI');
      console.info('[StorePulse] Authorization header sent to FakeStoreAPI (value hidden)');
    } catch (error) {
      console.error('[StorePulse] Unexpected bearer check error:', error);
      toast('Network failed during bearer check.', 'فشلت الشبكة أثناء التحقق من التوكن.', 'error');
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  }

  /* يكمل حالة الدخول بعد نجاح الـ API ويحفظ التوكن واسم المستخدم في الجلسة. */
  async function completeLogin(username, token) {
    state.token = token;
    state.username = username;
    writeStorage(KEYS.token, token, sessionStorage);
    writeStorage(KEYS.username, username, sessionStorage);
    syncAuthUi();
    await ensureUsers();
    state.user = deriveUser(username);

    getElement('login-username').value = '';
    getElement('login-password').value = '';
    getElement('login-error').hidden = true;
    clearLoginInvalidState();
    getElement('login-dialog').close();
    toast('Signed in (demo)', 'تم الدخول (تجريبي)');

    if (state.pendingCheckout) {
      state.pendingCheckout = false;
      placeOrder();
    }
  }

  /* يعالج submit: يمنع إعادة التحميل، يتحقق من الحقول، ثم يطلب الدخول. */
  async function handleLogin(event) {
    event.preventDefault();
    const submitButton = getElement('login-form').querySelector('button[type="submit"]');
    if (submitButton.disabled) return;
    const username = getElement('login-username').value.trim();
    const password = getElement('login-password').value;

    if (!username || !password) {
      showLoginError('Fill in both fields.', 'عبّئ الحقلين معاً.');
      getElement('login-username').setAttribute('aria-invalid', String(!username));
      getElement('login-password').setAttribute('aria-invalid', String(!password));
      return;
    }

    setLoginLoading(true);
    let result;
    try {
      // عند الخطأ الـ API يرجع 401 بنص عادي وليس JSON — apiRequest يتعامل مع ذلك.
      result = await apiRequest(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch (error) {
      // استثناء غير متوقع: يُسجّل صراحةً ولا يبقى عالقاً في Console.
      console.error('[StorePulse] Unexpected login error:', error);
      result = { ok: false, status: 0, data: null, text: '', empty: true, errorKind: 'network' };
    } finally {
      setLoginLoading(false);
    }

    if (!result.ok || !result.data || typeof result.data !== 'object' || !result.data.token) {
      showLoginFailure(result);
      return;
    }

    await completeLogin(username, result.data.token);
  }

  /* ---------- 13) الطلب التجريبي ---------- */
  /* يضبط حالة زر إنشاء الطلب بين بداية الطلب ونهايته. */
  function setCheckoutLoading(isLoading) {
    const button = getElement('btn-checkout');
    button.classList.toggle('is-loading', isLoading);
    button.disabled = isLoading;
  }

  /* يحوّل عناصر السلة إلى سطور تحمل السعر والعنوان من دليل المنتجات. */
  function createOrderItems() {
    return state.cart.map((item) => {
      const product = state.products.find((entry) => entry.id === item.productId) || {};
      return {
        productId: item.productId,
        quantity: item.quantity,
        title: product.title || `#${item.productId}`,
        price: product.price || 0
      };
    });
  }

  /* يبني جسم POST /carts بالصيغة المطلوبة في المرجع. */
  function buildOrderBody(items) {
    return {
      userId: state.user.id,
      date: new Date().toISOString().slice(0, DATE_PART_LENGTH),
      products: items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
    };
  }

  /* ينشئ سجل طلب محلي من استجابة الـ API ومن سطور الطلب. */
  function createOrderRecord(body, items, apiId) {
    return {
      apiId: apiId || '—',
      date: body.date,
      items,
      total: items.reduce((total, item) => total + item.price * item.quantity, 0)
    };
  }

  /* يضيف الطلب لذاكرة التبويب ويفرغ السلة ويعرض ملخص النافذة. */
  function finishOrder(order) {
    state.orders.unshift(order);
    state.orders = state.orders.slice(0, MAX_SAVED_ORDERS); // لا يُكتب في Storage بعد M9
    state.cart = [];
    writeStorage(KEYS.cart, state.cart);
    renderCartBadge();
    renderCartDialog();
    getElement('cart-dialog').close();
    openOrderDialog(order);
    toast('Demo order created', 'تم إنشاء الطلب التجريبي');
    console.log('[StorePulse] Demo order created with API id', order.apiId);
  }

  /* يرسل الطلب التجريبي بعد التحقق من السلة وتسجيل الدخول ومعرّف المستخدم. */
  async function placeOrder() {
    if (getElement('btn-checkout').disabled) return;
    if (state.cart.length === 0) {
      toast('Your cart is empty', 'سلتك فارغة', 'info');
      return;
    }

    if (!state.user) {
      state.pendingCheckout = true;
      getElement('cart-dialog').close();
      openLogin();
      toast('Sign in first (demo)', 'سجّل الدخول أولاً (تجريبي)', 'info');
      return;
    }

    // لا نخترع userId: إن لم نجده في /users نحاول الجلب مرة أخرى ثم نوقف الطلب.
    if (!Number.isInteger(state.user.id)) {
      await ensureUsers();
      state.user = deriveUser(state.user.username);
      if (!Number.isInteger(state.user.id)) {
        toast('Could not resolve the API user id. Try again.', 'تعذّر معرفة معرّف المستخدم من الـ API. حاول مجدداً.', 'error');
        return;
      }
    }

    const items = createOrderItems();
    const body = buildOrderBody(items);
    setCheckoutLoading(true);
    let result;
    try {
      result = await apiRequest(`${BASE_URL}/carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error('[StorePulse] Unexpected order error:', error);
      result = { ok: false, status: 0, data: null, empty: true, errorKind: 'network' };
    } finally {
      setCheckoutLoading(false);
    }

    if (!result.ok || !result.data || typeof result.data !== 'object' || !result.data.id) {
      showCheckoutFailure(result);
      return; // السلة تبقى كما هي عند الفشل
    }

    finishOrder(createOrderRecord(body, items, result.data.id));
  }

  /* يعرض ملخص الطلب الذي أنشأه الـ API. */
  function openOrderDialog(order) {
    const box = getElement('order-summary');
    const productCount = order.items.reduce((total, item) => total + item.quantity, 0);
    box.replaceChildren(
      createNode('div', {}, createBilingual('API order id', 'معرّف الطلب في الـ API'), createNode('strong', { text: `#${order.apiId}` })),
      createNode('div', {}, createBilingual('Products', 'عدد المنتجات'), createNode('strong', { text: String(productCount) })),
      createNode('div', {}, createBilingual('Total', 'المجموع'), createNode('strong', { text: formatMoney(order.total) })),
      createNode('div', {}, createBilingual('Kept in this tab', 'محفوظ في هذه التبويب فقط'), createNode('strong', { text: order.date }))
    );
    openDialog(getElement('order-dialog'));
  }

  /* ---------- 14) تفاصيل الواجهة ---------- */
  /* M2.7: الهيدر الآن sticky في CSS فقط، لذلك لم نعد نضيف/نحذف صنف إخفاء هنا.
     السكربت يحدّث شريط التقدّم وزر العودة للأعلى فقط. */
  /* يحدّث شريط التقدّم وزر العودة للأعلى أثناء التمرير. */
  function setupScrollEffects() {
    const progress = getElement('scroll-progress');
    const topButton = getElement('back-to-top');

    /* يحسب نسبة التمرير ويظهر زر العودة للأعلى بعد العتبة المحددة. */
    function updateScrollIndicators() {
      const scrollTop = Math.round(window.scrollY);
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progressRatio = scrollableHeight > 0 ? scrollTop / scrollableHeight : 0;
      progress.style.transform = `scaleX(${progressRatio.toFixed(4)})`;
      topButton.classList.toggle('is-visible', scrollTop > SCROLL_TOP_THRESHOLD_PX);
    }

    window.addEventListener('scroll', updateScrollIndicators, { passive: true });
    topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    updateScrollIndicators();
  }

  /* يربط البحث: debounce للتصفية، وEnter/Blur فقط لحفظ آخر عمليات البحث. */
  function setupSearchControl() {
    const searchInput = getElement('search-input');
    let searchTimer = null;
    let inputEvents = 0;
    let filterRuns = 0;

    // يطبع العدّادات الحقيقية في Console بعد كل تنفيذ أو عند الطلب.
    function logSearchStats(reason) {
      console.info(`[StorePulse] Search stats (${reason}) — input events: ${inputEvents}, filter runs: ${filterRuns}`);
    }

    // الدالة الفعلية للبحث: تقرأ القيمة الحالية وتعيد الرسم مرة واحدة فقط.
    function runSearch(reason = 'debounce') {
      searchTimer = null;
      state.search = searchInput.value.trim().toLowerCase().slice(0, MAX_SEARCH_LENGTH);
      filterRuns += 1;
      writeFilters(); // نص البحث الحالي جزء من الفلاتر في sessionStorage
      goToFirstPage();
      renderProducts();
      logSearchStats(reason);
      return state.search;
    }

    // كل حرف جديد يلغي المؤقت السابق؛ لا يُضافة إلى سجل البحث أثناء الكتابة.
    function debounceSearch() {
      inputEvents += 1;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch('debounce'), SEARCH_DEBOUNCE_MS);
    }

    // Enter أو مغادرة الحقل يعني أن المستخدم أنهى البحث، فحينها يُحفظ في السجل.
    function commitSearch(reason) {
      clearTimeout(searchTimer);
      const term = runSearch(reason);
      rememberSearch(term);
    }

    searchInput.addEventListener('input', debounceSearch);
    searchInput.addEventListener('change', () => commitSearch('change'));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitSearch('Enter');
      }
    });

    // إعادة استخدام عملية سابقة: زر من القائمة يملأ الحقل وينفّذ البحث فوراً.
    getElement('recent-searches-list').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-search]');
      if (!button) return;
      searchInput.value = button.dataset.search;
      commitSearch('recent');
      searchInput.focus();
    });
    getElement('btn-clear-recent').addEventListener('click', clearRecentSearches);

    // عدّادات للقراءة من Console: StorePulseSearchStats.log() / .reset().
    window.StorePulseSearchStats = Object.freeze({
      get inputEvents() { return inputEvents; },
      get filterRuns() { return filterRuns; },
      log: () => logSearchStats('console'),
      reset: () => { inputEvents = 0; filterRuns = 0; }
    });
  }

  /* يربط التحكمين اللذين يُنفّذان على السيرفر: limit و?sort=. */
  function setupServerSortControls() {
    getElement('limit-select').addEventListener('change', (event) => {
      state.limit = Number(event.target.value);
      writeFilters();
      goToFirstPage();
      loadProducts(buildProductsUrl());
    });

    getElement('id-sort-select').addEventListener('change', (event) => {
      state.idSort = event.target.value;
      // الترتيب المحلي يخفي ترتيب السيرفر، لذلك نرجّعه للافتراضي.
      state.sort = 'default';
      getElement('sort-select').value = 'default';
      writeFilters();
      goToFirstPage();
      loadProducts(buildProductsUrl());
    });
  }

  /* يربط الترتيب المحلي وزر المفضلة وزر إعادة المحاولة. */
  function setupLocalFilterControls() {
    getElement('sort-select').addEventListener('change', (event) => {
      state.sort = event.target.value;
      writeFilters();
      goToFirstPage();
      renderProducts();
    });

    getElement('btn-favorites').addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      getElement('btn-favorites').setAttribute('aria-pressed', String(state.favoritesOnly));
      goToFirstPage();
      renderProducts();
    });

    getElement('btn-retry').addEventListener('click', () => {
      if (state.currentUrl) loadProducts(state.currentUrl);
    });

    getElement('btn-checkout').addEventListener('click', placeOrder);
  }

  /* يملأ بيانات تجريبية في نموذج الدخول لتسهيل التجربة. */
  function fillDemoCredentials() {
    getElement('login-username').value = 'johnd';
    getElement('login-password').value = 'm38rmF$';
    getElement('login-error').hidden = true;
    clearLoginInvalidState();
  }

  /* يربط نموذج الدخول: submit مع preventDefault وتنظيف أخطاء الحقول. */
  function setupLoginForm() {
    getElement('btn-fill-demo').addEventListener('click', fillDemoCredentials);
    getElement('login-form').addEventListener('submit', handleLogin);
    ['login-username', 'login-password'].forEach((fieldId) => {
      getElement(fieldId).addEventListener('input', () => getElement(fieldId).removeAttribute('aria-invalid'));
    });
  }

  /* يعكس العرض المختار على زري Grid/Table عبر aria-pressed. */
  function syncViewControls() {
    getElement('view-grid').setAttribute('aria-pressed', String(state.view === 'grid'));
    getElement('view-table').setAttribute('aria-pressed', String(state.view === 'table'));
  }

  /* يغيّر العرض المحفوظ ويعيد الرسم من نفس البيانات. */
  function setViewMode(mode) {
    if (!VIEW_MODES.includes(mode) || mode === state.view) return;
    state.view = mode;
    writeStorage(KEYS.view, mode);
    syncViewControls();
    renderProducts();
  }

  /* يربط Per Page وتبديل العرض؛ كلاهما محلي ولا يرسل شيئاً للسيرفر. */
  function setupBrowseControls() {
    const perPage = getElement('per-page-select');
    perPage.value = String(state.pageSize);
    perPage.addEventListener('change', (event) => {
      const size = Number(event.target.value);
      if (!PAGE_SIZES.includes(size)) return;
      state.pageSize = size;
      writeStorage(KEYS.pageSize, size);
      goToFirstPage();
      renderProducts();
    });

    syncViewControls();
    getElement('view-grid').addEventListener('click', () => setViewMode('grid'));
    getElement('view-table').addEventListener('click', () => setViewMode('table'));
  }

  /* يربط Previous/Next وأرقام الصفحات بمعالج واحد مفوّض. */
  function setupPaginationControls() {
    getElement('page-prev').addEventListener('click', () => setPage(state.page - 1));
    getElement('page-next').addEventListener('click', () => setPage(state.page + 1));
    getElement('page-list').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-page]');
      if (button) setPage(button.dataset.page);
    });
  }

  /* يربط أزرار الجلسة التجريبية بعد الدخول. */
  function setupAuthControls() {
    syncAuthUi();
    getElement('btn-logout').addEventListener('click', logout);
    getElement('btn-bearer-check').addEventListener('click', checkBearerHeader);
  }

  /* يعكس الفلاتر المستعادة على الحقول ويضمن وجود مفاتيح الجلسة من أول تحميل. */
  function setupRestoredControls() {
    getElement('search-input').value = state.search;
    getElement('sort-select').value = state.sort;
    getElement('limit-select').value = String(state.limit);
    getElement('id-sort-select').value = state.idSort;
    renderRecentSearches();
    writeFilters();
    writeCurrentPage();
  }

  /* يوزّع إعداد أدوات التحكم على دوال صغيرة مركّزة. */
  function setupControls() {
    setupRestoredControls();
    setupSearchControl();
    setupServerSortControls();
    setupLocalFilterControls();
    setupBrowseControls();
    setupPaginationControls();
    setupLoginForm();
    setupProductForm();
    setupAuthControls();
  }

  /* ---------- 14b) اختبار الضغط (6.5) ---------- */
  /* نسخة احتياطية واحدة في الذاكرة؛ لا تُكتب في localStorage أبداً. */
  let stressRestore = null;

  /*
   * يرسم قائمة مؤقتة بدالة الرسم الحقيقية renderProducts.
   * pageSize هنا أداة اختبار فقط؛ القيم العادية للواجهة هي 5/10/20.
   */
  function stressRender(products, pageSize) {
    if (stressRestore) stressRestore();
    if (!Array.isArray(products) || products.length === 0) throw new Error('Stress data must be a non-empty array.');
    if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Stress page size must be a positive integer.');

    const backup = {
      products: state.products,
      viewProducts: state.viewProducts,
      category: state.category,
      search: state.search,
      sort: state.sort,
      pageSize: state.pageSize,
      page: state.page,
      view: state.view,
      favoritesOnly: state.favoritesOnly
    };

    state.products = products;
    state.viewProducts = products;
    state.category = 'all';
    state.search = '';
    state.sort = 'default';
    state.pageSize = pageSize;
    state.page = 1;
    state.view = 'grid';
    state.favoritesOnly = false;
    renderProducts();

    stressRestore = () => {
      Object.assign(state, backup);
      stressRestore = null;
      renderProducts();
    };
    return { requested: products.length, rendered: getElement('product-grid').children.length };
  }

  /* يُتاح من Console فقط لاختبار 5000 منتج؛ لا يغيّر بيانات التطبيق الدائمة. */
  function setupStressHook() {
    window.StorePulseStress = Object.freeze({
      render: stressRender,
      restore: () => { if (stressRestore) stressRestore(); }
    });
  }

  /*
   * مختبر محاكاة لحالات M8.5 التي لا يمكن إنتاجها من الـ API الحقيقي
   * (400 و500 مثلاً). يستدعي دوال العرض الحقيقية نفسها، ولا يرسل أي طلب.
   */
  function setupErrorLab() {
    window.StorePulseErrorLab = Object.freeze({
      isSuccess: (result) => Boolean(result && result.ok && result.status >= 200 && result.status < 300 && !result.empty),
      message: (result) => getApiErrorMessage(result),
      request: (path, options) => apiRequest(`${BASE_URL}${path}`, options),
      renderLogin: (result) => { openLogin(); showLoginFailure(result); },
      renderWrite: (result) => { openProductForm(PRODUCT_FORM_MODE.ADD); showFormWriteError(result, 'mocked write'); }
    });
  }

  /* يسجّل أي استثناء غير معالج بدل تركه صامتاً في Console. */
  function setupGlobalErrorLogging() {
    window.addEventListener('error', (event) => {
      console.error('[StorePulse] Unhandled error:', event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[StorePulse] Unhandled promise rejection:', event.reason);
    });
  }

  /* ---------- 15) البدء ---------- */
  function init() {
    setupGlobalErrorLogging();
    setupLanguageAndTheme();
    setupMenu();
    setupDialogs();
    setupConfirmationDialog();
    setupProductGrid();
    setupControls();
    setupStressHook();
    setupErrorLab();
    setupScrollEffects();
    renderCartBadge();
    renderCartDialog();
    restoreSession();
    loadCategories();
    loadProducts(buildProductsUrl());
    console.info('[StorePulse] Ready with theme', state.theme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

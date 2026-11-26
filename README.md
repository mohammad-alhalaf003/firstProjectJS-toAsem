# StorePulse

متجر الكتروني تعليمي ثنائي اللغة مبني على **FakeStoreAPI** باستخدام HTML و CSS و JavaScript فقط، بدون أي framework أو مكتبات خارجية.

> **ملاحظة عن أرقام الأسطر:** أرقام الأسطر في أقسام M1–M8 أدناه هي أرقام وقت كتابة تلك الأقسام؛ تغيّرت مواضع الأسطر بعد تعديلات M8 وM9 والتدقيق النهائي. المرجع الحالي والمُحدَّث بعد الإصلاحات موجود في `evidence/final/TESTS.md`، وجدول M9 في نهاية هذا الملف يشرح المفاتيح لا مواضع الأسطر.

## الملفات

- `index.html` — الهيكل، النصوص ثنائية اللغة، نوافذ التفاصيل/السلة/الدخول/الطلب، وسياسة CSP.
- `style.css` — التصميم، الوضع الداكن، RTL، الحركات، hover، وقواعد المؤشر الأصلي للمتصفح.
- `script.js` — طلبات الـ API، اللغة، الثيم، السلة، المفضلة، الدخول التجريبي، والطلب المحاكى.
- `api.html` — مرجع الـ API الذي بُني عليه المشروع.
- `README.md` — هذا الملف: ما المشروع، كيف يُشغَّل، المزايا، ما تعلّمته، وحدود العمل.
- `evidence/` — سكربتات ولقطات وسجلات الاختبار، كل مجلد باسم المرحلة (`m1`…`m9`) و`final/` للتدقيق الأخير. ملفات التشغيل الفعلية هي ثلاثة فقط: `index.html` و`style.css` و`script.js`.

## التقنيات المستخدمة

| التقنية | أين ظهرت فعلياً | ملاحظة |
|---|---|---|
| HTML5 دلالي | `header` / `nav` / `main` / `section` / `article` / `aside` / `footer`، `<dialog>`، `<template>`، `h1` واحد | كل عنصر استُخدم لمعناه لا لشكله |
| CSS3 | متغيرات الألوان والمسافات، Grid/Flexbox، `:focus-visible`، `@media`، RTL، `prefers-color-scheme` | لا مكتبات CSS ولا framework |
| JavaScript (ES6+) | `const` / `let`، دوال صغيرة، `async/await`، `fetch`، `URLSearchParams`، `Map` / `Set`، `reduce`، `slice`، `try/catch/finally` | ملف واحد `script.js` بلا إضافات |
| DOM API | `createElement`، `textContent`، `querySelector(All)`، `closest`، `dataset`، `classList` | لا `innerHTML` مع بيانات الـ API |
| Browser Storage | `localStorage` و`sessionStorage` عبر `readStorage` / `writeStorage` / `removeStorage` | JSON + `try/catch` + قيم افتراضية |
| FakeStoreAPI | `https://fakestoreapi.com` | مصدر البيانات الوحيد؛ لا backend ولا قاعدة بيانات محلية |
| Chrome DevTools Protocol (CDP) | `evidence/m*/cdp-*.js` و`evidence/final/*.js` | لتشغيل المتصفح فعلياً والتحقق من Network وConsole وStorage واللقطات |
| Git / GitHub | مستودع علني محلي ونسخة بعيدة | التدقيق النهائي قرأ الحالة فقط ولم يكتب commits أو push |

## التشغيل

افتح `index.html` في المتصفح مباشرة، أو شغّل خادم محلي بسيط داخل المجلد:

```powershell
python -m http.server 8000
```

ثم افتح `http://localhost:7993`.

## الوظائف

1. جلب المنتجات: `GET /products?limit=20&sort=asc` — المعاملات تُبنى بـ `URLSearchParams` فتظهر في DevTools → Network → Payload (Query String Parameters)، والتنفيذ على الـ API مش محلي.
2. جلب الفئات وبناء الشرائح: `GET /products/categories`.
3. تصفية حسب الفئة: `GET /products/category/{category}`.
4. تفاصيل المنتج تُجلب عند النقر من `GET /products/{id}` — الـ ID يُقرأ من `card.dataset.id`، وتُعرض بيانات الاستجابة الفعلية مع حالتي تحميل وخطأ داخل النافذة (M5.5).
   - تحكّمات `limit` (20/10/5) و`sort` (تصاعدي / تنازلي) تُرسل أيضاً مع `GET /products/category/{category}` عند اختيار فئة.
   - **مفارقة الـ API**: يطبّق `limit` قبل `sort`، فمثلاً `?limit=5&sort=desc` يرجّع أول 5 منتجات معكوسة (5..1) وليس أعلى 5 معرّفات. نعرض الرابط في الواجهة عشان يتأكد المدرب من المعاملات المرسلة.
5. بحث محلي مع Debounce، وترتيب السعر/التقييم/الاسم محلياً، وترتيب ID على السيرفر + مفضلة محفوظة في `localStorage`.
6. سلة محلية بالكميات والمجموع (لأن الـ API لا يحفظ عمليات الكتابة).
7. دخول تجريبي: `POST /auth/login` — التوكن واسم المستخدم يُحفظان في `sessionStorage` للتبويب الحالي فقط، ولا تُحفظ كلمة المرور أبداً.
8. طلب محاكى: `POST /carts` + سجل الطلبات في ذاكرة التبويب فقط (لا يُحفظ في Browser Storage).
9. تبديل اللغة (both / ar / en) بلا حفظ، وتبديل الثيم محفوظ في `localStorage`؛ آخر خمس عمليات بحث محفوظة وقابلة لإعادة الاستخدام.
10. تصفّح محلي (M6): ترقيم Previous/Next وأرقام صفحات، Per Page (5/10/20)، وعرض Grid أو Table — كلاهما من نفس البيانات والفلاتر والبحث والترتيب.

## نقاط مهمة للمدرب

- عمليات `POST/PUT/PATCH/DELETE` في FakeStoreAPI **محاكاة** ولا تُحفظ؛ لذلك تُحفظ السلة في `localStorage`، أما سجل الطلبات ونسخ المنتجات المضافة/المعدّلة/المحذوفة فتبقى في ذاكرة التبويب فقط ولا تُكتب في Browser Storage.
- معرّف خاطئ في `GET` قد يُرجع `200` مع جسم فارغ، لذلك نتحقق من `Array.isArray(data)`.
- `POST /auth/login` يخطئ بـ `401` بنص عادي وليس JSON؛ لذلك نقرأ `response.text()` ثم نحلّل JSON داخل `try/catch`.
- الفئة `jewelery` مكتوبة هكذا في الـ API ويجب نسخها كما هي.
- الـ API يدعم ترتيب ID فقط (`sort=asc|desc`)؛ لذلك ترتيب السعر/التقييم/الاسم يبقى محلياً.
- البحث محلي (Client-side) لأن FakeStoreAPI **ما عنده endpoint بحث**؛ البارامترات المتاحة هي `limit` و`sort` و`startdate` و`enddate` فقط. أضفنا **Debounce 350ms**: كل حرف يلغي المؤقت السابق، والضغط على `Enter` ينفّذ البحث فوراً ويلغي المؤقت حتى لا يتكرر التنفيذ. لو احتجنا بحثاً حقيقياً بالباك اند لازم نضيف سيرفر Node يطلب من الـ API ويفلتر النتائج. تفاصيل العدّادات في قسم M7.
- نستخدم `textContent` بدل `innerHTML` مع بيانات الـ API حمايةً من XSS.
- CSP يسمح بالاتصال وتحميل الصور من `fakestoreapi.com` فقط، ويمنع السكربتات المضمّنة.
- مؤشر المتصفح الأصلي هو الوحيد المستخدم: **يد** على الأزرار والروابط والشرائح، **شريط نص** على حقول الإدخال فقط، **عدسة تكبير** على صورة المنتج التي تفتح التفاصيل، و**منع** على الأزرار المعطّلة. النصوص الثابتة لا توحي بأنها قابلة للتحرير.
- الهيدر يختفي عند النزول 5 بكسل ويظهر مجدداً عند الصعود 5 بكسل (أو فور الوصول لأعلى 120 بكسل). أما شريط الفلاتر فغير لاصق: يبقى في مكانه أعلى الصفحة ويرحل مع التمرير.
- التجاوب مُختبر على 1440 / 1024 / 768 / 560 / 390 / 360 / 320 بكسل: شبكة 4/3/2 عمود، هيدر مدمج على الجوال مع بقاء زري الدخول والثيم، حقول بخط 16px لمنع زوم iOS، ونوافذ بلا تمرير أفقي حتى عرض 320 بكسل.

### حدود FakeStoreAPI مجمَّعة في مكان واحد

| الحد / السلوك | ما يعنيه للمشروع | الدليل |
|---|---|---|
| `GET /products` يقبل `limit` و`sort=asc|desc` فقط | لا يوجد `page` ولا `pageSize` حقيقيان؛ الترقيم عندنا `client-side` عبر `slice()` | `buildProductsUrl()` في `script.js`؛ `evidence/m6/runtime-tests.json` |
| الترتيب المتاح للسيرفر هو ID فقط | ترتيب السعر/التقييم/العنوان محلي على نسخة من المصفوفة | `SORT_COMPARATORS` و`state.idSort` في `script.js` |
| الـ API يطبّق `limit` قبل `sort` | `?limit=5&sort=desc` يُرجع أول 5 معكوسة، لا أعلى 5 معرّفات | `evidence/m5/api-probe.json`؛ ملاحظة واجهة `#request-url` |
| لا يوجد endpoint بحث | البحث محلي بالكامل مع Debounce 350ms، وصفر طلبات أثناء الكتابة | `evidence/m7/debounce-tests.json` |
| `GET /products/categories` و`GET /products/category/{category}` غير مذكورين في OpenAPI لكنهما يعملان | استُخدمَا بعد التحقق من الاستجابة الحقيقية 200 | `evidence/m5/api-docs-review.json` |
| معرّف غير موجود يُرجع `200` بجسم فارغ | نتحقق من `Array.isArray(data)` ونعرض "No product for this id" | `evidence/m5/api-probe.json`؛ `evidence/final/network-evidence.json` |
| `POST /auth/login` يُرجع `201` عند النجاح و`401` بنص غير JSON عند الفشل | لا نعتمد على المواصفة وحدها؛ نقرأ `text()` ثم نحلّل inside `try/catch` | `evidence/final/network-evidence.json` |
| كل عمليات `POST/PUT/PATCH/DELETE` **محاكاة** ولا تُحفظ | نسخ التعديلات تبقى في ذاكرة التبويب، والسلة تُحفظ محلياً، ولا يُدعى أن الـ API خزّن شيئاً | `evidence/m8/network-evidence.json`؛ `evidence/m8/TESTS.md` |
| بيانات الدخول المعروضة في `api.html` أمثلة عامة من توثيق الـ API | لا تُحفظ كلمة المرور ولا تظهر قيم التوكن في الأدلة؛ الأدلة كلها `[redacted]` | `api.html`؛ `evidence/final/network-evidence.json` |
| CORS يسمح بالقراءة من أصل آخر عبر `access-control-allow-origin: *` | CSP في `index.html` يقيّد الاتصال والصور بـ `fakestoreapi.com` فقط | `index.html`؛ `evidence/final/network-evidence.json` |

## M5 — الـ API: التوثيق، الاختبار، التفاصيل، ومفردات HTTP

المصدر الرسمي: <https://fakestoreapi.com/docs> ومواصفة OpenAPI على `/docs-data` (الإصدار `old-version-production`). راجعنا الـ 22 endpoint المذكورة في `api.html` والـ 16 endpoint في المواصفة الرسمية؛ 6 endpoints في `api.html` غير موثّقة رسمياً. التفاصيل في `evidence/m5/api-docs-review.json`.

### 5.1 جدول Documentation → JavaScript → HTML

الجدول يغطّي الـ endpoints التي يستخدمها التطبيق فعلياً، ويربط كل حقل استجابة بالمتغير والعنصر الذي يعرضه فعلاً:

| Endpoint | التوثيق الرسمي | JavaScript (الدالة / المتغير) | HTML (العنصر) | حقول الاستجابة → أين تظهر |
|---|---|---|---|---|
| `GET /products?limit=20&sort=asc` | موثّق كـ `GET /products`؛ `limit` و`sort` غير مذكورين في المواصفة لكنهما يعملان فعلياً | `buildProductsUrl()` `script.js:404`، `loadProducts()` `:730`، `state.products` `:168`، `state.viewProducts` `:169` | `#request-url` `index.html:264`، `#product-grid` `:315`، `#result-count` `:272`، `#state-box` `:349` | `id` → `card.dataset.id` `:635`؛ `title` / `description` → `.card-title` / `.card-desc` `:659-660`؛ `price` → `.price` عبر `formatMoney` `:663`؛ `image` → `img.src` `:645`؛ `category` → `.card-badge` `:652`؛ `rating.rate` / `rating.count` → `.rate` / `.rating-count` `:661-662` |
| `GET /products/{id}` | موثّق (200 / 400) | `buildProductUrl()` `script.js:977`، `openProductDialog()` `:1047`، `renderProductDetail()` `:1037`، `state.detailToken` `:188` | `#product-dialog` `index.html:417`، `#product-dialog-body` `:422`، `.detail-price` / `.detail-desc` / `.rating` داخل `createProductDetailView()` `script.js:991` | `title` → `h2` `:996`؛ `price` → `.detail-price` `:998`؛ `description` → `.detail-desc` `:999`؛ `image` → `img.src` `:993`؛ `category` → `.detail-badge` `:995`؛ `rating` → `createDetailRating()` `:982`؛ `id` → زر إضافة للسلة `:1041-1042` |
| `GET /products/categories` | **غير موثّق رسمياً**، لكنه يرجع 200 | `loadCategories()` `script.js:393`، `state.categories` `:170` | `#category-chips` `index.html:269` | كل سلسلة في المصفوفة → زر شريحة بـ `data-category` `script.js:371-386` |
| `GET /products/category/{category}?limit=20&sort=asc` | **غير موثّق رسمياً**، لكنه يرجع 200 | `buildProductsUrl()` `script.js:404`، `selectCategory()` `:416`، `loadProducts()` `:730` | نفس عناصر شبكة المنتجات أعلاه | نفس حقول `GET /products`؛ الفئة تُقرأ من المسار، والعدد/الترتيب من الاستعلام |
| `GET /users` | موثّق (200 / 400) | `ensureUsers()` `script.js:1099`، `state.users` `:183`، `completeLogin()` `:1106` → `state.user` `:184` | `#login-label` `index.html:114` | `id` / `username` / `name` → `state.user` `script.js:1109-1112`؛ `username` يظهر في `#login-label` `:1114` |
| `POST /products` | موثّق (201 / 400) | `readValidatedProductForm()` `script.js:1363`، `sendProductWrite()` `:1484`، `apiRequest()` `:409` | `#product-form` `index.html:561`، `#write-result` `:619` | الطلب: `title` / `price` / `description` / `image` / `category`؛ الاستجابة `id` → `#write-result` وبطاقة `.session-flag` في `#product-grid` |
| `PUT /products/{id}` | موثّق (200 / 400) | `sendProductWrite()` `script.js:1484`، `confirmDeleteProduct()` `:1563`، `safeProductId()` `:953` | `#confirm-dialog` `index.html:658`، `#write-result` `:619` | Path `id` + نفس جسم المنتج؛ الاستجابة `id` → رسالة `Updated (200)`؛ لا يُرسل شيء قبل التأكيد |
| `DELETE /products/{id}` | موثّق (200 / 400) | `confirmDeleteProduct()` `script.js:1563`، `applySessionChanges()` `:908`، `safeProductId()` `:953` | `#confirm-dialog` `index.html:658` | Path `id` فقط؛ الاستجابة تُطبَّق محلياً بإزالة البطاقة لأن الـ API لا يحفظ الحذف |
| `POST /auth/login` | موثّق (200 / 400) | `handleLogin()` `script.js:1705`، `completeLogin()` `:1682`، `state.token` (الذاكرة) + `sessionStorage.storepulse_token` | `#login-username` / `#login-password` / `#login-error` / `#login-label` | الطلب: `username` و`password` من الحقلين؛ الاستجابة `token` → الذاكرة + `sessionStorage`؛ رسالة 401 النصية → `#login-error` عبر `showLoginFailure()` |
| `POST /carts` | موثّق (201 / 400) | `buildOrderBody()` `script.js:1193`، `placeOrder()` `:1228`، `createOrderRecord()` `:1202`، `state.orders` `:182` | `#cart-total` `index.html:445`، `#orders-list` `:471`، `#order-summary` `:536` | الطلب: `userId` و`date` و`products[].productId/quantity` `script.js:1193-1198`؛ الاستجابة `id` → `#<apiId>` في `openOrderDialog()` `:1268-1272` |

عند إضافة endpoint جديد في مرحلة قادمة: أضف صفاً هنا، وحدّث `evidence/m5/api-docs-review.json`، وأعد تشغيل فاحص الـ API.

### 5.2 اختبار الـ API فعلياً

- **Postman / Apidog: NOT TESTED** — غير مثبتين على هذا الجهاز، لذلك لم أدّعِ استخدامهما.
- **ما نُفّذ فعلاً**: طلبات `fetch()` داخل Browser Console (عبر CDP `Runtime.evaluate`)، مع قراءة Headers وPayload وPreview وResponse وTiming من Network. 10 طلبات حقيقية في `evidence/m5/api-probe.json`، و9 اختبارات تشغيل في `evidence/m5/runtime-tests.json` مع لقطات PNG. بيانات الدخول والتوكينات مُخفاة في الأدلة.
- **لتجربتها بنفسك**: افتح `index.html`، ثم DevTools → Console، واكتب:

```js
await fetch('https://fakestoreapi.com/products?limit=5&sort=desc')
  .then(response => console.log(response.status, response.headers.get('content-type')) || response.json())
  .then(console.log);
```

ثم افتح Network وابحث عن الطلب: سترى Query String Parameters وResponse Headers وPreview وTiming.

### 5.3 كتالوج المنتجات والحالات

| الحالة | أين | النتيجة الفعلية |
|---|---|---|
| Loading | `showSkeleton()` `script.js:331` يضع `aria-busy=true` و8 بطاقات هيكل | Slow 3G (محاكاة CDP بزمن 2000ms و400kbps): ظهر 8 skeletons ثم اختفوا بعد 20 بطاقة |
| Error | `getLoadErrorMessage()` `:761` + `setState()` `:348` مع زر `#btn-retry` | حجب `/products?` أنتج "Could not load products" وزر إعادة محاولة ظاهر و`aria-busy` مزال `:747`؛ بعد رفع الحجب أعاد الزر 20 بطاقة |
| Empty | `renderProducts()` `:576` | فئة تُرجع `[]` أنتجت "Nothing here" وصفر بطاقات وبدون `aria-busy` |
| تنظيف `aria-busy` | `:587` عند النجاح، `:747` عند الفشل؛ نافذة التفاصيل `:1056` | PASS في كل الحالات أعلاه |

### 5.4 معاملات الـ API

- `URLSearchParams` في `buildProductsUrl()` `script.js:404-413` يبني `?limit=20&sort=asc` ويظهر في Network → Payload → Query String Parameters.
- Path Parameters: الفئة عبر `encodeURIComponent(state.category)` `:407`، ومعرّف المنتج عبر `encodeURIComponent(productId)` `:977` — لا إلحاق نص خام بالرابط.
- الدليل: `/products/category/electronics?limit=20&sort=asc` و`/products/1` ظهرا فعلياً في Network (انظر `evidence/m5/runtime-tests.json`).

### 5.5 تفاصيل المنتج

النقر على البطاقة يقرأ `card.dataset.id` `:676-685` ثم يستدعي `openProductDialog(productId)` `:1047` الذي يرسل `GET /products/{id}` ويرسم بيانات الاستجابة نفسها (لا الكائن المحمّل مسبقاً). حالات التحميل والخطأ/الاستجابة الفارغة في `:1010-1034`، ومنع كتابة استجابة قديمة عبر `state.detailToken` `:188, :1049, :1055`. معرّف غير موجود أو جسم فارغ (الـ API يرجع 200 بطول 0) يُعرض كرسالة "No product for this id" مع زر إعادة محاولة `:1058-1062`. التصميم لم يتغير: نفس `#product-dialog` ونفس أصناف `.product-detail`.

### 5.6 مفردات HTTP

- **URL Anatomy**: في `https://fakestoreapi.com/products/1?limit=5` — `https` المخطط (scheme)، `fakestoreapi.com` المضيف، `/products/1` المسار وفيه Path Parameter `1`، `?limit=5` سلسلة الاستعلام وفيها Query Parameter. لا يوجد fragment هنا. صفحة التطبيق تُفتح من `file://`، لذلك أصل الطلب (`Origin`) مختلف عن أصل الـ API وهذا يفسّر أهمية CORS.
- **HTTP Methods**: `GET` للقراءة (`/products`, `/products/{id}`, `/categories`, `/users`) و`POST` للإنشاء (`/products`, `/auth/login`, `/carts`) و`PUT` للتعديل و`DELETE` للحذف (`/products/{id}`). `PATCH` موثّق في `api.html` لكن التطبيق اختار `PUT`. عمليات الكتابة في FakeStoreAPI محاكاة ولا تُحفظ.
- **Headers**: الطلب يُرسل `Content-Type: application/json` مع POSTs، ويضيف المتصفح `Origin` / `Referer` / `User-Agent`. الاستجابة الحقيقية تحمل `content-type: application/json; charset=utf-8` و`access-control-allow-origin: *` و`server: cloudflare` و`content-length` (أو `text/html` عند 401).
- **Request Body**: بيانات JSON مكتوبة بـ `JSON.stringify` — `{title, price, description, image, category}` لإنشاء منتج، ونسخة نفسها لتعديله بـ `PUT`، و`{username, password}` للدخول، و`{userId, date, products: [{productId, quantity}]}` للطلب. تظهر في Network → Payload → Request Payload. لا تُكتب كلمات المرور في الأدلة أو README.
- **Status Codes**: `200` نجاح القراءة، `201` إنشاء فعلي للـ POST (خلاف ما تقول المواصفة للدخول)، `400` موثّق كخطأ عام، `401` دخول خاطئ بنص HTML، `404` معناه "غير موجود" كقاعدة عامة (لكن هذا الـ API يرجع `200` بجسم فارغ لمعرّف مفقود)، و`500` خطأ سيرفر. `response.ok` يغطّي نطاق 200–299 فقط.
- **JSON**: تنسيق نصي للتبادل؛ يُقرأ بـ `response.text()` ثم `JSON.parse` داخل `try/catch` في `apiRequest()` `script.js:301-327`. المصفوفات للقوائم، والكائنات للتفاصيل/الدخول/السلة؛ الجسم الفارغ يعطي `null`.
- **REST**: موارد بأسماء (products / users / carts) في المسار، والفعل في-method؛ الطلبات مستقلة (stateless). المسار يحدّد المورد، والاستعلام يعدّل طريقة عرضه (limit / sort).
- **CORS**: المتصفح يمنع قراءة استجابة من أصل آخر إلا إذا أرسل السيرفر `Access-Control-Allow-Origin`. الـ API الحقيقي يرسل `*`؛ وسياسة CSP في `index.html` تسمح بالاتصال بـ `fakestoreapi.com` فقط. أي رد مُقلَّد في الاختبارات يحتاج نفس الهيدر وإلا اعتبره المتصفح فشل شبكة.
- **Path Parameter مقابل Query Parameter**: `/products/1` يحدّد منتجاً واحداً (Path)، بينما `/products?limit=5&sort=desc` يحدّد عدد/ترتيب نتيجة داخل مجموعة (Query). كلا النوعين ظهر في Network في الأدلة.

#### فروق حقيقية بين التوثيق والاستجابات (5.6)

| # | ما تقوله المواصفة / `api.html` | ما ظهر فعلياً | الدليل |
|---|---|---|---|
| 1 | `POST /auth/login` موثّق بـ `200` وخطأ `400` | بيانات صحيحة → `201` JSON فيه `token`؛ بيانات خاطئة → `401` نص HTML بطول 33 | `evidence/m5/api-probe.json` (الطلبان 8 و9؛ القيم الحساسة مُخفاة) |
| 2 | لا توجد نقطة `GET /products/categories` ولا `GET /products/category/{category}` في OpenAPI | كلتاهما تعملان: 4 فئات، و3 منتجات لـ `jewelery?limit=3&sort=asc` | `evidence/m5/api-docs-review.json` + `api-probe.json` (الطلبان 4 و5) |
| 3 | مخطط `Product` لا يحتوي `rating` | كل منتج يحمل `rating: {rate, count}`، والتطبيق يعرضه في `.rating` | `api-probe.json` (الطلب 1) + `script.js:657-658` |
| 4 | `GET /products/{id}` يوثّق `400` للخطأ | `GET /products/9999` يرجع `200` و`content-length: 0` وجسم فارغ | `api-probe.json` (الطلب 3) + `script.js:1058-1062` |
| 5 | `GET /products` بلا معاملات موثّقة | `limit=5&sort=desc` ظهر في Query وغيّر النتائج إلى 5 عناصر مرتّبة تنازلياً | `api-probe.json` (الطلب 1) + `runtime-tests.json` |
| 6 | مخطط `User` لا يذكر `password` ولا `__v` | استجابة `/users` تحمل الحقلين؛ التطبيق لا يعرضهما إطلاقاً | `api-probe.json` (الطلب 7) |

### الأدلة وحدود الاختبار

- `evidence/m5/api-probe.json` — 10 طلبات fetch حقيقية مع Headers / Payload / Preview / Timing (بدون كلمات مرور أو توكنات).
- `evidence/m5/api-docs-review.json` — مقارنة 22 endpoint في `api.html` بـ 16 endpoint في المواصفة الرسمية.
- `evidence/m5/runtime-tests.json` وصور PNG — 9 اختبارات تشغيل: Slow 3G، انقطاع الشبكة، إعادة المحاولة، حالات التفاصيل والقائمة الفارغة.
- **NOT TESTED**: Postman / Apidog (غير مثبتين)، Firefox (أما Edge فاختُبر في التدقيق النهائي عبر `evidence/final/`)، جهاز لمسي حقيقي، قارئ شاشة حقيقي، Slow 3G على شبكة فعلية (استُخدمت محاكاة DevTools)، Lighthouse، axe.

## M6 — التصفح على نطاق واسع: الترقيم والعرضان

المصدر: `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf` صفحتا 15–16، المتطلبات 6.1–6.6. كل ما أُضيف محلي في المتصفح؛ لم يتغيّر طلب الـ API ولا التصميم العام ولا بيانات M1–M5.

### خريطة التخزين والفرق بين `limit` و `pageSize`

| القيمة | المفتاح | أين تُحفظ | أين تُقرأ/تُكتب | المعنى |
|---|---|---|---|---|
| حجم الصفحة | `storepulse_page_size` | `localStorage` | `script.js:61, :127-133, :257-258, :2199-2207` | عدد البطاقات/الصفوف المعروضة محلياً (5/10/20) |
| رقم الصفحة | `storepulse_current_page` | `sessionStorage` | `script.js:66, :127-133, :261, :582-584, :632-644` | الصفحة الحالية أثناء الجلسة فقط |
| نوع العرض | `storepulse_view_mode` | `localStorage` | `script.js:60, :127-133, :259, :2193` | `grid` أو `table` |

- **API Limit** (`?limit=`) يحدّد عدد المنتجات **المستلمة من السيرفر**؛ يتغيّر من `#limit-select` `index.html:238` ويرسل طلباً جديداً (`buildProductsUrl()` `script.js:404`).
- **Page Size** يحدّد عدد المنتجات **المعروضة من المصفوفة المستلمة**؛ لا يرسل أي طلب. `Array.slice` في `renderProducts()` `script.js:583-584`.
- **لا نرسل `page` إطلاقاً**: FakeStoreAPI يدعم `limit` و`sort` فقط، ولا يدعم ترقيم السيرفر. لذلك الترقيم كله `client-side`.
- تغيير Per Page أو الفئة أو البحث أو الترتيب المحلي أو ترتيب السيرفر أو `limit` أو المفضلة يستدعي `goToFirstPage()` `script.js:471` قبل الرسم.

### 6.1–6.4 — ما أُضيف وأين

| المتطلب | الملف والسطر | لماذا | كيف تتحقق | النتيجة |
|---|---|---|---|---|
| 6.1 Pagination | `#pagination` / `#page-prev` / `#page-list` / `#page-next` / `#page-status` في `index.html:336-347`؛ `renderPagination()` `script.js:534`، `setPage()` `:477`، `getPageWindow()` `:486`، `setupPaginationControls()` `:1442` | تصفّح 20 منتجاً بلا إغراق الصفحة، مع وصول واضح للصفحة الأولى والأخيرة | اختر Per Page = 5 ثم Previous/Next وأرقام الصفحات؛ راقب `Showing 6–10 of 20` و`aria-current="page"` وتعطيل الزرين عند الطرفين | **PASS** — 67/67 في `evidence/m6/runtime-tests.json` |
| 6.2 Page Size | `#per-page-select` `index.html:292`؛ `PAGE_SIZES` `script.js:37`؛ `setupBrowseControls()` `:1424`؛ `slice()` `:584`؛ الحفظ `:157-162` | فصل عدد المستلَم عن number المعروض وإعادة الصفحة الأولى بعد كل تغيير | غيّر Per Page إلى 5/10/20، ثم غيّر بحثاً أو فئة أو ترتيباً؛ تحقّق من `localStorage.storepulse_page_size` و`sessionStorage.storepulse_current_page` | **PASS** |
| 6.3 Grid + Table | شبكة `index.html:315`؛ جدول حقيقي `index.html:316-332` بـ `caption` `:320` و`thead` `:321` و`th scope` `:322-328` و`tbody` `:331`؛ `createProductRow()` `script.js:513`؛ معالج مشترك `handleProductGridClick()` `:676`؛ تفويض ثانٍ على `tbody` `:718-721`؛ رسم واحد `renderProducts()` `:576` | عرض الصورة/العنوان/التصنيف/السعر/التقييم في جدول دلالي دون نسخ منطق الفلاتر أو الإجراءات | اضبط Per Page = 5، ثم اضغط Table؛ جرّب Details وHeart وAdd من صف الجدول ثم ارجع Grid | **PASS** — نفس 5 عناصر وإنهاء إجراءات الجدول تعمل |
| 6.4 Responsive Table | `.table-wrap { overflow-x:auto }` `style.css:727`، `.product-table { min-width:46rem }` `:728`؛ `syncViewControls()` `script.js:1409`؛ `setViewMode()` `:1415`؛ حفظ العرض `:1416-1417` | يبقى الجدول قابلاً للقراءة على 320px من دون تمرير أفقي للصفحة كاملة، مع `aria-pressed` يوضّح العرض النشط | عند 320px افتح Table: `document.documentElement.scrollWidth <= innerWidth` و`table-wrap.scrollWidth > clientWidth` و`overflow-x === 'auto'` | **PASS** عند 320 / 768 / 1280 |
| حالة بلا نتائج | `renderPagination()` `script.js:535-539` و`renderProducts()` `:596-607` | لا أرقام صفحات وهمية ولا استثناء عند صفر نتائج | ابحث عن `zzzz-no-match`: `Showing 0–0 of 0`، الترقيم مخفي، ورسالة "No matches" ظاهرة بلا أخطاء Console | **PASS** |

### 6.5 Stress test — 5,000 products

- **كيف نُفّذ**: وُلّدت 5000 منتج في Browser Console (`100000..104999`) بصورة `data URI` 1×1 حتى لا يتأثر القياس بالشبكة، ثم رُسمت بدالة الرسم الحقيقية نفسها عبر `window.StorePulseStress.render(products, pageSize)` `script.js:1469`، المتاحة من `setupStressHook()` `:1506`. لا توجد كتابة في `localStorage`، وتستعيد الدالة الحالة الأصلية من نسخة في الذاكرة (`restore()`).
- **القياس**: `console.time()` / `console.timeEnd()` داخل Console، مع قياس ثانٍ بـ `requestAnimationFrame` مرتين لتقريب زمن الرسم المرئي. الأرقام النهائية في `evidence/m6/stress-test.json` واللقطتان `stress-5000.png` / `stress-page20.png`.

| السيناريو | زمن JavaScript (`console.time`) | زمن حتى الرسم المرئي (double-rAF) | العناصر |
|---|---:|---:|---:|
| 5000 دفعة واحدة | **214.9 ms** | **13523.9 ms** | 5000 بطاقة، `Showing 1–5000 of 5000` |
| صفحة واحدة من 20 | **13.6 ms** | **422 ms** | 20 بطاقة، `Showing 1–20 of 5000` |
| الفرق | JavaScript أسرع ≈ **15.8×** | المرئي أسرع ≈ **32.05×** | نفس الـ 5000 منتج في الحالتين |

- **ما الذي يقيسه الاختبار بالضبط**: زمن JavaScript هو بناء DOM وتنفيذ `renderProducts()` حتى آخر `append`؛ أما زمن double-rAF فهو حدّ أعلى تقريبي حتى الإطار المرئي التالي، وليس مقياس Lighthouse رسمي. الأرقام تتغيّر بين التشغيلات حسب حمل الجهاز؛ سُجّل ما ظهر فعلياً في التشغيل الأخير.
- **التحقق بعد الاختبار**: عاد التطبيق إلى 20 بطاقة حقيقية من الـ API، `Showing 1–20 of 20`، وصفر عناوين `Stress product` وصفر أخطاء Console.
- **لتجربتها**:
```js
const fake = Array.from({ length: 5000 }, (_, i) => ({
  id: 100000 + i, title: 'Stress product ' + (i + 1), price: 9.99,
  description: 'synthetic', category: 'electronics',
  image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  rating: { rate: 4.5, count: 10 }
}));
console.time('all-5000'); StorePulseStress.render(fake, 5000); console.timeEnd('all-5000');
StorePulseStress.restore();
console.time('page-20'); StorePulseStress.render(fake, 20); console.timeEnd('page-20');
StorePulseStress.restore();
```

### 6.6 Scaling to 5,000 products

عند تحميل كل المنتجات دفعة واحدة يحدث ما يلي:

- **Network**: طلب واحد قد يُرجع 5000 عنصر وصوراً كثيرة؛ حتى مع `limit` يبقى حجم JSON والصور هو الحد الأعلى. `?limit=` يقلّل عدد العناصر المستلمة لكنه لا يوفّر ترقيماً.
- **Memory**: مصفوفة 5000 كائن + 5000 عقدة DOM + صورها تبقى في الذاكرة طوال الجلسة؛ تكرار إعادة الرسم يضاعف الضغط.
- **DOM**: 5000 بطاقة تعني عشرات الآلاف من العقد؛ البحث عن عنصر أو تحديثه يصبح أبطأ، وتزيد تكلفة `querySelector` وإعادة الرسم.
- **Rendering**: الأرقام أعلاه تثبت الفرق: بناء DOM 5000 بطاقة استغرق ~215ms لكن ظهوره المرئي استغرق ~13.5s؛ التخطيط والرسم (layout/paint) أغلى من JavaScript نفسه. الأرقام تتغيّر بين التشغيلات حسب حمل الجهاز.
- **Client-side Pagination**: `slice()` يرسم 20 فقط ويخفّض DOM والرسم فوراً، لكنه لا يخفّض التنزيل ولا الذاكرة لأن 5000 عنصر ما زالت محمّلة في المتصفح.
- **Server-side Pagination**: السيرفر يرسل صفحة واحدة فقط، فيخفّض Network وMemory وDOM معاً؛ يحتاج معاملات `page` و`pageSize` وعدداً كلياً `totalCount` لرسم أرقام الصفحات.
- **API Limit**: أداة تقليل حجم الاستجابة الحالية؛ FakeStoreAPI يرسل أول `limit` عناصر ثم يطبّق `sort`، ولا يدعم `page`. لذلك لا يمكن الاعتماد عليه وحده لصفحات حقيقية.
- **تصميم API مستقبلي (نظري، بدون بناء Backend الآن)**: `GET /products?page=3&pageSize=20` يُرجع `{ items: [...], page: 3, pageSize: 20, totalCount: 5000, totalPages: 250 }`. الواجهة تستخدم `totalCount` لحساب عدد الصفحات و`items` للرسم فقط، وترسل `limit` القديم عند الحاجة للتوافق. لا يوجد backend جديد في هذا المشروع؛ هذا وصف تصميمي فقط.

### الأدلة وحدود اختبار M6

- `evidence/m6/runtime-tests.json` — 67 اختباراً فعلياً عبر CDP (Chrome headless) عند 320 / 768 / 1280، كلها **PASS**.
- `evidence/m6/grid-*.png` و`table-*.png` — لقطات العرضين عند العروض الثلاثة.
- `evidence/m6/stress-test.json` و`stress-*.png` — أرقام اختبار 5000 واللقطتان.
- `evidence/m5/*` واختبارات M1–M4 أُعيد تشغيلها بعد التعديل من نسخها المحفوظة في `evidence/m1/` إلى `evidence/m4/`: `check-m1.js`، `check-vars.js`، `check-m4.js` 38/38، `m4-deadcode.js`، `cdp-m4.js`، `cdp-m2.js`، `cdp-m3.js`، `cdp-verify.js` عند 320/768/1280، و`cdp-m5-runtime.js` 9/9 — كلها PASS بصفر أخطاء Console؛ سجلات التشغيل الفعلية محفوظة بجانب كل سكربت.
- **NOT TESTED**: Firefox (أما Edge فاختُبر في التدقيق النهائي عبر `evidence/final/`)، جهاز لمسي حقيقي، قارئ شاشة حقيقي، Lighthouse، axe، Postman / Apidog (غير مثبتين كما في M5). اختبار 5000 نُفّذ في Chrome headless وليس على جهاز مستخدم حقيقي.

## M7 — بحث سريع مع Debounce

المصدر: `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf` صفحة 16، المتطلبات 7.1–7.3. حسّنت البحث الموجود مسبقاً في مكانه؛ لم أعد بناءه، ولم يتغيّر طلب الـ API ولا التصميم ولا M1–M6.

### 7.1 — البحث

| البند | التنفيذ | الملف والسطر | كيف أجربه | النتيجة |
|---|---|---|---|---|
| البحث بالعنوان والتصنيف | البحث يفحص `title` و`description` و`category` والترجمة العربية للفئة، مع كلمات عربية مساعدة للعناوين الإنجليزية | `searchableText()` `script.js:424-429`، `AR_KEYWORDS` `:61`، `visibleProducts()` `:441-463` | اكتب `backpack` أو `electronics` أو `حقيبة`؛ النتائج تتطابق | **PASS** |
| Case-insensitive | `toLowerCase()` على قيمة البحث وعلى النص قبل المقارنة | `runSearch()` `script.js:1317`، `searchableText()` `:425` | اكتب `BACKPACK` ثم `backpack`؛ نفس العدد | **PASS** |
| البحث العربي حالياً | كلمات مثل `حقيبة` / `حقيبة ظهر` تُضاف للعناصر التي تحمل `backpack` في العنوان | `AR_KEYWORDS` `script.js:61-63`، `searchableText()` `:426-428` | اكتب `حقيبة`؛ تظهر نفس نتائج `backpack` | **PASS** |
| عدد النتائج الفعلي | `#result-count` يُحدَّث من طول المصفوفة بعد الفلترة لا من العرض | `renderProducts()` `script.js:577-596` | ابحث `electronics`؛ يظهر `6 in this category` بينما تُعرض 5 إن كان Per Page=5 | **PASS** |
| Empty state | عند صفر نتائج تظهر `No matches` مع `Showing 0–0 of 0` والترقيم مخفي | `renderProducts()` `script.js:600-611`، `renderPagination()` `:534` | اكتب `zzzz-no-match` | **PASS** |
| التكامل | نفس `visibleProducts()` يمرّ عبر الترقيم والفئة والترتيب المحلي و`limit` وGrid/Table | `visibleProducts()` `:441`، `renderProducts()` `:576`، `renderPagination()` `:534` | جرّب البحث مع Per Page=5 والصفحة 3، ثم فئة electronics، ثم `price-desc`، ثم `limit=5`، ثم Table | **PASS** |
| إعادة للصفحة الأولى | كل تنفيذ بحث يستدعي `goToFirstPage()` قبل الرسم | `runSearch()` `script.js:1319`، `goToFirstPage()` `:471` | قف للصفحة 3 ثم اكتب؛ يصبح `aria-current="page"` = 1 | **PASS** |
| مسح البحث | حذف النص يعيد تنفيذ الفلترة على الفلاتر الحالية | `debounceSearch()` `script.js:1325-1328`، `visibleProducts()` `:441` | امسح البحث بعد اختيار فئة؛ يعود عدد الفئة لا كل المنتجات | **PASS** |

### 7.2 — Debounce يدوي بدون مكتبات

- الثابت المسمّى: `SEARCH_DEBOUNCE_MS = 350` في `script.js:15`.
- `setTimeout` / `clearTimeout` داخل `debounceSearch()` `script.js:1325-1328`: كل حدث `input` يلغي المؤقت السابق ويبدأ مؤقتاً جديداً، فلا تتم الفلترة إلا بعد توقّف الكتابة 350ms.
- `runSearch()` `script.js:1315-1322` ينفّذ الفلترة مرة واحدة، ويضيف 1 إلى `filterRuns`، ويطبع العدّادات في Console.
- `Enter` `script.js:1332-1340` يلغي المؤقت (`clearTimeout` + ضبطه `null`) ثم ينفّذ فوراً بسبب `reason = 'Enter'`، لذلك لا يتكرر التنفيذ بعد 350ms.
- البحث محلي بالكامل: لا يوجد أي طلب API داخل `runSearch()`؛ تحقّق الاختبار من **صفر طلبات** `/products` أثناء الكتابة والضغط على Enter.

### 7.3 — إثبات عمل Debounce بالأرقام

العدّادات معروضة للقراءة من Console عبر `StorePulseSearchStats` `script.js:1343-1348`:

```js
StorePulseSearchStats.inputEvents   // عدد أحداث input
StorePulseSearchStats.filterRuns    // عدد مرات تنفيذ فلترة البحث
StorePulseSearchStats.log()         // يطبع القيم الحقيقية
StorePulseSearchStats.reset()       // يصفّر العدّادات للاختبار
```

كل تنفيذ يطبع تلقائياً سطراً مثل: `[StorePulse] Search stats (debounce) — input events: 8, filter runs: 1`.

| الحالة | أحداث `input` | executions `filterRuns` | النتيجة |
|---|---:|---:|---|
| كتابة سريعة `backpack` (40ms بين الحرف والحرف) عند 320/768/1280 | **8** | **1** | PASS — الفلترة أقل من الأحداث، وصفر طلبات API |
| كتابة بطيئة `bag` (450ms بين الحرف والحرف) | **3** | **3** | PASS — كل توقّف نفّذ فلترة واحدة |
| كتابة سريعة `bag` ثم `Enter` | **3** | **1** | PASS — سطر `(Enter)` واحد فقط، بلا تنفيذ مؤجّل |
| مسح البحث بعد `Enter` | — | — | PASS — عادت نفس نتائج الفلاتر الحالية، بلا نتائج قديمة |

الأدلة الكاملة: `evidence/m7/debounce-tests.json` (60/60 PASS) و9 لقطات PNG.

### الفرق بين Debounce وThrottle، ولماذا اخترنا Debounce؟

- **Debounce**: يؤجّل التنفيذ حتى يمرّ زمن سكون محدد على آخر حدث؛ أي حدث جديد يُلغي المؤقت ويُعيد العدّ. إن استمرّ المستخدم بالكتابة فلا شيء ينفّذ، ثم ينفّذ مرة واحدة بعد التوقّف. مناسب عندما نريد النتيجة النهائية فقط (بحث، حفظ تلقائي، إعادة حساب مكلفة).
- **Throttle**: يسمح بتنفيذ واحد على الأكثر كل فترة زمنية ثابتة، حتى لو استمرّت الأحداث. مناسب للأحداث المستمرة التي نريد تحديثاً خلالها (scroll، resize، حركة المؤشر، شريط التقدّم).
- **لماذا Debounce للبحث؟** لأن كل حرف وسيط (`b`، `ba`، `bac`…) ليس استعلاماً مفيداً؛ المستخدم يريد نتائج آخر نص كتبه. Debounce يمنع إعادة الرسم عشرات المرات ويبقي الواجهة سريعة، مع نتيجة واحدة صحيحة بعد 350ms. أما Throttle فكان سينفّذ عدة مرات أثناء الكتابة، لذا فائدته أقل هنا.
- **ماذا لو أرسلنا طلب API عند كل ضغطة؟** مع كلمة من 8 أحرف سنرسل 8 طلبات `GET /products`؛ مع بحث بالباك اند هذا يعني زمن شبكة واستهلاك bandwidth وطابور طلبات وتنافساً بين الاستجابات (قد تظهر نتائج قديمة بعد جديدة ما لم نلغِ الطلبات)، وضغطاً على السيرفر، ووميضاً في الواجهة. Debounce يحوّل ذلك إلى طلب واحد بعد التوقّف. **في مشروعنا البحث محلي أصلاً، فلا توجد طلبات؛ لكن القاعدة نفسها تنطبق على أي بحث سيرفري مستقبلي.**

### الأدلة وحدود اختبار M7

- `evidence/m7/debounce-tests.json` — 60 فحصاً فعلياً عبر Chrome headless/CDP عند 320 / 768 / 1280، صفر أخطاء Console.
- `evidence/m7/search-fast-*.png`، `search-empty-*.png`، `search-table-*.png` — لقطات من التفاعل الفعلي.
- أُعيد تشغيل M1–M6 بعد التعديل: `node --check`، `git diff --check`، ونسخ `evidence/m1`–`evidence/m4` (`check-m1.js`، `check-vars.js`، `check-m4.js` 38/38، `m4-deadcode.js`، `cdp-m4.js`، `cdp-m2.js`، `cdp-m3.js`، `cdp-verify.js`)، ثم `cdp-m5-runtime.js` 9/9، `cdp-m6.js` 67/67، `cdp-m6-stress.js`.
- **NOT TESTED**: Firefox (أما Edge فاختُبر في التدقيق النهائي عبر `evidence/final/`)، جهاز لمسي حقيقي، قارئ شاشة حقيقي، Lighthouse، axe، Postman / Apidog (غير مثبتين)، ومستخدم حقيقي يكتب بلوحة مفاتيح فعلية (استُخدمت أحداث DOM عبر CDP).

## M8 — الكتابة إلى الـ API وتسجيل الدخول

المصدر: `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf` صفحتا 16–17، المتطلبات 8.1–8.5. لم يُضف backend ولا قاعدة بيانات ولا مكتبات؛ كل الكتابات تُرسل إلى FakeStoreAPI، والنسخة المحلية للمنتجات تبقى في الذاكرة فقط أثناء الجلسة لأن الـ API **يحاكي** الكتابة ولا يحفظها.

### خريطة الطلبات والاستجابات الفعلية

| العملية | Method + Path | المعاملات / الجسم | الاستجابة المرصودة في Network | أين تُعرض |
|---|---|---|---|---|
| إضافة منتج | `POST https://fakestoreapi.com/products` | JSON: `{title, price, description, image, category}` مع `Content-Type: application/json` | `201` + كائن فيه `id` (ظهر `21`) | `#write-result` يعرض المعرّف، وبطاقة تحمل `.session-flag` |
| تعديل منتج | `PUT https://fakestoreapi.com/products/{id}` | Path `id` + نفس جسم المنتج | `200` + كائن فيه `id` | النموذج يعبّأ مسبقاً، وبعد التأكيد تظهر رسالة `Updated (200)` |
| حذف منتج | `DELETE https://fakestoreapi.com/products/{id}` | Path `id` فقط | `200` + كائن المنتج المحذوف | يختفي محلياً مع بقاء رسالة نجاح؛ الـ API لا يحذفه فعلياً |
| دخول | `POST https://fakestoreapi.com/auth/login` | `{username, password}` | بيانات صحيحة `201` + `token`؛ خاطئة `401` بنص `text/html` | `#login-error`، `#login-label`، زر Logout |
| طلب لاحق بالتوكن | `GET https://fakestoreapi.com/products/1` | Header: `Authorization: Bearer <token>` | `200` | إشعار يؤكد إرسال الرأس فقط؛ قيمة التوكن لا تُطبع |
| إتمام السلة | `POST https://fakestoreapi.com/carts` | `{userId: 1, date: "YYYY-MM-DD", products: [{productId, quantity}]}` + Bearer | `201` + `id` | `#order-dialog`، `#orders-list`؛ السلة تُفرَّغ فقط بعد النجاح |
| رابط خاطئ | `GET https://fakestoreapi.com/this-route-does-not-exist` | — | `404` | رسالة `Not found — wrong URL...` |
| معرّف مفقود | `GET https://fakestoreapi.com/products/999999` | Path `id` | `200` بجسم فارغ | رسالة `The API returned an empty response body.` |

> كلمة المرور والتوكن مُخفاة في `evidence/m8/*`. في `network-evidence.json` يُخزَّن حقل `bearerSent` كقيمة منطقية فقط بدل قيمة الرأس.

### 8.1–8.5 — ما أُضيف وأين

| المتطلب | الملف والسطر (الحالي بعد M8) | لماذا | كيف تتحقق | النتيجة |
|---|---|---|---|---|
| 8.1 `POST /products`: نموذج دلالي، تحقق، `Content-Type`، `JSON.stringify`، عرض المعرّف، Network Payload | `index.html:292, 548-603`؛ `style.css:937-945`؛ `script.js:41-43, 1184-1256, 1308-1358`؛ `apiRequest()` `:314-350` | نموذج `<dialog>` بحقول `label` و`type` صحيحة (`number` / `url` / `textarea` / `select`) يمنع الإرسال قبل صحة القيم، ويرسل الحقول الخمسة بصيغة الـ API بالضبط | اضغط **Add product**، جرّب حقولاً فارغة وسعر `0`، ثم أرسل مرتين بسرعة؛ راقب Network → Payload و`#write-result` | **PASS** — طلب واحد فقط، `201`، المعرّف ظاهر |
| 8.2 Edit / Delete: أزرار واضحة، `PUT/DELETE /products/{id}`، تعبئة مسبقة، تأكيد، استخراج ID آمن، رسائل، بلا طلب عند الإلغاء | `script.js:710-719, 767-815, 1142-1175, 1280-1302, 1361-1441, 1445`؛ `index.html:639-662` | الفعل لا ينفّذ قبل تأكيد صريح؛ `safeProductId()` يمنع إلحاق نص خام بالمسار؛ النسخ المؤقتة تُطبَّق وقت الرسم `:612-614` | اضغط Edit أو Delete ثم **Cancel**؛ راقب Network (صفر طلبات). أعد المحاولة واضغط **Confirm**؛ راقب `PUT /products/1` أو `DELETE /products/2` | **PASS** — `200/200`، إلغاء بلا طلب |
| 8.3 `POST /auth/login`: توكن حقيقي، `sessionStorage`، استعادة بعد Reload، `Authorization`، Logout، 401، بلا تخزين/طباعة كلمة المرور | `script.js:47-57, 1592-1731`؛ `index.html:120, 124`؛ `apiRequest()` `:315-318` يمنع الأصول الأخرى | التوكن واسم المستخدم خاصان بالتبويب؛ كلمة المرور لا تُحفظ ولا تُطبع؛ الدخول تعليمي وليس مصادقة إنتاجية | سجّل دخول ببيانات خاطئة ثم صحيحة، اضغط **Bearer check**، أعد تحميل التبويب، ثم **Logout**؛ راقب Application وNetwork وConsole | **PASS** — `401` ثم `201`، رأس Bearer مُرسل، استعادة ثم مسح كامل |
| 8.4 سلة: إضافة/حذف/كمية/مجموع بـ `reduce`، منع الكميات غير الصالحة، `POST /carts` بمعرّف مستخدم حقيقي | `script.js:154-165, 940-986, 1061-1074, 1766-1841`؛ `index.html:467` | `cartTotal()` يستخدم `reduce`؛ القيم `0` و`>99` تُرفض وتُنظَّف من Storage؛ معرّف المستخدم يُقرأ من `GET /users` لا يُخترع؛ عند الفشل تبقى السلة | أضف منتجين، غيّر الكمية، احذف واحداً، ثم اضغط Checkout؛ راقب `#cart-total` و`POST /carts` | **PASS** — `201`، جسم `{userId,date,products}`، سلة فارغة بعد النجاح فقط |
| 8.5 رسائل `200/201/400/401/404/500/offline/رابط خاطئ/جسم فارغ/JSON غير صالح` مع `response.ok` و`try/catch/finally` وإعادة تمكين الأزرار | `script.js:314-350, 859-915, 1262-1274, 1308-1358, 1401-1421, 1655-1676, 1801-1841`؛ `setupErrorLab()` `:2108-2122` | `response.ok` يغطّي 200–299؛ النص غير JSON لا يُعامل كاستثناء؛ كل `finally` ينهي التحميل ويعيد الأزرار؛ الحالات التي لا ينتجها الـ API الحي مُحاكاة بوضوح | راجع `runtime-tests.json` و`network-evidence.json`؛ جرّب wrong URL و`/products/999999` وOffline، ثم استدعِ حالات `__400/500/invalid JSON` من مختبر الأخطاء | **PASS** — 120/120 فحصاً، صفر أخطاء Console |

### Live API Tests مقابل Mocked Tests

| الفئة | الحالات | كيف نُفّذت |
|---|---|---|
| **Live API Tests** | `POST /products` → 201؛ `PUT` → 200؛ `DELETE` → 200؛ `POST /auth/login` → 201 و401؛ `GET /products/1` بالتوكن → 200؛ `POST /carts` → 201؛ رابط خاطئ → 404؛ `/products/999999` → 200 بجسم فارغ | طلبات `fetch()` حقيقية من المتصفح إلى FakeStoreAPI عبر Chrome headless/CDP، مع Network Headers وPayload وResponse وStatus |
| **Mocked Tests** | 400 و500؛ جسم نصي غير JSON؛ Offline | `StorePulseErrorLab` يستدعي دوال العرض الحقيقية لـ 400/500؛ Offline عبر CDP `Network.emulateNetworkConditions`؛ Invalid JSON عبر استبدال `fetch` لطلب واحد داخل الاختبار ثم إعادته. لا تُرسل هذه الحالات إلى الـ API ولا تُخزَّن في التطبيق |
| **NOT TESTED** | Postman / Apidog، Firefox (أما Edge فاختُبر في التدقيق النهائي عبر `evidence/final/`)، لوحة مفاتيح فعلية، قارئ شاشة، جهاز لمسي حقيقي | غير متوفرة/غير مثبتة على بيئة الاختبار؛ لا يُدعى استخدامها |

### الأدلة وحدود M8

- `evidence/m8/runtime-tests.json` — **120/120 PASS** عند 320 / 768 / 1280 بكسل (40 فحصاً لكل عرض)، صفر FAIL.
- `evidence/m8/network-evidence.json` — الطلبات والاستجابات مع Payload وStatus؛ التوكن وكلمة المرور مُخفاة، و`bearerSent` منطقي فقط.
- `evidence/m8/storage-evidence.json` — شكل المفاتيح وأطوالها في `localStorage` و`sessionStorage` عند مراحل: قبل الكتابة، بعد الإضافة، بعد الدخول، بعد الخروج، بعد الدفع. لا قيم حساسة.
- `evidence/m8/console-evidence.json` — سجل Console؛ لا أخطاء غير معالجة ولا طباعة للتوكن.
- `evidence/m8/m8-*.png` — 12 لقطة للنموذج والنتيجة وحالة تسجيل الدخول عند العروض الثلاثة.
- `evidence/m8/cdp-m8.js` — نسخة قابلة لإعادة التشغيل من اختبار CDP المستخدم (يتطلب Chrome على نفس المسار).
- `evidence/m8/TESTS.md` — التقرير العربي التفصيلي لكل متطلب مع PASS / FAIL / NOT TESTED.
- أُعيد تشغيل M1–M7 بعد التعديل: `node --check`، `git diff --check`، نسخ `evidence/m1`–`evidence/m4`، ثم `cdp-m5-runtime.js`، `cdp-m5-api.js`، `cdp-m6.js` 67/67، `cdp-m6-stress.js`، `cdp-m7.js` 60/60 — كلها **PASS**.
- **حدود مهمة**: FakeStoreAPI لا يحفظ الكتابة، لذلك `GET /products/{id}` لا يمكنه استرجاع منتج أُضيف محلياً بعد Reload؛ هذا سلوك الـ API وليس خللاً في التطبيق. المصادقة هنا تعليمية فقط؛ لا تُستخدم كأمان حقيقي.
- خريطة M9 الكاملة في القسم التالي. لا توجد commits أو push جديد بدون موافقة.

## M9 — تخزين المتصفح

المصدر: `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf` صفحتا 10–11 (خريطة التخزين) وصفحة 17 (9.1–9.3). لم يُضف backend ولا framework؛ كل التخزين يتم عبر واجهتي `localStorage` و`sessionStorage` الأصليتين.

### الخريطة الفعلية المنفَّذة

| القيمة المطلوبة | المفتاح الفعلي | الصندوق | الكود | لماذا في هذا الصندوق؟ |
|---|---|---|---|---|
| الثيم | `storepulse_theme` | `localStorage` | `script.js:56, :310-338`؛ `api.html:2087` | تفضيل يجب أن يبقى بعد إغلاق المتصفح وتراه كل التبويبات، وسواء فُتحت `index.html` أو `api.html` |
| المفضلة | `storepulse_favorites` | `localStorage` | `script.js:57, :250, :1064` | اختيار مستخدم دائم، لا يعتمد على جلسة الدخول |
| عناصر السلة | `storepulse_cart` | `localStorage` | `script.js:58, :251-254, :1112, :1136, :1144, :1963` | يجب أن تبقى بعد إغلاق المتصفح لأن FakeStoreAPI **يحاكي** الطلبات ولا يحفظها |
| آخر 5 عمليات بحث | `storepulse_recent_searches` | `localStorage` | `script.js:59, :209-223, :255, :598-629, :2105-2112` | سجل مفيد بين الزيارات، صغير، ويُعرض في كل تبويب |
| Grid / Table | `storepulse_view_mode` | `localStorage` | `script.js:60, :259, :2193` | تفضيل عرض دائم وليس حالة جلسة مؤقتة |
| حجم الصفحة | `storepulse_page_size` | `localStorage` | `script.js:61, :257-258, :2199-2207` | إعداد عرض يبقى بين الزيارات، ويُطبَّق فوراً في كل تبويب |
| توكن الدخول | `storepulse_token` | `sessionStorage` | `script.js:63, :1793, :1858` | بيانات جلسة خاصة بالتبويب؛ لا داعي لبقائها بعد إغلاقه، وتُمسح عند Logout |
| اسم المستخدم | `storepulse_username` | `sessionStorage` | `script.js:64, :1794, :1859` | مع التوكن فقط أثناء الجلسة، ولا يُحفظ في `localStorage` |
| الفلاتر الحالية | `storepulse_filters` | `sessionStorage` | `script.js:65, :75-77, :226-239, :587-595, :2074, :2125-2147, :2234-2241` | حالة مؤقتة للمتابعة بعد Reload في نفس التبويب؛ لا معنى لها في تبويب جديد أو بعد إغلاق المتصفح |
| رقم الصفحة | `storepulse_current_page` | `sessionStorage` | `script.js:66, :261, :582-584, :632-644` | موضع مؤقت داخل الجلسة، ويعود إلى 1 في تبويب مستقل |
| مسودة إضافة غير مرسلة | `storepulse_product_draft` | `sessionStorage` | `script.js:67, :241-248, :1434-1444, :1466-1477, :1508-1510, :1624-1645` | نص غير مرسل يخص التبويب الحالي؛ يُزال بعد النجاح أو «تجاهل المسودة» |

> **ملاحظة «sort»:** خريطة PDF تذكر `sort` واحدة ضمن الفلاتر. في هذا المشروع يوجد ترتيبان: ترتيب محلي (`#sort-select`) وترتيب الـ API عبر `?sort=` (`#id-sort-select`). كلاهما محفوظ داخل كائن `storepulse_filters` واحد: `sort` و`idSort`. لم نضف مفتاح تخزين جديداً خارج الخريطة.

### ما لا يُخزَّن إطلاقاً

| البند | ما يحدث فعلياً | الدليل |
|---|---|---|
| كلمات المرور | تُقرأ من النموذج وتُرسل إلى `POST /auth/login` فقط؛ لا تُحفظ ولا تُطبع ولا تظهر في الأدلة | `script.js:1878-1914`؛ `network-evidence.json` فيه `[redacted]` |
| مفاتيح سرية أو بيانات شخصية | لا توجد مثل هذه المفاتيح إطلاقاً، ولا تُحفظ بيانات المستخدمين القادمة من `/users` | الخريطة 10–11؛ فاحص المفاتيح في `runtime-tests.json` |
| كتالوج المنتجات الكامل | يُجلب من `GET /products` عند كل تحميل؛ نسخ الإضافة/التعديل/الحذف تبقى في `state.sessionChanges` بالذاكرة فقط | `script.js` حالة التطبيق؛ `evidence/m8/TESTS.md` |
| اللغة | ليست في الخريطة؛ تبدأ دائماً بـ `both` ولا تكتب أي مفتاح | `script.js:148-159`؛ `api.html:2088, :2163-2168` |
| سجل الطلبات | ليس في الخريطة؛ يعيش في ذاكرة التبويب ويزول بعد Reload | `index.html:502-503`، نص السلة `index.html:481-484` |

يُنظّف `purgeConflictingStorageKeys()` `script.js:148-159` كل مفتاح يبدأ بـ `storepulse_` ولا ينتمي لخريطة الصندوق نفسه؛ لذلك حُذفت مفاتيح اللغة والطلبات القديمة (`storepulse_shop_lang`, `storepulse_api_lang`, `storepulse_orders`) من كلا الصندوقين، بينما **لا تُمس** مفاتيح المواقع الأخرى. اختُبر ذلك بترك مفتاح `other_site_data` فبقي كما هو.

### دوال التخزين الصغيرة والآمنة

- `readStorage()` `script.js:114-124` — `JSON.parse` داخل `try/catch` وقيمة افتراضية عند الفشل أو حظر التخزين.
- `writeStorage()` `script.js:127-133` — `JSON.stringify` داخل `try/catch`؛ لا يوقف التطبيق عند امتلاء الحصة.
- `removeStorage()` `script.js:136-142` — حذف آمن لمفتاح واحد.
- الثوابت: `KEYS` `script.js:54-68`، قوائم المفاتيح المسموحة `:69-74`، والقيم الافتراضية `:75-77`.
- فحص القيم قبل الاستخدام: `toSavedList()` `:194-199`، `sanitizeCartItems()` `:201-207`، `sanitizeRecentSearches()` `:209-223`، `readSavedFilters()` `:225-239`، `readProductDraft()` `:241-248`.
- سجل البحث يُحفظ فقط عند `Enter` أو `change` أو إعادة استخدام شريحة `:2088-2112`، وليس عند كل ضغطة حرف؛ التكرار ينتقل للأعلى دون زيادة الطول، والحد الأقصى 5.

### ماذا يبقى بعد كل حدث؟

| الحدث | `localStorage` | `sessionStorage` |
|---|---|---|
| Reload | يبقى كاملاً | يبقى كاملاً في التبويب نفسه: الفلاتر والصفحة والتوكن والمسودة |
| تبويب جديد مستقل | ترى الثيم والمفضلة والسلة والبحث الأخير والعرض وحجم الصفحة | لا يرى شيئاً من التبويب الآخر؛ يبدأ بفلاتر افتراضية وصفحة 1 وبلا دخول أو مسودة |
| إغلاق التبويب | يبقى لصالح التبويبات الأخرى والمستقبل | يزول مع التبويب |
| إغلاق المتصفح ثم إعادة فتحه | يبقى كاملاً | يزول كاملاً (اختُبر بإعادة تشغيل Chrome بنفس الـ profile) |
| Logout | لا يتغيّر | يُحذف التوكن واسم المستخدم فقط؛ الفلاتر والصفحة والمسودة تبقى |

> تنبيه من الـ PDF: بعض المتصفحات تستعيد `sessionStorage` عند استعادة الجلسة، وفتح تبويب من تبويب آخر قد ينسخه؛ لذلك اختُبر **تبويب مستقل** صراحةً، ولا يُعدّ `sessionStorage` مكاناً آمناً للسرّ.

### لماذا لا يُعدّ أيٌّ من الصندوقين آمناً؟

كلاهما يخزّن نصوصاً فقط (نحتاج JSON للكائنات)، سعتهما نحو 5MB، وأي سكربت يعمل في الصفحة يستطيع قراءتهما. لذلك لا يصلحان لكلمات المرور أو المفاتيح أو التوكنات الحقيقية. في النظام الحقيقي تُحفظ الجلسة على الخادم ويُرسل للمستخدم معرّف جلسة داخل كوكي `HttpOnly` (ومع `Secure` و`SameSite`) لا يستطيع JavaScript قراءته. التوكن هنا تعليمي ومطلوب صراحةً في M8/M9، لذلك يبقى في `sessionStorage` للتبويب الحالي فقط، أما كلمة المرور فلا تُحفظ إطلاقاً.

### كيف تتحقق يدوياً في DevTools

1. افتح `index.html`، ثم **F12 → Application → Storage → Local Storage / Session Storage** واختر أصل الملف.
2. غيّر الثيم، أضف مفضلة ومنتجاً للسلة، وابحث ثم اضغط Enter؛ يجب أن تظهر المفاتيح الستة في `Local Storage`.
3. غيّر الفئة والترتيب و`limit` والنص ورقم الصفحة، وسجّل دخول وابدأ مسودة إضافة؛ يجب أن تظهر المفاتيح الخمسة في `Session Storage`.
4. اضغط **F5**: كل شيء يعود. افتح تبويباً جديداً من شريط العنوان: لن يرى التوكن ولا الفلاتر ولا المسودة، لكنه يرى الثيم والسلة.
5. أغلق التبويب ثم أغلق المتصفح وأعد فتحه: يبقى `localStorage` ويختفي `sessionStorage`. جرّب **Logout** فتختفي بيانات الدخول فقط.
6. راقب **Console**؛ يجب ألا تظهر أخطاء غير معالجة. شغّل أيضاً `node evidence/m9/cdp-m9.js` لإعادة الاختبار الآلي.

### 9.1–9.3 — ما أُنجز وأين

| المتطلب | الملف والسطر | لماذا | كيف تتحقق | النتيجة |
|---|---|---|---|---|
| 9.1 خريطة التخزين، الممنوعات، وتنظيف المفاتيح القديمة | `script.js:51-77, :148-159, :190-259`؛ `index.html:240-250, :481-484, :502-503`؛ `api.html:2085-2088, :2163-2168` | كل قيمة في صندوقها الصحيح؛ لا لغة ولا طلبات ولا كتالوج ولا كلمات مرور في المتصفح، مع عدم حذف بيانات المواقع الأخرى | راجع جدول الخريطة أعلاه و`runtime-tests.json` (فحص المفاتيح، الحذف، بقاء `other_site_data`) | **PASS** |
| 9.2 دوال قراءة/كتابة صغيرة بـ JSON و`try/catch` وقيم افتراضية | `script.js:114-142`، `:194-248`، `:582-595`، `:1419-1434` | JSON لأن التخزين نصي؛ `try/catch` لحالات الوضع الخاص والحصة الممتلئة؛ فحص النوع يمنع انهيار التطبيق عند JSON تالف | اختُبر بوضع `{broken json` في الصندوقين، وبجعل `Storage.prototype` يرمي استثناءً؛ الصفحة بقيت تعمل بالقيم الافتراضية | **PASS** |
| 9.3 عرض الاثنين في Application وتوقّع البقاء | `evidence/m9/storage-evidence.json`، `runtime-tests.json`؛ لقطات `m9-*.png`؛ `cdp-m9.js` | نفس واجهات التخزين التي يعرضها DevTools، مع دورة حياة حقيقية: Reload، تبويب مستقل، إغلاق تبويب، إغلاق المتصفح، Logout | شغّل `node evidence/m9/cdp-m9.js`؛ راجع جدول البقاء أعلاه و`console-evidence.json` | **PASS** |

### الأدلة وحدود M9

- `evidence/m9/runtime-tests.json` — **38/38 PASS**، صفر FAIL، صفر أخطاء Console غير معالجة؛ تتضمن فحوصات العرض 320 / 768 / 1280.
- `evidence/m9/storage-evidence.json` — أسماء المفاتيح وأشكالها وأطوالها في مراحل مختلفة؛ القيم الحساسة مُخفاة أو ممثّلة كـ `tokenPresent`.
- `evidence/m9/console-evidence.json` و`network-evidence.json` — سجل فعلي؛ التوكن وكلمة المرور ورأس `Authorization` مُخفاة.
- `evidence/m9/m9-*.png` — لقطات من الحالة المخزّنة، المسودة المستعادة، التبويب المستقل، ما بعد إغلاق المتصفح، وصفحة `api.html`.
- `evidence/m9/cdp-m9.js` — نسخة قابلة لإعادة التشغيل تتطلب Chrome على المسار المكتوب داخلها.
- `evidence/m9/TESTS.md` — التقرير العربي التفصيلي مع PASS / FAIL / NOT TESTED.
- **FAIL:** 0. **NOT TESTED:** Firefox (أما Edge فاختُبر في التدقيق النهائي عبر `evidence/final/`)، جهاز لمسي حقيقي، قارئ شاشة حقيقي، استعادة جلسة المتصفح التلقائية، Postman / Apidog، حصة تخزين ممتلئة فعلياً (استُخدم محاكاة الرمي بدلاً منها).
- أُعيد تشغيل M1–M8 بعد التعديل؛ النتيجة في `evidence/m9/TESTS.md`. لا توجد commits أو push بدون موافقة صريحة.

## ما تعلّمته

- **الفصل بين الطبقات**: `index.html` للمعنى، `style.css` للمظهر، `script.js` للسلوك؛ تغيير الثيم لا يلمس الهيكل، وتغيير اللغة لا يلمس بيانات الـ API.
- **الدلالية قبل الشكل**: `<button>` للفعل و`<a>` للتنقل و`<table>` للبيانات الجدولية، و`<dialog>` للحوار، مع `h1` واحد وترتيب عناوين صحيح (`check-m1.js`).
- **الـ API ليس قاعدة بيانات**: التقطتُ الفرق بين ما تقوله المواصفة وما يرجعه الخادم فعلاً؛ `POST /auth/login` يعطي `201`، والمعرّف المفقود يعطي `200` بجسم فارغ، وعمليات الكتابة محاكاة (`evidence/m5/api-probe.json`، `evidence/final/network-evidence.json`).
- **التفويض (event delegation)**: مستمع واحد على `#product-grid` يقرأ `event.target.closest('[data-action]')` و`card.dataset.id` بدل مستمع لكل بطاقة؛ عند إضافة منتج أو إعادة الرسم لا نحتاج ربط أحداث من جديد.
- **دالة واحدة لمهمة واحدة**: `buildProductsUrl()` يبني الرابط، `apiRequest()` يتحكم بالطلب والخطأ، `renderProducts()` يرسم فقط، `addToCart()` يعدّل السلة فقط. هذا يجعل الاختبار والتفسير أسهل.
- **الحالة في مكان واحد**: كائن `state` واحد يحمل المنتجات والفلاتر والصفحة والدخول؛ `renderApp()` يعيد الرسم من الحالة بدل تعديل DOM متفرق.
- **Debounce مقابل Throttle**: تعلمتُ أن Debounce هو الصحيح للبحث لأننا نريد نتيجة آخر نص فقط؛ العدّادات `inputEvents` و`filterRuns` أثبتت 8 أحداث مقابل تنفيذ واحد (`evidence/m7/debounce-tests.json`).
- **تصميم التخزين**: ما يبقى بين الزيارات (`localStorage`) مختلف عما يخص التبويب (`sessionStorage`)؛ كلاهما نصي ويُقرأ من أي سكربت في الصفحة، لذلك لا يصلحان للسرّ. كلمة المرور لا تُحفظ إطلاقاً والتوكن تعليمي في `sessionStorage`.
- **الترقيم ليس مجرد `slice()`**: فهمتُ الفرق بين `limit` (ما يصل من السيرفر) و`pageSize` (ما يُعرض محلياً)، ولماذا لا يوفّر `slice()` تنزيلاً أو ذاكرة (`evidence/m6/stress-test.json`).
- **إتاحة الوصول (a11y)**: `aria-busy` للحالات، `aria-live` للرسائل، `aria-current="page"`، `aria-pressed` لزر العرض، `:focus-visible`، وأهداف لمس لا تقل عن 44px عند 320px.
- **الأمان في الواجهة**: `textContent` بدل `innerHTML` مع بيانات خارجية، وCSP يمنع السكربتات المضمّنة ويحصر الاتصال والصور بنطاق الـ API، وتنظيف مفاتيح التخزين القديمة.
- **الاختبار دليل لا ادعاء**: كل رقم في هذه الأدلة جاء من تشغيل فعلي عبر CDP؛ ما لم يُختبر (Firefox، Postman، قارئ شاشة حقيقي، جهاز لمسي حقيقي) كُتب `NOT TESTED` صراحةً.

## سير عمل Git وGitHub

المستودع علني على <https://github.com/mohammad-alhalaf003/firstProjectJS-toAsem.git>، والعمل المحلي بدأ من clone وليس ZIP. التحقق النهائي كان **للقراءة فقط**؛ لم ينفّذ التدقيق أي `git add` أو `commit` أو `push` أو `pull` أو `clone` جديد.

| المتطلب | الحالة | ما ظهر فعلاً |
|---|---|---|
| G1 مستودع علني | **PASS** | الرابط العام يستجيب HTTP 200، وواجهة GitHub تعرض المستودع |
| G2 عمل داخل clone محلي | **PASS** | `.git` موجود، و`origin` يشير إلى الرابط أعلاه |
| G3 commit وpush بعد كل مرحلة | **FAIL** | السجل يحتوي 3 commits فقط (`64fd28a`، `41c26d7`، `9e2ab10`) بلا وسم مرحلي لكل من M1–M9؛ آخر push قبل عمل M5–M9. لا تُختلق تواريخ مرحلية |
| G4 استخدام `git pull` مرة على الأقل | **FAIL** | لا يوجد سجل pulls؛ `reflog` يُظهر clone وpush فقط |
| G5 clone نهائي في مجلد جديد وتشغيله | **NOT TESTED** | لم يُنفَّذ clone جديد أثناء التدقيق؛ المتطلب لم يُستوفَ بعد |

الفرق المطلوب معرفته في المراجعة: `add` يضع التغييرات في منطقة التحضير، `commit` يسجّلها محلياً، `push` يرسلها للبعيد، `clone` ينشئ نسخة كاملة من المستودع (بخلاف ZIP الذي لا يحمل التاريخ)، و`pull` يجلب التغييرات ويدمجها. لا تُكتب كلمات مرور أو توكنات أو مفاتيح في أي commit؛ القيم الحساسة في الأدلة كلها `[redacted]`.

## حدود معروفة / NOT TESTED

- **المنتج**: FakeStoreAPI يحاكي POST/PUT/DELETE ولا يحفظها؛ المصادقة تعليمية وليست أماناً إنتاجياً؛ لا يوجد بحث سيرفري ولا ترقيم سيرفري؛ الـ API يطبّق `limit` قبل `sort`؛ بعض نقاطه غير موثّقة رسمياً وبعضها يخالف مواصفته.
- **الاختبار**: Firefox لم يُختبر آلياً (لا driver متاح؛ Chrome + Edge عبر CDP يغطّيان متطلب متصفحين)، Postman/Apidog غير مثبتين، لا جهاز لمسي حقيقي ولا قارئ شاشة حقيقي ولا Lighthouse/axe، وSlow 3G كان محاكاة عبر CDP لا شبكة فعلية. استعادة جلسة المتصفح التلقائية وحصة تخزين ممتلئة فعلياً لم تُختبرا؛ استُخدمت محاكاة الرمي.
- **القياس**: أرقام 5000 منتج من `console.time` وdouble-`requestAnimationFrame` داخل Chrome headless، وليست Lighthouse ولا جهاز مستخدم حقيقي؛ قد تتغير بين التشغيلات.
- **Git**: G3 وG4 غير محققين وG5 لم يُختبر؛ العمل الحالي (`README.md`، `api.html`، `index.html`، `script.js`، `style.css`، PDF، و`evidence/`) غير commit وغير push، بانتظار موافقتك.
- **المراجعة اليدوية المطلوبة منك**: فتح الرابط العلني، تجربة التخزين في DevTools على جهازك، ومراجعة التباين بصرياً؛ ما ورد في الأدلة قياس آلي عبر CDP ولقطات حقيقية، ولا يُدعى أنه اختبار بشري أو على جهاز لمسي حقيقي.

## التسليم والمراجعة الفردية

- ملفات التشغيل: `index.html` + `style.css` + `script.js` تعمل بلا إعداد أو تثبيت.
- README: هذا الملف. الأدلة: `evidence/m1/` … `evidence/m9/` و`evidence/final/`، وفيها سكربتات ولقطات وسجلات Network وConsole وApplication.
- **التقرير النهائي العربي الكامل**: `evidence/final/TESTS.md` — فيه مصفوفة Q1–Q7 وG1–G5 وM1–M9 والـ API والتخزين والتسليم والمراجعة الفردية، مع الحالة ورقم الملف والسطر والدليل، ونسبة التطابق وطريقة حسابها، وكل ما لم يُختبر.
- في المراجعة الفردية يُتوقع أن تشرح بلغتك: لماذا كل قيمة في صندوقها، كيف يعمل Debounce، ما الفرق بين `add/commit/push/clone/pull`، وماذا يحدث لو حذفت سطراً مثل `clearTimeout` أو `safeProductId()`؛ ثم تُجرى تغييراً صغيراً حياً (مثلاً `?limit=5` أو hover state أو نقل مفتاح بين الصندوقين). أمثلة التغيير الآمن موجودة في التقرير النهائي.
# تقرير M8 — الكتابة إلى الـ API وتسجيل الدخول

**المصدر:** `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf`، صفحتا 16–17، المتطلبات 8.1–8.5.  
**تاريخ التنفيذ:** 2026-11-25.  
**النتيجة الإجمالية:** **PASS — 120/120 فحصاً** عند 320 / 768 / 1280 بكسل، و**صفر FAIL**، وصفر أخطاء Console غير معالجة.  
**لم يُستخدم:** backend، قاعدة بيانات، framework، أو مكتبات خارجية. كل الكتابات تذهب إلى FakeStoreAPI فقط.

> هذه مصادقة تعليمية (demo) وليست نظام حماية إنتاجي. التوكن يُحفظ في `sessionStorage` للتبويب الحالي فقط، وكلمة المرور لا تُحفظ ولا تُطبع ولا تظهر في أي دليل.

---

## 1) كيف أُجري الاختبار فعلياً

- شغّلت `evidence/m8/cdp-m8.js` عبر Chrome headless مع CDP من جذر المشروع:

```powershell
node evidence/m8/cdp-m8.js
```

- اعترضت CDP أحداث `Network.requestWillBeSent` و`Network.responseReceived` و`Network.getResponseBody` لتسجيل Method وURL وHeaders وPayload وStatus وResponse.
- قرأت `localStorage` و`sessionStorage` عبر `Runtime.evaluate` في مراحل مختلفة، وسجّلت **الشكل والأطوال فقط** لا القيم الحساسة.
- التقطت `Runtime.consoleAPICalled` وأخطاء `window.onerror` / `unhandledrejection`.
- أخذت لقطات PNG عند العروض الثلاثة عبر `Page.captureScreenshot`.
- كل قيمة `token` أو `password` أو `Authorization` مُخفاة في الملفات الناتجة؛ وفي `network-evidence.json` يُحفظ `bearerSent: true|false` بدل قيمة الرأس.

### ملفات الأدلة

| الملف | المحتوى |
|---|---|
| `runtime-tests.json` | 120 نتيجة فحصاً (40 عند كل عرض)، مع تفاصيل كل PASS / FAIL |
| `network-evidence.json` | الطلبات والاستجابات الحقيقية مع Payload وStatus؛ قيم حساسة مُخفاة |
| `storage-evidence.json` | لقطات شكل التخزين في 5 مراحل، بدون قيم حساسة |
| `console-evidence.json` | سجل Console؛ لا أخطاء غير معالجة |
| `m8-add-form-*.png` | نموذج الإضافة عند 320 / 768 / 1280 |
| `m8-add-result-*.png` | نتيجة الإضافة والمعرّف المعاد عند 320 / 768 / 1280 |
| `m8-crud-result-*.png` | نتيجة التعديل والحذف عند 320 / 768 / 1280 |
| `m8-signed-in-*.png` | حالة تسجيل الدخول عند 320 / 768 / 1280 |
| `cdp-m8.js` | نسخة قابلة لإعادة التشغيل من الاختبار المستخدم |

---

## 2) تفاصيل المتطلبات

### 8.1 — `POST /products`: JSON و`Content-Type` والتحقق والمعرّف المعاد

| البند | التفاصيل |
|---|---|
| **ما أُنجز** | زر **Add product** يفتح `<dialog>` دلالياً فيه `label` لكل حقل، و`input[type=number]` للسعر، و`input[type=url]` للصورة، و`textarea` للوصف، و`select` للفئة. التحقق يمنع الإرسال إذا كان العنوان أقل من 3 أحرف، أو السعر غير عدد موجب، أو الوصف أقل من 5 أحرف، أو رابط الصورة ليس `http(s)`، أو الفئة غير مختارة. الإرسال يستخدم `JSON.stringify` و`Content-Type: application/json`. معرّف الـ API المعاد يظهر صراحةً في `#write-result`. |
| **الملف والسطر** | `index.html:292, 548-603`؛ `style.css:937-945`؛ `script.js:41-43` (الثوابت)، `:1188-1260` (التحقق)، `:1266-1278` (منع التكرار)، `:1312-1362` (الإرسال)؛ `apiRequest()` `:316-352`. |
| **لماذا هكذا** | التحقق المحلي يمنع طلبات بلا معنى ويحفظ Network نظيفاً؛ `state.writePending` يمنع إرسالاً ثانياً أثناء انتظار الاستجابة؛ `finally` يعيد تمكين الأزرار دائماً؛ النسخة المحلية تُعلام بـ `.session-flag` حتى لا يُفهم أنها محفوظة في الـ API. |
| **كيف تتحقق يدوياً** | DevTools → Network → Fetch/XHR. اضغط Add product، أرسل نموذجاً فارغاً (صفر طلبات)، ثم سعر `0` (صفر طلبات)، ثم بيانات صحيحة مرتين بسرعة (طلب واحد فقط). افتح الطلب → Payload وHeaders وResponse، ثم ابحث عن المعرّف داخل النافذة. |
| **Endpoint / Method** | `POST https://fakestoreapi.com/products` |
| **Parameters / Body** | لا query parameters. JSON: `{"title":"M8 probe 320","price":12.5,"description":"M8 validation description","image":"https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg","category":"electronics"}` |
| **Response** | `201`، JSON فيه `id: 21` وبقية حقول المنتج. ظهر في `network-evidence.json`. |
| **النتيجة** | **PASS** — semantic fields، تحقق بلا طلب، طلب واحد فقط، `Content-Type` صحيح، Payload بـ 5 مفاتيح، `201`، المعرّف `21` ظاهر، بطاقة مؤقتة مرئية. |

### 8.2 — Edit / Delete، تأكيد، `PUT` و`DELETE`

| البند | التفاصيل |
|---|---|
| **ما أُنجز** | بطاقة المنتج والصف في الجدول يعرضان زري **Edit** و**Delete**. Edit يفتح النموذج معبّأً ببيانات المنتج؛ الحفظ لا يُرسل إلا بعد تأكيد صريح. Delete يطلب تأكيداً أيضاً. الإلغاء أو Escape أو إغلاق النافذة يمسح الكallback دون أي طلب. `safeProductId()` يتحقق أن المعرّف عدد صحيح قبل بناء المسار. `DELETE` يحذف نسخة محلية فقط لأن الـ API لا يحفظ الحذف. |
| **الملف والسطر** | `script.js:714-723` (تفويض الأزرار)، `:771-819` (النسخ المؤقتة والمعرّف الآمن)، `:1146-1179` (التأكيد)، `:1284-1306` (التعبئة المسبقة)، `:1365-1445` (الإرسال والحذف)، `:1449` (بناء الرابط)؛ `index.html:639-662`. |
| **لماذا هكذا** | التأكيد يمنع التعديل أو الحذف بالخطأ؛ استخراج المعرّف بأمان يمنع حقن نص في المسار؛ رسائل النجاح والفشل ثنائية اللغة؛ فشل الحذف لا يغيّر الكتالوج. |
| **كيف تتحقق يدوياً** | اضغط Edit على منتج، راقب الحقول معبّأة، غيّر العنوان، اضغط Cancel في نافذة التأكيد → صفر طلبات `PUT`. أعد المحاولة واضغط Confirm → يظهر `PUT /products/1`. كرّر مع Delete و`DELETE /products/2`. |
| **Endpoint / Method** | `PUT https://fakestoreapi.com/products/1` و`DELETE https://fakestoreapi.com/products/2` |
| **Parameters / Body** | Path parameter `id`. جسم `PUT` نفس جسم المنتج مع العنوان المعدّل؛ `DELETE` بلا جسم. |
| **Response** | `200` للاثنين؛ `PUT` أعاد الكائن المعدّل و`DELETE` أعاد كائن المنتج المحذوف. |
| **النتيجة** | **PASS** — تعبئة مسبقة صحيحة، إلغاء بلا طلبات، `PUT` و`DELETE` بحالة `200`، معرّف مستخرج بأمان، نسخة مؤقتة مُعلَّمة، رسائل واضحة. |

### 8.3 — `POST /auth/login`، التوكن، Bearer، والخروج

| البند | التفاصيل |
|---|---|
| **ما أُنجز** | الدخول يرسل `username` و`password` إلى `/auth/login`. عند النجاح يُحفظ التوكن واسم المستخدم في `sessionStorage` ويُحدَّث الهيدر؛ عند الفشل تظهر رسالة 401 واضحة وتُعاد تفعيل الأزرار. زر **Bearer check** يرسل `GET /products/1` مع `Authorization: Bearer <token>` إلى FakeStoreAPI فقط. زر **Logout** يمسح الذاكرة و`sessionStorage` والواجهة. إعادة تحميل التبويب تستعيد الجلسة. `apiRequest()` يمنع أي أصل غير `fakestoreapi.com` قبل إرسال الطلب. |
| **الملف والسطر** | `script.js:47-57` (مفاتيح التخزين)، `:316-318` (حجب الأصول الأخرى)، `:1596-1605` (معرّف المستخدم ورأس التوكن)، `:1609-1618` (مزامنة الواجهة)، `:1623-1657` (الاستعادة والمسح والخروج والفحص)، `:1659-1735` (إكمال الدخول ومعالجته). `index.html:120, 124`. |
| **لماذا هكذا** | `sessionStorage` مناسب لجلسة التبويب ولا ينتقل لتبويب آخر؛ كلمة المرور لا تُخزَّن إطلاقاً؛ الرأس يُرسل إلى الـ API فقط؛ الرسائل لا تكشف قيمة التوكن؛ هذا تعليمي وليس بديلاً عن cookies آمنة من الخادم. |
| **كيف تتحقق يدوياً** | سجّل دخول بكلمة سر خاطئة → 401 ورسالة. سجّل دخول بالبيانات التجريبية → 201 وظهور Logout. اضغط Bearer check وراقب Request Headers (سترى `Bearer [redacted]` في الدليل). أعد تحميل التبويب → الجلسة تعود. اضغط Logout → يختفي الاسم والأزرار ويُمسح المفتاحان من Application. |
| **Endpoint / Method** | `POST /auth/login`؛ ثم `GET /products/1`؛ ثم `GET /users` لاستخراج معرّف المستخدم الحقيقي |
| **Parameters / Body** | `{username, password}` — القيمة الحساسة مُخفاة في الأدلة |
| **Response** | صحيح: `201` + `{"token":"[redacted]"}`؛ خاطئ: `401` بنص `text/html`؛ `/products/1` بالتوكن: `200`. |
| **النتيجة** | **PASS** — 401 ثم 201، توكن واسم مستخدم في `sessionStorage` فقط، لا كلمة مرور ولا توكن في `localStorage` أو Console، رأس Bearer مُرسل، استعادة بعد Reload، خروج كامل، حجب أصل خارجي. |

### 8.4 — السلة والكميات والمجموع و`POST /carts`

| البند | التفاصيل |
|---|---|
| **ما أُنجز** | إضافة/حذف/تغيير كمية مع منع القيم غير الصحيحة (الصفر يحذف، والقيمة فوق 99 تُرفض). `cartTotal()` يستخدم `reduce`، ويعرض المجموع في `#cart-total` والشريط. جسم الخروج يُبنى من سلة حقيقية بمعرّف مستخدم قادم من `GET /users`، مع تاريخ بصيغة `YYYY-MM-DD`. التوكن يُضاف إلى طلب `/carts` إن وُجد. عند الفشل تبقى السلة كما هي. |
| **الملف والسطر** | `script.js:154-165` (تنظيف الكميات المحفوظة)، `:944-990` (المجموع وتغيير الكمية)، `:1065-1078` (رسم السلة)، `:1770-1845` (بناء الجسم وإتمام الطلب). `index.html:467`. |
| **لماذا هكذا** | `reduce` هو الأداة المناسبة لجمع قيم مصفوفة؛ منع الكميات غير المنطقية يحمي المجموع والجسم المرسل؛ عدم اختراع `userId` يحترم الـ API؛ إبقاء السلة عند الفشل يمنع فقدان بيانات المستخدم. |
| **كيف تتحقق يدوياً** | أضف منتجين، غيّر الكمية من السلة، احذف أحدهما، راقب العدّاد والمجموع، ثم اضغط Checkout. افتح Network → `POST /carts` → Payload. جرّب أيضاً وضع كمية `0` أو `100` في `localStorage` يدوياً ثم أعد التحميل: ستُرفض القيمتان. |
| **Endpoint / Method** | `POST https://fakestoreapi.com/carts` |
| **Parameters / Body** | `{"userId":1,"date":"2026-11-25","products":[{"productId":3,"quantity":1}]}` |
| **Response** | `201` + JSON فيه `id`. السلة تُفرَّغ بعد النجاح فقط. |
| **النتيجة** | **PASS** — إضافة/حذف/كمية/مجموع صحيحة، كميات غير صالحة مرفوضة ومُنظَّفة من Storage، جسم مطابق للتوثيق، `201`، سلة فارغة بعد النجاح فقط. |

### 8.5 — رسائل الحالات والفشل الآمن

| البند | التفاصيل |
|---|---|
| **ما أُنجز** | جدول رسائل ثنائي اللغة لـ 400 و401 و404 و500، ورسائل منفصلة لـ offline وtimeout وnetwork وblocked، والجسم الفارغ، والجسم النصي غير JSON. `apiRequest()` يعتمد على `response.ok` ويقرأ النص أولاً ثم يحاول `JSON.parse` داخل `try/catch`. كل عمليات الكتابة والدخول والخروج تنهي حالة التحميل وتعيد الأزرار في `finally`. `StorePulseErrorLab` يختبر الحالات التي لا ينتجها الـ API الحي باستخدام دوال العرض الحقيقية نفسها. |
| **الملف والسطر** | `script.js:316-352` (`apiRequest`)، `:863-919` (الرسائل وعارضات الأخطاء)، `:1266-1278`، `:1312-1362`، `:1405-1425`، `:1659-1680`، `:1805-1845` (آخر `finally`)، `:2114-2128` (مختبر الأخطاء). |
| **لماذا هكذا** | 200 و201 نجاح وليسا خطأً؛ 401 قد تكون نصاً لا JSON؛ 404 تعني رابطاً خاطئاً؛ الجسم الفارغ شائع في هذا الـ API؛ Offline لا يمر عبر `response` إطلاقاً؛ `finally` يمنع بقاء الأزرار معطّلة. |
| **كيف تتحقق يدوياً** | افتح Network وجرّب: رابط خاطئ (404)، `/products/999999` (200 بجسم فارغ)، قطع الشبكة من DevTools (offline)، ثم من Console استدعِ `StorePulseErrorLab.message({ok:false,status:400})` و`...500` و`renderWrite(...)` و`renderLogin(...)` لرؤية الرسائل في صناديق الخطأ الحقيقية. |
| **Endpoint / Method** | مباشر: `GET /this-route-does-not-exist`، `GET /products/999999`، `POST /auth/login` (401). محاكى: 400/500/invalid JSON/offline. |
| **Response** | 404 HTML؛ 200Empty body؛ 401 `text/html`؛ 400 و500 مُحاكاة برسائل `Bad request` و`Server error`؛ Invalid JSON برسالة `Non-JSON text response`. |
| **النتيجة** | **PASS** — كل الحالات المطلوبة لها رسالة واضحة، `response.ok` مستخدم، `try/catch/finally` في كل مسار، الأزرار تعود بعد النجاح والفشل، صفر أخطاء Console. |

---

## 3) Live API Tests مقابل Mocked Tests

| التصنيف | الحالات | الدليل |
|---|---|---|
| **Live API Tests** | `POST /products → 201`، `PUT /products/1 → 200`، `DELETE /products/2 → 200`، `POST /auth/login → 401 و201`، `GET /products/1` بالتوكن `→ 200`، `POST /carts → 201`، رابط خاطئ `→ 404`، `/products/999999 → 200` بجسم فارغ | `network-evidence.json` |
| **Mocked Tests** | `400` و`500` عبر `StorePulseErrorLab` بدوال العرض الحقيقية؛ `invalid JSON` باستبدال `fetch` لطلب واحد داخل الاختبار؛ `offline` عبر `Network.emulateNetworkConditions` من CDP | `runtime-tests.json` (أسماء تحتوي `mocked` / `invalid JSON` / `offline`) |
| **NOT TESTED** | Postman / Apidog (غير مثبتين)، Firefox / Edge، قارئ شاشة حقيقي، جهاز لمسي حقيقي، مستخدم يكتب بلوحة مفاتيح فعلية، مصادقة إنتاجية | لا يُدعى استخدامها |

---

## 4) مشاكل اكتشافها أثناء الاختبار وأُصلحت ثم أُعيد اختبارها

| # | المشكلة | الإصلاح | إعادة الاختبار |
|---|---|---|---|
| 1 | ظهرت نافذتا تأكيد بالمعرف `confirm-dialog` نفسه بعد إضافة M8.2 | حُذفت النسخة المكررة ووحّدت النافذة الحالية مع `#confirm-no` و`#confirm-yes` | `check-m1.js` صفر معرّفات مكررة؛ 120/120 |
| 2 | المنتج المضاف ظهر في العدّاد (`21 products`) لكنه لم يظهر في الشبكة | `renderProducts()` يطبّق `applySessionChanges(visibleProducts())` وقت الرسم، وحُذف التكرار الذي كان يضيف نسختين | PASS عند العروض الثلاثة |
| 3 | زر التأكيد بقي معطّلاً أحياناً بعد إغلاق النافذة | `askConfirmation()` يعيد تعيين الحالة، وحدث `close` لم يعد يمسح الكallback قبل التنفيذ | PASS — cancel بلا طلب، confirm ينفّذ مرة واحدة |
| 4 | كميات `0` و`100` كانت تُرفض في الذاكرة لكنها تبقى في `localStorage` | `script.js:162-165` يكتب النسخة المنظّفة إلى Storage عند التحميل | PASS — `invalid saved quantities removed` عند العروض الثلاثة |
| 5 | أداة الاختبار كانت تُظهر `authorizationValue: [redacted]` لكل طلب بسبب تعميم التعتيم | استُبدل الحقل الخام بـ `bearerSent` منطقي؛ أُعيد توليد `network-evidence.json` | PASS — 6 طلبات فقط تحمل Bearer: 3 `GET /products/1` و3 `POST /carts` |
| 6 | فاحص `f.labels` فشل لأن `HTMLFormElement` لا يملك خاصية `labels` قابلة للتكرار | استُبدل بـ `f.querySelectorAll('label')` في أداة الاختبار فقط | PASS |

---

## 5) إجابات مختصرة للمراجعة الشفوية

- **GET مقابل POST:** `GET` يقرأ مورداً ولا يغيّر حالة الخادم؛ `POST /products` يُنشئ مورداً جديداً ويعيد `201` ومعرّفاً. Network → Payload في `GET` يُظهر Query String، وفي `POST` يُظهر Request Payload.
- **PUT مقابل PATCH مقابل DELETE:** `PUT` يستبدل الحقول المرسلة إلى `/products/{id}`؛ `PATCH` يعدّل جزئياً وهو موثّق في `api.html` لكن التطبيق اختار `PUT`؛ `DELETE` يحذف المورد المحدد بالمسار. الثلاثة في هذا الـ API محاكاة.
- **التوكن ليس كلمة مرور:** التوكن دليل على جلسة دخول مُنحت بعد التحقق، ويُرسل في `Authorization: Bearer` إلى الـ API فقط؛ كلمة المرور تُرسل مرة واحدة ولا تُخزَّن. كلاهما سري، لكن لا ينتمي أي منهما إلى `localStorage` أو سجل Console.
- **لماذا `sessionStorage` للتوكن؟** لأنه يبقى في التبويب الحالي ويزول بإغلاقه، بينما `localStorage` يبقى بين التبويبات ويُقرأ من أي سكربت في الصفحة؛ ولا أي منهما مكان آمن بسبب قابلية القراءة من JavaScript.

---

## 6) الخلاصة النهائية

| المتطلب | الحالة |
|---|---|
| 8.1 POST /products | **PASS** |
| 8.2 Edit / Delete / Confirmation | **PASS** |
| 8.3 Login / Token / Bearer / Logout | **PASS** |
| 8.4 Cart / Quantity / Total / POST /carts | **PASS** |
| 8.5 Error handling and messages | **PASS** |
| M1–M7 regression after M8 | **PASS** |
| Postman / Apidog، متصفح ثانٍ، لوحة مفاتيح فعلية، قارئ شاشة | **NOT TESTED** |
| M9 والمراجعة النهائية للـ PDF | **NOT STARTED** |

**لا توجد حالات FAIL في M8.** لم يُجرَ أي `git add` أو commit أو push أو pull أو clone أو تغيير remote.

# تقرير M9 — تخزين المتصفح

**المصدر:** `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf` صفحتا 10–11 (خريطة التخزين) وصفحة 17 (9.1–9.3).  
**تاريخ التنفيذ:** 2026-11-25.  
**النتيجة الإجمالية:** **PASS — 38/38 فحصاً فعلياً**، صفر FAIL، صفر أخطاء Console غير معالجة.  
**البيئة:** Google Chrome headless عبر CDP مع Storage API حقيقي ودورات حياة حقيقية للتبويب والمتصفح. لم يُستخدم backend ولا قاعدة بيانات ولا framework ولا مكتبات خارجية.

> لا يحتوي أي ملف في `evidence/m9/` على كلمة مرور أو توكن أو قيمة رأس `Authorization`. تُخزَّن الحالة كـ `tokenPresent` / `bearerSent` أو كقيمة `[redacted]`.

---

## 1) كيف أُجري الاختبار فعلياً

1. شغّلت من جذر المشروع:

```powershell
node evidence/m9/cdp-m9.js
```

2. فتح السكربت Chrome بملف تعريف مؤقت، ثم قرأ `localStorage` و`sessionStorage` عبر `Runtime.evaluate`، وراقب `Runtime.consoleAPICalled` و`window.onerror` و`unhandledrejection`.
3. نفّذ أحداثاً حقيقية: تغيير ثيم، مفضلة، إضافة للسلة، بحث، فلاتر، صفحة، تسجيل دخول، فتح نموذج إضافة، ثم:
   - Reload؛
   - تبويب جديد مستقل؛
   - إغلاق التبويب؛
   - Logout؛
   - إغلاق Chrome وإعادة فتحه بنفس الـ profile؛
   - فتح `api.html` مع مفتاح لغة قديم محقون مسبقاً.
4. التقط لقطات عند 320 / 768 / 1280 بكسل، وحفظ الأشكال والأطوال لا القيم الحساسة.
5. للتأكد يدوياً في المتصفح: **F12 → Application → Storage → Local Storage / Session Storage**، ثم كرّر الخطوات أعلاه وراقب المفاتيح.

---

## 2) 9.1 — خريطة التخزين المنفَّذة

### 2.1 المفاتيح الفعلية ولماذا كل قيمة في صندوقها

| القيمة من PDF | المفتاح الفعلي | الصندوق | الملف والسطر | لماذا هنا؟ | كيف تتحقق | النتيجة |
|---|---|---|---|---|---|---|
| Theme choice | `storepulse_theme` | `localStorage` | `script.js:56, :312-340`؛ `api.html:2087` | تفضيل يجب أن يبقى بعد إغلاق المتصفح وتراه التبويبات وصفحة التوثيق | غيّر الثيم إلى `ocean`، أعد التحميل، افتح تبويباً جديداً، ثم أغلق المتصفح وأعده | **PASS** |
| Favourites | `storepulse_favorites` | `localStorage` | `script.js:57, :250, :1068` | اختيار دائم للمستخدم وليس حالة جلسة | اضغط قلب المفضلة، أعد التحميل، وافتح تبويباً مستقلاً | **PASS** |
| Cart items | `storepulse_cart` | `localStorage` | `script.js:58, :251-254, :1116, :1140, :1148, :1968` | الـ API يحاكي الطلبات، فالسلة يجب أن تبقى بعد إغلاق المتصفح | أضف منتجاً مرتين، أعد التحميل، ثم أغلق المتصفح وأعده؛ الكمية 2 تبقى | **PASS** |
| Recent searches (last 5) | `storepulse_recent_searches` | `localStorage` | `script.js:59, :209-223, :255, :602-633, :2111-2118`؛ `index.html:240-250`؛ `style.css:684-688` | سجل صغير ومفيد بين الزيارات، ويظهر في كل تبويب | ابحث عن 6 كلمات واضغط Enter لكل واحدة؛ تظهر 5 فقط، الأحدث أولاً | **PASS** |
| Grid / table view | `storepulse_view_mode` | `localStorage` | `script.js:60, :259, :2199` | تفضيل عرض دائم | اختر Table، أعد التحميل، ثم افتح تبويباً جديداً | **PASS** |
| Page size | `storepulse_page_size` | `localStorage` | `script.js:61, :257-258, :2205-2213` | إعداد عرض يبقى بين الزيارات | اختر 5، أعد التحميل، ثم أغلق المتصفح وأعده | **PASS** |
| Login token | `storepulse_token` | `sessionStorage` | `script.js:63, :1797, :1862` | جلسة خاصة بالتبويب؛ تُمسح عند Logout ولا معنى لها بعد إغلاقه | سجّل دخول، أعد التحميل، ثم جرّب تبويباً مستقلاً ثم Logout | **PASS** |
| Logged-in username | `storepulse_username` | `sessionStorage` | `script.js:64, :1798, :1863` | يرافق التوكن داخل الجلسة فقط | نفس الاختبار؛ الاسم يظهر في الهيدر بعد Reload فقط في التبويب الأصلي | **PASS** |
| Current filters | `storepulse_filters` | `sessionStorage` | `script.js:65, :75-77, :226-239, :591-599, :2080, :2131-2153, :2240-2247` | حالة مؤقتة للمتابعة بعد Reload في نفس التبويب | غيّر الفئة والترتيب و`limit` ونص البحث، أعد التحميل، ثم افتح تبويباً مستقلاً | **PASS** |
| Current page number | `storepulse_current_page` | `sessionStorage` | `script.js:66, :261, :586-588, :636-648` | موضع مؤقت داخل الجلسة؛ يعود إلى 1 في تبويب جديد | اذهب للصفحة 2، أعد التحميل، ثم افتح تبويباً مستقلاً | **PASS** |
| Unsent add-product draft | `storepulse_product_draft` | `sessionStorage` | `script.js:67, :241-248, :1423-1438, :1457-1468, :1495-1497, :1596-1617`؛ `index.html:573-576, :629-631` | نص غير مرسل يخص التبويب الحالي؛ لا يُشارك مع تبويبات أخرى | ابدأ مسودة، أعد التحميل، أعد فتح النموذج، ثم جرّب Cancel وDiscard والإرسال الناجح | **PASS** |

**ملاحظة `sort`:** PDF يذكر `sort` واحدة ضمن الفلاتر. في المشروع ترتيب محلي وترتيب للـ API، وكلاهما محفوظ داخل الكائن `storepulse_filters`: `sort` للمحلي و`idSort` لـ `?sort=`. لم يُنشأ مفتاح تخزين خارج الخريطة.

### 2.2 ما لا يُخزَّن أبداً

| البند | السلوك | الملف والسطر | النتيجة |
|---|---|---|---|
| كلمات المرور | تُقرأ من النموذج وتُرسل إلى API فقط؛ لا حفظ ولا طباعة ولا أدلة | `script.js:1882-1918` | **PASS** |
| مفاتيح سرية / بيانات شخصية | لا توجد مثل هذه المفاتيح، ولا تُحفظ بيانات `/users` | الخريطة 10–11 + فاحص المفاتيح في `runtime-tests.json` | **PASS** |
| كتالوج المنتجات الكامل | يُجلب من `GET /products`؛ نسخ CRUD في ذاكرة `state.sessionChanges` | `script.js` حالة التطبيق | **PASS** |
| اللغة | ليست في الخريطة؛ تبدأ بـ `both` ولا تكتب أي مفتاح | `script.js:148-159`؛ `api.html:2088, :2163-2168` | **PASS** |
| سجل الطلبات | ليس في الخريطة؛ ذاكرة التبويب فقط وتزول بعد Reload | `index.html:481-484, :502-503` | **PASS** |

### 2.3 تنظيف المفاتيح القديمة دون حذف بيانات المواقع الأخرى

`purgeConflictingStorageKeys()` في `script.js:148-159` يحذف فقط المفاتيح التي تبدأ بـ `storepulse_` وتخرج عن خريطة الصندوق. اختُبر حقن `storepulse_shop_lang` و`storepulse_api_lang` و`storepulse_orders` و`storepulse_legacy` في الصندوقين، فحُذفت كلها، وبقي `other_site_data` كما هو. انظر `runtime-tests.json` (أول فحصين). **PASS**

---

## 3) 9.2 — دوال التخزين الصغيرة والآمنة

| الدالة / الأداة | الملف والسطر | ماذا تفعل؟ | لماذا؟ | اختبار فعلي | النتيجة |
|---|---|---|---|---|---|
| `readStorage` | `script.js:114-124` | `JSON.parse` داخل `try/catch` مع قيمة افتراضية | التخزين نصي وقد يرمي استثناءً في الوضع الخاص | حُقن `{broken json` في `storepulse_cart` و`storepulse_filters`؛ الصفحة بقيت تعمل بالقيم الافتراضية | **PASS** |
| `writeStorage` | `script.js:127-133` | `JSON.stringify` داخل `try/catch` | امتلاء الحصة لا يجب أن يوقف التطبيق | جُعلت `Storage.prototype.setItem` ترمي استثناءً؛ لم تظهر أخطاء غير معالجة | **PASS** |
| `removeStorage` | `script.js:136-142` | حذف مفتاح واحد بأمان | Logout وClear يحتاجان حذفاً بلا انهيار | Logout وClear recent وDiscard نفّذت الحذف فعلياً | **PASS** |
| `KEYS` / المسموحات / الافتراضيات | `script.js:51-77` | أسماء ثابتة وقوائم بيضاء لكلا الصندوقين | لا magic strings، ولا مفتاح خارج الخريطة | فحص مفاتيح `localStorage` و`sessionStorage` بعد بناء حالة كاملة | **PASS** |
| فاحصات القيم | `script.js:194-248` | `toSavedList`, `sanitizeCartItems`, `sanitizeRecentSearches`, `readSavedFilters`, `readProductDraft` | منع انهيار التطبيق عند نوع خاطئ أو مسودة تالفة | سجل تالف، سلة تالفة، مسودة `not json`، فلاتر `{broken json` — كلها رُفضت بأمان | **PASS** |
| كتابة الفلاتر والصفحة | `script.js:586-599, :2080, :2131-2153, :2240-2247` | كائن filters واحد + رقم صفحة منفصل | تغيير أي فلتر يحدّث الحالة فوراً | غيّرت الفئة والترتيبين و`limit` والبحث والصفحة، ثم أعد التحميل | **PASS** |

---

## 4) 9.3 — البقاء عبر دورة الحياة الحقيقية

| الحدث | ما الذي لوحظ فعلياً | الدليل في `runtime-tests.json` | النتيجة |
|---|---|---|---|
| **Reload** | الثيم والمفضلة والسلة و5 بحوث والعرض وحجم الصفحة رجعت؛ الفلاتر والصفحة والتوكن والمسودة رجعت في التبويب نفسه، وظهرت الصفحة 2 و`?sort=desc` و`price-asc` | `reload restores…` (3 فحوصات) | **PASS** |
| **تبويب جديد مستقل** | رأى `localStorage` كاملاً؛ لم يرَ التوكن ولا اسم المستخدم ولا المسودة، وبدأ بفلاتر افتراضية وصفحة 1 | `independent new tab…` | **PASS** |
| **إغلاق التبويب** | بقي `localStorage` والتبويب الأصلي على توكنه وصفحته 2 | `closing the independent tab…` | **PASS** |
| **Logout** | حُذف التوكن واسم المستخدم فقط؛ المسودة والفلاتر والصفحة والسلة والثيم بقيت | `logout removes…` | **PASS** |
| **إغلاق المتصفح ثم إعادة فتحه** | بقي كل `localStorage`؛ اختفى كل `sessionStorage`؛ الجدول وحجم الصفحة ظهرا من التخزين الدائم | `browser close/reopen…` (3 فحوصات) | **PASS** |
| **`api.html`** | حُذف `storepulse_api_lang` عند التحميل، بدأ الوضع `both`، وتبديل اللغة لم يكتب أي مفتاح لغة؛ `storepulse_theme` بقي | فحصان بعنوان `api.html…` | **PASS** |

> PDF يحذّر من استعادة الجلسة ونسخ `sessionStorage` عند فتح تبويب من تبويب آخر؛ لذلك اختُبر تبويب **مستقل** صراحةً، ولا يُعدّ `sessionStorage` وسيلة حماية.

### 4.1 قواعد البحث الأخير والمسودة

| السلوك | ما أُجري | النتيجة |
|---|---|---|
| لا حفظ عند كل حرف | كُتبت 6 أحداث `input` مع Debounce؛ لم يُنشأ `storepulse_recent_searches` | **PASS** |
| لا حفظ لبحث فارغ | أدخل مسافات وضغط Enter؛ لم يُنشأ المفتاح | **PASS** |
| الحد الأقصى 5 | بُحثت 6 كلمات؛ بقيت `shirt,hat,jeans,ring,watch` | **PASS** |
| التكرار | بُحث `bag` مرة ثانية؛ انتقل للأعلى وصار طول القائمة 5 | **PASS** |
| العرض وإعادة الاستخدام | ظهرت 5 أزرار تحمل التسمية `Search again`؛ الضغط على `hat` ملأ الحقل ونفّذ البحث | **PASS** |
| مسح صريح | زر Clear حذف المفتاح وأخفى الصندوق | **PASS** |
| المسودة بعد Reload | فُتحت المسودة بعد إعادة التحميل فاستُعيدت كل الحقول الخمسة | **PASS** |
| Cancel | يغلق النافذة فقط ويحتفظ بالمسودة (موضّح في `index.html:573-576`) | **PASS** |
| Discard draft | زر صريح `script.js:1600-1604` يمسح المفتاح ويعيد النموذج فارغاً | **PASS** |
| بعد إضافة ناجحة | `script.js:1497` يمسح المسودة بعد `201` فقط | **PASS** |
| وضع التعديل | لا يكتب مسودة، وزر Discard مخفي `script.js:1441-1468` | **PASS** |

---

## 5) لماذا لا يُعدّ أيٌّ من الصندوقين آمناً؟

كلاهما يخزّن نصوصاً فقط (لذلك نستخدم JSON)، سعتهما نحو 5MB، وأي سكربت في الصفحة يستطيع قراءتهما. لذلك لا يصلحان للكلمات السرية أو التوكنات الحقيقية. في نظام حقيقي تُحفظ الجلسة على الخادم، ويُرسل معرّفها في كوكي `HttpOnly` مع `Secure` و`SameSite` لا يستطيع JavaScript قراءته. المصادقة هنا تعليمية، والتوكن موضوع في `sessionStorage` لأن M8 وM9 يطلبان ذلك صراحةً؛ أما كلمة المرور فلا تُحفظ أبداً.

---

## 6) إعادة تشغيل M1–M9 بعد تعديلات M9

| الفاحص | النتيجة |
|---|---|
| `node --check script.js` و`node --check evidence/m9/cdp-m9.js` و`node --check evidence/m8/cdp-m8.js` | PASS — لا أخطاء صياغة |
| `git diff --check` | PASS — تحذير EOL فقط على `README.md`، لا whitespace errors |
| `check-m1.js` | PASS — بنية دلالية، لا معرّفات مكررة، لا أخطاء حقول/أزرار |
| `check-vars.js` | PASS — `undefined: []` (التكرارات المذكورة هي تعريفات ثيم متوقعة) |
| `check-m4.js` | **38/38 PASS** |
| `m4-deadcode.js` | PASS — 160 دالة، `unused: []` |
| `cdp-verify.js` | PASS عند 320 / 768 / 1280 — صفر `bad` وصفر أخطاء |
| `cdp-m2.js` | PASS — Flex/Grid/تباين/ثيمات/أول زيارة |
| `cdp-m3.js` | PASS — Sticky/قوائم/لمس/حالات/حركة |
| `cdp-m4.js` | PASS — تفويض حدث واحد على الشبكة، صفر مستمع لكل بطاقة |
| `cdp-m5-runtime.js` | **9/9 PASS** |
| `cdp-m5-api.js` | PASS — 10 طلبات حقيقية مع Status وPayload وCORS |
| `cdp-m6.js` | **67/67 PASS** |
| `cdp-m6-stress.js` | PASS — 5000 منتج، 204ms JS مقابل 2.5ms لصفحة من 20 |
| `cdp-m7.js` | **60/60 PASS** |
| `cdp-m8.js` | **120/120 PASS** |
| `evidence/m9/cdp-m9.js` | **38/38 PASS** |

---

## 7) الأدلة المحفوظة

- `evidence/m9/runtime-tests.json` — 38 نتيجة PASS/FAIL مع تفاصيل مُخفاة.
- `evidence/m9/storage-evidence.json` — أسماء المفاتيح وأشكالها وأطوالها في 11 مرحلة.
- `evidence/m9/console-evidence.json` — Console الفعلي؛ تحذيرات مت عمّدة عند حقن تخزين تالف، صفر أخطاء غير معالجة.
- `evidence/m9/network-evidence.json` — طلبات فعلي؛ `bearerSent` منطقي وبيانات الدخول `[redacted]`.
- `evidence/m9/m9-stored-state-1280.png`، `m9-draft-restored-1280.png`، `m9-independent-tab-1280.png`، `m9-after-browser-reopen-1280.png`، `m9-draft-320.png`، `m9-draft-768.png`، `m9-api-language-storage-1280.png`.
- `evidence/m9/cdp-m9.js` — السكربت القابل لإعادة التشغيل.

---

## 8) الحكم النهائي

| البند | الحكم |
|---|---|
| M9.1 الخريطة والممنوعات والتنظيف | **PASS** |
| M9.2 المساعدات الآمنة | **PASS** |
| M9.3 العرض في Application والتنبؤ بالبقاء | **PASS** |
| إجمالي فحوص M9 | **38/38 PASS — FAIL 0** |
| إجمالي الانحدار M1–M9 | **PASS** |
| **NOT TESTED** | Firefox / Edge؛ جهاز لمسي حقيقي؛ قارئ شاشة حقيقي؛ استعادة جلسة المتصفح التلقائية؛ Postman / Apidog؛ حصة تخزين ممتلئة فعلياً (استُخدم محاكاة الرمي بدلاً منها) |

> لم تُنفَّذ أي عملية `git add` أو `commit` أو `push` أو `pull` أو `clone` أو تغيير remote بدون موافقة صريحة.

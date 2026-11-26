# التقرير النهائي للتدقيق — StorePulse

**التاريخ:** 2026-11-25  
**المرجع النهائي الوحيد:** `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf`، صفحات 1–18.  
**النطاق:** تدقيق شامل لكل عناصر PDF: Q1–Q7، G1–G5، M1–M9 بجميع بنودها الفرعية، متطلبات FakeStoreAPI، خريطة التخزين، التسليم، والمراجعة الفردية.  
**قاعدة الحكم:** أُبلّغ فقط عن نتائج نُفّذت فعلاً. لا توجد نتائج مستنتجة من النية، ولا أدلة مُختلقة، ولا سجل Git مُعاد كتابته.

## دليل الحالات

| الحالة | المعنى |
|---|---|
| **PASS** | البند موجود ومُختبَر بالدليل المذكور. |
| **PARTIAL** | جزء من البند مُنجَز وجزء آخر غير مُختبَر أو غير مُنجَز. |
| **FAIL** | البند مطلوب ولم يتحقق. |
| **NOT TESTED** | لم نُجرّبه؛ يُذكر صراحةً في قسم القيود. |

> ملاحظة عن أرقام الأسطر: هذه الأرقام حالية بعد آخر تعديلات التدقيق. أرقام أقسام M1–M8 في `README.md` تاريخية، وأُشير إلى هذا الملف بوصفه المرجع المُحدَّث.

---

## 1. الحكم التنفيذي

| القسم | الحالة | الخلاصة |
|---|---:|---|
| Q1–Q7 — الكود المقروء | **PASS** | 7/7؛ الأسماء، الدوال الصغيرة، الثوابت، التعليقات، kebab-case، الترتيب، وعدم الإيهام. |
| G1 — مستودع عام | **PASS** | المستودع عام؛ تحققتُ من HTTP 200 بقراءة فقط، و`origin` يشير إليه. |
| G2 — عمل داخل clone محلي | **PASS** | `git reflog` يُظهر `clone` من المستودع، وليس ZIP. |
| G3 — commit/push بعد كل مرحلة | **FAIL** | 3 commits فقط، ولا يوجد commit لكل M1–M9؛ آخرpush قبل M5. |
| G4 — استخدام `git pull` مرة على الأقل | **FAIL** | لا يوجد أي `pull` أو `fetch` في السجل. |
| G5 — clone نهائي في مجلد جديد وتشغيله | **NOT TESTED** | لم أنفّذ clone جديداً؛ أي عملية Git كتابة تتطلب موافقتك. |
| M1 — HTML دلالي | **PASS** | 1.1–1.6 كلها PASS. |
| M2 — أساسيات CSS | **PASS** | 2.1–2.8 كلها PASS. |
| M3 — التفاعل والثيمات والاستجابة | **PASS** | 3.1–3.5 كلها PASS. |
| M4 — أساسيات JavaScript | **PASS** | 4.1–4.7 كلها PASS؛ 38/38 فحصاً ثابتاً، و160 دالة بدون dead code. |
| M5 — قراءة الـ API | **PARTIAL** | 5.1 و5.3–5.6 PASS؛ 5.2 PARTIAL لأن Postman/Apidog غير مُثبَّتين، لكن Console وNetwork مُختبَران. |
| M6 — الترقيم والعرضان | **PASS** | 6.1–6.6 كلها PASS؛ 67/67 وقياس 5000 منتج. |
| M7 — البحث مع Debounce | **PASS** | 7.1–7.3 كلها PASS؛ 60/60 وعدّادات حقيقية 8 input مقابل 1 filter. |
| M8 — الكتابة وتسجيل الدخول | **PASS** | 8.1–8.5 كلها PASS؛ 120/120 بعد إعادة التشغيل النهائية. |
| M9 — Browser Storage | **PASS** | 9.1–9.3 كلها PASS؛ 38/38. |
| متطلبات FakeStoreAPI | **PASS** | جميع نقاط PDF مُستخدَمة والمفارقات موثّقة. |
| خريطة التخزين | **PASS** | كل مفتاح في الصندوق الصحيح؛ لا كلمات مرور أو أسرار أو قائمة منتجات كاملة. |
| التسليم | **PARTIAL** | الملفات/README/الأدلة/الاختبارات PASS؛ سجل الـ commit FAIL وclone نهائي NOT TESTED. |
| المراجعة الفردية | **NOT TESTED** | المقابلة نفسها لم تجرِ؛ التحضير موجود في القسم 17. |
| الخصوصية والتخفيض | **PASS** | لا كلمات مرور أو توكنات أو أسماء مستخدمين أو قيم `Authorization` خام في الأدلة. |

---

## 2. Q1–Q7 — الكود المقروء (صفحة 4)

| البند | الحالة | الدليل والموقع | السبب/الاختبار |
|---|---:|---|---|
| Q1 أسماء تعبّر عن المعنى والفعل | **PASS** | `script.js:165` `createNode`، `:409` `apiRequest`، `:749` `renderProducts`، `:959` `loadProducts`، `:2278` `stressRender`؛ `evidence/m4/check-m4-output.json` | فحص "لا أسماء بحرف واحد": `found: none`. الدوال تبدأ بفعل، والمتغيرات المنطقية أسئلة مثل `isLoading` في `:1280`. |
| Q2 دالة واحدة لكل مهمة، بلا نسخ لاصق | **PASS** | `script.js:117–143` دوال التخزين، `:561–585` التصفية، `:707–747` الترقيم، `:1363–1411` تحقق النموذج، `:1484–1537` الإرسال؛ `evidence/m4/m4-deadcode-output.json` | `totalFunctions:160`، `unused:[]`؛ الحالات الكبيرة قُسّمت إلى `createCartRow`, `fillCardText`, `showFormWriteError` إلخ. |
| Q3 ثوابت بدل الأرقام السحرية | **PASS** | `script.js:12` `BASE_URL`، `:16` `SEARCH_DEBOUNCE_MS`، `:19` `THEMES`، `:45` `MAX_CART_QUANTITY`، `:48` `RECENT_SEARCH_LIMIT`، `:57–71` `KEYS` | لا `350` ولا مفاتيح تخزين مكتوبة يدوياً في منطق التطبيق؛ التغيير يتم من موضع واحد. |
| Q4 تعليقات تشرح لماذا، وتعليق سطر لكل دالة | **PASS** | أمثلة: `script.js:56`، `:228`، `:590`، `:927`، `:1431`، `:1804`، `:1817`، `:2271`؛ `evidence/m4/check-m4-output.json` | `Q4 one-line comment per function: PASS` مع `undocumented: none`. لا كود مُعلَّق ولا ملاحظات غامضة. |
| Q5 أسماء HTML/CSS بالمعنى وkebab-case | **PASS** | `style.css:357` `.btn`، `:787` `.card`، `:780` `.page-btn`، `:767` `.table-wrap`؛ `index.html:317` `per-page-select`، `:329` `view-grid` | لا أسماء مثل `.red` أو `.a1`؛ فحص M1 لم يجد `duplicateIds` أو زراً بلا `type`. |
| Q6 تنسيق متسق وترتيب ملفات ثابت، بلا كود ميت | **PASS** | `script.js:1–160` ثوابت/مساعدات، `:268–291` state، `:347–1043` عرض/رسائل، `:1059–2326` أحداث/منطق، `:2347` `init`؛ `evidence/m4/check-m4-output.json` و`m4-deadcode-output.json` | `Q6 file order: PASS`؛ `unused:[]`. تحذير Git الوحيد هو `LF will be replaced by CRLF` ولا يغيّر المحتوى. |
| Q7 لا إيهام بالاسم أو التعليق أو الرسالة | **PASS** | `script.js:962` يعرض الرابط الحقيقي، `:1000–1029` رسائل مرتبطة بحالة الاستجابة، `:1818–1834` `clearAuthState/logout` يمسحان فعلاً، `:1971` `finishOrder` يضع الطلب في ذاكرة التبويب فقط | الرسائل تقول "محاكى" حيث لا يُحفظ الطلب فعلياً؛ لا ادعاء بـ Postman أو حفظ المنتجات في المتصفح. |

---

## 3. G1–G5 — Git وGitHub (صفحة 7–8)

| البند | الحالة | الدليل | السبب |
|---|---:|---|---|
| G1 مستودع عام | **PASS** | فحص قراءة فقط لرابط `origin`: HTTP 200؛ `git remote -v` | المستودع عام وقابل للقراءة دون مصادقة. لم يُعد تعديله. |
| G2 local clone وليس ZIP | **PASS** | `git reflog`: `clone: from https://...` بتاريخ 2026-11-24؛ `git rev-parse --show-toplevel` | أول سجل للمجلد `clone`، فلا يمكن أن يكون ZIP مُنزَّلاً ثم `git init`. |
| G3 commit وpush بعد كل مرحلة | **FAIL** | `git log --oneline`: `9e2ab10`, `41c26d7`, `64fd28a` فقط؛ `git status --short` يُظهر تعديلات غير مُودَعة | لا يوجد commit لكل M1–M9. أُبقيت الحقيقة كما هي ولم أنشئ commits بأثر رجعي. |
| G4 استخدام `git pull` مرة | **FAIL** | `git reflog` لا يحتوي `pull` ولا `fetch` | لم تجرِ أي عملية سحب. |
| G5 clone نهائي في مجلد جديد وتشغيله | **NOT TESTED** | لا يوجد دليل؛ منع أي clone بدون موافقتك | حتى لو نجح، لا يجوز اختباره الآن لأنه يتطلب كتابة/شبكة. |

**حالة العمل الحالية (قراءة فقط):**

```text
 M README.md
 M api.html
 M index.html
 M script.js
 M style.css
?? HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf
?? evidence/
```

`HEAD`, `main`, `origin/main` و`origin/HEAD` كلها عند `9e2ab10`. أي أن نسخة Remote تقف قبل M5؛ الكود المُدقَّق محلي وغير مدفوع. **لم أنفّذ `git add` ولا `commit` ولا `push` ولا `pull` ولا `clone`.**

---

## 4. M1 — Structure: semantic HTML (صفحة 11)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 1.1 مستند صالح | **PASS** | `index.html:1,8,10,11,32,34,686` | doctype، `lang`، charset، viewport، title، CSS في head، `script defer`. |
| 1.2 معالم دلالية وh1 واحد | **PASS** | `index.html:48,75,145,148,202,297,284,387,155` | `evidence/m1/check-m1-output.json`: `h1:1`, `nav:3`, `aside:1`, `section:3`. |
| 1.3 العنصر الصحيح للوظيفة | **PASS** | `index.html:75,289,361` تنقّل؛ `:304,329,333` أزرار؛ `:246` `ul/li`؛ `script.js:165` لإنشاء العناصر | `categoryUl:true`, `footerUl:true`, `buttonsNoType:[]`. |
| 1.4 صور بـ alt وحجم/lazy ونماذج صحيحة | **PASS** | `index.html:413–450` قالب البطاقة؛ `:215` بحث، `:510–630` نماذج | `htmlImages:1`, `htmlImageIssues:[]`, `labelsNoFor:[]`, `buttonsNoType:[]`. صور الـ API تُبنى بـ `createElement` في `script.js:814`. |
| 1.5 hooks ووصولية | **PASS** | `script.js:803–842` `data-id` و`dataset.action`، `:670` أزرار بأسماء ثنائية اللغة، `style.css:301` `:focus-visible`، `:311` skip link | `duplicateIds:[]`؛ الترتيب المنطقي مُختبَر بلوحة المفاتيح في `evidence/final/runtime-tests.json`. |
| 1.6 template وdialog قابلان لإعادة الاستخدام | **PASS** | `index.html:413` template؛ `:451,460,510,560,636,658` ستة dialogs؛ `script.js:895–906` يستنسخ القالب | `templates:1`, `dialogs:6`, `jsUsesTemplate:true`. |

---

## 5. M2 — Look: CSS foundations (صفحة 12)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 2.1 `style.css` واحد منظّم، kebab-case، بلا inline styles | **PASS** | `style.css:1–24` تعليقات الأقسام؛ بقية الملف بأسماء مثل `.product-grid`, `.table-wrap` | `evidence/m1/check-m1-output.json` لم يجد أنماطاً مضمّنة؛ `check-vars-output.json` يغطي المتغيرات. |
| 2.2 المُحدِّدات والـ cascade | **PASS** | `style.css:246–295` عناصر/عام، `:357` صنف، `:781` سمة، `:768` سليل، `:172,209` attr selectors | تجاوزات الثيمات مبرّرة ومعزولة؛ `themeOverrides:26` وليست تعريفات مكررة في نفس النطاق. |
| 2.3 box model ووحدات | **PASS** | `style.css:246` `border-box`، `:758` `fr/minmax`، `:24–170` `rem`، `:158` `--touch-target` | لا تخطيط يعتمد على px ثابتة للعرض؛ px للحواف فقط. |
| 2.4 خطوط/ألوان/تباين/متغيرات | **PASS** | `style.css:24–170`، `:172–240`، `:209–240`، `:256` line-height؛ `evidence/m2/cdp-m2-output.txt` | تباين النص الخافت: light `4.66:1`، dark `5.44:1`؛ `undefined:[]`, `usedUnique:129`. |
| 2.5 Flexbox للمحاور الأحادية | **PASS** | `style.css:442` الهيدر، `:800+` تذييل البطاقة، `:700+` الـ chips | مُختبَر بصرياً في `evidence/final/chrome-1280-light.png` و`edge-320-light.png`. |
| 2.6 Grid للعرض ثنائي الأبعاد | **PASS** | `style.css:758` `repeat(auto-fill, minmax(14.875rem, 1fr))` | نفس الشبكة يستعملها `renderProducts` عند `script.js:749`. |
| 2.7 sticky/absolute/z-index مُبرَّرة | **PASS** | `style.css:415–420` sticky مع تعليق، `:791–825` شارة داخل بطاقة relative، `:310,383,563,578,1001` z-index مع تعليقات | التعليقات تشرح الطبقات: skip link 300، هيدر 100، شريط تقدّم 101، إشعارات 200. |
| 2.8 pseudo-classes/pseudo-elements ومعالجة العناوين الطويلة | **PASS** | `style.css:294,301,1183–1219`، `:380,817,1034` `::before/::after`، `:830+` قص العناوين | `evidence/final/runtime-tests.json` يغطي التركيز؛ `style.css:675` `.search-field:focus-within` صحيحة. |

---

## 6. M3 — Interaction, themes, responsive (صفحة 13)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 3.1 حالات hover/focus/active/disabled وانتقالات | **PASS** | `style.css:294,301,357–397,1181–1219` | `:focus-visible` يملك حدوداً واضحة؛ hover محصور في `@media (hover:hover)`؛ `:disabled` يغيّر الشكل؛ الانتقالات عبر متغيرات قصيرة. |
| 3.2 تحميل متحرك مع prefers-reduced-motion | **PASS** | `script.js:448` `showSkeleton`؛ `style.css:874–881,1042,1046,1222,1230` | `@keyframes shimmer/spin` يتوقفان صراحةً مع تقليل الحركة؛ `evidence/m3/cdp-m3-output.txt`. |
| 3.3 استجابة 320/768/1280 وقائمة هامبرغر | **PASS** | `index.html:11,69`؛ `style.css:1051–1167`؛ `script.js:347` `setupMenu` | `evidence/final/screenshots.json` 18 لقطة (3 أحجام × 3 ثيمات × متصفحين)؛ لا overflow أفقي في `evidence/final/runtime-tests.json`؛ أهداف اللمس ≥44px في `evidence/m2/cdp-m2-output.txt`. |
| 3.4 light/dark بمتغيرات وأول زيارة تتبع النظام | **PASS** | `style.css:24,172,209`؛ `script.js:313–342` `applyTheme/setupLanguageAndTheme` | `evidence/m3/cdp-m3-output.txt`: أول زيارة بدقة `dark` أعطت `stored:null`؛ الثيم المحفوظ ocean نجا من إعادة التحميل. |
| 3.5 ثلاث ثيمات قابلة للتبديل | **PASS** | `script.js:19` `THEMES = ['light','dark','ocean']`؛ `style.css:172,209` overrides للمتغيرات فقط | لا قواعد تخطيط تتغير بين الثيمات؛ `evidence/final` يغطي الثلاثة في المتصفحين. |

---

## 7. M4 — JavaScript fundamentals (صفحة 13–14)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 4.1 الأساسيات | **PASS** | `script.js:268–291`، `:561–585`، `:2071–2108` | `check-m4-output.json`: const=271، let=18، backticks=160، `===`=122، for...of=3، forEach=24. |
| 4.2 الدوال | **PASS** | `script.js:117,180,391,409` أمثلة؛ `:160+` تعريفات | declarations=147، expressions=3، arrows=134، returns=121، listeners=61؛ معاملات افتراضية في `createNode/createBilingual/toast/renderCartBadge/apiRequest`. |
| 4.3 المصفوفات والكائنات | **PASS** | `script.js:561,1076,1081,1209,1952` | `map/filter/find/some/includes/reduce` كلها مستخدمة؛ spread/rest=11، destructuring=3. |
| 4.4 الترتيب ومقارنته بخادم الـ API | **PASS** | `script.js:552–581` مقارنات محلية، `:521–529` `?sort=` للسيرفر، `:2137–2155` مفاتيح منفصلة | الترتيب المحلي على نسخة `result.sort(compare)`؛ الفرق موثّق في `README.md:68–82` و`evidence/m5/api-probe.json`. |
| 4.5 DOM | **PASS** | `script.js:165–197`، `:678–842`، `:895–906` | `querySelector(All)` و`createElement` و`append` و`textContent` و`classList` و`dataset`؛ `innerHTML` يظهر في التعليقات فقط (3 مرات). |
| 4.6 الأحداث والتفويض | **PASS** | `script.js:347`، `:851–906`، `:1256–1296`، `:1604–1629`، `:2071–2108` | click/input/submit/keydown و`preventDefault` وEscape؛ مستمع واحد للشبكة يقرأ `data-action` و`dataset.id`؛ `evidence/m4/cdp-m4-output.txt`: PASS. |
| 4.7 state واحد + render + أخطاء | **PASS** | `script.js:268–291`، `:749–802`، `:409–446`، `:990–1051`، `:2337–2345` | `state` واحد، `renderProducts/renderApp`، `try/catch/finally`، `response.ok`، `console.log/info/warn/error`؛ `check-m4`: 38/38. |

**حصيلة M4:** `evidence/m4/check-m4-output.json` = **38 PASS / 0 FAIL**؛ `m4-deadcode-output.json` = 160 دالة، `unused:[]`؛ `cdp-m4-output.txt` ينتهي بـ `M4 runtime delegation test: PASS`.

---

## 8. M5 — Reading and calling the API (صفحة 14–15)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 5.1 قراءة التوثيق وجدول الربط | **PASS** | `README.md:83–105`؛ `api.html`؛ `script.js:409–529` | `evidence/m5/api-docs-review.json`: 22 endpoint في HTML، 16 في المواصفة الرسمية، 10 يستخدمها التطبيق؛ 6 نقاط غير مذكورة في OpenAPI موثّقة. |
| 5.2 Postman/Apidog ثم Console ثم Network | **PARTIAL** | `evidence/m5/cdp-m5-api-output.txt`؛ `evidence/final/network-evidence.json` | **Console fetch وNetwork PASS:** 9/9 فحصاً، و13 endpoint نهائياً مع Headers/Status/Payload/Response. **Postman/Apidog NOT TESTED:** غير مُثبَّتين في البيئة؛ لا أدعاء باستخدامهما. |
| 5.3 GET /products والحالات الثلاث | **PASS** | `script.js:448,468,959–997`؛ `:2326` معمل الأخطاء | `evidence/m5/runtime-tests.json` = 9/9: Slow 3G skeleton ثم 20 بطاقة، انقطاع شبكة + retry، حالة فارغة، Console نظيف. |
| 5.4 المعاملات وبناء الروابط بأمان | **PASS** | `script.js:510–529`، `:12` | `buildProductsUrl` يستخدم `URLSearchParams`، و`apiRequest:411` يمنع أي origin غير `fakestoreapi.com`؛ الرابط المعروض في `index.html:285`. |
| 5.5 صفحة التفاصيل من `data-id` | **PASS** | `script.js:803`، `:851–867`، `:1698–1741` | `GET /products/1` ظهر في Network؛ 200 وعنوان وسعر صحيحان؛ حالة المعرّف غير الموجود/الفارغة مُختبرة. |
| 5.6 مفردات HTTP وثلاثة فروق على الأقل | **PASS** | `README.md:139–161`؛ `evidence/m5/api-docs-review.json`؛ `cdp-m5-api-output.txt` | الفروق: `rating` موجود في الاستجابة، POST يعطي 201، معرّف غير معروف يعطي 200 بجسم فارغ، 401 بنص عادي لا JSON، ونقاط categories غير موجودة في المواصفة. |

---

## 9. M6 — Browsing at scale (صفحة 15–16)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 6.1 ترقيم كامل و`aria-current` | **PASS** | `script.js:636–747`، `index.html:361` | previous/next وأرقام، الصفحة الحالية `[aria-current="page"]`، تعطيل الطرفين، نص `Showing 1-8 of 20`؛ `evidence/m6/runtime-tests.json` = 67/67. |
| 6.2 تحكم حجم الصفحة والعودة للصفحة 1 | **PASS** | `index.html:317`؛ `script.js:636,2212–2228`؛ عند `change` يُستدعى `goToFirstPage()`؛ الفلاتر والبحث والترتيب تفعل الشيء ذاته؛ `stress-test.json` يُظهر الاستعادة إلى 20. |
| 6.3 شبكة وجدول حقيقيان بنفس البيانات | **PASS** | `index.html:340–359`؛ `script.js:678–706,2203–2211` | `<table>` فيه `caption` و`thead` و`th scope` وصورة/عنوان/فئة/سعر/تقييم؛ `setViewMode` يبدّل العرض دون إعادة جلب. |
| 6.4 الجدول على الهاتف و`aria-pressed` | **PASS** | `style.css:767–772` `overflow-x:auto`؛ `index.html:329,333`؛ `script.js:2197–2201` | اللقطات عند 320px لا تُظهر overflow للصفحة؛ الزر الفعّال يحمل `aria-pressed="true"`. |
| 6.5 stress test لـ5000 | **PASS** | `script.js:2278–2316`؛ `evidence/m6/stress-test.json` | 5000 منتج: JS `214.9ms`، visual upper bound `13523.9ms`، 5000 بطاقة. صفحة من 20: JS `13.6ms`، visual `422ms`. أسرع `15.8×` و`32.05×`. الأرقام من التشغيل الأخير وتتغيّر بحمل الجهاز. |
| 6.6 قسم README عن التوسّع | **PASS** | `README.md:196–235` | يشرح ما ينكسر عند تحميل الكل، ويقارن `limit` المحلي بـ `page` الخادمي ويقترح `total` وصفحة واحدة لكل طلب؛ الأرقام مطابقة للملف الحقيقي. |

> **تنويه قياس صادق:** الأرقام قياس JS DOM داخل Chrome بواسطة `console.time` مع حد أعلى للرسم عبر `requestAnimationFrame` مزدوج؛ ليست نتيجة Lighthouse.

---

## 10. M7 — Search with debounce (صفحة 16)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 7.1 بحث بالعنوان والفئة مع عدد وحالة فارغة | **PASS** | `script.js:542–585`، `:468–476`، `:749–795` | `evidence/m7/debounce-tests.json`: `1 products`، `6 products`، `0 products` مع `No matches` و`Showing 0-0 of 0`. |
| 7.2 debounce يدوي بـ setTimeout/clearTimeout ≈350ms | **PASS** | `script.js:16`، `:2071–2108`؛ `style.css:675` | `SEARCH_DEBOUNCE_MS = 350`؛ `setTimeout` عند `:2103` مع إلغاء المؤقت السابق؛ لا مكتبات. إصلاح المسافة الزائدة في `:675` أعاد الفحص إلى 76/0. |
| 7.3 إثبات بعدد الأحداث مقابل التنفيذ | **PASS** | `script.js:2094–2104`؛ `evidence/m7/debounce-tests.json` | كتابة سريعة: `input events: 8` مقابل `filter runs: 1`؛ كتابة بطيئة: 3 مقابل 3؛ Enter: 3 مقابل 1؛ السجل `[StorePulse] Search stats ...`. المجموع **60 PASS / 0 FAIL**. |

---

## 11. M8 — Writing data and login (صفحة 16–17)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 8.1 POST /products بجسم JSON وتحقق وعرض المعرّف | **PASS** | `script.js:1363–1411`، `:1484–1537` | `Content-Type: application/json` وPayload في `evidence/final/network-evidence.json`؛ الاستجابة 201 ومعرّف جديد معروض؛ `evidence/m8/m8-add-result-*.png`. |
| 8.2 تعديل وحذف مع مربع تأكيد | **PASS** | `script.js:1287–1327`، `:1563–1603` | PUT/DELETE مع `askConfirmation`؛ Network يعرض 200 لكل؛ `m8-crud-result-*.png`. |
| 8.3 POST /auth/login وتوكن Bearer وتسجيل خروج | **PASS** | `script.js:1743–1931`، `:1786`، `:1841–1868`، `:1834` | تسجيل صحيح 201، خاطئ 401، طلب لاحق بـ `Authorization: Bearer [redacted]` مُختبر عبر `tokenPresent/bearerSent`، logout يمسح sessionStorage؛ القيم الحقيقية غير محفوظة. |
| 8.4 سلة بكمية ومجموع checkout | **PASS** | `script.js:1076–1226`، `:1939–2034` | `reduce` للمجموع، حد أقصى 99، إضافة/إزالة/تغيير كمية، `POST /carts` = 201 مع `{userId,date,products:[{productId,quantity}]}`؛ الطلب في ذاكرة التبويب فقط. |
| 8.5 معالجة 200/201/400/401/404/500/offline/رابط خاطئ/جسم فارغ/JSON غير صالح | **PASS** | `script.js:409–446`، `:1000–1051`، `:2326–2335` | `API_STATUS_MESSAGES` ورسائل مخصصة؛ `evidence/final/cdp-network-output.txt` 13 endpoint بحالات `200,201,401,404` المتوقعة؛ معمل الأخطاء يغطي البقية؛ Console النهائي `errors:[]`. |

**حصيلة M8 النهائية بعد إعادة التشغيل:** `evidence/m8/runtime-tests.json` = **120 PASS / 0 FAIL**. لقطات ما بعد الدخول تُخفِي اسم المستخدم بـ `[redacted]` عبر دالة الالتقاط في `evidence/m8/cdp-m8.js`، ثم أُعيد تشغيل الـ harness بنجاح.

---

## 12. M9 — Browser storage (صفحة 17)

| البند | الحالة | الموقع | الدليل |
|---|---:|---|---|
| 9.1 تطبيق خريطة التخزين بالضبط | **PASS** | `script.js:57–71`، `:72–160`، `:314–342`، `:587–607`، `:1068–1152`، `:1432–1446`، `:1871–1872`، `:2206–2219` | `ALLOWED_LOCAL_KEYS` و`ALLOWED_SESSION_KEYS` يمنعان أي مفتاح إضافي ويُنظّفان القديم عند البدء؛ `evidence/m9/storage-evidence.json`. |
| 9.2 دوال قراءة/كتابة صغيرة آمنة | **PASS** | `script.js:117–143` | `JSON.parse/stringify` داخل `try/catch` مع قيم افتراضية؛ `toSavedList` و`sanitizeCartItems` و`sanitizeRecentSearches` عند `:198–228`. |
| 9.3 عرض الاثنين في Application وتوقّع البقاء | **PASS** | `script.js:151–160`، `:1805–1872`؛ `evidence/m9/storage-evidence.json`، `evidence/m9/m9-after-browser-reopen-1280.png`، `evidence/m9/m9-independent-tab-1280.png` | **38 PASS / 0 FAIL**: reload، تبويب مستقل، إعادة فتح الملف الشخصي، ولقطات Application. استعادة جلسة تلقائية فعلية على متصفح حقيقي NOT TESTED، لكن سلوك `sessionStorage` مُختبَر عبر CDP. |

### الخريطة المنفَّذة مقابل المطلوب

| المطلوب | المكان | المفتاح/السلوك | الحالة |
|---|---|---|---:|
| اختيار الثيم | localStorage | `storepulse_theme` (`script.js:59,313–325`) — أول زيارة تتبع `prefers-color-scheme` دون كتابة مفتاح | PASS |
| المفضلة | localStorage | `storepulse_favorites` (`:60,1063–1072`) | PASS |
| السلة | localStorage | `storepulse_cart` (`:61,1115–1156`) | PASS |
| عمليات البحث الأخيرة (5) | localStorage | `storepulse_recent_searches` (`:62,606–635`) مع `RECENT_SEARCH_LIMIT=5` | PASS |
| اختيار grid/table | localStorage | `storepulse_view_mode` (`:63,2209–2215`) | PASS |
| حجم الصفحة | localStorage | `storepulse_page_size` (`:64,2225`) | PASS |
| توكن الدخول | sessionStorage | `storepulse_token` (`:66,1875`) ولا يُطبع أبداً | PASS |
| اسم المستخدم | sessionStorage | `storepulse_username` (`:67,1876`) ومُخفًّى في الأدلة | PASS |
| فلاتر category/sort/limit/search | sessionStorage | كائن واحد `storepulse_filters` (`:68,594–604`) | PASS |
| رقم الصفحة | sessionStorage | `storepulse_current_page` (`:69,590–593`) | PASS |
| مسودة إضافة غير مرسلة | sessionStorage | `storepulse_product_draft` (`:70,1436–1450`)؛ الإلغاء الصريح يمسحها، الإرسال الناجح يمسحها، وضع التعديل لا يكتبها | PASS |
| كلمات المرور/الأسرار/بيانات شخصية | nowhere | لا يوجد مفتاح؛ `login-password` يُرسل فقط ولا يُخزَّن (`script.js:1891–1931`) | PASS |
| قائمة المنتجات الكاملة | nowhere | `state.products` في الذاكرة فقط (`:270`)؛ `init` يجلبها من API (`:2347`) | PASS |
| الطلبات (قرار تنفيذي ضمن M8) | ذاكرة التبويب فقط | `state.orders` (`:285`)، `:2271` تعليق صريح، لا مفتاح تخزين | PASS |
| اللغة (افتراض `both`) | لا مفتاح افتراضيًا | `index.html:8`، `script.js:302–329` | PASS |

`evidence/m9/storage-evidence.json` و`README.md:355–441` يشرحان "لماذا هذا الصندوق وليس الآخر" لكل عنصر.

---

## 13. متطلبات FakeStoreAPI (صفحة 8–9)

الـ Base URL في `script.js:12` هو `https://fakestoreapi.com` فقط. لا backend، ولا قاعدة بيانات، ولا مكتبات، ولا مصادر بيانات أخرى.

| Endpoint | الحالة | الدليل |
|---|---:|---|
| `GET /products?limit=&sort=` | PASS | `script.js:521–529`؛ 200 في `cdp-m5-api-output.txt` و`network-evidence.json`؛ مفارقة `limit` قبل `sort` موثّقة. |
| `GET /products/{id}` | PASS | `script.js:1708–1741`؛ 200، وحالة 200 بجسم فارغ للمعرّف غير المعروف. |
| `GET /products/categories` | PASS | `script.js:510–519`؛ 200؛ غير مذكور في OpenAPI الرسمي لكنه مُختبَر. |
| `GET /products/category/{category}?limit=&sort=` | PASS | المسار + الاستعلام ظهران في Network؛ 200 و3 منتجات jewelery. |
| `POST /products` | PASS | 201 مع `{title,price,description,image,category}`؛ الرد يحمل `rating` ومعرّفاً جديداً. محاكى: لا حفظ دائم. |
| `PUT /products/{id}` | PASS | 200؛ جسم JSON؛ التعديل المحلي يُطبَّق على نسخة الجلسة. |
| `DELETE /products/{id}` | PASS | 200؛ إزالة محلية بعد تأكيد. |
| `POST /auth/login` | PASS | 201 صحيح، 401 خاطئ بنص عادي؛ التوكن يُحفظ في sessionStorage ويُرسل Bearer. |
| `POST /carts` | PASS | 201 بجسم `{userId,date,products:[{productId,quantity}]}`. |
| `GET /users` | PASS (للتحقق من شكل المستخدم فقط) | 200؛ لا قيم personally identifiable محفوظة في الأدلة. |
| رابط خاطئ | PASS | 404 متوقّعة في `cdp-network-output.txt`. |

**الفروق الحقيقية المسجّلة بين التوثيق والواقع:** `rating` موجود فعلاً، POST=201، معرّف غير موجود=200 بجسم فارغ، 401 كنص لا JSON، ونقاط categories/carts/user غير موجودة في OpenAPI رغم عملها. انظر `README.md:151–161` و`evidence/m5/api-docs-review.json`.

---

## 14. التسليم (صفحة 18)

| المتطلب | الحالة | الدليل |
|---|---:|---|
| `index.html`, `style.css`, `script.js` بلا setup | PASS | الملفات الثلاثة تعمل بفتح `index.html`؛ `README.md:29–38`. |
| `README.md` فيه ما/is/kيفية التشغيل/المزايا/ما تعلّمته | PASS | `README.md:1,16,29,39,442`؛ الأقسام الإضافية عند `:83,169,244,305,355,457,471,479`. |
| `evidence/` بصور مُسمَّاة حسب المرحلة | PASS | `evidence/m1` … `evidence/m9` و`evidence/final`؛ 18 صورة نهائية مُسمَّاة `chrome/edge-320/768/1280-light/dark/ocean.png`. |
| Network بـ Headers/Payload/Response لكل endpoint | PASS | `evidence/final/network-evidence.json` (13 endpoint) و`evidence/m8/network-evidence.json` و`evidence/m9/network-evidence.json`. |
| عيّنة Console نظيفة | PASS | `evidence/final/console-evidence.json`: `errors:[]`؛ `evidence/m5/runtime-tests.json`: consoleErrors/exceptions فارغان. |
| Application يُظهر التخزين | PASS | `evidence/m9/storage-evidence.json` وصور `m9-*-1280.png`. |
| ثلاثة عروض لكل ثيم | PASS | `evidence/final/screenshots.json` = 18 لقطة حقيقية. |
| اختبار بلوحة المفاتيح فقط | PASS | `evidence/final/runtime-tests.json` 76/76، يشمل focus menu/dialog/grid/pagination/skip link. |
| متصفحان | PASS | Chrome وEdge عبر CDP؛ Firefox NOT TESTED لغياب driver، لكن شرط "متصفحين" تحقق. |
| كود مقروء | PASS | القسم 2 أعلاه. |
| تاريخ commit واضح لكل مرحلة | **FAIL** | 3 commits فقط؛ Remote قبل M5؛ لا إعادة كتابة تاريخ. |

---

## 15. ملخص الاختبارات النهائية الفعلية

| الأداة | النتيجة |
|---|---|
| `node --check script.js` و`node --check` لكل cdp harness | PASS |
| `git diff --check` | PASS مع تحذير EOL فقط (`LF will be replaced by CRLF`) |
| `evidence/m1/check-m1.js` | `h1:1`, `nav:3`, `aside:1`, `section:3`, `dialogs:6`, `templates:1`, `duplicateIds:[]`, `cssBraceCounts:[437,437]` |
| `evidence/m2/check-vars.js` | `undefined:[]`, `duplicatesInSameScope:[]`, `themeOverrides:26`, `usedUnique:129` |
| `evidence/m2/cdp-m2.js` | لا overflow عند 320/768/1280؛ تباين 4.66/5.44؛ أهداف لمس OK |
| `evidence/m3/cdp-m3.js` | الثيمات/القائمة/sticky/تقليل الحركة/first-visit PASS |
| `evidence/m4/check-m4.js` | 38 PASS / 0 FAIL |
| `evidence/m4/m4-deadcode.js` | 160 دالة، `unused:[]` |
| `evidence/m4/cdp-m4.js` | event delegation PASS |
| `evidence/m5/cdp-m5-api.js` | 9/9 PASS |
| `evidence/m5/runtime-tests.json` | 9/9 PASS |
| `evidence/m6/runtime-tests.json` | 67/67 PASS |
| `evidence/m6/stress-test.json` | 5000 بطاقة؛ 214.9/13523.9 مقابل 13.6/422 ms |
| `evidence/m7/debounce-tests.json` | 60/60 PASS؛ 8 input → 1 filter |
| `evidence/m8/runtime-tests.json` | **120/120 PASS** بعد إعادة التشغيل |
| `evidence/m9/runtime-tests.json` | **38/38 PASS** بعد إعادة التشغيل |
| `evidence/final/runtime-tests.json` | **76/76 PASS** (كان 74/2 قبل إصلاح `style.css:675`) |
| `evidence/final/cdp-network.js` | 13 endpoint بالحالات المتوقعة، دون قيم حساسة |

### الإصلاحات أثناء التدقيق النهائي

1. `style.css:675`: صُحِّح `.search-field: focus-within` إلى `.search-field:focus-within`؛ أعاد فحص التركيز من 74/2 إلى **76/0** في `evidence/final/runtime-tests.json`.
2. `evidence/m8/cdp-m8.js` و`evidence/m9/cdp-m9.js`: أُضيف التقاط مُخفِّي لاسم المستخدم داخل اللقطات بعد الدخول؛ أُعيد تشغيلهم فبقيا 120/120 و38/38 دون تغيير سلوك التطبيق.
3. `README.md:196–235`: حُدِّثت أرقام الـ stress لتطابق `evidence/m6/stress-test.json` الحقيقي بدل أرقام قديمة.
4. `evidence/m5/m5-docs-data.json`: فُحص؛ يحتوي فقط على أسماء خصائص مخطط (`username/password/token`) وعنوان دعم عام في `info.contact.email`، ولا قيم أسرار. مسح متكرر على كل `evidence/` لأنماط بيانات الدخول والرموز المميزة أعطى **0 نتائج**.

---

## 16. القيود والعناصر غير المُختبَرة — صادقاً

| العنصر | الحالة | السبب |
|---|---:|---|
| Postman / Apidog | **NOT TESTED** | غير مُثبَّتين؛ استُبدل بـ Console fetch وNetwork CDP موثّقين. لذلك M5.2 PARTIAL. |
| Firefox | **NOT TESTED** | الملف موجود لكن لا driver متاح؛ شرط المتصفحين تحقق بـ Chrome وEdge. |
| جهاز لمس حقيقي / قارئ شاشة حقيقي | **NOT TESTED** | اختُبرت الأهداف والـ ARIA وkeyboard عبر CDP فقط. |
| Lighthouse / axe | **NOT TESTED** | لم يُشغَّلا؛ التباين قياس حسابي وCDP، لا تدقيق آلي خارجي. |
| استعادة جلسة تلقائية بعد إغلاق متصفح حقيقي | **NOT TESTED** | مُحاكاة عبر إعادة فتح ملف تعريف CDP في M9. |
| امتلاء فعلي بحجم 5MB | **NOT TESTED** | دوال التخزين مُختبَرة، لكن الحجم الكامل لم يُستنفد. |
| المقابلة الفردية نفسها | **NOT TESTED** | لم تجرِ بعد؛ التحضير أدناه. |
| Git commit/push/pull/clone إضافية | **NOT TESTED** | ممنوعة دون موافقتك صراحةً. |

---

## 17. التحضير للمراجعة الفردية (صفحة 18)

> هذه إجابات مبنية على الكود والأدلة الموجودة فعلاً، وليست سيناريوهات متخيّلة ولا تجارب شخصية مُدّعاة.

### 17.1 شرح ملفات حقيقية بأسطر حقيقية

| السؤال المتوقّع | الإجابة المختصرة | البديل / ماذا ينكسر إن حُذفت؟ |
|---|---|---|
| لماذا `state` واحد؟ | `script.js:268–291` يجمع products/view/filters/cart/auth في كائن واحد، و`renderApp:796` يعيد الرسم منه. | البديل Vue reactive؛ لو حُذف `renderApp` لظهرت بيانات قديمة بعد أي تغيير. |
| كيف تعمل طلبات API؟ | `apiRequest:409–446` يتحقق من origin عند `:411`، و`response.ok`، ويرمي أخطاء موحّدة. | البديل Axios في Laravel؛ لو حُذف فحص origin لأمكن إرسال طلب إلى نطاق آخر، ولو حُذف `response.ok` لعُدّ 401/404 نجاحاً. |
| الفرق بين `?limit=` و`pageSize`؟ | `:521–529` يبني رابط السيرفر؛ `:561–585` يقطع محلياً عبر `slice`؛ `:636–747` يرسم الصفحة. | البديل `?page=` خادمي لو دعمه الـ API؛ لو حُذف `pageSize` لظهرت كل النتائج دفعة واحدة. |
| لماذا Debounce؟ | `:2071–2108` يؤجل التنفيذ 350ms ويلغي المؤقت السابق. | البديل Throttle للتمرير؛ لو حُذف `clearTimeout` لأصبح كل حرف استعلام/بحث منفصلاً (8 بدل 1 في الدليل). |
| لماذا هذه الخريطة للتخزين؟ | `KEYS:57–71` و`readStorage/writeStorage:117–143` و`purgeConflictingStorageKeys:151–160`. | نقل الثيم إلى session يفقده عند إغلاق التبويب؛ نقل التوكن إلى localStorage يعرضه لتبويبات أخرى؛ حفظ كلمة المرور ممنوع. |
| كيف تعمل الكتابة؟ | `:1363–1411` تحقق، `:1484–1537` إرسال، `:1287–1327` تأكيد الحذف، `:1786` يضيف Bearer. | البديل PATCH للتعديل الجزئي؛ لو حُذفت `authHeaders` لرجع 401، ولو حُذفت confirm لحذف product بلا سؤال. |
| كيف تعمل الثيمات؟ | `THEMES:19`، `applyTheme:313–342`، `[data-theme]` في `style.css:172,209`. | إضافة ثيم جديد تعني متغيرات فقط؛ لو حُذفت المتغيرات لتبقى قواعد التخطيط صحيحة لكن الألوان كلها فاتحة. |
| لماذا template وdialog؟ | `index.html:413` و`:451–685`، مع `script.js:895` و`:1247–1296`. | البديل بناء DOM يدوي؛ لو حُذف القالب لتكرر كود البطاقة، ولو أُزيل `dialog` لفقد الإغلاق بـ Esc والتركيز المحبوس. |

### 17.2 تغييرات صغيرة حيّة مقترحة (كلها قابلة للتنفيذ محلياً)

1. غيّر `SEARCH_DEBOUNCE_MS` في `script.js:16` من `350` إلى `500` وأعد `evidence/m7/cdp-m7.js`؛ يجب أن تبقى النسبة input/filter متدنية.
2. غيّر `pageSize` الافتراضي في `script.js` عند `init` إلى `5` وافتح الصفحة؛ يجب أن يظهر `Showing 1-5 of 20` و`per-page-select` يعكس القيمة.
3. انقل `storepulse_theme` مؤقتاً من localStorage إلى sessionStorage في `script.js:59` و`:325`؛ بعد إغلاق التبويب سيعود الثيم للافتراض — هذا يشرح الخريطة عملياً.
4. أضف `:hover` بسيطاً داخل الكتلة الموجودة في `style.css:1183` ولاحظ أنه لا يُطبَّق على `(hover:none)`.
5. احذف سطر `writeFilters()` في `script.js:2087`؛ ستبقى الفلاتر ظاهرة بعد reload لكنها غير محفوظة في Application.

### 17.3 ما يُقال بوضوح في المقابلة

- الـ API يحاكي الكتابة؛ لا أدعي أن المنتجات تُحفظ فعلياً في FakeStoreAPI.
- لا توجد قاعدة بيانات ولا backend؛ `POST /carts` يُنشئ طلباً في ذاكرة التبويب فقط.
- Debounce محلي ولا يُرسل طلباً لكل حرف؛ الدليل عدد حقيقي.
- استخدمتُ OpenCode/AI كمساعد لتوليد ومراجعة الكود، ثم طلبتُ الشرح والتعديل؛ لا أدّعي خبرة Postman أو اختبار أجهزة حقيقية.
- سجل Git كما هو: 3 commits؛ المطلوب هو commit لكل مرحلة بعد موافقتك، لا تزوير تاريخ.
- لا توجد قيم دخول أو توكنات أو أسماء مستخدمين في الأدلة؛ كلها `[redacted]` أو `tokenPresent/bearerSent`.

---

## 18. الخاتمة

التطبيق من حيث **الوظيفة والكود والأدلة** جاهز للمراجعة: Q1–Q7 PASS، M1–M9 PASS عدا M5.2 PARTIAL، خريطة التخزين PASS، متطلبات API PASS، والتسليم التقني PASS باستثناء سجل Git.  
**ما يمنع اكتمال PDF رسمياً:** G3 FAIL، G4 FAIL، G5 NOT TESTED، وM5.2 PARTIAL. هذه حقائق حالية وليست ملاحظات شكلية.

**توقف هنا بانتظار مراجعتك. لم أنفّذ أي `git add` أو `commit` أو `push` أو `pull` أو `clone`.**
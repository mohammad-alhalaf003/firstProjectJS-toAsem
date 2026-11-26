# M5 — ملخص الأدلة والاختبارات الفعلية

المصدر: `HHRD_FrontEnd_Fundamentals_Requirements_Draft2.pdf` صفحتا 14–15 (5.1–5.6).

## الأدوات
- Google Chrome 158 headless عبر CDP (`Runtime.evaluate` = Browser Console، `Network`، `Fetch`، `Network.emulateNetworkConditions`).
- Postman / Apidog: **NOT TESTED** (غير مثبتين على الجهاز). لم يُدّعَ استخدامهما.
- السكربتات المستخدمة على هذا الجهاز (خارج المستودع):
  - `C:\Users\user\AppData\Local\Temp\opencode\cdp-m5-api.js`
  - `C:\Users\user\AppData\Local\Temp\opencode\cdp-m5-runtime.js`
  - `C:\Users\user\AppData\Local\Temp\opencode\m5-docs-compare.js`

## الملفات في هذا المجلد
| الملف | المحتوى |
|---|---|
| `api-probe.json` | 10 طلبات fetch حقيقية: Headers وPayload وPreview وResponse وTiming (Resource Timing) لكل endpoint مستخدم |
| `api-docs-review.json` | مقارنة 22 endpoint في `api.html` مقابل 16 endpoint في OpenAPI الرسمي |
| `runtime-tests.json` | 9 اختبارات تشغيل (تفاصيل من API، معاملات، Slow 3G، انقطاع شبكة، إعادة محاولة، حالات فارغة/خطأ) |
| `*.png` | لقطات لحالات التحميل والخطأ والقائمة الفارغة وشبكة الفئات |

## نتائج اختبارات M5
| الاختبار | النتيجة |
|---|---|
| `GET /products/{id}` يظهر في Network ويغذّي نافذة التفاصيل (200، title/price مطابقان لطلب مستقل) | PASS |
| `path=/products/category/electronics` مع `limit=20&sort=asc` في Query | PASS |
| Slow 3G: 8 skeletons + `aria-busy=true` ثم 20 بطاقة وبدون `aria-busy` | PASS |
| Slow 3G: تحميل التفاصيل (2 skeleton + `aria-busy`) ثم البيانات without busy | PASS |
| حجب `/products?` → رسالة خطأ + زر إعادة محاولة + بلا busy؛ رفع الحجب ثم الرجوع 20 بطاقة | PASS |
| حجب `/products/1` → خطأ داخل النافذة + إعادة محاولة تعيد العنوان الصحيح | PASS |
| استجابة 200 بجسم فارغ لمعرّف مفقود → "No product for this id" | PASS |
| فئة تُرجع `[]` → "Nothing here" وصفر بطاقات | PASS |
| Console: صفر أخطاء وصفر استثناءات | PASS |
| فحص الـ API (10 طلبات): 200 / 201 / 401 / 200-بجسم-فارغ كما سُجّل | PASS |

## الانحدار الكامل بعد التعديل
`node --check script.js`، `git diff --check`، `check-m1.js`، `check-vars.js`، `check-m4.js` (38/38)، `m4-deadcode.js` (93 دالة، 0 غير مستخدمة)، `cdp-m4.js`، `cdp-m2.js`، `cdp-m3.js`، `cdp-verify.js` عند 320 / 768 / 1280: كلها PASS بصفر أخطاء console، 20 بطاقة، 5 شرائح، ولا overflow.

## لم يُختبر
Postman / Apidog، Firefox / Edge، جهاز لمسي حقيقي، قارئ شاشة حقيقي، Slow 3G على شبكة فعلية (استُخدمت محاكاة DevTools)، Lighthouse، axe.

## الخصوصية
بيانات الدخول والتوكينات مُخفاة في `api-probe.json`؛ لا توجد كلمات مرور أو توكنات في الأدلة أو في README.

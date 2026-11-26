# M7 — ملخص الأدلة والاختبارات الفعلية

المصدر: PDF صفحة 16، المتطلبات 7.1–7.3.

## الأدوات
- Google Chrome headless عبر CDP (`Runtime.evaluate`، `Network.requestWillBeSent`، `Page.captureScreenshot`، `Emulation.setDeviceMetricsOverride`).
- السكربت خارج المستودع: `C:\Users\user\AppData\Local\Temp\opencode\cdp-m7.js`.

## الملفات
| الملف | المحتوى |
|---|---|
| `debounce-tests.json` | 60 فحصاً عند 320 / 768 / 1280: بحث العنوان/الفئة، case-insensitive، العربية، عدد النتائج، Empty state، التكامل مع الترقيم والفئة والترتيب والـ limit والعرضين، العدّادات، صفر طلبات API، Console |
| `search-fast-320.png`, `search-fast-768.png`, `search-fast-1280.png` | نتيجة البحث السريع `backpack` |
| `search-empty-320.png`, `search-empty-768.png`, `search-empty-1280.png` | Empty state بعد `zzzz-no-match` |
| `search-table-320.png`, `search-table-768.png`, `search-table-1280.png` | نفس البحث داخل Table view |

## أرقام العدّادات الحقيقية
| الحالة | input events | filter runs |
|---|---:|---:|
| كتابة سريعة `backpack` (40ms/حرف) | 8 | 1 |
| كتابة بطيئة `bag` (450ms/حرف) | 3 | 3 |
| كتابة سريعة `bag` ثم Enter | 3 | 1 (سطر `(Enter)` واحد) |
| طلبات `/products` أثناء البحث وEnter | — | 0 |

السطر المطبوع فعلياً في Console:
`[StorePulse] Search stats (debounce) — input events: 8, filter runs: 1`

## النتائج
| البند | النتيجة |
|---|---|
| 60/60 فحص M7 | PASS |
| صفر أخطاء Console | PASS |
| صفر طلبات API أثناء البحث (محلي بالكامل) | PASS |
| إعادة تشغيل M1–M6 بعد التعديل | PASS |

## ملاحظة على التشغيل الأول
أول تشغيل أعطي 51/57 بسبب توقّعات خاطئة في سكربت الاختبار نفسه (كان يفترض 6 بطاقات بينما Per Page=5، ويفترض 5 منتجات بينما `limit=5` يُرجع منتجاً واحداً يطابق `backpack`). لم تكن هناك مشكلة في التطبيق؛ صُحّحت التوقّعات وأضيف فحص أقوى يثبت أن البحث لا يجد منتجاً خارج الـ `limit`. التشغيل النهائي 60/60.

## NOT TESTED
Firefox / Edge، جهاز لمسي حقيقي، قارئ شاشة حقيقي، Lighthouse، axe، Postman / Apidog (غير مثبتين)، ومستخدم حقيقي يكتب بلوحة مفاتيح فعلية (استُخدمت أحداث DOM عبر CDP).

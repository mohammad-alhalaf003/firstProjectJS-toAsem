# M6 — ملخص الأدلة والاختبارات الفعلية

المصدر: PDF صفحتا 15–16، المتطلبات 6.1–6.6.

## الأدوات
- Google Chrome headless عبر CDP (`Runtime.evaluate`، `Page.captureScreenshot`، `Emulation.setDeviceMetricsOverride`).
- السكربتات على هذا الجهاز (خارج المستودع): `cdp-m6.js` و`cdp-m6-stress.js`.

## الملفات
| الملف | المحتوى |
|---|---|
| `runtime-tests.json` | 67 اختباراً عند 320 / 768 / 1280: ترقيم، Per Page، إعادة للصفحة 1، Grid/Table، حفظ/استعادة، حالات فارغة، Console |
| `stress-test.json` | أرقام 5000 منتج مقابل صفحة 20، مع `console.time` وdouble-rAF وحالة الاسترجاع |
| `grid-320.png`, `grid-768.png`, `grid-1280.png` | لقطات Grid |
| `table-320.png`, `table-768.png`, `table-1280.png` | لقطات Table مع التمرير داخل الحاوية |
| `stress-5000.png`, `stress-page20.png` | لقطتا اختبار الأداء |

## النتائج
| البند | النتيجة |
|---|---|
| 67/67 اختبار M6 | PASS |
| 38/38 `check-m4.js` | PASS |
| 109 دوال، 0 غير مستخدمة (`m4-deadcode.js`) | PASS |
| `check-m1.js` / `check-vars.js` / `node --check` / `git diff --check` | PASS |
| `cdp-m4.js` / `cdp-m2.js` / `cdp-m3.js` / `cdp-verify.js` عند 320 / 768 / 1280 | PASS |
| M5 `cdp-m5-runtime.js` 9/9 و`cdp-m5-api.js` | PASS |

## Stress (التشغيل الأخير المسجّل)
| السيناريو | `console.time` | double-rAF |
|---|---:|---:|
| 5000 دفعة واحدة | 133.97 ms | 3867.7 ms |
| صفحة من 20 | 0.78 ms | 55.2 ms |

بعد الاختبار عاد التطبيق إلى 20 بطاقة حقيقية من الـ API وصفر أخطاء Console.

## NOT TESTED
Firefox / Edge، جهاز لمسي حقيقي، قارئ شاشة حقيقي، Lighthouse، axe، Postman / Apidog (غير مثبتين)، Slow 3G على شبكة فعلية، شبكة 5000 منتج حقيقية من خادم.

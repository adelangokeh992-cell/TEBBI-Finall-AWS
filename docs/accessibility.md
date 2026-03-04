# إمكانية الوصول (Accessibility) — TEBBI

التطبيق يستهدف **WCAG 2.1 Level AA** حيث أمكن، مع دعم لوحة المفاتيح وقارئات الشاشة.

## تباين الألوان (WCAG 2.1)

- **النص العادي:** نسبة التباين 4.5:1 على الأقل بين النص والخلفية.
- **النص الكبير:** (18px عادي أو 14px عريض) نسبة 3:1 على الأقل.
- الباليت المعرّفة في [frontend/src/index.css](TEBI--main/frontend/src/index.css) (`:root` و `.dark`) تستخدم ألواناً مناسبة؛ يُنصح بقياس التباين عند إضافة ألوان جديدة (أدوات: WebAIM Contrast Checker، أو DevTools).
- عدم الاعتماد على اللون وحده لتمييز المعلومات (مثلاً استخدام نص أو أيقونة مع اللون).

## ما تم تطبيقه

- **أزرار وروابط:** Radix/shadcn مكونات تستخدم نصوص أو تسميات؛ أضف `aria-label` لأزرار الأيقونة فقط. أهداف اللمس: الحد الأدنى 44×44 px للعناصر التفاعلية.
- **ربط Labels:** مكونات النماذج (Form, Input, Label من Radix) تربط الحقول تلقائياً؛ عند الحقول المخصصة ربط رسائل الأخطاء بـ `aria-describedby` و`aria-invalid`.
- **التنقل بلوحة المفاتيح:** كل الإجراءات ممكنة بـ Tab و Enter و Escape. النوافذ المنبثقة (Dialog من Radix) تحتوي على focus trap وإرجاع التركيز عند الإغلاق.
- **مؤشر التركيز:** استخدام `:focus-visible` في [frontend/src/index.css](TEBI--main/frontend/src/index.css) لعرض حدود واضحة عند التنقل بلوحة المفاتيح؛ لا تُزَل الـ outline.
- **تكبير النص:** أحجام الخطوط بـ `rem` و`%`؛ الصفحة لا تقص النص عند تكبير المتصفح.
- **صور ورسوم:** إضافة `alt` يصف المحتوى لكل صورة؛ إن كانت طبية: النوع، التاريخ، والنتيجة إن لزم.
- **تنبيهات ديناميكية:** مكون Toast (Sonner) مع `role="status"` و`aria-live="polite"`.

## الرسوم البيانية (Recharts)

- الصفحات التي تستخدم Recharts (مثلاً لوحة إدارة العيادة): إضافة وصف للنقاط/السلسلة عبر `aria-label` أو `role="img"` و `aria-label` للحاوية عند الإمكان.
- توفير بديل نصي للبيانات الأساسية (جدول أو قائمة ملخصة) أو ضمان تنقل بلوحة المفاتيح للعناصر التفاعلية في الرسم حسب WCAG للرسوم البيانية.

## الاختبار

- **axe:** تشغيل **axe-core** يدوياً (axe DevTools في المتصفح) أو في الاختبارات عبر **jest-axe** (مثلاً [App.test.js](TEBI--main/frontend/src/App.test.js), [LoginPage.test.js](TEBI--main/frontend/src/pages/LoginPage.test.js), [Layout.test.js](TEBI--main/frontend/src/components/Layout.test.js)).
- **التنقل بلوحة المفاتيح:** تجربة Tab و Enter و Escape في الصفحات الحرجة.
- **قارئ الشاشة:** اختبار اختياري مع NVDA أو VoiceOver.

لإضافة فحص axe في اختبار جديد: `import { axe, toHaveNoViolations } from 'jest-axe'; expect.extend(toHaveNoViolations);` ثم `expect(await axe(container)).toHaveNoViolations();`.

# TEBBI — نظام إدارة العيادات الطبية

**TEBBI** هو نظام لإدارة العيادات الطبية يدعم إدارة المرضى والمواعيد والفواتير والصيدلية والتحليلات بالذكاء الاصطناعي، مع دعم تعدد العيادات والصلاحيات وواجهة عربية/إنجليزية.

---

## المتطلبات

- **Node.js** 18 أو أحدث (للواجهة الأمامية)
- **Python** 3.11+ (للخادم)
- **MongoDB** (محلي أو بعيد)
- **Yarn** (أو npm) لإدارة حزم الواجهة

---

## كيفية التشغيل

### 1. Backend (الخادم)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# عدّل .env بالقيم المناسبة (انظر متغيرات البيئة أدناه)
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

الـ API يعمل على: `http://localhost:8000`

### 2. Frontend (الواجهة)

```bash
cd frontend
yarn install
yarn start
```

الواجهة تعمل على: `http://localhost:3000` (والـ proxy يوجّه طلبات الـ API إلى المنفذ 8000).

---

## متغيرات البيئة (Backend)

انسخ [backend/.env.example](backend/.env.example) إلى `backend/.env` وعدّل القيم.

| المتغير | الوصف |
|--------|--------|
| `MONGO_URL` | رابط اتصال MongoDB (مثال: `mongodb://localhost:27017`) |
| `DB_NAME` | اسم قاعدة البيانات (مثال: `tebbi`) |
| `JWT_SECRET` | **مهم:** سر توقيع JWT. في الإنتاج استخدم قيمة عشوائية قوية (32+ حرف). مثال توليد: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | مفتاح تشفير الحقول الحساسة (32+ حرف). إن لم يُضبط يُستمد من JWT_SECRET (غير موصى به في الإنتاج). |
| `OPENAI_API_KEY` | مفتاح OpenAI لجميع ميزات الذكاء الاصطناعي (الأعراض، الصور، التقارير). |
| `CORS_ORIGINS` | منشأ الواجهة المسموح (مثال: `http://localhost:3000,http://127.0.0.1:3000`) |
| `PRODUCTION` | إن وُجد (مثل `1` أو `true`) يتم إخفاء واجهة توثيق API (`/docs`, `/redoc`) في الإنتاج. |

---

## توثيق API

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

في Swagger/ReDoc تظهر المجموعات التالية مع وصف عربي:

| المجموعة | الوصف |
|----------|--------|
| Auth | تسجيل الدخول، التسجيل، تغيير كلمة المرور، MFA، تسجيل الخروج |
| Health | Liveness و Readiness للـ Docker/K8s |
| Users | المستخدمون والأدوار والصلاحيات |
| Patients | المرضى، الحساسيات، التشخيصات، الأدوية، الصور الطبية |
| Appointments | المواعيد، الطابور، الجلسات عن بُعد |
| Invoices | الفواتير، المصروفات، المحاسبة |
| Consent | نماذج الموافقة وتوقيعها |
| Inventory | المخزون والصيدلية |
| Companies | الشركات/العيادات، الاشتراكات، الموظفون، النسخ الاحتياطي |
| Audit | سجلات التدقيق للوصول إلى البيانات |
| AI | تحليل الأعراض، الصور، التقارير، التنبيهات |
| Public | الحجز العام، العيادات، الأطباء، المراجعات |
| Portal | بوابة المريض والمواعيد والرسائل |
| Notifications | الإشعارات والإعدادات |

في بيئة الإنتاج (عند ضبط `PRODUCTION`) يمكن إخفاء `/docs` و `/redoc` تلقائياً. يُنصح بعدم تعريضهما للإنترنت دون حماية.

---

## الأمان والبيانات الحساسة

- **الأسرار:** لا توضع أبداً كلمات سر أو مفاتيح API أو روابط قواعد بيانات داخل الكود. كل القيم الحساسة تأتي من متغيرات البيئة (`.env`) أو نظام إدارة أسرار. لا يُرفع `.env` إلى Git. انظر [docs/secrets.md](docs/secrets.md).
- **تشفير في الراحة:** الحقول الحساسة (هاتف المريض، هاتف الطوارئ، عناوين، حالات مزمنة، هواتف الشركة/الموظفين، توكن Twilio، مفاتيح API) تُخزّن مشفّرة ([crypto_utils](backend/crypto_utils.py)، [docs/encryption.md](docs/encryption.md)). استخدم `ENCRYPTION_KEY` في `.env` بقيمة قوية (32+ حرف) في الإنتاج.
- **النقل:** في الإنتاج يجب تقديم الـ API والواجهة عبر **HTTPS** فقط (عبر reverse proxy مثل Nginx، انظر [deploy/](deploy/)). لا تعرّض المنفذ 8000 أو 3000 مباشرة للإنترنت دون TLS.

---

## إمكانية الوصول (Accessibility)

يُنصح لاستخدام النظام في بيئات رعاية صحية استهداف **WCAG 2.1 Level AA** (ومراجعته في **Section 508** إن كان مطلوباً): تباين ألوان كافٍ (نص عادي 4.5:1)، دعم لوحة المفاتيح وترتيب focus، وتسميات ARIA للعناصر التفاعلية وقارئات الشاشة. المشروع يستخدم `eslint-plugin-jsx-a11y` و **jest-axe** في الاختبارات لفحص انتهاكات إمكانية الوصول.

---

## الاختبارات

- **Backend:** من جذر المشروع: `cd backend && pytest tests -v`
- **Frontend:** `cd frontend && yarn test --watchAll=false`

---

## Docker (تطوير/نشر موحد)

- **تشغيل Backend + MongoDB فقط:** من جذر المشروع (`TEBI--main`):
  ```bash
  docker-compose up -d
  ```
  الـ API على: `http://localhost:8000`، و MongoDB على المنفذ 27017.
- **بناء صورة Backend:** `docker build -t tebbi-backend ./backend`
- **بناء صورة Frontend:** `docker build -t tebbi-frontend ./frontend`
- متغيرات البيئة في `backend/.env` أو عبر `CORS_ORIGINS`, `JWT_SECRET` في docker-compose.

---

## البنية

- `backend/` — خادم FastAPI (Python)، قاعدة البيانات MongoDB، المصادقة، الـ API.
- `frontend/` — تطبيق React (واجهة المستخدم).
- `backend/routers/` — مسارات منفصلة (مثل المصادقة).
- `backend/tests/` — اختبارات الـ API.
- `frontend/src/utils/translations.js` — ترجمات ar/en؛ يُنصح بأن تأتي **كل** النصوص القابلة للعرض من هنا (دالة `t(ar, en)` من AuthContext أو `t(key, lang)` من الترجمات). عند إضافة صفحة أو مكون جديد، استخدم `t()` أو مفاتيح من `translations.js` واجتنب النص الثابت المضمّن.
- `frontend/src/hooks/useTranslations.js` — هوك للترجمة خارج AuthContext (مثلاً الصفحات العامة).
- [docs/audit.md](docs/audit.md) — سياسة سجلات التدقيق والاحتفاظ (retention).
- [docs/fhir-mapping.md](docs/fhir-mapping.md) — تماثل كيانات المريض والموعد مع HL7 FHIR R4 (للتكامل المستقبلي).

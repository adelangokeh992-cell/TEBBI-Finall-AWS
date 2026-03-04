# نشر TEBBI (Deploy)

## نظرة عامة

- الـ **Backend** (FastAPI) يُبنى ويُصدَّر كصورة Docker إلى GHCR عبر [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) عند الدفع إلى `main`.
- على السيرفر (مثلاً EC2 أو VPS): سحب الصورة، تشغيل الحاويات مع متغيرات البيئة/الأسرار، وإعادة التشغيل عند التحديث.
- **Nginx** ينهي TLS ويوجّه `/api/` و`/api/health/` إلى الـ backend؛ يمكن توجيه `/` إلى حاوية الـ frontend عند استخدام بنية كاملة.

---

## سحب الصورة وتشغيل الخدمة على السيرفر

1. **تسجيل الدخول إلى Container Registry (GHCR):**
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   ```
   (استخدم Personal Access Token أو GITHUB_TOKEN مع صلاحية `read:packages`.)

2. **سحب الصورة وتشغيل الـ backend:**
   ```bash
   docker pull ghcr.io/OWNER/tebbi-backend:latest
   docker run -d --name tebbi-backend \
     -e MONGO_URL="mongodb://..." \
     -e DB_NAME=tebbi \
     -e JWT_SECRET="your_strong_secret_32_chars_minimum" \
     -e ENCRYPTION_KEY="your_encryption_key_at_least_32_bytes" \
     -e CORS_ORIGINS="https://your-frontend-domain.com" \
     -e PRODUCTION=true \
     -p 8000:8000 \
     ghcr.io/OWNER/tebbi-backend:latest
   ```
   أو استخدم `docker-compose`: انسخ/عدّل `docker-compose.yml` في المشروع، وضبط المتغيرات في `.env` أو في الـ compose، ثم:
   ```bash
   docker-compose pull backend
   docker-compose up -d backend
   ```

3. **إعادة التشغيل بعد تحديث الصورة:**
   ```bash
   docker-compose pull backend && docker-compose up -d backend
   ```
   أو مع `docker run`: أوقف الحاوية القديمة، اسحب `latest` ثم شغّل من جديد كما أعلاه.

4. **الأسرار:** لا تضع `JWT_SECRET` أو `ENCRYPTION_KEY` في الكود. استخدم متغيرات بيئة من ملف آمن أو من مدير أسرار (مثلاً AWS Secrets Manager، HashiCorp Vault) وحقنها عند التشغيل.

---

## Nginx — تشفير النقل (HTTPS)

- الملف `nginx.conf` يوجّه كل الطلبات إلى HTTPS (منفذ 443) ويعيد توجيه HTTP (80) إلى HTTPS.
- إنهاء TLS يتم عند Nginx؛ الخادم الخلفي (FastAPI) لا يُعرّى مباشرة على الإنترنت.
- يُفضّل استخدام **TLS 1.3** (مدعوم في الإعداد الحالي مع TLS 1.2).
- رؤوس الأمان: HSTS، X-Frame-Options، X-Content-Type-Options، X-XSS-Protection، Referrer-Policy، Content-Security-Policy (يمكن تخفيف CSP حسب احتياجات الواجهة).

### شهادات SSL

ضع الشهادات في مجلد (مثلاً `./deploy/ssl/`):

- `cert.pem` — الشهادة
- `key.pem` — المفتاح الخاص

ثم اربط المجلد عند التشغيل: `-v $(pwd)/deploy/ssl:/etc/nginx/ssl:ro`

للتنمية المحلية يمكن استخدام شهادة ذاتية التوقيع:

```bash
mkdir -p deploy/ssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout deploy/ssl/key.pem -out deploy/ssl/cert.pem -subj "/CN=localhost"
```

للإنتاج: استخدم Let's Encrypt (مثلاً certbot) لتوليد الشهادات وتجديدها تلقائياً.

### تشغيل Nginx مع الـ backend

من جذر المشروع مع تفعيل profile `with-nginx`:

```bash
docker-compose --profile with-nginx up -d
```

---

## Frontend و Nginx (إنتاج كامل)

لخدمة واجهة React من حاوية منفصلة بدلاً من الـ backend:

1. **تفعيل خدمة الـ frontend في `docker-compose.yml`:**
   - إزالة التعليق عن خدمة `frontend` (build من `./frontend`، expose 80).
   - إضافة الـ frontend إلى `depends_on` لـ nginx إن لزم.

2. **تعديل `deploy/nginx.conf`:**
   - تعليق الـ `location /` الحالية التي توجّه إلى `backend:8000`.
   - إلغاء التعليق عن الـ block الذي يوجّه `location /` إلى `proxy_pass http://frontend:80;`.
   - الإبقاء على `location /api/` و `location /api/health/` موجّهة إلى الـ backend.

بعد ذلك يصبح Nginx يخدم الواجهة الثابتة من الـ frontend ويمرّر طلبات الـ API إلى الـ backend.

---

## أتمتة النشر (CD) إلى سيرفر عبر SSH

لأتمتة النشر إلى EC2 أو أي سيرفر بعد دفع الصورة إلى GHCR:

1. إضافة **Secrets** في المستودع:
   - `DEPLOY_SSH_HOST`: عنوان السيرفر (اسم النطاق أو IP، بدون المستخدم)
   - `DEPLOY_SSH_USER`: مستخدم SSH (مثلاً `ec2-user` لـ Amazon Linux)
   - `DEPLOY_SSH_KEY`: المحتوى الكامل لمفتاح SSH الخاص (.pem) للاتصال بالسيرفر

2. إضافة job في `.github/workflows/deploy.yml` يعتمد على `build-backend` ويستخدم `appleboy/ssh-action`:
   - الاتصال عبر SSH باستخدام الـ secrets أعلاه.
   - تنفيذ أوامر على السيرفر، مثلاً: `docker pull ghcr.io/.../tebbi-backend:latest && docker-compose up -d backend` (أو أوامر مشابهة حسب بنية السيرفر).

3. يمكن جعل هذا الـ job يعمل فقط عند دفع tag (مثلاً `v*`) أو عند `workflow_dispatch` لتجنّب النشر التلقائي عند كل دفع إلى `main` إن رغبت.

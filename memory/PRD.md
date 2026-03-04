# Tebbi Medical System - PRD (Multi-Tenant SaaS)

## Original Problem Statement
بناء نظام SaaS طبي شامل للبيع للمستشفيات والعيادات

## Architecture
- **Backend:** FastAPI + MongoDB + Motor + APScheduler (background jobs) + Twilio
- **Frontend:** React + Tailwind + shadcn/ui + Axios
- **Multi-Tenant:** Data isolation via `company_id` on all queries

---

## ✅ All Completed Features

### 1. Public Landing Page (`/`)
- صفحة رئيسية مع Hero، تخصصات، أطباء
- حجز أونلاين للمرضى

### 2. Multi-Tenant SaaS System

#### Super Admin Dashboard (`/super-admin`)
- تصميم احترافي داكن
- **توجيه تلقائي بعد تسجيل الدخول حسب الدور:** ✅ NEW
  - Super Admin → `/super-admin`
  - Company Admin → `/clinic-admin`
  - Doctor → `/dashboard`

#### صفحة الأطباء المُحسّنة ✅ NEW
- **فلترة حسب:**
  - البحث بالاسم أو البريد
  - الاختصاص (قلب، أطفال، جلدية، ...)
  - العيادة/المشفى
- **زر تعديل** لكل طبيب (يظهر عند hover)
- **عرض سعر الكشفية** لكل طبيب

#### إدارة العيادات والمشافي
- صفحة تفاصيل شاملة لكل عيادة:
  - **المعلومات:** الاسم، البريد، الهاتف، العنوان
  - **الموظفين:** ✅ UPDATED
    - عرض سعر الكشفية بجانب كل طبيب
    - زر تعديل لكل موظف
    - Dialog تعديل مع حقول: الاسم، الهاتف، الاختصاص، سعر الكشفية
  - **الاشتراك:** حالة الاشتراك، تمديد الاشتراك
  - **الميزات:** تفعيل/تعطيل الميزات لكل عيادة
  - **الصلاحيات:** صلاحيات مخصصة لكل دور
  - **النسخ الاحتياطي:** إنشاء/استعادة/حذف نسخ احتياطية

### 3. لوحة تحكم مدير العيادة (`/clinic-admin`)
**3 تابات:**
1. **الحجوزات:** إدارة حجوزات المرضى (تأكيد، إلغاء، إتمام)
2. **الموظفين:** إضافة/حذف موظفين
3. **الإعدادات:** إعدادات الإشعارات الكاملة

### 4. نظام الإشعارات SMS/WhatsApp
**إعدادات Twilio:**
- Account SID
- Auth Token (مخفي)
- رقم هاتف Twilio
- رقم WhatsApp
- زر "ربط المفتاح" للتحقق من الاتصال

### 5. التذكير التلقائي
- **Switch** لتفعيل/تعطيل التذكير التلقائي
- **خيارات الوقت:** 1، 2، 6، 12، 24، 48 ساعة قبل الموعد
- **طريقة الإرسال:** SMS فقط، واتساب فقط، SMS + واتساب
- **Background Task** يعمل كل ساعة

### 6. قوالب الرسائل المخصصة
**4 قوالب:**
1. رسالة تأكيد الحجز
2. رسالة التذكير
3. رسالة إلغاء الحجز
4. رسالة بعد الزيارة

**المتغيرات:**
- `{patient_name}`, `{clinic_name}`, `{doctor_name}`
- `{date}`, `{time}`, `{confirmation_code}`

### 7. النسخ الاحتياطي والاستعادة
- إنشاء نسخة احتياطية يدوية
- عرض قائمة النسخ مع الحجم والتاريخ والحالة
- استعادة نسخة احتياطية (Super Admin فقط)
- حذف نسخة احتياطية

### 8. عزل البيانات (Data Isolation)
- جميع الـ queries تتضمن `company_id`
- كل عيادة ترى بياناتها فقط

### 9. AI Features
- تحليل الأعراض
- تحليل الصور/الأشعة
- التداخلات الدوائية
- تقارير AI
- مساعد AI Chat
- التنبيهات الذكية

---

## Key API Endpoints

### User Management
- `PUT /api/users/{id}` - تحديث بيانات المستخدم (super_admin فقط) ✅ NEW
  - Fields: name, name_ar, specialty, consultation_fee, phone, company_id

### Backup APIs
- `POST /api/companies/{id}/backups` - إنشاء نسخة
- `GET /api/companies/{id}/backups` - جلب قائمة النسخ
- `POST /api/companies/{id}/backups/{backup_id}/restore` - استعادة
- `DELETE /api/companies/{id}/backups/{backup_id}` - حذف

### Notification Settings APIs
- `GET /api/companies/{id}/notification-settings`
- `POST /api/companies/{id}/notification-settings`
- `POST /api/companies/{id}/test-notification`

---

## Demo Credentials
- **Super Admin:** superadmin@tebbi.com / super123 → redirects to `/super-admin`
- **Doctor/Admin:** doctor@tebbi.com / doctor123 → redirects to `/dashboard`
- **Demo Company ID:** 355b4886-2ec0-41c6-bab3-57ac4ec85294

---

## Testing Status

### Iteration 6 (Latest)
- **Backend:** 100% (13/13 tests passed)
- **Frontend:** 100% verified
- **Test Files:** 
  - `/app/backend/tests/test_iteration6_features.py`
  - `/app/test_reports/iteration_6.json`

### Features Verified:
- ✅ Role-based login redirect
- ✅ Doctors page filters (search, specialty, company)
- ✅ Doctor edit dialog with consultation fee
- ✅ Staff section with fee display and edit button
- ✅ PUT /api/users/{id} endpoint

---

## Known Mocked APIs
- **Twilio SMS/WhatsApp:** الإرسال الفعلي للرسائل معطّل حتى يتم إدخال مفاتيح Twilio صحيحة

---

## P1 - Next Tasks
- [ ] تفعيل إرسال الرسائل الفعلي عند إدخال مفاتيح Twilio

## P2 - Future Tasks
- [ ] إعادة هيكلة `backend/server.py` إلى بنية modular
- [ ] إصلاح جذري لخطأ `Maximum call stack size exceeded` 
- [ ] Email notifications (SendGrid)
- [ ] Dashboard analytics charts
- [ ] تحسين PDF للوصفات والفواتير

---

## Latest Update
**March 2, 2026:**
- ✅ Role-based login redirect (super_admin → /super-admin)
- ✅ Enhanced Doctors page with 3 filters (search, specialty, company)
- ✅ Doctor edit dialog with consultation fee
- ✅ Staff section: consultation fee display + edit button + edit dialog
- ✅ PUT /api/users/{id} API endpoint
- ✅ Full testing via testing_agent_v3_fork (13 backend tests, UI verification)

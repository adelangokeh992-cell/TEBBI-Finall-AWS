# الصلاحيات والأدوار (RBAC) — TEBBI

## نظرة عامة

النظام يستخدم **التحكم بالوصول على أساس الأدوار (RBAC)**: كل مستخدم له **دور** وكل **ميزة** (مثل المرضى، المواعيد، الفواتير) مرتبطة بصلاحيات. الوصول إلى أي endpoint يمس بيانات المرضى أو الموارد الحساسة محكوم بـ `require_feature(...)` أو فحص صلاحية مكافئ في [server.py](TEBI--main/backend/server.py).

## الأدوار (Roles)

| الدور | الوصف | الصلاحيات الافتراضية |
|-------|--------|------------------------|
| **super_admin** | مدير النظام (كل العيادات) | كل الميزات |
| **company_admin** | مدير العيادة/الشركة | كل الميزات ضمن العيادة |
| **doctor** | طبيب | عرض/تعديل المرضى، الزيارات، المواعيد، AI، الصيدلية |
| **nurse** | ممرض/ممرضة | عرض المرضى، العلامات الحيوية، المواعيد، الصيدلية |
| **receptionist** | موظف استقبال | عرض المرضى، إضافة مرضى، المواعيد، الصيدلية |
| **accountant** | محاسب | الفواتير، التقارير |

يمكن لمدير العيادة تخصيص صلاحيات الأدوار عبر **custom_permissions** للشركة.

## الميزات والصلاحيات المرتبطة

- **patients**: `view_patients`, `edit_patients`, `add_patients`
- **appointments** / **queue**: `view_appointments`, `manage_appointments`
- **invoices**: `view_invoices`, `create_invoices`
- **ai_analysis**: `use_ai`
- **reports**: `view_reports`
- **pharmacy**: `view_patients`, `manage_pharmacy`
- **backup**, **audit_logs**, **marketing**, **notifications**: صلاحية `all` (عادة مدير أو سوبر أدمن)

كل endpoint يقرأ أو يعدّل **بيانات مرضى (PHI)** أو مواعيد أو فواتير أو مستندات يجب أن يستدعي `Depends(require_feature("..."))` مع الميزة المناسبة، أو يتحقق من `company_id` وعدم تجاوز صلاحيات العيادة.

## مراجعة الحماية

يُنصح عند إضافة endpoints جديدة أن تُربط بالميزة المناسبة عبر `require_feature("patients")`, `require_feature("appointments")`, إلخ، وأن لا يُعاد أي PHI لمستخدم من عيادة أخرى (ما لم يكن super_admin).

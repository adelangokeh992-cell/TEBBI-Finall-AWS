# تماثل TEBBI مع HL7 FHIR R4 (للتوسع المستقبلي)

هذه الوثيقة تصف تماثل كيانات TEBBI الداخلية مع موارد **HL7 FHIR R4** لتسهيل التكامل لاحقاً مع مستشفيات أو أنظمة خارجية.

## المريض (Patient)

| حقل TEBBI (الداخلي) | مورد FHIR R4 | ملاحظات |
|---------------------|--------------|---------|
| `id` | `Patient.id` | معرف فريد |
| `name` | `Patient.name[].given` + `family` | يمكن دمج الاسم الكامل في `text` أو تقسيمه |
| `name_ar` | امتداد أو `Patient.name[].text` | اسم عربي |
| `date_of_birth` | `Patient.birthDate` | تاريخ ميلاد |
| `gender` | `Patient.gender` | `male` → `male`, `female` → `female` |
| `phone` | `Patient.telecom` (نوع phone) | |
| `address` / `address_ar` | `Patient.address` | |
| `national_id` | `Patient.identifier` (نظام هوية وطنية) | |
| `blood_type` | امتداد أو `Patient extension` | |
| `emergency_contact` / `emergency_phone` | `Patient.contact` | |

تحويل من TEBBI إلى FHIR Patient: إنشاء `Patient` resource مع تعبئة الحقول أعلاه. تحويل من FHIR إلى TEBBI: قراءة الحقول من الـ resource وتعيينها في نموذج المريض الداخلي.

## الموعد (Appointment)

| حقل TEBBI | مورد FHIR R4 | ملاحظات |
|-----------|--------------|---------|
| `id` | `Appointment.id` | |
| `patient_id` | `Appointment.participant` (actor = Patient reference) | |
| `doctor_id` | `Appointment.participant` (actor = Practitioner reference) | |
| `date` + `time` | `Appointment.start` / `Appointment.end` | دمج التاريخ والوقت في ISO 8601 |
| `status` | `Appointment.status` | `scheduled` → `booked`, `completed` → `fulfilled`, `cancelled` → `cancelled` |
| `reason` | `Appointment.reasonCode` أو `comment` | |

تحويل من TEBBI إلى FHIR Appointment: إنشاء `Appointment` مع `participant` للمريض والطبيب و`start`/`end`. تحويل من FHIR إلى TEBBI: قراءة المشاركين والتوقيت والحالة.

## خطوات التوسع المقترحة

1. إضافة نماذج Pydantic (اختياري) تطابق هيكل موارد FHIR للمريض والموعد لاستخدامها في endpoints تصدير/استيراد.
2. إضافة `GET /api/fhir/Patient/{id}` و `GET /api/fhir/Appointment/{id}` يعيدان تمثيلاً JSON متوافقاً مع FHIR R4 (للتصدير أو التكامل).
3. عند الربط مع نظام خارجي، استخدام هذه الوثيقة لتنفيذ محولات (mappers) من/إلى TEBBI.

لا يلزم تنفيذ الـ endpoints أو المحولات كاملاً في المرحلة الحالية؛ الوثيقة كافية للتصميم المبكر.

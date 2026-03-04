/**
 * Central translations for Tebbi (ar/en).
 * Use t(key, language) or useTranslations() hook. All user-visible strings should
 * come from here for consistent i18n and RTL support.
 */
export const translations = {
  // Navigation
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  patients: { ar: 'المرضى', en: 'Patients' },
  appointments: { ar: 'المواعيد', en: 'Appointments' },
  aiAssistant: { ar: 'مساعد AI', en: 'AI Assistant' },
  billing: { ar: 'الفواتير', en: 'Billing' },
  accounting: { ar: 'المحاسبة', en: 'Accounting' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  logout: { ar: 'تسجيل الخروج', en: 'Logout' },

  // Common
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  delete: { ar: 'حذف', en: 'Delete' },
  edit: { ar: 'تعديل', en: 'Edit' },
  add: { ar: 'إضافة', en: 'Add' },
  search: { ar: 'بحث', en: 'Search' },
  loading: { ar: 'جاري التحميل...', en: 'Loading...' },
  noData: { ar: 'لا توجد بيانات', en: 'No data' },
  confirm: { ar: 'تأكيد', en: 'Confirm' },
  back: { ar: 'رجوع', en: 'Back' },
  
  // Auth
  login: { ar: 'تسجيل الدخول', en: 'Login' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  welcomeBack: { ar: 'مرحباً بعودتك', en: 'Welcome Back' },
  loginSubtitle: { ar: 'سجل دخولك للوصول إلى النظام', en: 'Sign in to access the system' },

  // Dashboard
  totalPatients: { ar: 'إجمالي المرضى', en: 'Total Patients' },
  todayAppointments: { ar: 'مواعيد اليوم', en: "Today's Appointments" },
  pendingInvoices: { ar: 'فواتير معلقة', en: 'Pending Invoices' },
  totalAppointments: { ar: 'إجمالي المواعيد', en: 'Total Appointments' },
  recentPatients: { ar: 'أحدث المرضى', en: 'Recent Patients' },
  quickActions: { ar: 'إجراءات سريعة', en: 'Quick Actions' },
  newPatient: { ar: 'مريض جديد', en: 'New Patient' },
  newAppointment: { ar: 'موعد جديد', en: 'New Appointment' },

  // Patient
  patientInfo: { ar: 'معلومات المريض', en: 'Patient Information' },
  name: { ar: 'الاسم', en: 'Name' },
  nameAr: { ar: 'الاسم بالعربي', en: 'Arabic Name' },
  nationalId: { ar: 'رقم الهوية', en: 'National ID' },
  dateOfBirth: { ar: 'تاريخ الميلاد', en: 'Date of Birth' },
  gender: { ar: 'الجنس', en: 'Gender' },
  male: { ar: 'ذكر', en: 'Male' },
  female: { ar: 'أنثى', en: 'Female' },
  phone: { ar: 'الهاتف', en: 'Phone' },
  address: { ar: 'العنوان', en: 'Address' },
  bloodType: { ar: 'فصيلة الدم', en: 'Blood Type' },
  emergencyContact: { ar: 'جهة اتصال للطوارئ', en: 'Emergency Contact' },
  medicalHistory: { ar: 'التاريخ الطبي', en: 'Medical History' },
  allergies: { ar: 'الحساسيات', en: 'Allergies' },
  diagnoses: { ar: 'التشخيصات', en: 'Diagnoses' },
  medications: { ar: 'الأدوية', en: 'Medications' },

  // Appointments
  date: { ar: 'التاريخ', en: 'Date' },
  time: { ar: 'الوقت', en: 'Time' },
  doctor: { ar: 'الطبيب', en: 'Doctor' },
  patient: { ar: 'المريض', en: 'Patient' },
  reason: { ar: 'السبب', en: 'Reason' },
  status: { ar: 'الحالة', en: 'Status' },
  scheduled: { ar: 'مجدول', en: 'Scheduled' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  noShow: { ar: 'لم يحضر', en: 'No Show' },

  // AI Assistant
  symptomAnalysis: { ar: 'تحليل الأعراض', en: 'Symptom Analysis' },
  imageAnalysis: { ar: 'تحليل الصور', en: 'Image Analysis' },
  enterSymptoms: { ar: 'أدخل الأعراض', en: 'Enter symptoms' },
  uploadImage: { ar: 'رفع صورة', en: 'Upload Image' },
  analyze: { ar: 'تحليل', en: 'Analyze' },
  xray: { ar: 'أشعة سينية', en: 'X-Ray' },
  ecg: { ar: 'تخطيط قلب', en: 'ECG' },
  labTest: { ar: 'تحليل مخبري', en: 'Lab Test' },
  aiWarning: { ar: 'تحذير: هذه اقتراحات AI فقط وليست تشخيصاً طبياً نهائياً', en: 'Warning: These are AI suggestions only, not a final medical diagnosis' },
  requiresInternet: { ar: 'يتطلب اتصال بالإنترنت', en: 'Requires internet connection' },

  // Billing
  invoice: { ar: 'فاتورة', en: 'Invoice' },
  invoiceNumber: { ar: 'رقم الفاتورة', en: 'Invoice Number' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  paid: { ar: 'مدفوع', en: 'Paid' },
  pending: { ar: 'معلق', en: 'Pending' },
  partial: { ar: 'جزئي', en: 'Partial' },
  payNow: { ar: 'ادفع الآن', en: 'Pay Now' },
  subtotal: { ar: 'المجموع الفرعي', en: 'Subtotal' },
  discount: { ar: 'الخصم', en: 'Discount' },
  tax: { ar: 'الضريبة', en: 'Tax' },
  total: { ar: 'الإجمالي', en: 'Total' },

  // Accounting
  income: { ar: 'الدخل', en: 'Income' },
  expenses: { ar: 'المصاريف', en: 'Expenses' },
  netProfit: { ar: 'صافي الربح', en: 'Net Profit' },
  pendingPayments: { ar: 'مدفوعات معلقة', en: 'Pending Payments' },
  addExpense: { ar: 'إضافة مصروف', en: 'Add Expense' },
  category: { ar: 'الفئة', en: 'Category' },
  salary: { ar: 'رواتب', en: 'Salary' },
  rent: { ar: 'إيجار', en: 'Rent' },
  utilities: { ar: 'مرافق', en: 'Utilities' },
  supplies: { ar: 'مستلزمات', en: 'Supplies' },
  equipment: { ar: 'معدات', en: 'Equipment' },
  maintenance: { ar: 'صيانة', en: 'Maintenance' },
  other: { ar: 'أخرى', en: 'Other' },
};

export const t = (key, language) => {
  const translation = translations[key];
  if (!translation) return key;
  return language === 'ar' ? translation.ar : translation.en;
};

export default translations;

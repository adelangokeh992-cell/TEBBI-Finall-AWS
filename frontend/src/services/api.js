import axios from 'axios';

// الباكند: منفذ 8001 (لو .env فيه 8000 غيّره لـ 8001)
function getBackendBase() {
  const env = process.env.REACT_APP_BACKEND_URL;
  if (env && typeof env === 'string') {
    const b = env.replace(/\/api\/?$/, '').replace(/\/$/, '').trim();
    if (b && b !== 'undefined' && b.startsWith('http')) return b;
  }
  return 'http://localhost:8001';
}
const BACKEND_BASE = getBackendBase();
const API_URL = `${BACKEND_BASE}/api`;

// Notifications API
export const notificationsAPI = {
  getUnread: () => axios.get(`${API_URL}/notifications/unread`),
  markRead: (id) => axios.patch(`${API_URL}/notifications/${id}/read`),
  markAllRead: () => axios.patch(`${API_URL}/notifications/read-all`),
};

// Auth API
export const authAPI = {
  login: (email, password) => axios.post(`${API_URL}/auth/login`, { email, password }),
  register: (data) => axios.post(`${API_URL}/auth/register`, data),
  getMe: () => axios.get(`${API_URL}/auth/me`),
  changePassword: (currentPassword, newPassword) =>
    axios.post(`${API_URL}/auth/change-password`, { current_password: currentPassword, new_password: newPassword }),
  forgotPassword: (email) => axios.post(`${API_URL}/auth/forgot-password`, { email }),
  resetPassword: (token, newPassword) =>
    axios.post(`${API_URL}/auth/reset-password`, { token, new_password: newPassword }),
  logout: () => axios.post(`${API_URL}/auth/logout`, {}, { headers: axios.defaults.headers.common }),
  logoutAll: () => axios.post(`${API_URL}/auth/logout-all`),
  mfaSetup: (tempToken) =>
    axios.post(`${API_URL}/auth/mfa/setup`, {}, { headers: tempToken ? { Authorization: `Bearer ${tempToken}` } : {} }),
  mfaVerify: (code, tempToken) =>
    axios.post(`${API_URL}/auth/mfa/verify`, { code }, { headers: tempToken ? { Authorization: `Bearer ${tempToken}` } : {} }),
  mfaChallenge: (tempToken, code) =>
    axios.post(`${API_URL}/auth/mfa/challenge`, { temp_token: tempToken, code }),
};

// Patients API
export const patientsAPI = {
  getAll: (search) => axios.get(`${API_URL}/patients`, { params: { search } }),
  getOne: (id) => axios.get(`${API_URL}/patients/${id}`),
  create: (data) => axios.post(`${API_URL}/patients`, data),
  update: (id, data) => axios.put(`${API_URL}/patients/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/patients/${id}`),
  createPortalInvite: (patientId) => axios.post(`${API_URL}/patients/${patientId}/portal-invite`),
  sendMessageToPatient: (patientId, message) => axios.post(`${API_URL}/patients/${patientId}/messages`, { message }),
  getDocuments: (patientId) => axios.get(`${API_URL}/patients/${patientId}/documents`),
  createDocument: (patientId, data) => axios.post(`${API_URL}/patients/${patientId}/documents`, data),
};

// Patient Portal API (uses portal JWT in Authorization header)
export function portalAPI(accessToken) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  return {
    login: (token) => axios.get(`${API_URL}/portal/login`, { params: { token } }),
    getMe: () => axios.get(`${API_URL}/portal/me`, { headers }),
    getVisits: () => axios.get(`${API_URL}/portal/visits`, { headers }),
    getInvoices: () => axios.get(`${API_URL}/portal/invoices`, { headers }),
    getMessages: () => axios.get(`${API_URL}/portal/messages`, { headers }),
    sendMessage: (message) => axios.post(`${API_URL}/portal/messages`, { message }, { headers }),
    getDocuments: () => axios.get(`${API_URL}/portal/documents`, { headers }),
  };
}

// Allergies API
export const allergiesAPI = {
  getByPatient: (patientId) => axios.get(`${API_URL}/allergies/patient/${patientId}`),
  create: (data) => axios.post(`${API_URL}/allergies`, data),
  delete: (id) => axios.delete(`${API_URL}/allergies/${id}`),
};

// Diagnoses API
export const diagnosesAPI = {
  getByPatient: (patientId) => axios.get(`${API_URL}/diagnoses/patient/${patientId}`),
  create: (data) => axios.post(`${API_URL}/diagnoses`, data),
  delete: (id) => axios.delete(`${API_URL}/diagnoses/${id}`),
};

// Medications API
export const medicationsAPI = {
  getByPatient: (patientId) => axios.get(`${API_URL}/medications/patient/${patientId}`),
  create: (data) => axios.post(`${API_URL}/medications`, data),
  delete: (id) => axios.delete(`${API_URL}/medications/${id}`),
};

// Medical Images API
export const medicalImagesAPI = {
  getByPatient: (patientId) => axios.get(`${API_URL}/medical-images/patient/${patientId}`),
  create: (data) => axios.post(`${API_URL}/medical-images`, data),
  delete: (id) => axios.delete(`${API_URL}/medical-images/${id}`),
};

// Appointments API
export const appointmentsAPI = {
  getAll: (params) => axios.get(`${API_URL}/appointments`, { params }),
  getOne: (id) => axios.get(`${API_URL}/appointments/${id}`),
  create: (data) => axios.post(`${API_URL}/appointments`, data),
  update: (id, data) => axios.put(`${API_URL}/appointments/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/appointments/${id}`),
  updateQueueStatus: (id, queue_status) => axios.patch(`${API_URL}/appointments/${id}/queue-status`, { queue_status }),
};

// Queue API
export const queueAPI = {
  getToday: (doctorId) => axios.get(`${API_URL}/queue/today`, { params: doctorId ? { doctor_id: doctorId } : {} }),
  addWalkin: (data) => axios.post(`${API_URL}/queue/add`, data),
  updateWalkinStatus: (walkinId, queue_status) => axios.patch(`${API_URL}/queue/walkin/${walkinId}/queue-status`, { queue_status }),
};

// Consent forms API
export const consentAPI = {
  listForms: () => axios.get(`${API_URL}/consent-forms`),
  createForm: (data) => axios.post(`${API_URL}/consent-forms`, data),
  getPatientConsents: (patientId) => axios.get(`${API_URL}/patients/${patientId}/consents`),
  signForm: (formId, data) => axios.post(`${API_URL}/consent-forms/${formId}/sign`, data),
};

// Inventory API
export const inventoryAPI = {
  list: () => axios.get(`${API_URL}/inventory`),
  create: (data) => axios.post(`${API_URL}/inventory`, data),
  update: (id, data) => axios.put(`${API_URL}/inventory/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/inventory/${id}`),
  getAlerts: () => axios.get(`${API_URL}/inventory/alerts`),
};

// Pharmacy API (dispense to patient → invoice)
export const pharmacyAPI = {
  dispense: (data) => axios.post(`${API_URL}/pharmacy/dispense`, data),
};

// Marketing API
export const marketingAPI = {
  createCampaign: (data) => axios.post(`${API_URL}/marketing/campaigns`, data),
  listCampaigns: () => axios.get(`${API_URL}/marketing/campaigns`),
};

// Audit logs API
export const auditAPI = {
  getLogs: (params) => axios.get(`${API_URL}/audit-logs`, { params }),
};

// Invoices API
export const invoicesAPI = {
  getAll: (params) => axios.get(`${API_URL}/invoices`, { params }),
  getOne: (id) => axios.get(`${API_URL}/invoices/${id}`),
  create: (data) => axios.post(`${API_URL}/invoices`, data),
  pay: (id, amount) => axios.put(`${API_URL}/invoices/${id}/pay`, null, { params: { amount } }),
  createCheckoutSession: (id) => axios.post(`${API_URL}/invoices/${id}/create-checkout-session`),
  getByPatient: (patientId) => axios.get(`${API_URL}/patients/${patientId}/invoices`),
};

// Reference Lists API (Medical Data)
export const referenceAPI = {
  getAllergies: () => axios.get(`${API_URL}/reference/allergies`),
  addAllergy: (data) => axios.post(`${API_URL}/reference/allergies`, data),
  getDiagnoses: () => axios.get(`${API_URL}/reference/diagnoses`),
  addDiagnosis: (data) => axios.post(`${API_URL}/reference/diagnoses`, data),
  getMedications: () => axios.get(`${API_URL}/reference/medications`),
  addMedication: (data) => axios.post(`${API_URL}/reference/medications`, data),
};

// Expenses API
export const expensesAPI = {
  getAll: (params) => axios.get(`${API_URL}/expenses`, { params }),
  create: (data) => axios.post(`${API_URL}/expenses`, data),
  delete: (id) => axios.delete(`${API_URL}/expenses/${id}`),
};

// Dashboard & Accounting API
export const dashboardAPI = {
  getStats: () => axios.get(`${API_URL}/dashboard/stats`),
  getAccountingSummary: (params) => axios.get(`${API_URL}/accounting/summary`, { params }),
};

// Users API
export const usersAPI = {
  getAll: (params) => axios.get(`${API_URL}/users`, { params }),
  getDoctors: () => axios.get(`${API_URL}/users/doctors`),
  update: (userId, data) => axios.put(`${API_URL}/users/${userId}`, data),
};

// Companies API (notification settings, online bookings, AI status, staff, printers)
export const companiesAPI = {
  getNotificationSettings: (companyId) =>
    axios.get(`${API_URL}/companies/${companyId}/notification-settings`),
  saveNotificationSettings: (companyId, data) =>
    axios.post(`${API_URL}/companies/${companyId}/notification-settings`, data),
  getPrintSettings: (companyId) =>
    axios.get(`${API_URL}/companies/${companyId}/print-settings`),
  getPrinters: (companyId) =>
    axios.get(`${API_URL}/companies/${companyId}/printers`),
  getOne: (companyId) => axios.get(`${API_URL}/companies/${companyId}`),
  update: (companyId, data) => axios.put(`${API_URL}/companies/${companyId}`, data),
  getOnlineBookings: (companyId) =>
    axios.get(`${API_URL}/companies/${companyId}/online-bookings`),
  getDashboardStats: (companyId) =>
    axios.get(`${API_URL}/companies/${companyId}/dashboard-stats`),
  getReports: (companyId, params) =>
    axios.get(`${API_URL}/companies/${companyId}/reports`, { params }),
  testAi: (companyId, data) =>
    axios.post(`${API_URL}/companies/${companyId}/test-ai`, data),
  testNotification: (companyId, data) =>
    axios.post(`${API_URL}/companies/${companyId}/test-notification`, data),
  getStaff: (companyId) => axios.get(`${API_URL}/companies/${companyId}/staff`),
  addStaff: (companyId, data) => axios.post(`${API_URL}/companies/${companyId}/staff`, data),
  deleteStaff: (companyId, staffId) =>
    axios.delete(`${API_URL}/companies/${companyId}/staff/${staffId}`),
  updateStaff: (companyId, staffId, data) =>
    axios.put(`${API_URL}/companies/${companyId}/staff/${staffId}`, data),
  create: (data) => axios.post(`${API_URL}/companies`, data),
  delete: (companyId) => axios.delete(`${API_URL}/companies/${companyId}`),
  getBackups: (companyId) => axios.get(`${API_URL}/companies/${companyId}/backups`),
  createBackup: (companyId) => axios.post(`${API_URL}/companies/${companyId}/backups`),
  restoreBackup: (companyId, backupId) =>
    axios.post(`${API_URL}/companies/${companyId}/backups/${backupId}/restore`),
  deleteBackup: (companyId, backupId) =>
    axios.delete(`${API_URL}/companies/${companyId}/backups/${backupId}`),
  updateFeatures: (companyId, data) =>
    axios.put(`${API_URL}/companies/${companyId}/features`, data),
  updateSubscription: (companyId, data) =>
    axios.put(`${API_URL}/companies/${companyId}/subscription`, data),
};
export const onlineBookingsAPI = {
  confirm: (bookingId) => axios.put(`${API_URL}/online-bookings/${bookingId}/confirm`),
  cancel: (bookingId) => axios.put(`${API_URL}/online-bookings/${bookingId}/cancel`),
  complete: (bookingId) => axios.put(`${API_URL}/online-bookings/${bookingId}/complete`),
};

// AI API (assistant uses analyzeMedicalImage for image analysis; analyzeImage is legacy/simple)
export const aiAPI = {
  analyzeSymptoms: (data) => axios.post(`${API_URL}/ai/analyze-symptoms`, data),
  analyzeImage: (data) => axios.post(`${API_URL}/ai/analyze-image`, data),
  analyzePatient: (data) => axios.post(`${API_URL}/ai/analyze-patient`, data),
  smartSymptoms: (data) => axios.post(`${API_URL}/ai/smart-symptoms`, data),
  chat: (data) => axios.post(`${API_URL}/ai/chat`, data),
  checkDrugInteractions: (data) => axios.post(`${API_URL}/ai/drug-interactions`, data),
  getAlerts: (patientId) => axios.get(`${API_URL}/ai/alerts/${patientId}`),
  generateReport: (data) => axios.post(`${API_URL}/ai/generate-report`, data),
  analyzeMedicalImage: (data) => axios.post(`${API_URL}/ai/analyze-medical-image`, data),
  saveAIInsight: (data) => axios.post(`${API_URL}/ai/insights`, data),
  getAIInsights: (patientId) => axios.get(`${API_URL}/ai/insights`, { params: { patient_id: patientId } }),
  updateAIInsight: (insightId, data) => axios.patch(`${API_URL}/ai/insights/${insightId}`, data),
};

// Telemedicine API
export const telemedicineAPI = {
  createSession: (data) => axios.post(`${API_URL}/telemedicine/sessions`, data),
  getSession: (roomId) => axios.get(`${API_URL}/telemedicine/sessions/${roomId}`),
  startSession: (roomId) => axios.patch(`${API_URL}/telemedicine/sessions/${roomId}/start`),
  endSession: (roomId, data) => axios.patch(`${API_URL}/telemedicine/sessions/${roomId}/end`, data),
};

// Super Admin API
export const adminAPI = {
  getDashboard: () => axios.get(`${API_URL}/admin/dashboard`),
  listCompanies: () => axios.get(`${API_URL}/companies`),
  getSystemSettings: () => axios.get(`${API_URL}/admin/system-settings`),
  updateSystemSettings: (data) => axios.put(`${API_URL}/admin/system-settings`, data),
};

// MFA allowed at system level (read-only, for company admin UI)
export const settingsMfaAPI = {
  getMfaAllowed: () => axios.get(`${API_URL}/settings/mfa-allowed`),
};

// Public API (booking, doctor profile, no auth)
export const publicAPI = {
  getDoctors: (params) => axios.get(`${API_URL}/public/doctors`, { params }),
  getCompanyByCode: (code) => axios.get(`${API_URL}/public/companies/by-code/${encodeURIComponent(code)}`),
  getDoctor: (identifier) => axios.get(`${API_URL}/public/doctor/${identifier}`),
  getSlots: (doctorId, date) =>
    axios.get(`${API_URL}/public/doctors/${doctorId}/slots`, { params: { date } }),
  book: (data) => axios.post(`${API_URL}/public/book`, data),
  postReview: (data) => axios.post(`${API_URL}/public/reviews`, data),
};

// Settings API (user notification preferences)
export const settingsAPI = {
  getNotifications: () => axios.get(`${API_URL}/settings/notifications`),
  updateNotifications: (data) => axios.put(`${API_URL}/settings/notifications`, data),
  testNotification: (data) => axios.post(`${API_URL}/notifications/test`, data),
};

// Visits API
export const visitsAPI = {
  getAll: (patientId) => axios.get(`${API_URL}/visits`, { params: { patient_id: patientId } }),
  getOne: (id) => axios.get(`${API_URL}/visits/${id}`),
  create: (data) => axios.post(`${API_URL}/visits`, data),
  getByPatient: (patientId) => axios.get(`${API_URL}/patients/${patientId}/visits`),
  getLastVisit: (patientId) => axios.get(`${API_URL}/patients/${patientId}/last-visit`),
};

// Seed API — تحميل المرضى يستدعي المسار على جذر الباكند (بدون /api) لتفادي 404
export const seedAPI = {
  seed: () => axios.post(`${API_URL}/seed`),
  seedDemoPatients: (count = 100) =>
    axios.post(`${BACKEND_BASE}/seed-demo-patients`, { count }),
};

export default {
  auth: authAPI,
  notifications: notificationsAPI,
  patients: patientsAPI,
  allergies: allergiesAPI,
  diagnoses: diagnosesAPI,
  medications: medicationsAPI,
  appointments: appointmentsAPI,
  invoices: invoicesAPI,
  expenses: expensesAPI,
  dashboard: dashboardAPI,
  users: usersAPI,
  companies: companiesAPI,
  admin: adminAPI,
  public: publicAPI,
  settings: settingsAPI,
  ai: aiAPI,
  seed: seedAPI,
  reference: referenceAPI,
  visits: visitsAPI,
  telemedicine: telemedicineAPI,
  queue: queueAPI,
  consent: consentAPI,
  inventory: inventoryAPI,
  pharmacy: pharmacyAPI,
  marketing: marketingAPI,
  audit: auditAPI,
};

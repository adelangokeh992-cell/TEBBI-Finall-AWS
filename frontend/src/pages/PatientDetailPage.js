import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { patientsAPI, allergiesAPI, medicationsAPI, medicalImagesAPI, aiAPI, invoicesAPI, visitsAPI, telemedicineAPI, usersAPI } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, ArrowLeft, Trash2, Brain, AlertTriangle, Pill, ImageIcon, Baby, Receipt, AlertCircle, Calendar, ClipboardList, Bell, FileText, Copy, Download, CheckCircle, XCircle, ChevronDown, ChevronUp, Link2, Video, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import AllergySection from '../components/patient/AllergySection';
import MedicationSection from '../components/patient/MedicationSection';
import ImageSection from '../components/patient/ImageSection';
import AIAnalysisDialog from '../components/patient/AIAnalysisDialog';
import InvoicesSection from '../components/patient/InvoicesSection';
import VisitsSection from '../components/patient/VisitsSection';
import NewVisitDialog from '../components/patient/NewVisitDialog';
import SmartAlertsPanel from '../components/ai/SmartAlertsPanel';
import { LoadingSpinner } from '../components/common';

function PatientDetailPage() {
  const { t, language } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medicalImages, setMedicalImages] = useState([]);
  const [invoiceSummary, setInvoiceSummary] = useState(null);
  const [lastVisit, setLastVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiReportType, setAiReportType] = useState('monthly');
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportResult, setAiReportResult] = useState(null);
  const [reportEditContent, setReportEditContent] = useState('');
  const [aiInsights, setAiInsights] = useState([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [expandedInsightId, setExpandedInsightId] = useState(null);

  useEffect(() => { fetchData(); }, [id]);

  const fetchAIInsights = () => {
    setAiInsightsLoading(true);
    aiAPI.getAIInsights(id).then((res) => { setAiInsights(res.data || []); }).catch(() => {}).finally(() => setAiInsightsLoading(false));
  };
  useEffect(() => { if (id) fetchAIInsights(); }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        patientsAPI.getOne(id),
        allergiesAPI.getByPatient(id),
        medicationsAPI.getByPatient(id),
        medicalImagesAPI.getByPatient(id),
        invoicesAPI.getByPatient(id).catch(() => ({ data: { summary: null } })),
        visitsAPI.getLastVisit(id).catch(() => ({ data: null }))
      ]);
      setPatient(results[0].data);
      setAllergies(results[1].data);
      setMedications(results[2].data);
      setMedicalImages(results[3].data);
      setInvoiceSummary(results[4].data?.summary);
      setLastVisit(results[5].data);
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
    setLoading(false);
  };

  const handleAIAnalysis = async () => {
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const res = await aiAPI.analyzePatient({ patient_id: id, include_images: true, language });
      setAiResult(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('فشل', 'Failed'));
    }
    setAiAnalyzing(false);
  };

  const getReportDisplayText = (result) => {
    if (!result) return '';
    if (result.formatted_content) return result.formatted_content;
    if (typeof result.content === 'string') return result.content;
    const skip = ['patient_id', 'report_type', 'generated_at', 'generated_by', 'formatted_content'];
    return Object.entries(result)
      .filter(([k]) => !skip.includes(k))
      .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}`)
      .join('\n\n');
  };

  const handleGenerateReport = async () => {
    setAiReportLoading(true);
    setAiReportResult(null);
    setReportEditContent('');
    try {
      const res = await aiAPI.generateReport({ patient_id: id, report_type: aiReportType, language });
      setAiReportResult(res.data);
      setReportEditContent(getReportDisplayText(res.data));
      toast.success(t('تم إنشاء التقرير', 'Report generated'));
    } catch (e) {
      toast.error(e.response?.data?.detail || t('فشل في إنشاء التقرير', 'Failed to generate report'));
    }
    setAiReportLoading(false);
  };

  const reportTextForExport = () => reportEditContent || (aiReportResult ? getReportDisplayText(aiReportResult) : '');

  const copyReportToClipboard = () => {
    const text = reportTextForExport();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast.success(t('تم النسخ', 'Copied')));
  };

  const downloadReport = () => {
    const text = reportTextForExport();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${id}-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('تم التحميل', 'Downloaded'));
  };

  const downloadReportPdf = () => {
    const text = reportTextForExport();
    if (!text) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const lineHeight = 6;
    let y = 20;
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    for (let i = 0; i < lines.length; i++) {
      if (y > 277) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[i], margin, y);
      y += lineHeight;
    }
    doc.save(`patient-${id}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(t('تم تحميل PDF', 'PDF downloaded'));
  };

  const downloadReportWord = () => {
    const text = reportTextForExport();
    if (!text) return;
    const html = `<!DOCTYPE html><html dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${t('تقرير', 'Report')}</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.5;} pre{white-space:pre-wrap;}</style></head><body><pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${id}-report-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('تم تحميل Word', 'Word downloaded'));
  };

  const printReportAndSave = () => {
    const text = reportTextForExport();
    if (!text) return;
    const title = `${t('تقرير', 'Report')} ${aiReportType} - ${new Date().toISOString().slice(0, 10)}`;
    const content = `<div dir="${language === 'ar' ? 'rtl' : 'ltr'}"><pre style="white-space:pre-wrap;font-family:inherit;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>`;
    patientsAPI.createDocument(id, { type: 'report', title, content }).then(() => {
      toast.success(t('تم حفظ التقرير في ملف المريض', 'Report saved to patient file'));
    }).catch(() => toast.error(t('فشل الحفظ', 'Save failed')));
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="padding:20px;font-family:Arial;">${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const deletePatient = () => {
    if (window.confirm(t('متأكد من حذف المريض؟', 'Sure?'))) {
      patientsAPI.delete(id).then(() => navigate('/patients'));
    }
  };

  const calculateBMI = () => {
    if (!patient?.height_cm || !patient?.weight_kg) return null;
    return (patient.weight_kg / Math.pow(patient.height_cm / 100, 2)).toFixed(1);
  };

  const getBMICategory = (bmi) => {
    if (!bmi) return null;
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: t('نحيف', 'Under'), color: 'bg-blue-500' };
    if (val < 25) return { label: t('طبيعي', 'Normal'), color: 'bg-green-500' };
    if (val < 30) return { label: t('زيادة', 'Over'), color: 'bg-orange-500' };
    return { label: t('سمنة', 'Obese'), color: 'bg-red-500' };
  };

  if (loading) return <LoadingSpinner className="min-h-[50vh]" />;
  if (!patient) return <div className="text-center py-12" dir={language === 'ar' ? 'rtl' : 'ltr'}><h3>{t('غير موجود', 'Not found')}</h3></div>;

  const name = language === 'ar' ? (patient.name_ar || patient.name) : patient.name;
  const initial = name ? name[0].toUpperCase() : 'P';
  const hasPending = invoiceSummary?.has_pending;
  const bmi = calculateBMI();
  const bmiCat = getBMICategory(bmi);

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="patient-detail" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="rounded-2xl border border-teal-200/60 dark:border-teal-800/60 bg-gradient-to-br from-teal-50/80 to-purple-50/50 dark:from-teal-950/30 dark:to-purple-950/20 p-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
              {language === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </Button>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold">{initial}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-teal-800 dark:text-teal-100">{name}</h1>
                {bmi && <Badge className={`${bmiCat.color} gap-1`}>BMI: {bmi} ({bmiCat.label})</Badge>}
                {patient.is_pregnant && <Badge className="bg-pink-500 gap-1"><Baby className="w-3 h-3" />{t('حامل', 'Pregnant')} {patient.pregnancy_weeks}{t('أ', 'w')}</Badge>}
                {hasPending && <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />{t('مستحق', 'Due')}: {invoiceSummary.total_pending?.toFixed(0)}</Badge>}
              </div>
              <p className="text-muted-foreground">{patient.phone}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="gap-2 bg-teal-600 hover:bg-teal-700" onClick={() => setShowVisitDialog(true)} data-testid="new-visit-btn">
              <ClipboardList className="w-4 h-4" />{t('زيارة جديدة', 'New Visit')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/ai?patient=' + id)} data-testid="ai-center-btn">
              <Brain className="w-4 h-4" />{t('مركز AI', 'AI Center')}
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => { setShowAIDialog(true); handleAIAnalysis(); }} data-testid="ai-analysis-btn">
              <Brain className="w-4 h-4" />{t('تحليل AI', 'AI')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => patientsAPI.createPortalInvite(id).then((r) => { const link = r.data?.link; if (link) { navigator.clipboard.writeText(link); const sent = r.data?.sent_sms_whatsapp; toast.success(sent ? t('تم نسخ الرابط وإرساله للمريض على واتساب/SMS', 'Link copied and sent to patient via WhatsApp/SMS') : t('تم نسخ رابط بوابة المريض', 'Portal link copied')); } else toast.error(t('فشل', 'Failed')); }).catch(() => toast.error(t('فشل', 'Failed')))} data-testid="portal-invite-btn">
              <Link2 className="w-4 h-4" />{t('رابط البوابة', 'Portal link')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => usersAPI.getDoctors().then((r) => { const doctors = r.data || []; const doctorId = doctors[0]?.id; if (!doctorId) { toast.error(t('لا يوجد أطباء', 'No doctors')); return; } return telemedicineAPI.createSession({ patient_id: id, doctor_id: doctorId }); }).then((r) => { if (r?.data?.join_url) window.location.href = r.data.join_url; }).catch(() => toast.error(t('فشل', 'Failed')))}>
              <Video className="w-4 h-4" />{t('استشارة فيديو', 'Video consult')}
            </Button>
            <Button variant="destructive" size="icon" onClick={deletePatient}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="rounded-xl border-2"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{t('الهوية', 'ID')}</p><p className="font-medium text-sm">{patient.national_id || '-'}</p></CardContent></Card>
        <Card className="rounded-xl border-2"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{t('الميلاد', 'DOB')}</p><p className="font-medium text-sm">{patient.date_of_birth || '-'}</p></CardContent></Card>
        <Card className="rounded-xl border-2"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{t('الدم', 'Blood')}</p><p className="font-medium text-sm text-red-600">{patient.blood_type || '-'}</p></CardContent></Card>
        <Card className="rounded-xl border-2"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{t('الطول', 'H')}</p><p className="font-medium text-sm">{patient.height_cm ? patient.height_cm + 'cm' : '-'}</p></CardContent></Card>
        <Card className="rounded-xl border-2"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{t('الوزن', 'W')}</p><p className="font-medium text-sm">{patient.weight_kg ? patient.weight_kg + 'kg' : '-'}</p></CardContent></Card>
        <Card className="rounded-xl border-2"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">{t('الجنس', 'Sex')}</p><p className="font-medium text-sm">{patient.gender === 'male' ? t('ذكر', 'M') : patient.gender === 'female' ? t('أنثى', 'F') : '-'}</p></CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visits">
        <TabsList className="grid w-full grid-cols-8 rounded-xl">
          <TabsTrigger value="visits" className="gap-1"><Calendar className="w-4 h-4" /><span className="hidden sm:inline">{t('زيارات', 'Visits')}</span></TabsTrigger>
          <TabsTrigger value="allergies" className="gap-1"><AlertTriangle className="w-4 h-4" /><span className="hidden sm:inline">{t('حساسيات', 'Allergies')}</span></TabsTrigger>
          <TabsTrigger value="medications" className="gap-1"><Pill className="w-4 h-4" /><span className="hidden sm:inline">{t('أدوية', 'Meds')}</span></TabsTrigger>
          <TabsTrigger value="images" className="gap-1"><ImageIcon className="w-4 h-4" /><span className="hidden sm:inline">{t('صور', 'Images')}</span></TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1"><Receipt className="w-4 h-4" /><span className="hidden sm:inline">{t('فواتير', 'Invoices')}</span></TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1"><Bell className="w-4 h-4" /><span className="hidden sm:inline">{t('تنبيهات', 'Alerts')}</span></TabsTrigger>
          <TabsTrigger value="insights" className="gap-1"><Brain className="w-4 h-4" /><span className="hidden sm:inline">{t('اقتراحات AI', 'AI Suggestions')}</span></TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><FileText className="w-4 h-4" /><span className="hidden sm:inline">{t('تقارير AI', 'AI Reports')}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="mt-4"><VisitsSection patientId={id} t={t} language={language} /></TabsContent>
        <TabsContent value="allergies" className="mt-4"><AllergySection patientId={id} allergies={allergies} onRefresh={fetchData} t={t} language={language} /></TabsContent>
        <TabsContent value="medications" className="mt-4"><MedicationSection patientId={id} medications={medications} onRefresh={fetchData} t={t} language={language} /></TabsContent>
        <TabsContent value="images" className="mt-4"><ImageSection patientId={id} images={medicalImages} onRefresh={fetchData} t={t} /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesSection patientId={id} t={t} language={language} /></TabsContent>
        <TabsContent value="alerts" className="mt-4"><SmartAlertsPanel patientId={id} t={t} language={language} /></TabsContent>
        <TabsContent value="insights" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-4">{t('سجل اقتراحات الذكاء الاصطناعي المحفوظة لهذا المريض. يمكنك اعتماد أو رفض كل اقتراح.', 'AI suggestions saved for this patient. You can accept or reject each.')}</p>
              {aiInsightsLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div> : aiInsights.length === 0 ? <p className="text-muted-foreground text-center py-6">{t('لا توجد اقتراحات محفوظة', 'No saved suggestions')}</p> : (
                <div className="space-y-3">
                  {aiInsights.map((insight) => {
                    const typeLabel = { symptom_analysis: t('تحليل أعراض', 'Symptom analysis'), image_analysis: t('تحليل صورة', 'Image analysis'), drug_interaction: t('تداخلات دوائية', 'Drug interaction'), report: t('تقرير', 'Report') }[insight.type] || insight.type;
                    const dateStr = insight.created_at ? new Date(insight.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';
                    const isExpanded = expandedInsightId === insight.id;
                    const summary = insight.payload?.primary_diagnosis?.name || insight.payload?.report_title || (insight.payload?.interactions?.length ? t('تداخلات', 'Interactions') + ': ' + insight.payload.interactions.length : JSON.stringify(insight.payload).slice(0, 60) + '…');
                    return (
                      <Card key={insight.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="p-3 flex items-center justify-between gap-2 flex-wrap cursor-pointer" onClick={() => setExpandedInsightId(isExpanded ? null : insight.id)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{typeLabel}</Badge>
                              <span className="text-sm">{summary}</span>
                              <span className="text-xs text-muted-foreground">{dateStr}</span>
                              {insight.status === 'accepted' && <Badge className="bg-green-600">{t('معتمد', 'Accepted')}</Badge>}
                              {insight.status === 'rejected' && <Badge variant="destructive">{t('مرفوض', 'Rejected')}</Badge>}
                              {insight.status === 'pending_review' && <Badge variant="secondary">{t('قيد المراجعة', 'Pending')}</Badge>}
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                          {isExpanded && (
                            <div className="border-t p-4 bg-slate-50 dark:bg-slate-900 space-y-3">
                              <pre className="text-xs overflow-auto max-h-48 p-3 rounded bg-slate-100 dark:bg-slate-800 whitespace-pre-wrap">{JSON.stringify(insight.payload, null, 2)}</pre>
                              {insight.status === 'pending_review' && (
                                <div className="flex gap-2">
                                  <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => { aiAPI.updateAIInsight(insight.id, { status: 'accepted' }).then(() => { toast.success(t('تم الاعتماد', 'Accepted')); fetchAIInsights(); setExpandedInsightId(null); }).catch(() => toast.error(t('فشل', 'Failed'))); }}>
                                    <CheckCircle className="w-4 h-4" />{t('اعتماد', 'Accept')}
                                  </Button>
                                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => { aiAPI.updateAIInsight(insight.id, { status: 'rejected' }).then(() => { toast.success(t('تم الرفض', 'Rejected')); fetchAIInsights(); setExpandedInsightId(null); }).catch(() => toast.error(t('فشل', 'Failed'))); }}>
                                    <XCircle className="w-4 h-4" />{t('رفض', 'Reject')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{t('نوع التقرير', 'Report type')}</label>
                  <select
                    className="border rounded-md px-3 py-2 text-sm"
                    value={aiReportType}
                    onChange={(e) => setAiReportType(e.target.value)}
                  >
                    <option value="monthly">{t('تقرير متابعة شهري', 'Monthly follow-up')}</option>
                    <option value="referral">{t('تقرير تحويل', 'Referral report')}</option>
                    <option value="case_summary">{t('خلاصة حالة', 'Case summary')}</option>
                    <option value="lab_report">{t('تقرير مختبر', 'Lab report')}</option>
                    <option value="follow_up">{t('متابعة دورية', 'Follow-up')}</option>
                    <option value="discharge_summary">{t('تقرير خروج', 'Discharge summary')}</option>
                  </select>
                </div>
                <Button onClick={handleGenerateReport} disabled={aiReportLoading} className="gap-2 bg-teal-600 hover:bg-teal-700">
                  {aiReportLoading ? <span className="animate-spin">⏳</span> : <FileText className="w-4 h-4" />}
                  {t('إنشاء تقرير AI', 'Generate AI report')}
                </Button>
              </div>
              {(aiReportResult || reportEditContent) && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={copyReportToClipboard} className="gap-1"><Copy className="w-4 h-4" />{t('نسخ', 'Copy')}</Button>
                    <Button variant="outline" size="sm" onClick={downloadReport} className="gap-1"><Download className="w-4 h-4" />{t('تحميل', 'Download')}</Button>
                    <Button variant="outline" size="sm" onClick={downloadReportPdf} className="gap-1"><FileText className="w-4 h-4" />{t('تحميل PDF', 'Download PDF')}</Button>
                    <Button variant="outline" size="sm" onClick={downloadReportWord} className="gap-1"><FileText className="w-4 h-4" />{t('تحميل Word', 'Download Word')}</Button>
                    <Button variant="outline" size="sm" onClick={printReportAndSave} className="gap-1"><Printer className="w-4 h-4" />{t('طباعة وحفظ', 'Print & Save')}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('يمكنك تعديل النص أدناه قبل النسخ أو التحميل أو الحفظ.', 'You can edit the text below before copy, download or save.')}</p>
                  <textarea
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                    className="w-full rounded-lg border bg-slate-50 dark:bg-slate-900 p-4 min-h-[320px] max-h-[480px] overflow-y-auto text-sm whitespace-pre-wrap font-sans resize-y text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                    value={reportEditContent}
                    onChange={(e) => setReportEditContent(e.target.value)}
                    placeholder={t('محتوى التقرير...', 'Report content...')}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AIAnalysisDialog open={showAIDialog} onOpenChange={setShowAIDialog} analyzing={aiAnalyzing} result={aiResult} onRetry={handleAIAnalysis} t={t} />
      <NewVisitDialog open={showVisitDialog} onOpenChange={setShowVisitDialog} patientId={id} patientName={name} onSuccess={fetchData} t={t} language={language} />
    </div>
  );
}

export default PatientDetailPage;

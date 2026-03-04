import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { aiAPI, patientsAPI, medicationsAPI, companiesAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Brain, Stethoscope, ImageIcon, Upload, Loader2, AlertTriangle, CheckCircle, X, Plus, MessageSquare, Pill, FileText, Bell, User, ExternalLink, Wifi, WifiOff, Settings } from 'lucide-react';
import { toast } from 'sonner';
import AIChatDialog from '../components/ai/AIChatDialog';
import SmartSymptomsDialog from '../components/ai/SmartSymptomsDialog';

var AI_DISCLAIMER_AR = 'هذا تحليل مساعد ولا يغني عن الفحص السريري وقرار الطبيب.';
var AI_DISCLAIMER_EN = 'This is assistive analysis only and does not replace clinical examination and physician decision.';

export default function AIAssistantPage() {
  var auth = useAuth();
  var t = auth.t;
  var language = auth.language;
  var [searchParams, setSearchParams] = useSearchParams();
  var navigate = useNavigate();
  
  var [activeTab, setActiveTab] = useState('chat');
  var [chatOpen, setChatOpen] = useState(false);
  var [symptomsOpen, setSymptomsOpen] = useState(false);
  
  var [currentPatientId, setCurrentPatientId] = useState('');
  var [currentPatientName, setCurrentPatientName] = useState('');
  
  var [imageFile, setImageFile] = useState(null);
  var [imagePreview, setImagePreview] = useState(null);
  var [imageType, setImageType] = useState('xray');
  var [imageNotes, setImageNotes] = useState('');
  var [imageAnalyzing, setImageAnalyzing] = useState(false);
  var [imageResult, setImageResult] = useState(null);
  var [imageError, setImageError] = useState(null);
  
  var [medications, setMedications] = useState([]);
  var [newMed, setNewMed] = useState('');
  var [drugAnalyzing, setDrugAnalyzing] = useState(false);
  var [drugResult, setDrugResult] = useState(null);
  var [drugError, setDrugError] = useState(null);
  
  var [reportPatientId, setReportPatientId] = useState('');
  var [reportType, setReportType] = useState('monthly');
  var [reportLoading, setReportLoading] = useState(false);
  var [reportResult, setReportResult] = useState(null);
  var [reportEditContent, setReportEditContent] = useState('');
  var [reportError, setReportError] = useState(null);
  var [patients, setPatients] = useState([]);
  var [patientAlerts, setPatientAlerts] = useState(null);
  var [aiStatus, setAiStatus] = useState({ loading: true, connected: false, provider: null });
  var user = auth.user;
  var canAccessPatients = (user?.allowed_features || []).includes('patients');

  useEffect(function() {
    if (canAccessPatients) {
      patientsAPI.getAll().then(function(res) { setPatients(res.data || []); }).catch(function() {});
    } else {
      setPatients([]);
    }
  }, [canAccessPatients]);

  useEffect(function() {
    var pid = searchParams.get('patient');
    if (pid && patients.length) {
      var p = patients.find(function(x) { return x.id === pid; });
      if (p) {
        setCurrentPatientId(pid);
        setCurrentPatientName(language === 'ar' ? (p.name_ar || p.name) : p.name);
        setReportPatientId(pid);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, patients, language, setSearchParams]);

  useEffect(function() {
    if (currentPatientId && reportPatientId !== currentPatientId) {
      setReportPatientId(currentPatientId);
    }
  }, [currentPatientId]);

  useEffect(function() {
    if (!currentPatientId) return;
    medicationsAPI.getByPatient(currentPatientId).then(function(res) {
      var list = (res.data || []).map(function(m) { return m.name_ar || m.name || ''; }).filter(Boolean);
      setMedications(list);
    }).catch(function() {});
  }, [currentPatientId]);

  useEffect(function() {
    if (!currentPatientId) { setPatientAlerts(null); return; }
    aiAPI.getAlerts(currentPatientId).then(function(res) { setPatientAlerts(res.data); }).catch(function() { setPatientAlerts(null); });
  }, [currentPatientId]);

  useEffect(function() {
    if (!user?.company_id) {
      setAiStatus(function(prev) { return { ...prev, loading: false, connected: false, provider: null }; });
      return;
    }
    companiesAPI.getNotificationSettings(user.company_id)
      .then(function(res) {
        var data = res.data || {};
        setAiStatus({ loading: false, connected: !!data.ai_connected, provider: data.ai_provider || null });
      })
      .catch(function() {
        setAiStatus(function(prev) { return { ...prev, loading: false, connected: false, provider: null }; });
      });
  }, [user?.company_id]);

  function handleImageSelect(e) {
    var file = e.target.files[0];
    if (file) {
      setImageFile(file);
      var reader = new FileReader();
      reader.onloadend = function() { setImagePreview(reader.result); };
      reader.readAsDataURL(file);
    }
  }

  async function handleImageAnalysis() {
    if (!imageFile) return;
    setImageAnalyzing(true);
    setImageResult(null);
    setImageError(null);
    try {
      var base64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onloadend = function() { resolve(reader.result); };
        reader.onerror = function() { reject(new Error('Failed to read file')); };
        reader.readAsDataURL(imageFile);
      });
      var payload = {
        image_type: imageType,
        image_base64: base64,
        clinical_context: imageNotes,
        language: language
      };
      if (currentPatientId) payload.patient_id = currentPatientId;
      var res = await aiAPI.analyzeMedicalImage(payload);
      setImageResult(res.data);
      setImageError(null);
    } catch (e) {
      var msg = e?.response?.data?.detail || e?.message || t('فشل التحليل', 'Analysis failed');
      var errStr = typeof msg === 'string' ? msg : t('فشل التحليل', 'Analysis failed');
      setImageError(errStr);
      toast.error(errStr);
    }
    setImageAnalyzing(false);
  }

  function addMedication() {
    if (newMed.trim() && medications.indexOf(newMed.trim()) === -1) {
      setMedications(medications.concat([newMed.trim()]));
      setNewMed('');
    }
  }

  function removeMedication(m) {
    setMedications(medications.filter(function(x) { return x !== m; }));
  }

  async function checkDrugInteractions() {
    if (medications.length < 2) {
      toast.error(t('أضف دوائين على الأقل', 'Add at least 2 medications'));
      return;
    }
    setDrugAnalyzing(true);
    setDrugResult(null);
    setDrugError(null);
    try {
      var payload = { medications: medications, language: language };
      if (currentPatientId) payload.patient_id = currentPatientId;
      var res = await aiAPI.checkDrugInteractions(payload);
      setDrugResult(res.data);
    } catch (e) {
      var msg = e?.response?.data?.detail || t('فشل الفحص', 'Check failed');
      var errStr = typeof msg === 'string' ? msg : t('فشل الفحص', 'Check failed');
      setDrugError(errStr);
      toast.error(errStr);
    }
    setDrugAnalyzing(false);
  }

  async function saveInsight(type, payload) {
    if (!currentPatientId) return;
    try {
      await aiAPI.saveAIInsight({ patient_id: currentPatientId, type: type, payload: payload });
      toast.success(t('تم الحفظ في ملف المريض', 'Saved to patient file'));
    } catch (e) {
      toast.error(t('فشل الحفظ', 'Save failed'));
    }
  }

  function getReportDisplayText(result) {
    if (!result) return '';
    if (result.formatted_content) return result.formatted_content;
    if (typeof result.content === 'string') return result.content;
    var skip = ['patient_id', 'report_type', 'generated_at', 'generated_by', 'formatted_content'];
    return Object.entries(result)
      .filter(function(_ref) { var k = _ref[0]; return !skip.includes(k); })
      .map(function(_ref2) { var key = _ref2[0], val = _ref2[1]; return key + ': ' + (typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)); })
      .join('\n\n');
  }

  async function generateReport() {
    if (!reportPatientId) {
      toast.error(t('اختر مريضاً', 'Select a patient'));
      return;
    }
    setReportLoading(true);
    setReportResult(null);
    setReportEditContent('');
    setReportError(null);
    try {
      var res = await aiAPI.generateReport({
        patient_id: reportPatientId,
        report_type: reportType,
        language: language
      });
      setReportResult(res.data);
      setReportEditContent(getReportDisplayText(res.data));
    } catch (e) {
      var msg = e.response?.data?.detail || t('فشل إنشاء التقرير', 'Report generation failed');
      var errStr = typeof msg === 'string' ? msg : t('فشل إنشاء التقرير', 'Report generation failed');
      setReportError(errStr);
      toast.error(errStr);
    }
    setReportLoading(false);
  }

  function drugSeverityClass(severity) {
    if (!severity) return 'bg-blue-50 border-blue-200';
    var s = String(severity).toLowerCase();
    if (s === 'خطير' || s === 'high' || s === 'dangerous' || s === 'severe' || s === 'critical') return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
    if (s === 'متوسط' || s === 'medium' || s === 'moderate') return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
    return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
  }

  var reportTypeLabels = { monthly: t('متابعة شهرية', 'Monthly'), quarterly: t('ربع سنوي', 'Quarterly'), referral: t('تحويل', 'Referral'), case_summary: t('خلاصة حالة', 'Case summary'), lab_report: t('تقرير مختبر', 'Lab report'), follow_up: t('متابعة دورية', 'Follow-up'), discharge_summary: t('تقرير خروج', 'Discharge summary') };

  function printReport() {
    var textToPrint = reportEditContent || (reportResult ? getReportDisplayText(reportResult) : '');
    if (!textToPrint && !reportResult) return;
    var patient = patients.find(function(p) { return p.id === reportPatientId; });
    var patientName = patient ? (language === 'ar' ? (patient.name_ar || patient.name) : patient.name) : '';
    var dateStr = new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var reportTypeText = reportTypeLabels[reportType] || reportType;
    
    var w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html dir="' + (language === 'ar' ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><title>' + (reportResult.report_title || t('تقرير طبي', 'Medical Report')) + '</title>');
    w.document.write('<style>');
    w.document.write('@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }');
    w.document.write('body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }');
    w.document.write('.header { text-align: center; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }');
    w.document.write('.header h1 { color: #7c3aed; margin: 10px 0; font-size: 24px; }');
    w.document.write('.header .subtitle { color: #666; font-size: 14px; }');
    w.document.write('.info-row { display: flex; justify-content: space-between; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }');
    w.document.write('.section { margin-bottom: 20px; padding: 15px; border-radius: 8px; }');
    w.document.write('.section h3 { margin: 0 0 10px; font-size: 16px; }');
    w.document.write('.section p { margin: 0; font-size: 14px; white-space: pre-wrap; }');
    w.document.write('.blue { background: #eff6ff; border-' + (language === 'ar' ? 'right' : 'left') + ': 4px solid #3b82f6; }');
    w.document.write('.blue h3 { color: #1d4ed8; }');
    w.document.write('.teal { background: #f0fdfa; border-' + (language === 'ar' ? 'right' : 'left') + ': 4px solid #14b8a6; }');
    w.document.write('.teal h3 { color: #0d9488; }');
    w.document.write('.green { background: #f0fdf4; border-' + (language === 'ar' ? 'right' : 'left') + ': 4px solid #22c55e; }');
    w.document.write('.green h3 { color: #16a34a; }');
    w.document.write('.amber { background: #fffbeb; border-' + (language === 'ar' ? 'right' : 'left') + ': 4px solid #f59e0b; }');
    w.document.write('.amber h3 { color: #d97706; }');
    w.document.write('.footer { margin-top: 40px; padding-top: 20px; border-top: 2px dashed #ddd; display: flex; justify-content: space-between; }');
    w.document.write('.signature { text-align: center; }');
    w.document.write('.signature-line { width: 150px; border-top: 1px solid #333; margin: 30px auto 5px; }');
    w.document.write('.disclaimer { margin-top: 30px; padding: 10px; background: #f1f5f9; border-radius: 8px; text-align: center; font-size: 12px; color: #64748b; }');
    w.document.write('</style></head><body>');
    w.document.write('<div class="header">');
    w.document.write('<h1>' + (reportResult.report_title || t('تقرير طبي', 'Medical Report')) + '</h1>');
    w.document.write('<div class="subtitle">Tebbi Medical System</div>');
    w.document.write('</div>');
    w.document.write('<div class="info-row">');
    w.document.write('<div><strong>' + t('المريض:', 'Patient:') + '</strong> ' + patientName + '</div>');
    w.document.write('<div><strong>' + t('التاريخ:', 'Date:') + '</strong> ' + dateStr + '</div>');
    w.document.write('<div><strong>' + t('النوع:', 'Type:') + '</strong> ' + reportTypeText + '</div>');
    w.document.write('</div>');
    w.document.write('<div class="section blue" style="white-space: pre-wrap;"><p>' + (textToPrint.replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</p></div>');
    w.document.write('<div class="footer">');
    w.document.write('<div class="signature"><div class="signature-line"></div><div>' + t('توقيع الطبيب', 'Doctor Signature') + '</div></div>');
    w.document.write('<div class="signature"><div class="signature-line"></div><div>' + t('ختم العيادة', 'Clinic Stamp') + '</div></div>');
    w.document.write('</div>');
    w.document.write('<div class="disclaimer">' + t('هذا التقرير تم إنشاؤه بواسطة نظام Tebbi AI - للاستخدام الطبي فقط', 'This report was generated by Tebbi AI System - For medical use only') + '</div>');
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(function() { w.print(); }, 100);
  }

  function setCurrentPatient(pid) {
    setCurrentPatientId(pid || '');
    if (pid) {
      var p = patients.find(function(x) { return x.id === pid; });
      setCurrentPatientName(p ? (language === 'ar' ? (p.name_ar || p.name) : p.name) : '');
      setReportPatientId(pid);
    } else {
      setCurrentPatientName('');
    }
  }

  var aiStatusBadge = aiStatus.loading
    ? React.createElement(Badge, { variant: 'secondary', className: 'gap-1' },
        React.createElement(Loader2, { className: 'w-3 h-3 animate-spin' }),
        t('جاري التحقق...', 'Checking...')
      )
    : aiStatus.connected
      ? React.createElement(Badge, { className: 'gap-1 bg-green-600 hover:bg-green-700' },
          React.createElement(Wifi, { className: 'w-3 h-3' }),
          t('متصل', 'Connected') + ' (' + (aiStatus.provider === 'gemini' ? 'Gemini' : 'OpenAI') + ')'
        )
      : user?.company_id
        ? React.createElement(Button, { variant: 'outline', size: 'sm', className: 'gap-1 border-amber-300 text-amber-700 hover:bg-amber-50', onClick: function() { navigate('/clinic-admin'); } },
            React.createElement(WifiOff, { className: 'w-3 h-3' }),
            t('غير متصل — ربط المفتاح من الإعدادات', 'Not connected — Link key in Settings'),
            React.createElement(Settings, { className: 'w-3 h-3' })
          )
        : React.createElement(Badge, { variant: 'secondary', className: 'gap-1' },
            React.createElement(WifiOff, { className: 'w-3 h-3' }),
            t('غير متصل', 'Not connected')
          );

  return React.createElement('div', { className: 'space-y-6', 'data-testid': 'ai-assistant-page', dir: language === 'ar' ? 'rtl' : 'ltr' },
    React.createElement('div', { className: 'rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-purple-50/50 dark:from-teal-950/30 dark:to-purple-950/20 p-6' },
      React.createElement('div', { className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4' },
        React.createElement('div', { className: 'flex-1 min-w-0' },
          React.createElement('div', { className: 'flex flex-wrap items-center gap-2 mb-2' }, aiStatusBadge),
          React.createElement('h1', { className: 'text-3xl font-bold flex items-center gap-3 text-teal-800 dark:text-teal-100' },
            React.createElement(Brain, { className: 'w-10 h-10 text-teal-600 dark:text-teal-400 shrink-0' }),
            t('مركز الذكاء الاصطناعي', 'AI Center')
          ),
          React.createElement('p', { className: 'text-muted-foreground mt-1' },
            t('أدوات ذكية لدعم القرار الطبي', 'Smart tools for medical decision support')
          ),
          React.createElement('div', { className: 'mt-3 flex flex-wrap items-center gap-2' },
            React.createElement(Label, { className: 'text-sm text-muted-foreground ' + (language === 'ar' ? 'me-2' : 'mr-2') }, t('المريض الحالي', 'Current patient')),
            React.createElement(Select, { value: currentPatientId || '_none', onValueChange: function(v) { setCurrentPatient(v === '_none' ? '' : v); } },
              React.createElement(SelectTrigger, { className: 'w-[200px]' },
                React.createElement(SelectValue, { placeholder: t('اختر مريضاً', 'Select patient') })
              ),
              React.createElement(SelectContent, null,
                React.createElement(SelectItem, { value: '_none' }, t('— لا مريض —', '— No patient —')),
                patients.map(function(p) {
                  return React.createElement(SelectItem, { key: p.id, value: p.id },
                    language === 'ar' ? (p.name_ar || p.name) : p.name
                  );
                })
              )
            )
          )
        ),
        React.createElement(Button, { onClick: function() { setChatOpen(true); }, className: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2 shrink-0 shadow-md' },
          React.createElement(MessageSquare, { className: 'w-4 h-4' }),
          t('محادثة مع AI', 'Chat with AI')
        )
      )
    ),

    !currentPatientId ? React.createElement(Card, { className: 'border-dashed border-2 border-slate-200 bg-slate-50/50 dark:bg-slate-900/30' },
      React.createElement(CardContent, { className: 'py-6 text-center' },
        React.createElement(User, { className: 'w-12 h-12 mx-auto text-slate-400 mb-3' }),
        React.createElement('p', { className: 'text-muted-foreground' },
          t('اختر مريضاً لربط النتائج بملفه أو استخدم الأدوات بدون مريض', 'Select a patient to link results to their file, or use the tools without a patient')
        )
      )
    ) : null,

    currentPatientId && currentPatientName ? React.createElement(React.Fragment, null,
      React.createElement(Card, { className: 'bg-teal-50 border-teal-200' },
        React.createElement(CardContent, { className: 'py-3 flex flex-wrap items-center justify-between gap-2' },
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement(User, { className: 'w-5 h-5 text-teal-600' }),
            React.createElement('span', { className: 'font-medium' }, currentPatientName),
            React.createElement(Badge, { variant: 'secondary' }, t('مرتبط بجميع الأدوات', 'Linked to all tools'))
          ),
          React.createElement(Button, { variant: 'outline', size: 'sm', className: 'gap-1', onClick: function() { navigate('/patients/' + currentPatientId); } },
            React.createElement(ExternalLink, { className: 'w-4 h-4' }),
            t('فتح ملف المريض', 'Open patient file')
          )
        )
      ),
      patientAlerts && (patientAlerts.critical_alerts?.length > 0 || patientAlerts.warnings?.length > 0) ? React.createElement(Card, { className: 'bg-amber-50 border-amber-200' },
        React.createElement(CardContent, { className: 'py-3 flex flex-wrap items-center justify-between gap-2' },
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement(Bell, { className: 'w-5 h-5 text-amber-600' }),
            React.createElement('span', { className: 'text-sm' }, t('تنبيهات ذكية', 'Smart alerts') + ': ' + ((patientAlerts.critical_alerts?.length || 0) + (patientAlerts.warnings?.length || 0)) + ' ' + t('تنبيه', 'alert(s)'))
          ),
          React.createElement(Button, { variant: 'outline', size: 'sm', className: 'gap-1', onClick: function() { navigate('/patients/' + currentPatientId); } },
            React.createElement(ExternalLink, { className: 'w-4 h-4' }),
            t('عرض كل التنبيهات', 'View all alerts')
          )
        )
      ) : null
    ) : null,

    React.createElement(Alert, { className: 'rounded-xl bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
      React.createElement(AlertTriangle, { className: 'h-5 w-5 text-amber-600 shrink-0' }),
      React.createElement(AlertTitle, { className: 'text-amber-800 dark:text-amber-200' }, t('تنبيه هام', 'Important')),
      React.createElement(AlertDescription, { className: 'text-amber-700 dark:text-amber-300' },
        t('اقتراح مساعد فقط — القرار النهائي للتشخيص والعلاج للطبيب المعالج. هذه الأدوات لا تغني عن الفحص السريري.', 'Assistive suggestion only — final diagnosis and treatment decision is for the treating physician. These tools do not replace clinical examination.')
      )
    ),

    React.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
      React.createElement(Card, { className: 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-teal-300 transition-all duration-200 border-2', onClick: function() { setSymptomsOpen(true); } },
        React.createElement(CardContent, { className: 'p-6 text-center' },
          React.createElement(Stethoscope, { className: 'w-12 h-12 mx-auto text-teal-600 dark:text-teal-400 mb-3' }),
          React.createElement('h3', { className: 'font-semibold' }, t('تحليل الأعراض', 'Symptom Analysis')),
          React.createElement('p', { className: 'text-xs text-muted-foreground mt-1' }, t('تشخيص تفريقي ذكي', 'Smart differential diagnosis'))
        )
      ),
      React.createElement(Card, { className: 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-blue-300 transition-all duration-200 border-2', onClick: function() { setActiveTab('image'); } },
        React.createElement(CardContent, { className: 'p-6 text-center' },
          React.createElement(ImageIcon, { className: 'w-12 h-12 mx-auto text-blue-600 dark:text-blue-400 mb-3' }),
          React.createElement('h3', { className: 'font-semibold' }, t('تحليل الصور', 'Image Analysis')),
          React.createElement('p', { className: 'text-xs text-muted-foreground mt-1' }, t('أشعة، تخطيط، تحاليل', 'X-ray, ECG, Labs'))
        )
      ),
      React.createElement(Card, { className: 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-orange-300 transition-all duration-200 border-2', onClick: function() { setActiveTab('drugs'); } },
        React.createElement(CardContent, { className: 'p-6 text-center' },
          React.createElement(Pill, { className: 'w-12 h-12 mx-auto text-orange-600 dark:text-orange-400 mb-3' }),
          React.createElement('h3', { className: 'font-semibold' }, t('التداخلات الدوائية', 'Drug Interactions')),
          React.createElement('p', { className: 'text-xs text-muted-foreground mt-1' }, t('فحص التعارضات', 'Check conflicts'))
        )
      ),
      React.createElement(Card, { className: 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-purple-300 transition-all duration-200 border-2', onClick: function() { setActiveTab('reports'); } },
        React.createElement(CardContent, { className: 'p-6 text-center' },
          React.createElement(FileText, { className: 'w-12 h-12 mx-auto text-purple-600 dark:text-purple-400 mb-3' }),
          React.createElement('h3', { className: 'font-semibold' }, t('تقارير AI', 'AI Reports')),
          React.createElement('p', { className: 'text-xs text-muted-foreground mt-1' }, t('تقارير تلقائية', 'Auto-generated reports'))
        )
      )
    ),

    React.createElement(Tabs, { value: activeTab, onValueChange: setActiveTab },
      React.createElement(TabsList, { className: 'grid w-full grid-cols-3 rounded-xl' },
        React.createElement(TabsTrigger, { value: 'image', className: 'rounded-lg' }, t('تحليل الصور', 'Images')),
        React.createElement(TabsTrigger, { value: 'drugs', className: 'rounded-lg' }, t('التداخلات', 'Drugs')),
        React.createElement(TabsTrigger, { value: 'reports', className: 'rounded-lg' }, t('التقارير', 'Reports'))
      ),

      React.createElement(TabsContent, { value: 'image', className: 'mt-6 rounded-xl border bg-slate-50/50 dark:bg-slate-900/20 p-6' },
        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
          React.createElement(Card, { className: 'border-2' },
            React.createElement(CardHeader, null,
              React.createElement(CardTitle, null, t('رفع صورة طبية', 'Upload Medical Image')),
              React.createElement(CardDescription, null, t('أشعة، تخطيط قلب، تحاليل', 'X-ray, ECG, Labs'))
            ),
            React.createElement(CardContent, { className: 'space-y-4' },
              React.createElement('div', { className: 'space-y-2' },
                React.createElement(Label, null, t('نوع الصورة', 'Image Type')),
                React.createElement(Select, { value: imageType, onValueChange: setImageType },
                  React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
                  React.createElement(SelectContent, null,
                    React.createElement(SelectItem, { value: 'xray' }, t('أشعة سينية X-Ray', 'X-Ray')),
                    React.createElement(SelectItem, { value: 'ecg' }, t('تخطيط قلب ECG', 'ECG')),
                    React.createElement(SelectItem, { value: 'lab' }, t('تحليل مخبري', 'Lab Test')),
                    React.createElement(SelectItem, { value: 'other' }, t('أخرى', 'Other'))
                  )
                )
              ),
              React.createElement('div', { className: 'border-2 border-dashed rounded-xl p-6 text-center ' + (imagePreview ? 'border-teal-300 bg-teal-50' : 'border-slate-300') },
                imagePreview ?
                  React.createElement('div', { className: 'space-y-4' },
                    React.createElement('img', { src: imagePreview, alt: 'Preview', className: 'max-h-48 mx-auto rounded-lg' }),
                    React.createElement(Button, { variant: 'outline', size: 'sm', onClick: function() { setImageFile(null); setImagePreview(null); } }, t('إزالة', 'Remove'))
                  ) :
                  React.createElement('label', { className: 'cursor-pointer' },
                    React.createElement(Upload, { className: 'w-12 h-12 mx-auto text-muted-foreground mb-2' }),
                    React.createElement('p', { className: 'text-muted-foreground' }, t('انقر لاختيار صورة', 'Click to select image')),
                    React.createElement('input', { type: 'file', accept: 'image/*', onChange: handleImageSelect, className: 'hidden' })
                  )
              ),
              React.createElement(Textarea, { value: imageNotes, onChange: function(e) { setImageNotes(e.target.value); }, placeholder: t('ملاحظات سريرية...', 'Clinical notes...') }),
              React.createElement(Button, { onClick: handleImageAnalysis, disabled: !imageFile || imageAnalyzing, className: 'w-full bg-teal-600' },
                imageAnalyzing ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin me-2' }) : React.createElement(Brain, { className: 'w-4 h-4 me-2' }),
                t('تحليل', 'Analyze')
              )
            )
          ),
          React.createElement(Card, { className: 'border-2' },
            React.createElement(CardHeader, null, React.createElement(CardTitle, null, t('نتائج التحليل', 'Results'))),
            React.createElement(CardContent, null,
              imageError ?
                React.createElement('div', { className: 'space-y-4' },
                  React.createElement(Alert, { className: 'rounded-lg border-red-200 bg-red-50 dark:bg-red-950/30' },
                    React.createElement(AlertTriangle, { className: 'h-4 w-4 text-red-600' }),
                    React.createElement(AlertTitle, null, t('فشل التحليل', 'Analysis failed')),
                    React.createElement(AlertDescription, null, imageError),
                    React.createElement(Button, { variant: 'outline', size: 'sm', className: 'mt-3 gap-1', onClick: handleImageAnalysis, disabled: imageAnalyzing },
                      imageAnalyzing ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }) : null,
                      t('إعادة المحاولة', 'Retry')
                    )
                  )
                ) : imageResult ?
                React.createElement('div', { className: 'space-y-4' },
                  imageResult.findings ? React.createElement('div', { className: 'p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg' },
                    React.createElement('h4', { className: 'font-bold text-blue-700 dark:text-blue-300 mb-2' }, t('النتائج', 'Findings')),
                    React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' },
                      (imageResult.findings || []).map(function(f, i) {
                        return React.createElement('li', { key: i }, '• ' + (f.finding || f.description || f));
                      })
                    )
                  ) : null,
                  imageResult.diagnosis ? React.createElement('div', { className: 'p-4 bg-teal-50 dark:bg-teal-950/40 rounded-lg' },
                    React.createElement('h4', { className: 'font-bold text-teal-700 dark:text-teal-300 mb-2' }, t('التشخيص', 'Diagnosis')),
                    React.createElement('p', { className: 'text-sm text-slate-800 dark:text-slate-100' }, imageResult.diagnosis)
                  ) : null,
                  imageResult.recommendations ? React.createElement('div', { className: 'p-4 bg-green-50 dark:bg-green-950/40 rounded-lg' },
                    React.createElement('h4', { className: 'font-bold text-green-700 dark:text-green-300 mb-2' }, t('التوصيات', 'Recommendations')),
                    React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' },
                      (imageResult.recommendations || []).map(function(r, i) { return React.createElement('li', { key: i }, '• ' + r); })
                    )
                  ) : null,
                  imageResult.analysis ? React.createElement('div', { className: 'p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg' },
                    React.createElement('p', { className: 'text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap' }, imageResult.analysis)
                  ) : null,
                  currentPatientId ? React.createElement(Button, { variant: 'outline', size: 'sm', className: 'mt-3 gap-1', onClick: function() { saveInsight('image_analysis', imageResult); } },
                    React.createElement(FileText, { className: 'w-4 h-4' }),
                    t('حفظ في ملف المريض', 'Save to patient file')
                  ) : null,
                  React.createElement('p', { className: 'text-xs text-muted-foreground mt-3 pt-3 border-t' }, language === 'ar' ? AI_DISCLAIMER_AR : AI_DISCLAIMER_EN)
                ) :
                React.createElement('div', { className: 'text-center py-12 text-muted-foreground' },
                  React.createElement(ImageIcon, { className: 'w-16 h-16 mx-auto opacity-30 mb-4' }),
                  React.createElement('p', null, t('ارفع صورة للتحليل', 'Upload image to analyze'))
                )
            )
          )
        )
      ),

      React.createElement(TabsContent, { value: 'drugs', className: 'mt-6 rounded-xl border bg-slate-50/50 dark:bg-slate-900/20 p-6' },
        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
          React.createElement(Card, { className: 'border-2' },
            React.createElement(CardHeader, null,
              React.createElement(CardTitle, null, t('فحص التداخلات الدوائية', 'Drug Interaction Check')),
              React.createElement(CardDescription, null, currentPatientId ? t('أدوية المريض الحالي مُحمّلة — أضف أو احذف حسب الحاجة', 'Current patient medications loaded — add or remove as needed') : t('أضف الأدوية لفحص التعارضات', 'Add medications to check for conflicts'))
            ),
            React.createElement(CardContent, { className: 'space-y-4' },
              currentPatientId && medications.length > 0 ? React.createElement('p', { className: 'text-xs text-teal-600' }, t('من ملف المريض', 'From patient file') + ': ' + currentPatientName) : null,
              React.createElement('div', { className: 'flex gap-2' },
                React.createElement(Input, { value: newMed, onChange: function(e) { setNewMed(e.target.value); }, placeholder: t('اسم الدواء...', 'Medication name...'), onKeyPress: function(e) { if (e.key === 'Enter') addMedication(); } }),
                React.createElement(Button, { onClick: addMedication, size: 'icon' }, React.createElement(Plus, { className: 'w-4 h-4' }))
              ),
              medications.length > 0 ? React.createElement('div', { className: 'flex flex-wrap gap-2' },
                medications.map(function(m) {
                  return React.createElement(Badge, { key: m, className: 'bg-orange-100 text-orange-700 gap-1' },
                    React.createElement(Pill, { className: 'w-3 h-3' }),
                    m,
                    React.createElement(X, { className: 'w-3 h-3 cursor-pointer hover:text-red-500', onClick: function() { removeMedication(m); } })
                  );
                })
              ) : null,
              React.createElement(Button, { onClick: checkDrugInteractions, disabled: medications.length < 2 || drugAnalyzing, className: 'w-full bg-orange-600 hover:bg-orange-700' },
                drugAnalyzing ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin me-2' }) : React.createElement(Pill, { className: 'w-4 h-4 me-2' }),
                t('فحص التداخلات', 'Check Interactions')
              )
            )
          ),
          React.createElement(Card, { className: 'border-2' },
            React.createElement(CardHeader, null, React.createElement(CardTitle, null, t('نتائج الفحص', 'Results'))),
            React.createElement(CardContent, null,
              drugError ?
                React.createElement('div', { className: 'space-y-4' },
                  React.createElement(Alert, { className: 'rounded-lg border-red-200 bg-red-50 dark:bg-red-950/30' },
                    React.createElement(AlertTriangle, { className: 'h-4 w-4 text-red-600' }),
                    React.createElement(AlertTitle, null, t('فشل الفحص', 'Check failed')),
                    React.createElement(AlertDescription, null, drugError),
                    React.createElement(Button, { variant: 'outline', size: 'sm', className: 'mt-3 gap-1', onClick: checkDrugInteractions, disabled: drugAnalyzing },
                      drugAnalyzing ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }) : null,
                      t('إعادة المحاولة', 'Retry')
                    )
                  )
                ) : drugResult ?
                React.createElement('div', { className: 'space-y-4' },
                  (drugResult.interactions || []).length > 0 ? drugResult.interactions.map(function(int, i) {
                    var severityClass = drugSeverityClass(int.severity);
                    return React.createElement('div', { key: i, className: 'p-4 rounded-lg border ' + severityClass },
                      React.createElement('div', { className: 'flex justify-between items-start' },
                        React.createElement('h4', { className: 'font-bold' }, (int.drugs || []).join(' + ')),
                        React.createElement(Badge, { variant: 'outline' }, int.severity)
                      ),
                      React.createElement('p', { className: 'text-sm mt-2' }, int.description),
                      int.recommendation ? React.createElement('p', { className: 'text-sm text-muted-foreground mt-1' }, '→ ' + int.recommendation) : null
                    );
                  }) : React.createElement('div', { className: 'p-4 bg-green-50 rounded-lg text-center' },
                    React.createElement(CheckCircle, { className: 'w-8 h-8 mx-auto text-green-600 mb-2' }),
                    React.createElement('p', { className: 'text-green-700' }, t('لا توجد تداخلات خطيرة', 'No dangerous interactions'))
                  ),
                  drugResult.warnings && drugResult.warnings.length > 0 ? React.createElement('div', { className: 'p-4 bg-amber-50 rounded-lg' },
                    React.createElement('h4', { className: 'font-bold text-amber-700 mb-2' }, t('تحذيرات', 'Warnings')),
                    React.createElement('ul', { className: 'text-sm space-y-1' },
                      drugResult.warnings.map(function(w, i) { return React.createElement('li', { key: i }, '⚠️ ' + w); })
                    )
                  ) : null,
                  currentPatientId ? React.createElement(Button, { variant: 'outline', size: 'sm', className: 'mt-3 gap-1', onClick: function() { saveInsight('drug_interaction', drugResult); } },
                    React.createElement(FileText, { className: 'w-4 h-4' }),
                    t('حفظ في ملف المريض', 'Save to patient file')
                  ) : null,
                  React.createElement('p', { className: 'text-xs text-muted-foreground mt-3 pt-3 border-t' }, language === 'ar' ? AI_DISCLAIMER_AR : AI_DISCLAIMER_EN)
                ) :
                React.createElement('div', { className: 'text-center py-12 text-muted-foreground' },
                  React.createElement(Pill, { className: 'w-16 h-16 mx-auto opacity-30 mb-4' }),
                  React.createElement('p', null, t('أضف الأدوية للفحص', 'Add medications to check'))
                )
            )
          )
        )
      ),

      React.createElement(TabsContent, { value: 'reports', className: 'mt-6 rounded-xl border bg-slate-50/50 dark:bg-slate-900/20 p-6' },
        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
          React.createElement(Card, { className: 'border-2' },
            React.createElement(CardHeader, null,
              React.createElement(CardTitle, null, t('إنشاء تقرير AI', 'Generate AI Report')),
              React.createElement(CardDescription, null, t('تقارير طبية تلقائية شاملة', 'Comprehensive auto-generated medical reports'))
            ),
            React.createElement(CardContent, { className: 'space-y-4' },
              React.createElement('div', { className: 'space-y-2' },
                React.createElement(Label, null, t('المريض', 'Patient')),
                React.createElement(Select, { value: reportPatientId, onValueChange: setReportPatientId },
                  React.createElement(SelectTrigger, null, React.createElement(SelectValue, { placeholder: t('اختر مريضاً', 'Select patient') })),
                  React.createElement(SelectContent, null,
                    patients.map(function(p) {
                      return React.createElement(SelectItem, { key: p.id, value: p.id },
                        language === 'ar' ? (p.name_ar || p.name) : p.name
                      );
                    })
                  )
                )
              ),
              React.createElement('div', { className: 'space-y-2' },
                React.createElement(Label, null, t('نوع التقرير', 'Report Type')),
                React.createElement(Select, { value: reportType, onValueChange: setReportType },
                  React.createElement(SelectTrigger, null, React.createElement(SelectValue, null)),
                  React.createElement(SelectContent, null,
                    React.createElement(SelectItem, { value: 'monthly' }, t('تقرير متابعة شهري', 'Monthly Follow-up')),
                    React.createElement(SelectItem, { value: 'quarterly' }, t('تقرير ربع سنوي', 'Quarterly Report')),
                    React.createElement(SelectItem, { value: 'referral' }, t('تقرير تحويل', 'Referral Report')),
                    React.createElement(SelectItem, { value: 'case_summary' }, t('خلاصة حالة', 'Case Summary')),
                    React.createElement(SelectItem, { value: 'lab_report' }, t('تقرير مختبر', 'Lab Report')),
                    React.createElement(SelectItem, { value: 'follow_up' }, t('متابعة دورية', 'Follow-up')),
                    React.createElement(SelectItem, { value: 'discharge_summary' }, t('تقرير خروج', 'Discharge Summary'))
                  )
                )
              ),
              React.createElement(Button, { onClick: generateReport, disabled: !reportPatientId || reportLoading, className: 'w-full bg-purple-600 hover:bg-purple-700' },
                reportLoading ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin me-2' }) : React.createElement(FileText, { className: 'w-4 h-4 me-2' }),
                t('إنشاء التقرير', 'Generate Report')
              )
            )
          ),
          React.createElement(Card, { className: 'border-2' },
            React.createElement(CardHeader, null, React.createElement(CardTitle, { className: 'text-slate-800 dark:text-slate-100' }, t('التقرير', 'Report'))),
            React.createElement(CardContent, null,
              reportError ?
                React.createElement('div', { className: 'space-y-4' },
                  React.createElement(Alert, { className: 'rounded-lg border-red-200 bg-red-50 dark:bg-red-950/30' },
                    React.createElement(AlertTriangle, { className: 'h-4 w-4 text-red-600' }),
                    React.createElement(AlertTitle, null, t('فشل إنشاء التقرير', 'Report failed')),
                    React.createElement(AlertDescription, null, reportError),
                    React.createElement(Button, { variant: 'outline', size: 'sm', className: 'mt-3 gap-1', onClick: generateReport, disabled: reportLoading },
                      reportLoading ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }) : null,
                      t('إعادة المحاولة', 'Retry')
                    )
                  )
                ) : reportResult ?
                React.createElement('div', { className: 'space-y-4' },
                  reportResult.report_title ? React.createElement('h3', { className: 'text-lg font-bold text-center p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-slate-800 dark:text-slate-100' }, reportResult.report_title) : null,
                  React.createElement('p', { className: 'text-xs text-muted-foreground' }, language === 'ar' ? 'يمكنك تعديل النص أدناه قبل الطباعة أو الحفظ. التعديل ضروري إن أردت تغيير أي جملة.' : 'You can edit the text below before print or save. Editing is important if you want to change any part.'),
                  React.createElement(Textarea, {
                    dir: language === 'ar' ? 'rtl' : 'ltr',
                    className: 'min-h-[280px] w-full rounded-lg border bg-slate-50 dark:bg-slate-900 p-4 text-sm whitespace-pre-wrap resize-y text-slate-800 dark:text-slate-100 placeholder:text-slate-500',
                    value: reportEditContent,
                    onChange: function(e) { return setReportEditContent(e.target.value); },
                    placeholder: language === 'ar' ? 'محتوى التقرير...' : 'Report content...'
                  }),
                  React.createElement('div', { className: 'flex flex-wrap gap-2' },
                  React.createElement(Button, { variant: 'outline', className: 'gap-2', onClick: printReport },
                    React.createElement(FileText, { className: 'w-4 h-4' }),
                    t('طباعة / حفظ PDF', 'Print / Save PDF')
                  ),
                  currentPatientId ? React.createElement(Button, { variant: 'outline', className: 'gap-2', onClick: function() { saveInsight('report', reportResult); } },
                    React.createElement(FileText, { className: 'w-4 h-4' }),
                    t('حفظ في ملف المريض', 'Save to patient file')
                  ) : null
                ),
                  React.createElement('p', { className: 'text-xs text-muted-foreground mt-3 pt-3 border-t' }, language === 'ar' ? AI_DISCLAIMER_AR : AI_DISCLAIMER_EN)
                ) :
                React.createElement('div', { className: 'text-center py-12 text-muted-foreground' },
                  React.createElement(FileText, { className: 'w-16 h-16 mx-auto opacity-30 mb-4' }),
                  React.createElement('p', null, t('اختر مريضاً لإنشاء تقرير', 'Select patient to generate report'))
                )
            )
          )
        )
      )
    ),

    React.createElement(AIChatDialog, { open: chatOpen, onOpenChange: setChatOpen, patientId: currentPatientId, patientName: currentPatientName, t: t, language: language }),
    React.createElement(SmartSymptomsDialog, { open: symptomsOpen, onOpenChange: setSymptomsOpen, patientId: currentPatientId, patientName: currentPatientName, onSaveToPatient: currentPatientId ? function(result) { saveInsight('symptom_analysis', result); } : undefined, t: t, language: language })
  );
}

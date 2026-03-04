import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, X, Plus, Printer, Upload, FileText, Receipt, ClipboardList, MessageSquare, Pill } from 'lucide-react';
import { toast } from 'sonner';
import { visitsAPI, referenceAPI, medicalImagesAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { buildInvoiceHtml, printHtml } from '../../utils/printTemplate';

// Common visit reasons
const COMMON_REASONS = [
  { id: 'checkup', ar: 'فحص دوري', en: 'Regular Checkup' },
  { id: 'follow_up', ar: 'متابعة', en: 'Follow-up' },
  { id: 'headache', ar: 'صداع', en: 'Headache' },
  { id: 'fever', ar: 'حرارة', en: 'Fever' },
  { id: 'cough', ar: 'سعال', en: 'Cough' },
  { id: 'cold', ar: 'زكام / رشح', en: 'Cold' },
  { id: 'stomach', ar: 'ألم في البطن', en: 'Stomach Pain' },
  { id: 'back_pain', ar: 'ألم في الظهر', en: 'Back Pain' },
  { id: 'chest_pain', ar: 'ألم في الصدر', en: 'Chest Pain' },
  { id: 'dizziness', ar: 'دوخة', en: 'Dizziness' },
  { id: 'fatigue', ar: 'إرهاق / تعب', en: 'Fatigue' },
  { id: 'skin', ar: 'مشكلة جلدية', en: 'Skin Problem' },
  { id: 'allergy', ar: 'حساسية', en: 'Allergy' },
  { id: 'diabetes', ar: 'متابعة سكري', en: 'Diabetes Follow-up' },
  { id: 'bp', ar: 'متابعة ضغط', en: 'BP Follow-up' },
  { id: 'prescription', ar: 'تجديد وصفة', en: 'Prescription Renewal' },
  { id: 'vaccination', ar: 'تطعيم', en: 'Vaccination' },
  { id: 'lab_results', ar: 'نتائج تحاليل', en: 'Lab Results Review' },
];

export default function NewVisitDialog({ open, onOpenChange, patientId, patientName, onSuccess, t, language }) {
  const { user } = useAuth();
  const companyId = user?.company_id;
  const [diag, setDiag] = useState([]);
  const [meds, setMeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [temp, setTemp] = useState('');
  const [bp, setBp] = useState('');
  const [hr, setHr] = useState('');
  const [o2, setO2] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [dxList, setDxList] = useState([]);
  const [rxList, setRxList] = useState([]);
  const [fee, setFee] = useState('');
  const [imgs, setImgs] = useState([]);
  const [newDxName, setNewDxName] = useState('');
  const [addingDx, setAddingDx] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [addingMed, setAddingMed] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [pharmacyItems, setPharmacyItems] = useState([]);

  useEffect(() => {
    if (open) {
      referenceAPI.getDiagnoses().then(r => setDiag([...(r.data.common || []), ...(r.data.custom || [])])).catch(() => {});
      referenceAPI.getMedications().then(r => setMeds([...(r.data.common || []), ...(r.data.custom || [])])).catch(() => {});
    }
  }, [open]);

  const reset = () => { setTemp(''); setBp(''); setHr(''); setO2(''); setReason(''); setCustomReason(''); setDxList([]); setRxList([]); setFee(''); setImgs([]); setNewDxName(''); setNewMedName(''); setDoctorNotes(''); setPharmacyItems([]); };

  const addDx = (id) => { const d = diag.find(x => x.id === id); if (d && !dxList.find(x => x.id === id)) setDxList([...dxList, { id, name: language === 'ar' ? d.name_ar : d.name_en }]); };
  const removeDx = (id) => setDxList(dxList.filter(x => x.id !== id));

  // Add custom diagnosis
  const addCustomDx = async () => {
    if (!newDxName.trim()) return;
    setAddingDx(true);
    try {
      const res = await referenceAPI.addDiagnosis({ 
        name_ar: newDxName.trim(), 
        name_en: newDxName.trim(),
        id: `CUSTOM-${Date.now()}`
      });
      const newDx = res.data;
      setDiag([...diag, newDx]);
      setDxList([...dxList, { id: newDx.id, name: newDxName.trim() }]);
      setNewDxName('');
      toast.success(t('تمت إضافة التشخيص', 'Diagnosis added'));
    } catch (e) {
      toast.error(t('فشل الإضافة', 'Failed to add'));
    }
    setAddingDx(false);
  };

  // Handle reason selection
  const handleReasonSelect = (id) => {
    if (id === 'custom') {
      setReason('');
    } else {
      const r = COMMON_REASONS.find(x => x.id === id);
      if (r) setReason(language === 'ar' ? r.ar : r.en);
    }
  };

  // Multi-select for medications
  const addMed = (id) => {
    const m = meds.find(x => x.id === id);
    if (m && !rxList.find(x => x.id === id)) {
      setRxList([...rxList, { 
        id, 
        name: language === 'ar' ? m.name_ar : m.name_en,
        dose: m.dosages?.[0] || '',
        freq: 'مرة'
      }]);
    }
  };
  const removeMed = (id) => setRxList(rxList.filter(x => x.id !== id));
  const updateMedDose = (id, dose) => setRxList(rxList.map(x => x.id === id ? { ...x, dose } : x));
  const updateMedFreq = (id, freq) => setRxList(rxList.map(x => x.id === id ? { ...x, freq } : x));

  // Add custom medication
  const addCustomMed = async () => {
    if (!newMedName.trim()) return;
    setAddingMed(true);
    try {
      const res = await referenceAPI.addMedication({ 
        name_ar: newMedName.trim(), 
        name_en: newMedName.trim(),
        dosages: ['500mg', '250mg', '100mg']
      });
      const newMed = res.data;
      setMeds([...meds, newMed]);
      // Add to prescription list
      setRxList([...rxList, { 
        id: newMed.id, 
        name: newMedName.trim(),
        dose: '500mg',
        freq: 'مرة يومياً'
      }]);
      setNewMedName('');
      toast.success(t('تمت إضافة الدواء', 'Medication added'));
    } catch (e) {
      toast.error(t('فشل الإضافة', 'Failed to add'));
    }
    setAddingMed(false);
  };

  const handleImg = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onloadend = () => setImgs([...imgs, { name: file.name, type, b64: r.result }]);
      r.readAsDataURL(file);
    }
  };
  const removeImg = (i) => setImgs(imgs.filter((_, idx) => idx !== i));

  const printRx = () => {
    if (rxList.length === 0) return;
    const w = window.open('', '_blank');
    const dateStr = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>وصفة طبية</title>
    <style>
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      body { font-family: 'Segoe UI', Tahoma, Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
      .header h1 { color: #0d9488; margin: 10px 0; font-size: 28px; }
      .header .subtitle { color: #666; font-size: 14px; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; }
      .info-item { text-align: center; }
      .info-label { font-size: 12px; color: #666; }
      .info-value { font-weight: bold; font-size: 16px; }
      .diagnosis { background: #e6f7f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #0d9488; }
      .diagnosis-title { color: #0d9488; font-weight: bold; margin-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th { background: #0d9488; color: white; padding: 12px; text-align: right; }
      td { padding: 12px; border-bottom: 1px solid #ddd; }
      tr:nth-child(even) { background: #f8f9fa; }
      .footer { margin-top: 50px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 2px dashed #ddd; }
      .signature { text-align: center; }
      .signature-line { width: 200px; border-top: 1px solid #333; margin: 10px auto 5px; }
      .rx-symbol { font-size: 40px; color: #0d9488; }
    </style></head><body>
    <div class="header">
      <div class="rx-symbol">℞</div>
      <h1>وصفة طبية</h1>
      <div class="subtitle">Tebbi Medical System</div>
    </div>
    <div class="info-row">
      <div class="info-item"><div class="info-label">اسم المريض</div><div class="info-value">${patientName}</div></div>
      <div class="info-item"><div class="info-label">التاريخ</div><div class="info-value">${dateStr}</div></div>
    </div>
    ${dxList.length > 0 ? `<div class="diagnosis"><div class="diagnosis-title">التشخيص:</div>${dxList.map(d=>d.name).join(' | ')}</div>` : ''}
    <table>
      <tr><th>#</th><th>الدواء</th><th>الجرعة</th><th>التكرار</th></tr>
      ${rxList.map((r, i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${r.dose}</td><td>${r.freq||'-'}</td></tr>`).join('')}
    </table>
    <div class="footer">
      <div class="signature"><div class="signature-line"></div><div>توقيع الطبيب</div></div>
      <div class="signature"><div class="signature-line"></div><div>ختم العيادة</div></div>
    </div>
    </body></html>`);
    w.document.close(); 
    setTimeout(() => w.print(), 100);
  };

  const printInv = async () => {
    const total = parseFloat(fee) || 0;
    if (total <= 0) return;
    const invNum = `INV-${Date.now().toString(36).toUpperCase()}`;
    const invoice = {
      invoice_number: invNum,
      id: invNum,
      created_at: new Date().toISOString(),
      items: [{ description: t('رسوم الاستشارة والكشف', 'Consultation fee'), quantity: 1, unit_price: total, total }],
      total,
      payment_status: 'pending'
    };
    try {
      const printSettings = companyId ? (await companiesAPI.getPrintSettings(companyId)).data : {};
      printHtml(buildInvoiceHtml(printSettings, invoice, { language, t }));
    } catch (e) {
      printHtml(buildInvoiceHtml({}, invoice, { language, t }));
    }
  };

  const save = async () => {
    if (!reason) { toast.error(t('أدخل سبب الزيارة', 'Enter reason')); return; }
    setSaving(true);
    const bpArr = bp.split('/');
    const consultationFee = parseFloat(fee) || 0;
    const pharmacyFiltered = (pharmacyItems || []).filter(i => i.description && (i.unit_price || 0) > 0);
    const pharmacyTotal = pharmacyFiltered.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0);
    const totalAmount = consultationFee + pharmacyTotal;
    try {
      await visitsAPI.create({
        patient_id: patientId,
        temperature: temp ? parseFloat(temp) : null,
        blood_pressure_systolic: bpArr[0] ? parseInt(bpArr[0]) : null,
        blood_pressure_diastolic: bpArr[1] ? parseInt(bpArr[1]) : null,
        heart_rate: hr ? parseInt(hr) : null,
        oxygen_saturation: o2 ? parseInt(o2) : null,
        reason,
        diagnosis: dxList.map(d => d.name).join(' | '),
        diagnosis_codes: dxList.map(d => d.id),
        doctor_notes: doctorNotes || undefined,
        pharmacy: pharmacyFiltered.length > 0 ? pharmacyFiltered.map(i => ({ description: i.description, description_ar: i.description_ar || i.description, quantity: i.quantity || 1, unit_price: i.unit_price || 0 })) : undefined,
        prescription: rxList.map(r => ({ medication_name: r.name, dosage: r.dose, frequency: r.freq })),
        consultation_fee: consultationFee,
        total_amount: totalAmount,
        payment_status: 'pending'
      });
      for (const img of imgs) await medicalImagesAPI.create({ patient_id: patientId, title: img.name, image_type: img.type, image_base64: img.b64 });
      toast.success(t('تم', 'Done')); reset(); onOpenChange(false); onSuccess();
    } catch (e) { toast.error(t('فشل', 'Failed')); }
    setSaving(false);
  };

  const imgTypes = [{ id: 'xray', l: t('أشعة', 'X-Ray') }, { id: 'ecg', l: t('تخطيط', 'ECG') }, { id: 'lab_test', l: t('تحليل', 'Lab') }, { id: 'other', l: t('أخرى', 'Other') }];
  const freqOptions = [
    { v: 'مرة يومياً', l: t('مرة يومياً', 'Once daily') },
    { v: 'مرتين يومياً', l: t('مرتين يومياً', 'Twice daily') },
    { v: '3 مرات يومياً', l: t('3 مرات يومياً', '3 times daily') },
    { v: '4 مرات يومياً', l: t('4 مرات يومياً', '4 times daily') },
    { v: 'عند الحاجة', l: t('عند الحاجة', 'As needed') },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-teal-600" />{t('زيارة جديدة', 'New Visit')} - {patientName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Vital Signs */}
          <div className="border rounded-lg p-3">
            <Label className="text-sm text-muted-foreground mb-2 block">{t('العلامات الحيوية', 'Vital Signs')}</Label>
            <div className="grid grid-cols-4 gap-3">
              <div><Label className="text-xs">{t('الحرارة', 'Temp')} °C</Label><Input value={temp} onChange={e => setTemp(e.target.value)} placeholder="37" data-testid="temp-input" /></div>
              <div><Label className="text-xs">{t('الضغط', 'BP')}</Label><Input value={bp} onChange={e => setBp(e.target.value)} placeholder="120/80" data-testid="bp-input" /></div>
              <div><Label className="text-xs">{t('النبض', 'HR')}</Label><Input value={hr} onChange={e => setHr(e.target.value)} placeholder="72" data-testid="hr-input" /></div>
              <div><Label className="text-xs">{t('الأكسجين', 'O2')} %</Label><Input value={o2} onChange={e => setO2(e.target.value)} placeholder="98" data-testid="o2-input" /></div>
            </div>
          </div>

          {/* Reason - Dropdown + Custom */}
          <div className="border rounded-lg p-3">
            <Label className="flex items-center gap-2 mb-2"><ClipboardList className="w-4 h-4" />{t('سبب الزيارة', 'Visit Reason')} *</Label>
            <Select onValueChange={handleReasonSelect}>
              <SelectTrigger><SelectValue placeholder={t('اختر سبب الزيارة', 'Select visit reason')} /></SelectTrigger>
              <SelectContent className="max-h-60">
                {COMMON_REASONS.map(r => <SelectItem key={r.id} value={r.id}>{language === 'ar' ? r.ar : r.en}</SelectItem>)}
                <SelectItem value="custom" className="text-teal-600 font-medium">{t('✍️ سبب آخر (اكتب يدوياً)', '✍️ Other (write manually)')}</SelectItem>
              </SelectContent>
            </Select>
            <Textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              rows={2} 
              placeholder={t('أو اكتب سبب الزيارة هنا...', 'Or write visit reason here...')} 
              className="mt-2"
              data-testid="reason-input" 
            />
          </div>

          {/* Diagnosis - Multi-select + Add New */}
          <div className="border rounded-lg p-3">
            <Label className="flex items-center gap-2 mb-2"><Stethoscope className="w-4 h-4" />{t('التشخيص', 'Diagnosis')}</Label>
            <Select onValueChange={addDx} data-testid="diagnosis-select">
              <SelectTrigger><SelectValue placeholder={t('اختر التشخيص', 'Select diagnosis')} /></SelectTrigger>
              <SelectContent className="max-h-60">
                {diag.map(d => <SelectItem key={d.id} value={d.id}>{language === 'ar' ? d.name_ar : d.name_en} ({d.id})</SelectItem>)}
              </SelectContent>
            </Select>
            {dxList.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{dxList.map(d => <Badge key={d.id} variant="secondary" className="bg-teal-100">{d.name}<button onClick={() => removeDx(d.id)}><X className="w-3 h-3 ms-1 hover:text-red-500" /></button></Badge>)}</div>}
            
            {/* Add new diagnosis */}
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Input 
                value={newDxName} 
                onChange={e => setNewDxName(e.target.value)} 
                placeholder={t('أضف تشخيص جديد...', 'Add new diagnosis...')}
                className="flex-1"
                onKeyPress={e => e.key === 'Enter' && addCustomDx()}
              />
              <Button 
                size="sm" 
                onClick={addCustomDx} 
                disabled={!newDxName.trim() || addingDx}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="w-4 h-4 me-1" />
                {t('إضافة', 'Add')}
              </Button>
            </div>
          </div>

          {/* Doctor notes (internal - not visible to patient in portal) */}
          <div className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-900/10">
            <Label className="flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4 text-amber-600" />{t('ملاحظات الدكتور', 'Doctor notes')} <span className="text-xs text-muted-foreground">({t('لا يراها المريض في البوابة', 'Not visible to patient in portal')})</span></Label>
            <Textarea value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} rows={2} placeholder={t('ملاحظات داخلية...', 'Internal notes...')} className="bg-white dark:bg-slate-900" />
          </div>

          {/* Pharmacy (from clinic - added to invoice) */}
          <div className="border rounded-lg p-3">
            <Label className="flex items-center gap-2 mb-2"><Pill className="w-4 h-4" />{t('الصيدلية / ما أُعطي من العيادة', 'Pharmacy / From clinic')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('مثال: إبرة تخدير، أدوية من المخزون — تُضاف للفاتورة', 'e.g. injection, supplies — added to invoice')}</p>
            {pharmacyItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center mb-2">
                <Input value={item.description} onChange={e => setPharmacyItems(prev => prev.map((x, i) => i === idx ? { ...x, description: e.target.value, description_ar: e.target.value } : x))} placeholder={t('البيان', 'Description')} className="flex-1" />
                <Input type="number" step="0.01" value={item.unit_price} onChange={e => setPharmacyItems(prev => prev.map((x, i) => i === idx ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))} placeholder={t('المبلغ', 'Amount')} className="w-24" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setPharmacyItems(prev => prev.filter((_, i) => i !== idx))}><X className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setPharmacyItems(prev => [...prev, { description: '', description_ar: '', quantity: 1, unit_price: 0 }])}>
              <Plus className="w-4 h-4 me-1" />{t('إضافة صنف', 'Add item')}
            </Button>
          </div>

          {/* Medications - Multi-select + Add New */}
          <div className="border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <Label className="flex items-center gap-2"><FileText className="w-4 h-4" />{t('الأدوية', 'Medications')}</Label>
              {rxList.length > 0 && <Button size="sm" variant="outline" onClick={printRx} data-testid="print-rx-btn"><Printer className="w-3 h-3 me-1" />{t('طباعة الوصفة', 'Print Rx')}</Button>}
            </div>
            <Select onValueChange={addMed} data-testid="medication-select">
              <SelectTrigger><SelectValue placeholder={t('اختر الدواء', 'Select medication')} /></SelectTrigger>
              <SelectContent className="max-h-60">
                {meds.map(m => <SelectItem key={m.id} value={m.id}>{language === 'ar' ? m.name_ar : m.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
            {rxList.length > 0 && (
              <div className="space-y-2 mt-3">
                {rxList.map(r => (
                  <div key={r.id} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                    <span className="flex-1 font-medium text-sm">{r.name}</span>
                    <Select value={r.dose} onValueChange={v => updateMedDose(r.id, v)}>
                      <SelectTrigger className="w-24 h-8"><SelectValue placeholder={t('الجرعة', 'Dose')} /></SelectTrigger>
                      <SelectContent>
                        {(meds.find(m => m.id === r.id)?.dosages || ['500mg', '250mg', '100mg']).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={r.freq} onValueChange={v => updateMedFreq(r.id, v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue placeholder={t('التكرار', 'Freq')} /></SelectTrigger>
                      <SelectContent>
                        {freqOptions.map(f => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button onClick={() => removeMed(r.id)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new medication */}
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Input 
                value={newMedName} 
                onChange={e => setNewMedName(e.target.value)} 
                placeholder={t('أضف دواء جديد...', 'Add new medication...')}
                className="flex-1"
                onKeyPress={e => e.key === 'Enter' && addCustomMed()}
              />
              <Button 
                size="sm" 
                onClick={addCustomMed} 
                disabled={!newMedName.trim() || addingMed}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 me-1" />
                {t('إضافة', 'Add')}
              </Button>
            </div>
          </div>

          {/* Images Upload */}
          <div className="border rounded-lg p-3">
            <Label className="flex items-center gap-2 mb-2"><Upload className="w-4 h-4" />{t('الصور والملفات', 'Images & Files')}</Label>
            <div className="grid grid-cols-4 gap-2">
              {imgTypes.map(type => (
                <label key={type.id} className="cursor-pointer border-2 border-dashed rounded-lg p-3 text-center hover:border-teal-400 hover:bg-teal-50 transition-colors">
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
                  <span className="text-xs block mt-1">{type.l}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImg(e, type.id)} data-testid={`upload-${type.id}`} />
                </label>
              ))}
            </div>
            {imgs.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{imgs.map((img, i) => <Badge key={i} variant="secondary" className="bg-blue-100">{img.name}<button onClick={() => removeImg(i)}><X className="w-3 h-3 ms-1 hover:text-red-500" /></button></Badge>)}</div>}
          </div>

          {/* Fees */}
          <div className="border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <Label className="flex items-center gap-2"><Receipt className="w-4 h-4" />{t('الرسوم', 'Fees')}</Label>
              {parseFloat(fee) > 0 && <Button size="sm" variant="outline" onClick={printInv} data-testid="print-inv-btn"><Printer className="w-3 h-3 me-1" />{t('طباعة الفاتورة', 'Print Invoice')}</Button>}
            </div>
            <Input type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="0" data-testid="fee-input" />
          </div>

          {/* Save Button */}
          <Button onClick={save} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 h-11" data-testid="save-visit-btn">
            {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ الزيارة', 'Save Visit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

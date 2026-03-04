import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { queueAPI, usersAPI, appointmentsAPI, patientsAPI, visitsAPI, invoicesAPI, companiesAPI } from '../services/api';
import { buildInvoiceHtml, buildPrescriptionHtml, printHtml } from '../utils/printTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, UserCheck, CheckCircle, CalendarDays, UserPlus, Printer, FileText } from 'lucide-react';

export default function QueuePage() {
  const { t, language, user } = useAuth();
  const companyId = user?.company_id;
  const canAccessPatients = (user?.allowed_features || []).includes('patients');
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctorId, setDoctorId] = useState('__all__');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addPatientId, setAddPatientId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [endingId, setEndingId] = useState(null);

  const fetch = () => {
    setLoading(true);
    const apiDoctorId = doctorId === '__all__' ? undefined : doctorId;
    const promises = [
      queueAPI.getToday(apiDoctorId).then((r) => setItems(r.data?.items || [])),
      usersAPI.getDoctors().then((r) => setDoctors(r.data || [])),
    ];
    if (canAccessPatients) {
      promises.push(patientsAPI.getAll().then((r) => setPatients(r.data || [])));
    } else {
      setPatients([]);
    }
    Promise.all(promises).catch(() => toast.error(t('فشل', 'Failed'))).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [doctorId]);

  const setStatus = (item, queue_status) => {
    const done = () => { toast.success(t('تم', 'Done')); fetch(); };
    if (item.source === 'walkin') {
      queueAPI.updateWalkinStatus(item.id, queue_status).then(done).catch(() => toast.error(t('فشل', 'Failed')));
    } else {
      appointmentsAPI.updateQueueStatus(item.id, queue_status).then(done).catch(() => toast.error(t('فشل', 'Failed')));
    }
  };

  const printInvoice = async (inv) => {
    if (!inv) return;
    try {
      const printSettings = companyId ? (await companiesAPI.getPrintSettings(companyId)).data : {};
      printHtml(buildInvoiceHtml(printSettings, inv, { language, t }));
    } catch (e) {
      printHtml(buildInvoiceHtml({}, inv, { language, t }));
    }
  };

  const printPrescription = async (visit, patientName) => {
    if (!visit) return;
    try {
      const printSettings = companyId ? (await companiesAPI.getPrintSettings(companyId)).data : {};
      printHtml(buildPrescriptionHtml(printSettings, visit, patientName, { language, t }));
    } catch (e) {
      printHtml(buildPrescriptionHtml({}, visit, patientName, { language, t }));
    }
  };

  const handlePrintAndEndSession = async (item) => {
    if (!item.patient_id) {
      toast.error(t('لا يوجد مريض مرتبط', 'No patient linked'));
      return;
    }
    setEndingId(item.id);
    try {
      const [visitsRes, invRes] = await Promise.all([
        visitsAPI.getByPatient(item.patient_id),
        invoicesAPI.getByPatient(item.patient_id)
      ]);
      const visits = visitsRes.data || [];
      const invoices = (invRes.data?.invoices || []).filter(inv => inv.visit_id);
      const visit = item.visit_id ? visits.find(v => v.id === item.visit_id) : visits[0];
      const invoice = visit ? invoices.find(inv => inv.visit_id === visit.id) : null;

      if (item.source === 'walkin') {
        await queueAPI.updateWalkinStatus(item.id, 'completed');
      } else {
        await appointmentsAPI.updateQueueStatus(item.id, 'completed');
      }

      if (invoice) await printInvoice(invoice);
      if (visit) {
        await printPrescription(visit, item.patient_name);
        const prescriptions = visit.prescription || [];
        const dateStr = visit.created_at ? new Date(visit.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '';
        const prescriptionHtml = prescriptions.length
          ? `<h3>${t('روشيتة', 'Prescription')} - ${dateStr}</h3><table><thead><tr><th>${t('الدواء', 'Medication')}</th><th>${t('الجرعة', 'Dosage')}</th><th>${t('التكرار', 'Frequency')}</th></tr></thead><tbody>${prescriptions.map(p => `<tr><td>${p.medication_name || p.name || '-'}</td><td>${p.dosage || '-'}</td><td>${p.frequency || p.freq || '-'}</td></tr>`).join('')}</tbody></table>`
          : `<p>${t('لا وصفة', 'No prescription')}</p>`;
        await patientsAPI.createDocument(item.patient_id, {
          type: 'prescription',
          title: `${t('روشيتة', 'Prescription')} ${dateStr}`,
          content: prescriptionHtml,
          visit_id: visit.id
        }).catch(() => {});
      }
      toast.success(t('تم إنهاء الجلسة وحفظ الروشيتة', 'Session ended and prescription saved'));
      fetch();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
    setEndingId(null);
  };

  const handleAddWalkin = () => {
    if (!addPatientId) { toast.error(t('اختر مريضاً', 'Select a patient')); return; }
    queueAPI.addWalkin({ patient_id: addPatientId, doctor_id: doctorId === '__all__' ? undefined : doctorId, reason: addReason || undefined })
      .then(() => { toast.success(t('تمت الإضافة', 'Added')); setAddOpen(false); setAddPatientId(''); setAddReason(''); fetch(); })
      .catch(() => toast.error(t('فشل', 'Failed')));
  };

  const scheduled = items.filter((i) => (i.queue_status || 'scheduled') === 'scheduled');
  const waiting = items.filter((i) => (i.queue_status || '') === 'waiting');
  const inConsultation = items.filter((i) => (i.queue_status || '') === 'in_consultation');
  const completed = items.filter((i) => (i.queue_status || '') === 'completed');

  const renderRow = (a, showCallButton, callLabel, callStatus, showDoneButton, showPrintAndEndButton) => (
    <div key={a.id} className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-transparent hover:border-slate-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            className="font-medium text-left w-full hover:underline text-primary"
            onClick={() => a.patient_id && navigate(`/patients/${a.patient_id}`)}
          >
            {a.patient_name || '-'}
          </button>
          <p className="text-xs text-muted-foreground">{a.time}</p>
          {a.visit_reason && <p className="text-xs text-muted-foreground mt-0.5">{t('سبب الزيارة', 'Visit reason')}: {a.visit_reason}</p>}
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap">
          {showCallButton && <Button size="sm" onClick={() => setStatus(a, callStatus)}>{callLabel}</Button>}
          {showPrintAndEndButton && (
            <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700" onClick={() => handlePrintAndEndSession(a)} disabled={endingId === a.id}>
              {endingId === a.id ? <span className="animate-spin">⏳</span> : <><Printer className="w-4 h-4" /><FileText className="w-4 h-4" /></>}
              {t('فاتورة وروشيتة وإنهاء', 'Print & End')}
            </Button>
          )}
          {showDoneButton && !showPrintAndEndButton && <Button size="sm" variant="secondary" onClick={() => setStatus(a, 'completed')}><CheckCircle className="w-4 h-4" /> {t('إنهاء', 'Done')}</Button>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('طابور الانتظار', 'Waiting Queue')}</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('الطبيب', 'Doctor')}:</span>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('الكل', 'All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('الكل', 'All')}</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name_ar || d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetch}>{t('تحديث', 'Refresh')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          {/* 1. مواعيد اليوم */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" /> {t('مواعيد اليوم', "Today's appointments")} ({scheduled.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {scheduled.map((a) => renderRow(a, true, t('استدعاء', 'Call'), 'waiting', false))}
              {scheduled.length === 0 && <p className="text-sm text-muted-foreground">{t('لا مواعيد', 'None')}</p>}
            </CardContent>
          </Card>

          {/* 2. في الانتظار */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> {t('في الانتظار', 'Waiting')} ({waiting.length})</CardTitle>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1"><UserPlus className="w-3 h-3" /> {t('إضافة مريض', 'Add patient')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('إضافة مريض للطابور', 'Add patient to queue')}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Label>{t('المريض', 'Patient')}</Label>
                    <Select value={addPatientId} onValueChange={setAddPatientId}>
                      <SelectTrigger><SelectValue placeholder={t('اختر مريضاً', 'Select patient')} /></SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name_ar || p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>{t('سبب الزيارة', 'Visit reason')} (اختياري)</Label>
                    <Input value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder={t('سبب الزيارة', 'Visit reason')} />
                    <Button onClick={handleAddWalkin}>{t('إضافة', 'Add')}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {waiting.map((a) => renderRow(a, true, t('استدعاء', 'Call'), 'in_consultation', false))}
              {waiting.length === 0 && <p className="text-sm text-muted-foreground">{t('لا أحد', 'None')}</p>}
            </CardContent>
          </Card>

          {/* 3. قيد الكشف */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><UserCheck className="w-4 h-4" /> {t('قيد الكشف', 'In consultation')} ({inConsultation.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {inConsultation.map((a) => renderRow(a, false, null, null, false, true))}
              {inConsultation.length === 0 && <p className="text-sm text-muted-foreground">{t('لا أحد', 'None')}</p>}
            </CardContent>
          </Card>

          {/* 4. منتهي */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {t('منتهي', 'Completed')} ({completed.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {completed.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-lg">
                  <div>
                    <button type="button" className="font-medium text-muted-foreground hover:underline text-left" onClick={() => a.patient_id && navigate(`/patients/${a.patient_id}`)}>{a.patient_name || '-'}</button>
                    <p className="text-xs text-muted-foreground">{a.time}</p>
                    {a.visit_reason && <p className="text-xs text-muted-foreground">{a.visit_reason}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(a, 'waiting')}>{t('إعادة', 'Back')}</Button>
                </div>
              ))}
              {completed.length === 0 && <p className="text-sm text-muted-foreground">{t('لا أحد', 'None')}</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Receipt, Printer, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { medicationsAPI, referenceAPI, visitsAPI, invoicesAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { buildInvoiceHtml, printHtml } from '../../utils/printTemplate';

function MedicationSection({ patientId, medications, onRefresh, t, language }) {
  const { user } = useAuth();
  const companyId = user?.company_id;
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState([]);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [freq, setFreq] = useState('');
  const [prescriptionsFromVisits, setPrescriptionsFromVisits] = useState([]);
  const [invoiceByVisitId, setInvoiceByVisitId] = useState({});
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true);
  const [invoiceDialog, setInvoiceDialog] = useState(null);

  useEffect(() => {
    referenceAPI.getMedications().then(res => {
      setMeds([...(res.data.common || []), ...(res.data.custom || [])]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrescriptions(true);
    Promise.all([
      visitsAPI.getByPatient(patientId),
      invoicesAPI.getByPatient(patientId)
    ]).then(([visRes, invRes]) => {
      if (cancelled) return;
      const visits = visRes.data || [];
      const invoices = invRes.data?.invoices || [];
      const byVisit = {};
      invoices.forEach(inv => { if (inv.visit_id) byVisit[inv.visit_id] = inv; });
      setInvoiceByVisitId(byVisit);
      const list = [];
      visits.forEach(v => {
        const dateStr = v.created_at ? new Date(v.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '';
        (v.prescription || []).forEach(item => {
          list.push({
            medication_name: item.medication_name || item.name,
            dosage: item.dosage || '',
            frequency: item.frequency || item.freq || '',
            visit_id: v.id,
            visit_date: dateStr,
            visit_number: v.visit_number
          });
        });
      });
      setPrescriptionsFromVisits(list);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoadingPrescriptions(false); });
    return () => { cancelled = true; };
  }, [patientId, language]);

  const save = async (e) => {
    e.preventDefault();
    if (!name || !dosage || !freq) {
      toast.error(t('أكمل البيانات', 'Complete data'));
      return;
    }
    try {
      await medicationsAPI.create({ patient_id: patientId, name, dosage, frequency: freq });
      toast.success(t('تم', 'Done'));
      setOpen(false);
      setName(''); setDosage(''); setFreq('');
      onRefresh();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const del = (id) => {
    medicationsAPI.delete(id).then(() => {
      toast.success(t('تم', 'Done'));
      onRefresh();
    });
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">{t('الأدوية', 'Medications')}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-teal-600" data-testid="add-medication-btn">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('إضافة دواء', 'Add Medication')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label>{t('الدواء', 'Medication')}</Label>
                <Select value={name} onValueChange={setName}>
                  <SelectTrigger><SelectValue placeholder={t('اختر', 'Select')} /></SelectTrigger>
                  <SelectContent>
                    {meds.slice(0, 25).map(m => (
                      <SelectItem key={m.id} value={language === 'ar' ? m.name_ar : m.name_en}>
                        {language === 'ar' ? m.name_ar : m.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input className="mt-2" value={name} onChange={e => setName(e.target.value)} placeholder={t('أو اكتب اسم الدواء', 'Or type name')} />
              </div>
              <div>
                <Label>{t('الجرعة', 'Dosage')}</Label>
                <Input value={dosage} onChange={e => setDosage(e.target.value)} placeholder="500mg" required />
              </div>
              <div>
                <Label>{t('التكرار', 'Frequency')}</Label>
                <Select value={freq} onValueChange={setFreq}>
                  <SelectTrigger><SelectValue placeholder={t('اختر', 'Select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="مرة يومياً">مرة يومياً</SelectItem>
                    <SelectItem value="مرتين يومياً">مرتين يومياً</SelectItem>
                    <SelectItem value="3 مرات يومياً">3 مرات يومياً</SelectItem>
                    <SelectItem value="قبل النوم">قبل النوم</SelectItem>
                    <SelectItem value="عند الحاجة">عند الحاجة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-teal-600">{t('حفظ', 'Save')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prescribed from visits */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FileText className="w-4 h-4" />{t('أدوية موصوفة (من الزيارات)', 'Prescribed from visits')}
          </p>
          {loadingPrescriptions ? (
            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
          ) : prescriptionsFromVisits.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {prescriptionsFromVisits.map((item, i) => {
                const inv = item.visit_id ? invoiceByVisitId[item.visit_id] : null;
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.medication_name}</p>
                      <p className="text-sm text-muted-foreground">{item.dosage} — {item.frequency}</p>
                      <p className="text-xs text-muted-foreground">{item.visit_date}{item.visit_number ? ` (${item.visit_number})` : ''}</p>
                    </div>
                    {inv && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setInvoiceDialog(inv)}>
                          <Receipt className="w-4 h-4" />{t('الفاتورة', 'Invoice')}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => printInvoice(inv)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">{t('لا توجد أدوية موصوفة من الزيارات', 'No prescribed meds from visits')}</p>
          )}
        </div>

        {/* Current medications (from medicationsAPI) */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">{t('أدوية مسجلة', 'Registered medications')}</p>
          {medications.length > 0 ? medications.map((m, i) => (
            <div key={i} className="flex items-center justify-between p-3 mb-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.dosage} - {m.frequency}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(m.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground py-2">{t('لا توجد أدوية مسجلة', 'No registered meds')}</p>
          )}
        </div>
      </CardContent>

      {/* Invoice view dialog */}
      <Dialog open={!!invoiceDialog} onOpenChange={(open) => !open && setInvoiceDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" />{t('الفاتورة', 'Invoice')} {invoiceDialog?.invoice_number}</DialogTitle>
          </DialogHeader>
          {invoiceDialog && (
            <div className="space-y-3 text-sm">
              <p>{t('التاريخ', 'Date')}: {invoiceDialog.created_at ? new Date(invoiceDialog.created_at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB') : '-'}</p>
              <ul className="border rounded-lg divide-y">
                {(invoiceDialog.items || []).map((i, idx) => (
                  <li key={idx} className="p-2 flex justify-between">
                    <span>{i.description || '-'}</span>
                    <span>{(i.total != null ? i.total : (i.quantity || 1) * (i.unit_price || 0)).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="font-semibold">{t('الإجمالي', 'Total')}: {(invoiceDialog.total != null ? invoiceDialog.total : 0).toFixed(2)}</p>
              <p>{t('الحالة', 'Status')}: {invoiceDialog.payment_status === 'paid' ? t('مدفوعة', 'Paid') : t('معلقة', 'Pending')}</p>
              <Button className="w-full gap-2" onClick={() => printInvoice(invoiceDialog)}><Printer className="w-4 h-4" />{t('طباعة', 'Print')}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default MedicationSection;

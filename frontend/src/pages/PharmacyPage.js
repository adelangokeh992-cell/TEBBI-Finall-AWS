import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { pharmacyAPI, inventoryAPI, patientsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Pill, Package, AlertTriangle, Plus, ExternalLink } from 'lucide-react';

export default function PharmacyPage() {
  const { t, language, user } = useAuth();
  const canAccessPatients = (user?.allowed_features || []).includes('patients');
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState({ low_stock: [], expiring_soon: [] });
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispenseOpen, setDispenseOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [visitId, setVisitId] = useState('');
  const [lines, setLines] = useState([{ inventory_id: '', quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name_ar: '',
    name_en: '',
    sku: '',
    quantity: 0,
    unit: 'unit',
    unit_price: 0,
    reorder_level: 10,
    expiry_date: '',
  });

  const fetch = () => {
    setLoading(true);
    const promises = [
      inventoryAPI.list().then((r) => setInventory(r.data || [])),
      inventoryAPI.getAlerts().then((r) => setAlerts(r.data || { low_stock: [], expiring_soon: [] })),
    ];
    if (canAccessPatients) {
      promises.push(patientsAPI.getAll().then((r) => setPatients(r.data || [])));
    } else {
      setPatients([]);
    }
    Promise.all(promises).catch(() => toast.error(t('فشل التحميل', 'Load failed'))).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const addLine = () => setLines((prev) => [...prev, { inventory_id: '', quantity: 1 }]);
  const setLine = (idx, field, value) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleDispense = () => {
    if (!patientId) { toast.error(t('اختر المريض', 'Select patient')); return; }
    const valid = lines.filter((l) => l.inventory_id && (Number(l.quantity) || 0) > 0);
    if (valid.length === 0) { toast.error(t('أضف صنفاً واحداً على الأقل بكمية', 'Add at least one item with quantity')); return; }
    setSubmitting(true);
    pharmacyAPI.dispense({
      patient_id: patientId,
      visit_id: visitId.trim() || undefined,
      items: valid.map((l) => ({ inventory_id: l.inventory_id, quantity: Number(l.quantity) })),
    })
      .then((res) => {
        toast.success(res.data?.message || t('تم الصرف وإضافة الأصناف للفاتورة', 'Dispensed and added to invoice'));
        setDispenseOpen(false);
        setPatientId('');
        setVisitId('');
        setLines([{ inventory_id: '', quantity: 1 }]);
        if (res.data?.invoice_id) {
          navigate(`/billing?invoice=${res.data.invoice_id}`);
        }
        fetch();
      })
      .catch((err) => toast.error(err.response?.data?.detail || t('فشل الصرف', 'Dispense failed')))
      .finally(() => setSubmitting(false));
  };

  const handleAddItem = () => {
    if (!form.name_ar.trim()) { toast.error(t('اسم الصنف (عربي) مطلوب', 'Arabic name required')); return; }
    inventoryAPI.create({
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || undefined,
      sku: form.sku.trim() || undefined,
      quantity: Number(form.quantity) || 0,
      unit: form.unit || 'unit',
      unit_price: Number(form.unit_price) || 0,
      reorder_level: Number(form.reorder_level) || 10,
      expiry_date: form.expiry_date || undefined,
    }).then(() => {
      toast.success(t('تمت إضافة الصنف', 'Item added'));
      setAddOpen(false);
      setForm({ name_ar: '', name_en: '', sku: '', quantity: 0, unit: 'unit', unit_price: 0, reorder_level: 10, expiry_date: '' });
      fetch();
    }).catch(() => toast.error(t('فشل', 'Failed')));
  };

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Pill className="w-7 h-7" /> {t('الصيدلية', 'Pharmacy')}
        </h1>
        <CardDescription className="text-base">{t('المخزون وصرف الأدوية للمرضى', 'Inventory and dispensing to patients')}</CardDescription>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>
      ) : (
        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              {t('المخزون', 'Inventory')}
            </TabsTrigger>
            <TabsTrigger value="dispense" className="gap-2">
              <Pill className="w-4 h-4" />
              {t('صرف لمريض', 'Dispense')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-4 space-y-4">
            {(alerts.low_stock?.length > 0 || alerts.expiring_soon?.length > 0) && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {t('تنبيهات', 'Alerts')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  {alerts.low_stock?.length > 0 && (
                    <p className="text-sm">{t('منخفض', 'Low stock')}: {alerts.low_stock.map((i) => i.name_ar || i.name_en).join('، ')}</p>
                  )}
                  {alerts.expiring_soon?.length > 0 && (
                    <p className="text-sm">{t('قرب انتهاء الصلاحية', 'Expiring soon')}: {alerts.expiring_soon.map((i) => i.name_ar || i.name_en).join('، ')}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('أصناف المخزون', 'Inventory items')}</CardTitle>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2"><Plus className="w-4 h-4" /> {t('إضافة صنف', 'Add item')}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t('إضافة صنف للمخزون', 'Add inventory item')}</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <Label>{t('الاسم (عربي)', 'Name (Arabic)')} *</Label>
                      <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder={t('اسم الصنف', 'Item name')} />
                      <Label>{t('الاسم (إنجليزي)', 'Name (English)')}</Label>
                      <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
                      <Label>{t('الكمية', 'Quantity')}</Label>
                      <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                      <Label>{t('الوحدة', 'Unit')}</Label>
                      <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unit, box, pack..." />
                      <Label>{t('سعر البيع', 'Unit price')}</Label>
                      <Input type="number" min={0} step={0.01} value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                      <Label>{t('إعادة الطلب عند', 'Reorder at')}</Label>
                      <Input type="number" min={0} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                      <Label>{t('تاريخ الانتهاء', 'Expiry date')}</Label>
                      <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                      <Button onClick={handleAddItem}>{t('حفظ', 'Save')}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <p className="text-muted-foreground">{t('لا أصناف. اضغط "إضافة صنف" أعلاه.', 'No items. Click "Add item" above.')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">{t('الاسم', 'Name')}</th>
                          <th className="text-left p-2">{t('الكمية', 'Qty')}</th>
                          <th className="text-left p-2">{t('سعر الوحدة', 'Unit price')}</th>
                          <th className="text-left p-2">{t('إعادة الطلب عند', 'Reorder at')}</th>
                          <th className="text-left p-2">{t('الانتهاء', 'Expiry')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map((i) => (
                          <tr key={i.id} className="border-b">
                            <td className="p-2">{i.name_ar || i.name_en}</td>
                            <td className="p-2">{i.quantity} {i.unit}</td>
                            <td className="p-2">{i.unit_price != null ? i.unit_price : '-'}</td>
                            <td className="p-2">{i.reorder_level}</td>
                            <td className="p-2">{i.expiry_date || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dispense" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('صرف لمريض', 'Dispense to patient')}</CardTitle>
                  <CardDescription>{t('اختر المريض والأصناف — تُضاف للفاتورة', 'Select patient and items — added to invoice')}</CardDescription>
                </div>
                <Dialog open={dispenseOpen} onOpenChange={setDispenseOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">{t('صرف لمريض', 'Dispense to patient')}</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{t('صرف أصناف لمريض (تُضاف للفاتورة)', 'Dispense to patient (added to invoice)')}</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <Label>{t('المريض', 'Patient')} *</Label>
                      <Select value={patientId} onValueChange={setPatientId}>
                        <SelectTrigger><SelectValue placeholder={t('اختر المريض', 'Select patient')} /></SelectTrigger>
                        <SelectContent>
                          {patients.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name_ar || p.name_en || p.name || p.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label>{t('رقم الكشف (اختياري)', 'Visit ID (optional)')}</Label>
                      <Input value={visitId} onChange={(e) => setVisitId(e.target.value)} placeholder={t('لربط الفاتورة بالكشف', 'To link invoice to visit')} />
                      <Label>{t('الأصناف والكميات', 'Items & quantities')}</Label>
                      {lines.map((line, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Select value={line.inventory_id} onValueChange={(v) => setLine(idx, 'inventory_id', v)}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder={t('صنف', 'Item')} /></SelectTrigger>
                            <SelectContent>
                              {inventory.filter((i) => (i.quantity || 0) > 0).map((i) => (
                                <SelectItem key={i.id} value={i.id}>{i.name_ar || i.name_en} ({i.quantity} {i.unit})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input type="number" min={0.01} step={0.01} className="w-24" value={line.quantity} onChange={(e) => setLine(idx, 'quantity', e.target.value)} />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>−</Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addLine}>+ {t('إضافة صنف', 'Add item')}</Button>
                      <Button onClick={handleDispense} disabled={submitting}>{submitting ? t('جاري الصرف...', 'Dispensing...') : t('صرف وإضافة للفاتورة', 'Dispense & add to invoice')}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <p className="text-muted-foreground">{t('لا أصناف في المخزون. أضف أصنافاً من تبويب المخزون أعلاه.', 'No inventory items. Add items from the Inventory tab above.')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">{t('الاسم', 'Name')}</th>
                          <th className="text-left p-2">{t('الكمية', 'Qty')}</th>
                          <th className="text-left p-2">{t('سعر الوحدة', 'Unit price')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map((i) => (
                          <tr key={i.id} className="border-b">
                            <td className="p-2">{i.name_ar || i.name_en}</td>
                            <td className="p-2">{i.quantity} {i.unit}</td>
                            <td className="p-2">{i.unit_price != null ? i.unit_price : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

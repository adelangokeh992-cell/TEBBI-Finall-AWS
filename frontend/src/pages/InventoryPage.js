import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package, AlertTriangle, Plus } from 'lucide-react';

export default function InventoryPage() {
  const { t, language } = useAuth();
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState({ low_stock: [], expiring_soon: [] });
  const [loading, setLoading] = useState(true);
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
    Promise.all([
      inventoryAPI.list().then((r) => setItems(r.data || [])),
      inventoryAPI.getAlerts().then((r) => setAlerts(r.data || { low_stock: [], expiring_soon: [] })),
    ]).catch(() => toast.error(t('فشل', 'Failed'))).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = () => {
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
      <h1 className="text-2xl font-bold">{t('المخزون', 'Inventory')}</h1>

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

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('الأصناف', 'Items')}</CardTitle>
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
                  <Button onClick={handleAdd}>{t('حفظ', 'Save')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
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
                    {items.map((i) => (
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
      )}
    </div>
  );
}

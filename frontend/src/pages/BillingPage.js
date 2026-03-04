import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { invoicesAPI, patientsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, CreditCard, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageEmptyState, LoadingSpinner } from '../components/common';

const BillingPage = () => {
  const { t, language, user } = useAuth();
  const canAccessPatients = (user?.allowed_features || []).includes('patients');
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(searchParams.get('new') === 'true');
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [items, setItems] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast.success(t('تم الدفع بنجاح', 'Payment completed successfully'));
      fetchData();
    } else if (payment === 'cancelled') {
      toast.info(t('تم إلغاء الدفع', 'Payment was cancelled'));
    }
  }, [searchParams.get('payment')]);

  const fetchData = async () => {
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      const promises = [invoicesAPI.getAll(params)];
      if (canAccessPatients) {
        promises.push(patientsAPI.getAll());
      }
      const results = await Promise.all(promises);
      setInvoices(results[0]?.data || []);
      setPatients(canAccessPatients ? (results[1]?.data || []) : []);
    } catch (error) {
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    if (itemDesc && itemQty > 0 && itemPrice > 0) {
      const newItem = {
        description: itemDesc,
        quantity: itemQty,
        unit_price: itemPrice,
        total: itemQty * itemPrice
      };
      setItems([...items, newItem]);
      setItemDesc('');
      setItemQty(1);
      setItemPrice(0);
    }
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getSubtotal = () => items.reduce((sum, item) => sum + item.total, 0);
  const getTotal = () => getSubtotal() - discount + tax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId || items.length === 0) {
      toast.error(t('الرجاء ملء جميع الحقول', 'Please fill all fields'));
      return;
    }
    try {
      await invoicesAPI.create({
        patient_id: patientId,
        items: items,
        subtotal: getSubtotal(),
        discount: discount,
        tax: tax,
        total: getTotal(),
        notes: ''
      });
      toast.success(t('تم إنشاء الفاتورة بنجاح', 'Invoice created successfully'));
      setShowNewDialog(false);
      setItems([]);
      setPatientId('');
      setDiscount(0);
      setTax(0);
      fetchData();
    } catch (error) {
      toast.error(t('فشل في إنشاء الفاتورة', 'Failed to create invoice'));
    }
  };

  const handlePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error(t('الرجاء إدخال مبلغ صحيح', 'Please enter a valid amount'));
      return;
    }
    try {
      await invoicesAPI.pay(selectedInvoice.id, parseFloat(payAmount));
      toast.success(t('تم تسجيل الدفعة', 'Payment recorded'));
      setShowPayDialog(false);
      setSelectedInvoice(null);
      setPayAmount('');
      fetchData();
    } catch (error) {
      toast.error(t('فشل في تسجيل الدفعة', 'Failed to record payment'));
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'paid') return <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="w-3 h-3" />{t('مدفوع', 'Paid')}</Badge>;
    if (status === 'partial') return <Badge className="bg-amber-100 text-amber-700 gap-1"><Clock className="w-3 h-3" />{t('جزئي', 'Partial')}</Badge>;
    return <Badge className="bg-red-100 text-red-700 gap-1"><AlertCircle className="w-3 h-3" />{t('معلق', 'Pending')}</Badge>;
  };

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100" data-testid="billing-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('الفواتير', 'Billing')}
        description={t('إدارة فواتير المرضى', 'Manage patient invoices')}
        icon={FileText}
        actions={
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="add-invoice-btn">
                <Plus className="w-4 h-4" />
                {t('فاتورة جديدة', 'New Invoice')}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('إنشاء فاتورة جديدة', 'Create New Invoice')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('المريض', 'Patient')}</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('اختر المريض', 'Select patient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {language === 'ar' ? p.name_ar || p.name : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('إضافة بند', 'Add Item')}</Label>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Input placeholder={t('الوصف', 'Description')} value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder={t('الكمية', 'Qty')} value={itemQty} onChange={(e) => setItemQty(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder={t('السعر', 'Price')} value={itemPrice} onChange={(e) => setItemPrice(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <Button type="button" onClick={addItem} className="w-full"><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>

              {items.length > 0 && (
                <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{item.description} x{item.quantity}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.total}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t('الخصم', 'Discount')}</Label>
                  <Input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('الضريبة', 'Tax')}</Label>
                  <Input type="number" value={tax} onChange={(e) => setTax(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="text-end text-xl font-bold">
                {t('الإجمالي:', 'Total:')} {getTotal().toFixed(2)} {t('ل.س', 'SYP')}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>{t('إلغاء', 'Cancel')}</Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">{t('إنشاء الفاتورة', 'Create Invoice')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      <Card className="rounded-xl border-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label className="text-slate-700 dark:text-slate-300">{t('تصفية حسب الحالة:', 'Filter by status:')}</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('الكل', 'All')}</SelectItem>
                <SelectItem value="pending">{t('معلق', 'Pending')}</SelectItem>
                <SelectItem value="partial">{t('جزئي', 'Partial')}</SelectItem>
                <SelectItem value="paid">{t('مدفوع', 'Paid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : invoices.length > 0 ? (
        <Card className="rounded-xl border-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('رقم الفاتورة', 'Invoice #')}</TableHead>
                  <TableHead>{t('المريض', 'Patient')}</TableHead>
                  <TableHead>{t('الإجمالي', 'Total')}</TableHead>
                  <TableHead>{t('المدفوع', 'Paid')}</TableHead>
                  <TableHead>{t('الحالة', 'Status')}</TableHead>
                  <TableHead>{t('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice, index) => {
                  const patient = patients.find(p => p.id === invoice.patient_id);
                  return (
                    <TableRow key={invoice.id} data-testid={`invoice-row-${index}`}>
                      <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                      <TableCell>{patient ? (language === 'ar' ? patient.name_ar || patient.name : patient.name) : '-'}</TableCell>
                      <TableCell>{invoice.total.toFixed(2)}</TableCell>
                      <TableCell>{invoice.paid_amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.payment_status)}</TableCell>
                      <TableCell>
                        {invoice.payment_status !== 'paid' && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="gap-1 text-green-600 hover:bg-green-50"
                              onClick={() => { setSelectedInvoice(invoice); setPayAmount((invoice.total - invoice.paid_amount).toString()); setShowPayDialog(true); }}>
                              <CreditCard className="w-4 h-4" />{t('تسجيل دفعة', 'Record')}
                            </Button>
                            <Button size="sm" variant="default" className="gap-1 bg-teal-600 hover:bg-teal-700"
                              onClick={async () => {
                                try {
                                  const { data } = await invoicesAPI.createCheckoutSession(invoice.id);
                                  if (data?.url) window.location.href = data.url;
                                  else toast.error(t('لم يتم إعداد الدفع أونلاين', 'Online payment not configured'));
                                } catch (err) {
                                  toast.error(err.response?.data?.detail || t('فشل في فتح صفحة الدفع', 'Failed to open payment page'));
                                }
                              }}>
                              <CreditCard className="w-4 h-4" />{t('الدفع أونلاين', 'Pay online')}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <PageEmptyState
          icon={FileText}
          message={t('لا توجد فواتير', 'No invoices')}
          actionLabel={t('فاتورة جديدة', 'New Invoice')}
          onAction={() => setShowNewDialog(true)}
          dir={isRtl ? 'rtl' : 'ltr'}
        />
      )}

      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('تسجيل دفعة', 'Record Payment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-muted-foreground">{t('المبلغ المتبقي', 'Remaining amount')}</p>
              <p className="text-2xl font-bold">{selectedInvoice ? (selectedInvoice.total - selectedInvoice.paid_amount).toFixed(2) : 0} {t('ل.س', 'SYP')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('مبلغ الدفعة', 'Payment amount')}</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} data-testid="pay-amount-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handlePay} className="bg-green-600 hover:bg-green-700">{t('تأكيد الدفع', 'Confirm Payment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingPage;

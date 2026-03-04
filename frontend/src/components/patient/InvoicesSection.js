import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Receipt, CreditCard, AlertCircle, CheckCircle, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { invoicesAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { buildInvoiceHtml, printHtml } from '../../utils/printTemplate';

function InvoicesSection({ patientId, t, language }) {
  const { user } = useAuth();
  const companyId = user?.company_id;
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_paid: 0, total_pending: 0 });
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  
  const [newInvoice, setNewInvoice] = useState({
    description: '',
    amount: ''
  });

  useEffect(() => {
    fetchInvoices();
  }, [patientId]);

  const fetchInvoices = async () => {
    try {
      const res = await invoicesAPI.getByPatient(patientId);
      setInvoices(res.data.invoices || []);
      setSummary(res.data.summary || { total_amount: 0, total_paid: 0, total_pending: 0 });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!newInvoice.description || !newInvoice.amount) {
      toast.error(t('أكمل البيانات', 'Complete data'));
      return;
    }
    
    try {
      const amount = parseFloat(newInvoice.amount);
      await invoicesAPI.create({
        patient_id: patientId,
        items: [{ 
          description: newInvoice.description, 
          quantity: 1, 
          unit_price: amount, 
          total: amount 
        }],
        subtotal: amount,
        total: amount,
        discount: 0,
        tax: 0
      });
      toast.success(t('تم إنشاء الفاتورة', 'Invoice created'));
      setShowDialog(false);
      setNewInvoice({ description: '', amount: '' });
      fetchInvoices();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error(t('أدخل مبلغ صحيح', 'Enter valid amount'));
      return;
    }
    
    try {
      await invoicesAPI.pay(selectedInvoice.id, parseFloat(payAmount));
      toast.success(t('تم تسجيل الدفع', 'Payment recorded'));
      setShowPayDialog(false);
      setSelectedInvoice(null);
      setPayAmount('');
      fetchInvoices();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'paid':
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="w-3 h-3" />{t('مدفوعة', 'Paid')}</Badge>;
      case 'partial':
        return <Badge className="bg-orange-500 gap-1"><AlertCircle className="w-3 h-3" />{t('جزئي', 'Partial')}</Badge>;
      default:
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />{t('معلقة', 'Pending')}</Badge>;
    }
  };

  const printInvoice = async (inv) => {
    if (!inv) return;
    try {
      const printSettings = companyId ? (await companiesAPI.getPrintSettings(companyId)).data : {};
      const html = buildInvoiceHtml(printSettings, inv, { language, t });
      printHtml(html);
    } catch (e) {
      const html = buildInvoiceHtml({}, inv, { language, t });
      printHtml(html);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          {t('الفواتير', 'Invoices')}
        </CardTitle>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-teal-600" data-testid="add-invoice-btn">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('فاتورة جديدة', 'New Invoice')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <Label>{t('الوصف', 'Description')}</Label>
                <Textarea 
                  value={newInvoice.description}
                  onChange={e => setNewInvoice({...newInvoice, description: e.target.value})}
                  placeholder={t('وصف الخدمة...', 'Service description...')}
                  required
                />
              </div>
              <div>
                <Label>{t('المبلغ', 'Amount')}</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={newInvoice.amount}
                  onChange={e => setNewInvoice({...newInvoice, amount: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-teal-600">{t('إنشاء', 'Create')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
            <p className="text-xs text-muted-foreground">{t('الإجمالي', 'Total')}</p>
            <p className="text-lg font-bold">{summary.total_amount?.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
            <p className="text-xs text-muted-foreground">{t('المدفوع', 'Paid')}</p>
            <p className="text-lg font-bold text-green-600">{summary.total_paid?.toFixed(2)}</p>
          </div>
          <div className={`p-3 rounded-lg text-center ${summary.total_pending > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
            <p className="text-xs text-muted-foreground">{t('المستحق', 'Due')}</p>
            <p className={`text-lg font-bold ${summary.total_pending > 0 ? 'text-red-600' : ''}`}>{summary.total_pending?.toFixed(2)}</p>
          </div>
        </div>

        {/* Invoices List */}
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : invoices.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {invoices.map((inv, i) => {
              const remaining = inv.total - (inv.paid_amount || 0);
              return (
                <div key={i} className="p-3 rounded-lg border flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{inv.invoice_number}</span>
                      {getStatusBadge(inv.payment_status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inv.items?.[0]?.description || t('خدمات طبية', 'Medical services')}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs">
                      <span>{t('الإجمالي', 'Total')}: <strong>{inv.total?.toFixed(2)}</strong></span>
                      {inv.paid_amount > 0 && <span className="text-green-600">{t('مدفوع', 'Paid')}: {inv.paid_amount?.toFixed(2)}</span>}
                      {remaining > 0 && <span className="text-red-600">{t('متبقي', 'Due')}: {remaining.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setViewInvoice(inv); setShowViewDialog(true); }}>
                      <Eye className="w-4 h-4" />{t('عرض', 'View')}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => printInvoice(inv)}>
                      <Printer className="w-4 h-4" />
                    </Button>
                    {remaining > 0 && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSelectedInvoice(inv); setShowPayDialog(true); }}>
                        <CreditCard className="w-4 h-4" />{t('دفع', 'Pay')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">{t('لا توجد فواتير', 'No invoices')}</p>
        )}

        {/* View Invoice Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" />{t('تفاصيل الفاتورة', 'Invoice Details')} {viewInvoice?.invoice_number}</DialogTitle>
            </DialogHeader>
            {viewInvoice && (
              <div className="space-y-3 text-sm">
                <p>{t('التاريخ', 'Date')}: {viewInvoice.created_at ? new Date(viewInvoice.created_at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB') : '-'}</p>
                <ul className="border rounded-lg divide-y">
                  {(viewInvoice.items || []).map((i, idx) => (
                    <li key={idx} className="p-2 flex justify-between">
                      <span>{i.description || '-'}</span>
                      <span>{(i.total != null ? i.total : (i.quantity || 1) * (i.unit_price || 0)).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-semibold">{t('الإجمالي', 'Total')}: {(viewInvoice.total != null ? viewInvoice.total : 0).toFixed(2)}</p>
                <p>{t('الحالة', 'Status')}: {viewInvoice.payment_status === 'paid' ? t('مدفوعة', 'Paid') : t('معلقة', 'Pending')}</p>
                <Button className="w-full gap-2" onClick={() => printInvoice(viewInvoice)}><Printer className="w-4 h-4" />{t('طباعة', 'Print')}</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Pay Dialog */}
        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('تسجيل دفعة', 'Record Payment')}</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <form onSubmit={handlePay} className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm">{t('الفاتورة', 'Invoice')}: <strong>{selectedInvoice.invoice_number}</strong></p>
                  <p className="text-sm">{t('المتبقي', 'Remaining')}: <strong className="text-red-600">{(selectedInvoice.total - (selectedInvoice.paid_amount || 0)).toFixed(2)}</strong></p>
                </div>
                <div>
                  <Label>{t('مبلغ الدفع', 'Payment Amount')}</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    max={selectedInvoice.total - (selectedInvoice.paid_amount || 0)}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('يمكنك دفع كامل المبلغ أو جزء منه', 'You can pay full or partial amount')}
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPayAmount((selectedInvoice.total - (selectedInvoice.paid_amount || 0)).toString())}>
                    {t('المبلغ الكامل', 'Full Amount')}
                  </Button>
                  <Button type="submit" className="bg-teal-600">{t('تأكيد الدفع', 'Confirm')}</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default InvoicesSection;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, expensesAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2,
  PieChart, Receipt, Wallet, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, LoadingSpinner } from '../components/common';

const AccountingPage = () => {
  const { t, language } = useAuth();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [formData, setFormData] = useState({
    category: 'other',
    amount: '',
    description: '',
    description_ar: '',
    date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, expensesRes] = await Promise.all([
        dashboardAPI.getAccountingSummary({}),
        expensesAPI.getAll({})
      ]);
      setSummary(summaryRes.data);
      setExpenses(expensesRes.data);
    } catch (error) {
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await expensesAPI.create({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      toast.success(t('تم إضافة المصروف', 'Expense added'));
      setShowExpenseDialog(false);
      setFormData({
        category: 'other',
        amount: '',
        description: '',
        description_ar: '',
        date: new Date().toISOString().split('T')[0],
        receipt_number: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      toast.error(t('فشل في إضافة المصروف', 'Failed to add expense'));
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm(t('هل أنت متأكد؟', 'Are you sure?'))) {
      try {
        await expensesAPI.delete(id);
        toast.success(t('تم حذف المصروف', 'Expense deleted'));
        fetchData();
      } catch (error) {
        toast.error(t('فشل في الحذف', 'Failed to delete'));
      }
    }
  };

  const categories = [
    { value: 'salary', label: language === 'ar' ? 'رواتب' : 'Salary', color: 'bg-blue-100 text-blue-700' },
    { value: 'rent', label: language === 'ar' ? 'إيجار' : 'Rent', color: 'bg-purple-100 text-purple-700' },
    { value: 'utilities', label: language === 'ar' ? 'مرافق' : 'Utilities', color: 'bg-amber-100 text-amber-700' },
    { value: 'supplies', label: language === 'ar' ? 'مستلزمات' : 'Supplies', color: 'bg-green-100 text-green-700' },
    { value: 'equipment', label: language === 'ar' ? 'معدات' : 'Equipment', color: 'bg-red-100 text-red-700' },
    { value: 'maintenance', label: language === 'ar' ? 'صيانة' : 'Maintenance', color: 'bg-orange-100 text-orange-700' },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other', color: 'bg-slate-100 text-slate-700' },
  ];

  const getCategoryBadge = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? <Badge className={cat.color}>{cat.label}</Badge> : <Badge>{category}</Badge>;
  };

  if (loading) {
    return <LoadingSpinner className="min-h-[50vh]" />;
  }

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="accounting-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('المحاسبة', 'Accounting')}
        description={t('إدارة الدخل والمصاريف', 'Manage income and expenses')}
        icon={PieChart}
        actions={
          <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="add-expense-btn">
                <Plus className="w-4 h-4" />
                {t('إضافة مصروف', 'Add Expense')}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('إضافة مصروف جديد', 'Add New Expense')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('الفئة', 'Category')}</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('المبلغ', 'Amount')}</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                    data-testid="expense-amount"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('الوصف', 'Description')}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                  data-testid="expense-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('التاريخ', 'Date')}</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('رقم الإيصال', 'Receipt #')}</Label>
                  <Input
                    value={formData.receipt_number}
                    onChange={(e) => setFormData({...formData, receipt_number: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('ملاحظات', 'Notes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowExpenseDialog(false)}>
                  {t('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  {t('حفظ', 'Save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border-2 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('إجمالي الدخل', 'Total Income')}</p>
                <p className="text-3xl font-bold text-green-800 dark:text-green-300 mt-2">
                  {summary?.total_income?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('ل.س', 'SYP')}</p>
              </div>
              <div className="p-3 bg-green-200 dark:bg-green-800 rounded-xl">
                <ArrowUpRight className="w-6 h-6 text-green-700 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-2 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('إجمالي المصاريف', 'Total Expenses')}</p>
                <p className="text-3xl font-bold text-red-800 dark:text-red-300 mt-2">
                  {summary?.total_expenses?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('ل.س', 'SYP')}</p>
              </div>
              <div className="p-3 bg-red-200 dark:bg-red-800 rounded-xl">
                <ArrowDownRight className="w-6 h-6 text-red-700 dark:text-red-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('صافي الربح', 'Net Profit')}</p>
                <p className={`text-3xl font-bold mt-2 ${summary?.net_profit >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-red-600'}`}>
                  {summary?.net_profit?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('ل.س', 'SYP')}</p>
              </div>
              <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-xl">
                <Wallet className="w-6 h-6 text-blue-700 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-2 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t('مدفوعات معلقة', 'Pending')}</p>
                <p className="text-3xl font-bold text-amber-800 dark:text-amber-300 mt-2">
                  {summary?.pending_income?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('ل.س', 'SYP')}</p>
              </div>
              <div className="p-3 bg-amber-200 dark:bg-amber-800 rounded-xl">
                <Receipt className="w-6 h-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown */}
      {summary?.expense_by_category && Object.keys(summary.expense_by_category).length > 0 && (
        <Card className="rounded-xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-teal-600" />
              {t('توزيع المصاريف', 'Expense Breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {categories.map(cat => {
                const amount = summary.expense_by_category[cat.value] || 0;
                if (amount === 0) return null;
                return (
                  <div key={cat.value} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Badge className={cat.color}>{cat.label}</Badge>
                    <p className="text-xl font-bold mt-2">{amount.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">{t('ل.س', 'SYP')}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('سجل المصاريف', 'Expense Log')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('التاريخ', 'Date')}</TableHead>
                  <TableHead>{t('الفئة', 'Category')}</TableHead>
                  <TableHead>{t('الوصف', 'Description')}</TableHead>
                  <TableHead>{t('المبلغ', 'Amount')}</TableHead>
                  <TableHead>{t('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense, index) => (
                  <TableRow key={expense.id} data-testid={`expense-row-${index}`}>
                    <TableCell>{expense.date}</TableCell>
                    <TableCell>{getCategoryBadge(expense.category)}</TableCell>
                    <TableCell>{language === 'ar' ? expense.description_ar || expense.description : expense.description}</TableCell>
                    <TableCell className="font-medium">{expense.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteExpense(expense.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-muted-foreground">{t('لا توجد مصاريف مسجلة', 'No expenses recorded')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountingPage;

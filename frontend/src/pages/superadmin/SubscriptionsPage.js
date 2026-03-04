import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, companiesAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, Building2, CheckCircle, XCircle, Clock, Edit, Sparkles } from 'lucide-react';

const SubscriptionsPage = () => {
  const { t, language } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editData, setEditData] = useState({ subscription_status: '', subscription_plan: '', extend_days: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await adminAPI.listCompanies();
      const list = res.data.companies || res.data || [];
      setCompanies(Array.isArray(list) ? list : []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleEdit = (company) => {
    setSelectedCompany(company);
    setEditData({
      subscription_status: company.subscription_status || 'trial',
      subscription_plan: company.subscription_plan || 'basic',
      extend_days: 0
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    try {
      await companiesAPI.update(selectedCompany.id, editData);
      toast.success(t('تم تحديث الاشتراك', 'Subscription updated'));
      setEditDialog(false);
      fetchData();
    } catch (error) {
      toast.error(t('فشل التحديث', 'Failed'));
    }
  };

  const stats = {
    active: companies.filter(c => c.subscription_status === 'active').length,
    trial: companies.filter(c => c.subscription_status === 'trial').length,
    expired: companies.filter(c => c.subscription_status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="subscriptions-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('إدارة الاشتراكات', 'Subscriptions')}</h1>
        <p className="text-slate-500 mt-1">{t('إدارة اشتراكات الشركات', 'Manage company subscriptions')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#12121a] border border-emerald-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400">{stats.active}</p>
          <p className="text-sm text-slate-500 mt-1">{t('نشط', 'Active')}</p>
        </div>
        <div className="rounded-2xl bg-[#12121a] border border-amber-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-amber-400">{stats.trial}</p>
          <p className="text-sm text-slate-500 mt-1">{t('تجريبي', 'Trial')}</p>
        </div>
        <div className="rounded-2xl bg-[#12121a] border border-red-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-400">{stats.expired}</p>
          <p className="text-sm text-slate-500 mt-1">{t('منتهي', 'Expired')}</p>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{t('قائمة الاشتراكات', 'Subscriptions List')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-start p-4 text-sm font-medium text-slate-400">{t('الشركة', 'Company')}</th>
                <th className="text-start p-4 text-sm font-medium text-slate-400">{t('الخطة', 'Plan')}</th>
                <th className="text-start p-4 text-sm font-medium text-slate-400">{t('الحالة', 'Status')}</th>
                <th className="text-start p-4 text-sm font-medium text-slate-400">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{language === 'ar' ? c.name_ar || c.name : c.name}</p>
                        <p className="text-xs text-slate-500">{c.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className="bg-white/5 text-slate-300 border border-white/10">{c.subscription_plan || 'basic'}</Badge>
                  </td>
                  <td className="p-4">
                    <Badge className={`border ${
                      c.subscription_status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : c.subscription_status === 'trial' 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {c.subscription_status === 'active' ? t('نشط', 'Active') :
                       c.subscription_status === 'trial' ? t('تجريبي', 'Trial') : t('منتهي', 'Expired')}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleEdit(c)}
                      className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                    >
                      <Edit className="w-4 h-4 me-1" />{t('تعديل', 'Edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="bg-[#12121a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('تعديل الاشتراك', 'Edit Subscription')}</DialogTitle>
          </DialogHeader>
          {selectedCompany && (
            <div className="space-y-5 pt-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <Building2 className="w-5 h-5 text-violet-400" />
                <span className="font-medium">{selectedCompany.name}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('حالة الاشتراك', 'Status')}</Label>
                <Select value={editData.subscription_status} onValueChange={(v) => setEditData({...editData, subscription_status: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-white/10">
                    <SelectItem value="active" className="text-white hover:bg-white/10">{t('نشط', 'Active')}</SelectItem>
                    <SelectItem value="trial" className="text-white hover:bg-white/10">{t('تجريبي', 'Trial')}</SelectItem>
                    <SelectItem value="expired" className="text-white hover:bg-white/10">{t('منتهي', 'Expired')}</SelectItem>
                    <SelectItem value="suspended" className="text-white hover:bg-white/10">{t('معلق', 'Suspended')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الخطة', 'Plan')}</Label>
                <Select value={editData.subscription_plan} onValueChange={(v) => setEditData({...editData, subscription_plan: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-white/10">
                    <SelectItem value="trial" className="text-white hover:bg-white/10">{t('تجريبي', 'Trial')}</SelectItem>
                    <SelectItem value="basic" className="text-white hover:bg-white/10">{t('أساسي', 'Basic')}</SelectItem>
                    <SelectItem value="pro" className="text-white hover:bg-white/10">{t('احترافي', 'Pro')}</SelectItem>
                    <SelectItem value="enterprise" className="text-white hover:bg-white/10">{t('مؤسسي', 'Enterprise')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('تمديد (يوم)', 'Extend (days)')}</Label>
                <Input 
                  type="number" 
                  value={editData.extend_days} 
                  onChange={(e) => setEditData({...editData, extend_days: parseInt(e.target.value) || 0})} 
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setEditDialog(false)} className="text-slate-400 hover:text-white hover:bg-white/10">
                  {t('إلغاء', 'Cancel')}
                </Button>
                <Button onClick={handleSave} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                  {t('حفظ', 'Save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionsPage;

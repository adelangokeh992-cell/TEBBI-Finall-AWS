import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { adminAPI, companiesAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Building2, Plus, Search, Trash2,
  CheckCircle, XCircle, Eye, MoreVertical,
  Mail, Sparkles, Users, Settings, ArrowUpRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ClinicsPage = () => {
  const { t, language, isRTL } = useAuth();
  const navigate = useNavigate();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [newClinic, setNewClinic] = useState({
    name: '', name_ar: '', code: '', email: '', phone: '',
    address: '', specialty: 'multi',
    admin_name: '', admin_email: '', admin_password: '',
    subscription_plan: 'trial', subscription_days: 14
  });

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const res = await adminAPI.listCompanies();
      const list = res.data.companies || res.data || [];
      setClinics(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await companiesAPI.create(newClinic);
      toast.success(t('تم إنشاء العيادة بنجاح', 'Clinic created'));
      setShowAddDialog(false);
      setNewClinic({
        name: '', name_ar: '', code: '', email: '', phone: '',
        address: '', specialty: 'multi',
        admin_name: '', admin_email: '', admin_password: '',
        subscription_plan: 'trial', subscription_days: 14
      });
      fetchClinics();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في إنشاء العيادة', 'Failed'));
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await companiesAPI.update(id, { is_active: !currentStatus });
      toast.success(t('تم تحديث الحالة', 'Status updated'));
      fetchClinics();
    } catch (error) {
      toast.error(t('فشل في التحديث', 'Failed'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذه العيادة؟', 'Delete this clinic?'))) return;
    try {
      await companiesAPI.delete(id);
      toast.success(t('تم الحذف', 'Deleted'));
      fetchClinics();
    } catch (error) {
      toast.error(t('فشل في الحذف', 'Failed'));
    }
  };

  const filteredClinics = clinics.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name_ar?.includes(searchTerm) || c.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.subscription_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const specialties = [
    { value: 'multi', label: t('متعدد التخصصات', 'Multi-specialty') },
    { value: 'general', label: t('طب عام', 'General') },
    { value: 'dental', label: t('أسنان', 'Dental') },
    { value: 'eye', label: t('عيون', 'Eye') },
    { value: 'pediatric', label: t('أطفال', 'Pediatric') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-violet-400 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="clinics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('العيادات والمشافي', 'Clinics & Hospitals')}</h1>
          <p className="text-slate-500 mt-1">{t('إدارة جميع العيادات والمشافي المشتركة', 'Manage all subscribed clinics & hospitals')}</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25" data-testid="add-clinic-btn">
              <Plus className="w-4 h-4" />
              {t('إضافة عيادة', 'Add Clinic')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#12121a] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl">{t('إضافة عيادة جديدة', 'Add New Clinic')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('اسم العيادة (English)', 'Clinic Name (EN)')}</Label>
                  <Input 
                    value={newClinic.name} 
                    onChange={(e) => setNewClinic({...newClinic, name: e.target.value})} 
                    required 
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('اسم العيادة (عربي)', 'Clinic Name (AR)')}</Label>
                  <Input 
                    value={newClinic.name_ar} 
                    onChange={(e) => setNewClinic({...newClinic, name_ar: e.target.value})} 
                    dir="rtl" 
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('الرمز', 'Code')}</Label>
                  <Input 
                    value={newClinic.code} 
                    onChange={(e) => setNewClinic({...newClinic, code: e.target.value.toUpperCase()})} 
                    placeholder="CLINIC01" 
                    required 
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('التخصص', 'Specialty')}</Label>
                  <Select value={newClinic.specialty} onValueChange={(v) => setNewClinic({...newClinic, specialty: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a24] border-white/10">
                      {specialties.map(s => <SelectItem key={s.value} value={s.value} className="text-white hover:bg-white/10">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('البريد', 'Email')}</Label>
                  <Input 
                    type="email" 
                    value={newClinic.email} 
                    onChange={(e) => setNewClinic({...newClinic, email: e.target.value})} 
                    required 
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('الهاتف', 'Phone')}</Label>
                  <Input 
                    value={newClinic.phone} 
                    onChange={(e) => setNewClinic({...newClinic, phone: e.target.value})} 
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('العنوان', 'Address')}</Label>
                <Input 
                  value={newClinic.address} 
                  onChange={(e) => setNewClinic({...newClinic, address: e.target.value})} 
                  className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                />
              </div>

              <div className="border-t border-white/10 pt-5">
                <h4 className="font-semibold text-violet-400 mb-4">{t('خطة الاشتراك', 'Subscription Plan')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">{t('نوع الاشتراك', 'Plan Type')}</Label>
                    <Select value={newClinic.subscription_plan} onValueChange={(v) => setNewClinic({...newClinic, subscription_plan: v})}>
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
                    <Label className="text-slate-300">{t('مدة الاشتراك (يوم)', 'Duration (days)')}</Label>
                    <Input 
                      type="number" 
                      value={newClinic.subscription_days} 
                      onChange={(e) => setNewClinic({...newClinic, subscription_days: parseInt(e.target.value)})} 
                      className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-5">
                <h4 className="font-semibold text-violet-400 mb-4">{t('بيانات المدير', 'Admin Details')}</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">{t('اسم المدير', 'Admin Name')}</Label>
                    <Input 
                      value={newClinic.admin_name} 
                      onChange={(e) => setNewClinic({...newClinic, admin_name: e.target.value})} 
                      required 
                      className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">{t('بريد المدير', 'Admin Email')}</Label>
                    <Input 
                      type="email" 
                      value={newClinic.admin_email} 
                      onChange={(e) => setNewClinic({...newClinic, admin_email: e.target.value})} 
                      required 
                      className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">{t('كلمة المرور', 'Password')}</Label>
                    <Input 
                      type="password" 
                      value={newClinic.admin_password} 
                      onChange={(e) => setNewClinic({...newClinic, admin_password: e.target.value})} 
                      required 
                      className="bg-white/5 border-white/10 focus:border-violet-500/50 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowAddDialog(false)} className="text-slate-400 hover:text-white hover:bg-white/10">
                  {t('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                  {t('إنشاء', 'Create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500`} />
          <Input
            placeholder={t('بحث...', 'Search...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${isRTL ? 'pr-10' : 'pl-10'} bg-[#12121a] border-white/10 focus:border-violet-500/50 text-white placeholder:text-slate-500`}
            data-testid="search-input"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 bg-[#12121a] border-white/10 text-white" data-testid="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a24] border-white/10">
            <SelectItem value="all" className="text-white hover:bg-white/10">{t('الكل', 'All')}</SelectItem>
            <SelectItem value="active" className="text-white hover:bg-white/10">{t('نشط', 'Active')}</SelectItem>
            <SelectItem value="trial" className="text-white hover:bg-white/10">{t('تجريبي', 'Trial')}</SelectItem>
            <SelectItem value="expired" className="text-white hover:bg-white/10">{t('منتهي', 'Expired')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clinics Grid */}
      {filteredClinics.length === 0 ? (
        <div className="rounded-2xl bg-[#12121a] border border-white/5 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-violet-400" />
          </div>
          <p className="text-slate-400">{t('لا توجد عيادات', 'No clinics found')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClinics.map((clinic) => (
            <div 
              key={clinic.id} 
              className="group rounded-2xl bg-[#12121a] border border-white/5 p-5 hover:border-violet-500/30 transition-all duration-300"
              data-testid={`clinic-card-${clinic.id}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{language === 'ar' ? clinic.name_ar || clinic.name : clinic.name}</h3>
                    <p className="text-sm text-slate-500">{clinic.code}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white hover:bg-white/10">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#1a1a24] border-white/10">
                    <DropdownMenuItem 
                      onClick={() => navigate(`/super-admin/clinics/${clinic.id}`)} 
                      className="text-slate-300 hover:bg-white/10 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 me-2" />{t('إدارة', 'Manage')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleStatus(clinic.id, clinic.is_active)} className="text-slate-300 hover:bg-white/10 cursor-pointer">
                      {clinic.is_active ? <XCircle className="w-4 h-4 me-2" /> : <CheckCircle className="w-4 h-4 me-2" />}
                      {clinic.is_active ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-400 hover:bg-red-500/10 cursor-pointer" onClick={() => handleDelete(clinic.id)}>
                      <Trash2 className="w-4 h-4 me-2" />{t('حذف', 'Delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t('الاشتراك', 'Subscription')}</span>
                  <Badge className={`border ${
                    clinic.subscription_status === 'active' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : clinic.subscription_status === 'trial' 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {clinic.subscription_status === 'active' ? t('نشط', 'Active') :
                     clinic.subscription_status === 'trial' ? t('تجريبي', 'Trial') : t('منتهي', 'Expired')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t('الحالة', 'Status')}</span>
                  {clinic.is_active ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3 me-1" />{t('فعال', 'Active')}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">
                      <XCircle className="w-3 h-3 me-1" />{t('معطل', 'Disabled')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t('الموظفين', 'Staff')}</span>
                  <span className="text-sm text-white flex items-center gap-1">
                    <Users className="w-4 h-4 text-slate-500" />
                    {clinic.users_count || 0}
                  </span>
                </div>
              </div>

              {clinic.email && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{clinic.email}</span>
                  </div>
                </div>
              )}

              {/* Quick Action Button */}
              <Button 
                variant="ghost" 
                className="w-full mt-4 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 border border-violet-500/20"
                onClick={() => navigate(`/super-admin/clinics/${clinic.id}`)}
              >
                {t('إدارة العيادة', 'Manage Clinic')}
                <ArrowUpRight className="w-4 h-4 ms-2" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClinicsPage;

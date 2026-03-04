import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { companiesAPI, usersAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Building2, Users, Stethoscope, CreditCard, Shield, Settings,
  Plus, Trash2, Edit, Save, ArrowRight, Calendar, Check, X,
  Sparkles, Brain, FileText, Receipt, CalendarDays, BarChart3,
  Bell, Printer, Database, Clock, ChevronLeft, Download, Upload,
  HardDrive, CheckCircle, AlertTriangle, RotateCcw, Loader2
} from 'lucide-react';

const ClinicDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language, isRTL } = useAuth();
  const [clinic, setClinic] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  // Dialogs
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  
  // Backup states
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(null);
  
  // Form states
  const [newStaff, setNewStaff] = useState({
    name: '', name_ar: '', email: '', phone: '', password: '',
    role: 'doctor', specialty: '', consultation_fee: ''
  });
  
  // Edit staff state
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: '', name_ar: '', phone: '', specialty: '', consultation_fee: 0
  });

  // Features list
  const allFeatures = [
    { id: 'dashboard', label: t('لوحة التحكم', 'Dashboard'), icon: BarChart3 },
    { id: 'patients', label: t('إدارة المرضى', 'Patient Management'), icon: Users },
    { id: 'appointments', label: t('المواعيد', 'Appointments'), icon: CalendarDays },
    { id: 'queue', label: t('طابور الانتظار', 'Queue'), icon: Calendar },
    { id: 'pharmacy', label: t('الصيدلية', 'Pharmacy'), icon: Receipt },
    { id: 'consent', label: t('الموافقات', 'Consent'), icon: FileText },
    { id: 'invoices', label: t('الفواتير والمحاسبة', 'Invoices & Billing'), icon: Receipt },
    { id: 'ai_analysis', label: t('الذكاء الاصطناعي', 'AI Analysis'), icon: Brain },
    { id: 'reports', label: t('التقارير', 'Reports'), icon: FileText },
    { id: 'online_booking', label: t('الحجز الأونلاين', 'Online Booking'), icon: Calendar },
    { id: 'notifications', label: t('الإشعارات', 'Notifications'), icon: Bell },
    { id: 'pdf_printing', label: t('طباعة PDF', 'PDF Printing'), icon: Printer },
    { id: 'backup', label: t('النسخ الاحتياطي', 'Backup'), icon: Database },
    { id: 'marketing', label: t('التسويق', 'Marketing'), icon: Bell },
    { id: 'audit_logs', label: t('سجلات التدقيق', 'Audit Logs'), icon: FileText },
  ];

  // Roles
  const roles = [
    { value: 'company_admin', label: t('مدير العيادة', 'Clinic Admin') },
    { value: 'doctor', label: t('طبيب', 'Doctor') },
    { value: 'nurse', label: t('ممرض/ة', 'Nurse') },
    { value: 'receptionist', label: t('موظف استقبال', 'Receptionist') },
    { value: 'accountant', label: t('محاسب', 'Accountant') },
  ];

  const specialties = [
    { value: 'general', label: t('طب عام', 'General') },
    { value: 'cardiology', label: t('قلب', 'Cardiology') },
    { value: 'pediatrics', label: t('أطفال', 'Pediatrics') },
    { value: 'dermatology', label: t('جلدية', 'Dermatology') },
    { value: 'orthopedics', label: t('عظام', 'Orthopedics') },
    { value: 'dentistry', label: t('أسنان', 'Dentistry') },
    { value: 'ophthalmology', label: t('عيون', 'Ophthalmology') },
    { value: 'gynecology', label: t('نسائية', 'Gynecology') },
    { value: 'internal', label: t('باطنية', 'Internal') },
    { value: 'surgery', label: t('جراحة', 'Surgery') },
  ];

  // Role permissions template
  const defaultPermissions = {
    company_admin: ['all'],
    doctor: ['view_patients', 'edit_patients', 'add_visits', 'view_appointments', 'manage_appointments', 'use_ai', 'manage_pharmacy'],
    nurse: ['view_patients', 'add_vitals', 'view_appointments', 'manage_pharmacy'],
    receptionist: ['view_patients', 'add_patients', 'manage_appointments', 'manage_pharmacy'],
    accountant: ['view_invoices', 'create_invoices', 'view_reports'],
  };

  useEffect(() => {
    fetchClinic();
    fetchStaff();
    fetchBackups();
  }, [id]);

  const fetchClinic = async () => {
    try {
      const res = await companiesAPI.getOne(id);
      setClinic(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await companiesAPI.getStaff(id);
      const list = res.data.staff || res.data || [];
      setStaff(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await companiesAPI.getBackups(id);
      const list = res.data.backups || res.data || [];
      setBackups(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await companiesAPI.createBackup(id);
      toast.success(t('تم إنشاء النسخة الاحتياطية بنجاح', 'Backup created successfully'));
      fetchBackups();
    } catch (error) {
      toast.error(t('فشل في إنشاء النسخة الاحتياطية', 'Failed to create backup'));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    if (!window.confirm(t('هل أنت متأكد من استرجاع هذه النسخة؟ سيتم استبدال البيانات الحالية.', 'Are you sure? Current data will be replaced.'))) return;
    
    setRestoringBackup(backupId);
    try {
      await companiesAPI.restoreBackup(id, backupId);
      toast.success(t('تم استرجاع النسخة الاحتياطية بنجاح', 'Backup restored successfully'));
      fetchClinic();
      fetchStaff();
    } catch (error) {
      toast.error(t('فشل في استرجاع النسخة الاحتياطية', 'Failed to restore backup'));
    } finally {
      setRestoringBackup(null);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذه النسخة؟', 'Delete this backup?'))) return;
    
    try {
      await companiesAPI.deleteBackup(id, backupId);
      toast.success(t('تم حذف النسخة', 'Backup deleted'));
      fetchBackups();
    } catch (error) {
      toast.error(t('فشل في الحذف', 'Failed to delete'));
    }
  };

  const handleSaveClinic = async () => {
    setSaving(true);
    try {
      await companiesAPI.update(id, {
        name: clinic.name,
        name_ar: clinic.name_ar,
        email: clinic.email,
        phone: clinic.phone,
        address: clinic.address,
      });
      toast.success(t('تم الحفظ بنجاح', 'Saved successfully'));
    } catch (error) {
      toast.error(t('فشل في الحفظ', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (featureId) => {
    const newFeatures = { ...clinic.features, [featureId]: !clinic.features[featureId] };
    try {
      await companiesAPI.updateFeatures(id, newFeatures);
      setClinic({ ...clinic, features: newFeatures });
      toast.success(t('تم تحديث الميزات', 'Features updated'));
    } catch (error) {
      toast.error(t('فشل في التحديث', 'Failed to update'));
    }
  };

  const handleUpdateSubscription = async (updates) => {
    try {
      await companiesAPI.updateSubscription(id, updates);
      setClinic({ ...clinic, ...updates });
      toast.success(t('تم تحديث الاشتراك', 'Subscription updated'));
    } catch (error) {
      toast.error(t('فشل في التحديث', 'Failed to update'));
    }
  };

  const handleExtendSubscription = async (days) => {
    try {
      const currentEnd = clinic.subscription_end_date ? new Date(clinic.subscription_end_date) : new Date();
      const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);
      await companiesAPI.updateSubscription(id, {
        subscription_end_date: newEnd.toISOString(),
        subscription_status: 'active'
      });
      setClinic({ ...clinic, subscription_end_date: newEnd.toISOString(), subscription_status: 'active' });
      toast.success(t(`تم تمديد الاشتراك ${days} يوم`, `Extended subscription by ${days} days`));
    } catch (error) {
      toast.error(t('فشل في التمديد', 'Failed to extend'));
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await companiesAPI.addStaff(id, {
        ...newStaff,
        company_id: id,
        consultation_fee: parseFloat(newStaff.consultation_fee) || 0
      });
      toast.success(t('تم إضافة الموظف', 'Staff added'));
      setShowAddStaff(false);
      setNewStaff({ name: '', name_ar: '', email: '', phone: '', password: '', role: 'doctor', specialty: '', consultation_fee: '' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في الإضافة', 'Failed to add'));
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm(t('هل أنت متأكد؟', 'Are you sure?'))) return;
    try {
      await companiesAPI.deleteStaff(id, staffId);
      toast.success(t('تم الحذف', 'Deleted'));
      fetchStaff();
    } catch (error) {
      toast.error(t('فشل في الحذف', 'Failed to delete'));
    }
  };

  const openEditStaff = (member) => {
    setEditingStaff(member);
    setEditStaffForm({
      name: member.name || '',
      name_ar: member.name_ar || '',
      phone: member.phone || '',
      specialty: member.specialty || '',
      consultation_fee: member.consultation_fee || 0
    });
  };

  const handleEditStaff = async () => {
    try {
      await usersAPI.update(editingStaff.id, editStaffForm);
      toast.success(t('تم التحديث بنجاح', 'Updated successfully'));
      setEditingStaff(null);
      fetchStaff();
    } catch (error) {
      toast.error(t('فشل في التحديث', 'Failed to update'));
    }
  };

  const handleSavePermissions = async () => {
    try {
      // Save custom permissions to clinic
      await companiesAPI.update(id, {
        custom_permissions: clinic.custom_permissions || defaultPermissions
      });
      toast.success(t('تم حفظ الصلاحيات', 'Permissions saved'));
      setEditingPermissions(null);
    } catch (error) {
      toast.error(t('فشل في الحفظ', 'Failed to save'));
    }
  };

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

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{t('العيادة غير موجودة', 'Clinic not found')}</p>
      </div>
    );
  }

  const permissions = clinic.custom_permissions || defaultPermissions;

  return (
    <div className="space-y-6" data-testid="clinic-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/super-admin/clinics')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {language === 'ar' ? clinic.name_ar || clinic.name : clinic.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/10 text-slate-300 border-white/20">{clinic.code}</Badge>
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
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#12121a] border border-white/10 p-1">
          <TabsTrigger value="info" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Building2 className="w-4 h-4 me-2" />
            {t('المعلومات', 'Info')}
          </TabsTrigger>
          <TabsTrigger value="staff" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Users className="w-4 h-4 me-2" />
            {t('الموظفين', 'Staff')}
          </TabsTrigger>
          <TabsTrigger value="subscription" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 me-2" />
            {t('الاشتراك', 'Subscription')}
          </TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Settings className="w-4 h-4 me-2" />
            {t('الميزات', 'Features')}
          </TabsTrigger>
          <TabsTrigger value="permissions" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Shield className="w-4 h-4 me-2" />
            {t('الصلاحيات', 'Permissions')}
          </TabsTrigger>
          <TabsTrigger value="backup" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Database className="w-4 h-4 me-2" />
            {t('النسخ الاحتياطي', 'Backup')}
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <div className="rounded-2xl bg-[#12121a] border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">{t('معلومات العيادة', 'Clinic Information')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (English)', 'Name (English)')}</Label>
                <Input 
                  value={clinic.name || ''} 
                  onChange={(e) => setClinic({...clinic, name: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (عربي)', 'Name (Arabic)')}</Label>
                <Input 
                  value={clinic.name_ar || ''} 
                  onChange={(e) => setClinic({...clinic, name_ar: e.target.value})}
                  dir="rtl"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('البريد الإلكتروني', 'Email')}</Label>
                <Input 
                  value={clinic.email || ''} 
                  onChange={(e) => setClinic({...clinic, email: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الهاتف', 'Phone')}</Label>
                <Input 
                  value={clinic.phone || ''} 
                  onChange={(e) => setClinic({...clinic, phone: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-300">{t('العنوان', 'Address')}</Label>
                <Input 
                  value={clinic.address || ''} 
                  onChange={(e) => setClinic({...clinic, address: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={handleSaveClinic} 
                disabled={saving}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                <Save className="w-4 h-4 me-2" />
                {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ التغييرات', 'Save Changes')}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff">
          <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t('الموظفين', 'Staff Members')}</h2>
                <p className="text-sm text-slate-500">{staff.length} {t('موظف', 'employees')}</p>
              </div>
              <Button 
                onClick={() => setShowAddStaff(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600"
              >
                <Plus className="w-4 h-4 me-2" />
                {t('إضافة موظف', 'Add Staff')}
              </Button>
            </div>
            
            <div className="divide-y divide-white/5">
              {staff.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('لا يوجد موظفين', 'No staff members')}</p>
                </div>
              ) : (
                staff.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] group">
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        member.role === 'doctor' ? 'bg-cyan-500/20 text-cyan-400' :
                        member.role === 'nurse' ? 'bg-pink-500/20 text-pink-400' :
                        member.role === 'company_admin' ? 'bg-violet-500/20 text-violet-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {member.role === 'doctor' ? <Stethoscope className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-white">{language === 'ar' ? member.name_ar || member.name : member.name}</p>
                        <p className="text-sm text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-white/5 text-slate-300 border-white/10">
                        {roles.find(r => r.value === member.role)?.label || member.role}
                      </Badge>
                      {member.specialty && (
                        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                          {specialties.find(s => s.value === member.specialty)?.label || member.specialty}
                        </Badge>
                      )}
                      {member.role === 'doctor' && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {member.consultation_fee || 0} {t('ل.س', 'SYP')}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditStaff(member)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                        data-testid={`edit-staff-${member.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteStaff(member.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Current Subscription */}
            <div className="rounded-2xl bg-[#12121a] border border-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">{t('الاشتراك الحالي', 'Current Subscription')}</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400">{t('الحالة', 'Status')}</span>
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
                
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-slate-400">{t('تاريخ الانتهاء', 'End Date')}</span>
                  <span className="text-white font-medium">
                    {clinic.subscription_end_date 
                      ? new Date(clinic.subscription_end_date).toLocaleDateString('ar-SA')
                      : t('غير محدد', 'Not set')}
                  </span>
                </div>

                <div className="space-y-2 pt-4">
                  <Label className="text-slate-300">{t('تغيير الحالة', 'Change Status')}</Label>
                  <Select 
                    value={clinic.subscription_status} 
                    onValueChange={(v) => handleUpdateSubscription({ subscription_status: v })}
                  >
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
              </div>
            </div>

            {/* Extend Subscription */}
            <div className="rounded-2xl bg-[#12121a] border border-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">{t('تمديد الاشتراك', 'Extend Subscription')}</h2>
              
              <div className="grid grid-cols-2 gap-3">
                {[7, 14, 30, 90, 180, 365].map((days) => (
                  <Button
                    key={days}
                    variant="outline"
                    onClick={() => handleExtendSubscription(days)}
                    className="bg-white/5 border-white/10 text-white hover:bg-violet-500/20 hover:border-violet-500/30 hover:text-violet-300"
                  >
                    <Clock className="w-4 h-4 me-2" />
                    {days} {t('يوم', 'days')}
                  </Button>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-300 text-sm">
                  {t('التمديد يبدأ من تاريخ الانتهاء الحالي أو من اليوم إذا كان الاشتراك منتهياً', 
                     'Extension starts from current end date or today if expired')}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <div className="rounded-2xl bg-[#12121a] border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">{t('الميزات المتاحة', 'Available Features')}</h2>
            <p className="text-slate-500 text-sm mb-6">{t('تفعيل أو تعطيل الميزات لهذه العيادة', 'Enable or disable features for this clinic')}</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {allFeatures.map((feature) => (
                <div 
                  key={feature.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    clinic.features?.[feature.id]
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      clinic.features?.[feature.id]
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 text-slate-500'
                    }`}>
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <span className={clinic.features?.[feature.id] ? 'text-white' : 'text-slate-400'}>
                      {feature.label}
                    </span>
                  </div>
                  <Switch
                    checked={clinic.features?.[feature.id] || false}
                    onCheckedChange={() => handleToggleFeature(feature.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <div className="rounded-2xl bg-[#12121a] border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">{t('صلاحيات الأدوار', 'Role Permissions')}</h2>
                <p className="text-slate-500 text-sm">{t('تخصيص صلاحيات كل دور في هذه العيادة', 'Customize permissions for each role')}</p>
              </div>
              {editingPermissions && (
                <Button 
                  onClick={handleSavePermissions}
                  className="bg-gradient-to-r from-violet-600 to-purple-600"
                >
                  <Save className="w-4 h-4 me-2" />
                  {t('حفظ الصلاحيات', 'Save Permissions')}
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {roles.filter(r => r.value !== 'company_admin').map((role) => (
                <div key={role.value} className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setEditingPermissions(editingPermissions === role.value ? null : role.value)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        role.value === 'doctor' ? 'bg-cyan-500/20 text-cyan-400' :
                        role.value === 'nurse' ? 'bg-pink-500/20 text-pink-400' :
                        role.value === 'receptionist' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{role.label}</p>
                        <p className="text-xs text-slate-500">
                          {(permissions[role.value] || []).length} {t('صلاحية', 'permissions')}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-violet-400">
                      <Edit className="w-4 h-4 me-1" />
                      {t('تعديل', 'Edit')}
                    </Button>
                  </div>
                  
                  {editingPermissions === role.value && (
                    <div className="p-4 pt-0 border-t border-white/5">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                        {[
                          { id: 'view_patients', label: t('عرض المرضى', 'View Patients') },
                          { id: 'edit_patients', label: t('تعديل المرضى', 'Edit Patients') },
                          { id: 'add_patients', label: t('إضافة مرضى', 'Add Patients') },
                          { id: 'add_visits', label: t('إضافة زيارات', 'Add Visits') },
                          { id: 'add_vitals', label: t('إضافة قراءات', 'Add Vitals') },
                          { id: 'view_appointments', label: t('عرض المواعيد', 'View Appointments') },
                          { id: 'manage_appointments', label: t('إدارة المواعيد', 'Manage Appointments') },
                          { id: 'view_invoices', label: t('عرض الفواتير', 'View Invoices') },
                          { id: 'create_invoices', label: t('إنشاء فواتير', 'Create Invoices') },
                          { id: 'view_reports', label: t('عرض التقارير', 'View Reports') },
                          { id: 'use_ai', label: t('استخدام AI', 'Use AI') },
                        ].map((perm) => {
                          const hasPermission = (permissions[role.value] || []).includes(perm.id);
                          return (
                            <div
                              key={perm.id}
                              onClick={() => {
                                const current = permissions[role.value] || [];
                                const updated = hasPermission
                                  ? current.filter(p => p !== perm.id)
                                  : [...current, perm.id];
                                setClinic({
                                  ...clinic,
                                  custom_permissions: { ...permissions, [role.value]: updated }
                                });
                              }}
                              className={`flex items-center gap-2 p-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                                hasPermission 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-white/[0.02] text-slate-500 border border-transparent hover:border-white/10'
                              }`}
                            >
                              {hasPermission ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                              <span className="truncate">{perm.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup">
          <div className="space-y-6">
            {/* Last Backup Info */}
            <div className="rounded-2xl bg-gradient-to-r from-cyan-600/10 via-blue-600/5 to-cyan-600/10 border border-cyan-500/20 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                    <Database className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{t('النسخ الاحتياطي', 'Backup & Restore')}</h2>
                    <p className="text-slate-400 text-sm">
                      {backups.length > 0 
                        ? t(`آخر نسخة: ${new Date(backups[0]?.created_at).toLocaleDateString('ar-SA')}`, 
                            `Last backup: ${new Date(backups[0]?.created_at).toLocaleDateString()}`)
                        : t('لا توجد نسخ احتياطية', 'No backups yet')}
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/25"
                >
                  {creatingBackup ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {creatingBackup ? t('جاري الإنشاء...', 'Creating...') : t('إنشاء نسخة احتياطية', 'Create Backup')}
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-[#12121a] border border-cyan-500/20 p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                  <HardDrive className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-cyan-400">{backups.length}</p>
                <p className="text-sm text-slate-500 mt-1">{t('نسخة متاحة', 'Backups')}</p>
              </div>
              <div className="rounded-2xl bg-[#12121a] border border-emerald-500/20 p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400">{backups.filter(b => b.status === 'success').length}</p>
                <p className="text-sm text-slate-500 mt-1">{t('ناجحة', 'Successful')}</p>
              </div>
              <div className="rounded-2xl bg-[#12121a] border border-violet-500/20 p-5 text-center">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-violet-400" />
                </div>
                <p className="text-2xl font-bold text-violet-400">
                  {backups.length > 0 
                    ? new Date(backups[0]?.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
                    : '-'}
                </p>
                <p className="text-sm text-slate-500 mt-1">{t('آخر نسخة', 'Last Backup')}</p>
              </div>
            </div>

            {/* Backup List */}
            <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-lg font-semibold text-white">{t('سجل النسخ الاحتياطية', 'Backup History')}</h2>
              </div>
              
              {loadingBackups ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                </div>
              ) : backups.length === 0 ? (
                <div className="p-8 text-center">
                  <Database className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400">{t('لا توجد نسخ احتياطية بعد', 'No backups yet')}</p>
                  <p className="text-slate-500 text-sm mt-1">{t('أنشئ أول نسخة احتياطية للحفاظ على بياناتك', 'Create your first backup to protect your data')}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {backups.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                          backup.status === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                        }`}>
                          {backup.status === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {new Date(backup.created_at).toLocaleDateString('ar-SA', { 
                              year: 'numeric', month: 'long', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-sm text-slate-500">
                              <HardDrive className="w-3 h-3" />
                              {backup.size || '~'}
                            </span>
                            <Badge className={`text-xs ${
                              backup.type === 'auto' 
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                                : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            } border`}>
                              {backup.type === 'auto' ? t('تلقائي', 'Auto') : t('يدوي', 'Manual')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleRestoreBackup(backup.id)}
                          disabled={restoringBackup === backup.id}
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        >
                          {restoringBackup === backup.id ? (
                            <Loader2 className="w-4 h-4 animate-spin me-1" />
                          ) : (
                            <RotateCcw className="w-4 h-4 me-1" />
                          )}
                          {t('استرجاع', 'Restore')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-200 mb-1">{t('تنبيه مهم', 'Important Notice')}</h3>
                  <p className="text-amber-300/70 text-sm">
                    {t('استرجاع نسخة احتياطية سيستبدل جميع البيانات الحالية. تأكد من أخذ نسخة احتياطية قبل الاسترجاع.', 
                       'Restoring a backup will replace all current data. Make sure to create a backup before restoring.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent className="max-w-lg bg-[#12121a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('إضافة موظف جديد', 'Add New Staff')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (English)', 'Name (EN)')}</Label>
                <Input 
                  value={newStaff.name} 
                  onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (عربي)', 'Name (AR)')}</Label>
                <Input 
                  value={newStaff.name_ar} 
                  onChange={(e) => setNewStaff({...newStaff, name_ar: e.target.value})}
                  dir="rtl"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t('البريد', 'Email')}</Label>
                <Input 
                  type="email"
                  value={newStaff.email} 
                  onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('كلمة المرور', 'Password')}</Label>
                <Input 
                  type="password"
                  value={newStaff.password} 
                  onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الدور', 'Role')}</Label>
                <Select value={newStaff.role} onValueChange={(v) => setNewStaff({...newStaff, role: v})}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-white/10">
                    {roles.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-white hover:bg-white/10">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newStaff.role === 'doctor' && (
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('التخصص', 'Specialty')}</Label>
                  <Select value={newStaff.specialty} onValueChange={(v) => setNewStaff({...newStaff, specialty: v})}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder={t('اختر', 'Select')} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a24] border-white/10">
                      {specialties.map(s => (
                        <SelectItem key={s.value} value={s.value} className="text-white hover:bg-white/10">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {newStaff.role === 'doctor' && (
              <div className="space-y-2">
                <Label className="text-slate-300">{t('رسوم الكشف', 'Consultation Fee')}</Label>
                <Input 
                  type="number"
                  value={newStaff.consultation_fee} 
                  onChange={(e) => setNewStaff({...newStaff, consultation_fee: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowAddStaff(false)} className="text-slate-400">
                {t('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-violet-600 to-purple-600">
                {t('إضافة', 'Add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
        <DialogContent className="bg-[#12121a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {t('تعديل بيانات الموظف', 'Edit Staff Member')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (إنجليزي)', 'Name (English)')}</Label>
                <Input
                  value={editStaffForm.name}
                  onChange={(e) => setEditStaffForm({...editStaffForm, name: e.target.value})}
                  className="bg-[#0a0a0f] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (عربي)', 'Name (Arabic)')}</Label>
                <Input
                  value={editStaffForm.name_ar}
                  onChange={(e) => setEditStaffForm({...editStaffForm, name_ar: e.target.value})}
                  className="bg-[#0a0a0f] border-white/10 text-white"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">{t('رقم الهاتف', 'Phone')}</Label>
              <Input
                value={editStaffForm.phone}
                onChange={(e) => setEditStaffForm({...editStaffForm, phone: e.target.value})}
                className="bg-[#0a0a0f] border-white/10 text-white"
              />
            </div>

            {editingStaff?.role === 'doctor' && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">{t('التخصص', 'Specialty')}</Label>
                  <Select 
                    value={editStaffForm.specialty} 
                    onValueChange={(v) => setEditStaffForm({...editStaffForm, specialty: v})}
                  >
                    <SelectTrigger className="bg-[#0a0a0f] border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a24] border-white/10">
                      {specialties.map(spec => (
                        <SelectItem key={spec.value} value={spec.value} className="text-white hover:bg-white/5">
                          {spec.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    {t('سعر الكشفية', 'Consultation Fee')}
                  </Label>
                  <Input
                    type="number"
                    value={editStaffForm.consultation_fee}
                    onChange={(e) => setEditStaffForm({...editStaffForm, consultation_fee: parseInt(e.target.value) || 0})}
                    className="bg-[#0a0a0f] border-white/10 text-white"
                  />
                  <p className="text-xs text-slate-500">{t('السعر بالليرة السورية', 'Price in Syrian Pounds')}</p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditingStaff(null)} className="text-slate-400">
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button 
              onClick={handleEditStaff}
              className="bg-gradient-to-r from-cyan-600 to-teal-600"
            >
              <Save className="w-4 h-4 me-2" />
              {t('حفظ التغييرات', 'Save Changes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClinicDetailPage;

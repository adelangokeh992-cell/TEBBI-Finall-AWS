import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Shield, Check, X, Unlock, Users, Stethoscope, Eye, Edit } from 'lucide-react';

const PermissionsPage = () => {
  const { t } = useAuth();

  const roles = [
    { 
      id: 'super_admin', 
      name: t('مدير النظام', 'Super Admin'),
      gradient: 'from-violet-500 to-purple-600',
      permissions: ['all']
    },
    { 
      id: 'company_admin', 
      name: t('مدير الشركة', 'Company Admin'),
      gradient: 'from-blue-500 to-cyan-500',
      permissions: ['view_patients', 'edit_patients', 'view_appointments', 'manage_staff', 'view_reports', 'manage_settings']
    },
    { 
      id: 'doctor', 
      name: t('طبيب', 'Doctor'),
      gradient: 'from-cyan-500 to-teal-500',
      permissions: ['view_patients', 'edit_patients', 'add_visits', 'view_appointments', 'use_ai']
    },
    { 
      id: 'nurse', 
      name: t('ممرض', 'Nurse'),
      gradient: 'from-pink-500 to-rose-500',
      permissions: ['view_patients', 'add_vitals', 'view_appointments']
    },
    { 
      id: 'receptionist', 
      name: t('استقبال', 'Receptionist'),
      gradient: 'from-amber-500 to-orange-500',
      permissions: ['view_patients', 'add_patients', 'manage_appointments']
    },
    { 
      id: 'accountant', 
      name: t('محاسب', 'Accountant'),
      gradient: 'from-emerald-500 to-green-500',
      permissions: ['view_invoices', 'create_invoices', 'view_reports']
    },
  ];

  const allPermissions = [
    { id: 'view_patients', label: t('عرض المرضى', 'View Patients'), icon: Eye },
    { id: 'edit_patients', label: t('تعديل المرضى', 'Edit Patients'), icon: Edit },
    { id: 'add_patients', label: t('إضافة مرضى', 'Add Patients'), icon: Users },
    { id: 'add_visits', label: t('إضافة زيارات', 'Add Visits'), icon: Stethoscope },
    { id: 'add_vitals', label: t('إضافة قراءات', 'Add Vitals'), icon: Edit },
    { id: 'view_appointments', label: t('عرض المواعيد', 'View Appointments'), icon: Eye },
    { id: 'manage_appointments', label: t('إدارة المواعيد', 'Manage Appointments'), icon: Edit },
    { id: 'view_invoices', label: t('عرض الفواتير', 'View Invoices'), icon: Eye },
    { id: 'create_invoices', label: t('إنشاء فواتير', 'Create Invoices'), icon: Edit },
    { id: 'manage_staff', label: t('إدارة الموظفين', 'Manage Staff'), icon: Users },
    { id: 'view_reports', label: t('عرض التقارير', 'View Reports'), icon: Eye },
    { id: 'manage_settings', label: t('إدارة الإعدادات', 'Manage Settings'), icon: Edit },
    { id: 'use_ai', label: t('استخدام AI', 'Use AI'), icon: Stethoscope },
  ];

  return (
    <div className="space-y-6" data-testid="permissions-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('الصلاحيات والأدوار', 'Permissions & Roles')}</h1>
        <p className="text-slate-500 mt-1">{t('إدارة صلاحيات المستخدمين حسب الدور', 'Manage user permissions by role')}</p>
      </div>

      {/* Roles Grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        {roles.map(role => (
          <div key={role.id} className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
            {/* Role Header */}
            <div className={`p-5 bg-gradient-to-r ${role.gradient} bg-opacity-10`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg`}>
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{role.name}</h3>
                    <p className="text-xs text-slate-400">{role.id}</p>
                  </div>
                </div>
                <Badge className="bg-white/10 text-white border-white/20">
                  {role.permissions.includes('all') ? t('كامل', 'Full') : role.permissions.length + ' ' + t('صلاحية', 'permissions')}
                </Badge>
              </div>
            </div>
            
            {/* Permissions */}
            <div className="p-5">
              {role.permissions.includes('all') ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <Unlock className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="font-semibold text-emerald-400">{t('صلاحيات كاملة', 'Full Access')}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('الوصول لجميع الميزات', 'Access to all features')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {allPermissions.map(perm => {
                    const hasPermission = role.permissions.includes(perm.id);
                    return (
                      <div 
                        key={perm.id} 
                        className={`flex items-center gap-2 p-2.5 rounded-xl text-sm transition-colors ${
                          hasPermission 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-white/[0.02] text-slate-600 border border-transparent'
                        }`}
                      >
                        {hasPermission ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                        <span className="truncate">{perm.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PermissionsPage;

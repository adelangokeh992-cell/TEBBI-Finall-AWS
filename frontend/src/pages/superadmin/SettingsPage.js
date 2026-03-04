import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Globe, Bell, Shield, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SettingsPage = () => {
  const { t } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaSaving, setMfaSaving] = useState(false);

  useEffect(() => {
    adminAPI.getSystemSettings()
      .then((res) => setMfaEnabled(res.data?.mfa_enabled ?? false))
      .catch(() => setMfaEnabled(false))
      .finally(() => setMfaLoading(false));
  }, []);

  const onMfaToggle = (checked) => {
    setMfaSaving(true);
    adminAPI.updateSystemSettings({ mfa_enabled: checked })
      .then(() => {
        setMfaEnabled(checked);
        toast.success(t('تم حفظ الإعداد', 'Settings saved'));
      })
      .catch(() => toast.error(t('فشل الحفظ', 'Failed to save')))
      .finally(() => setMfaSaving(false));
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('إعدادات النظام', 'System Settings')}</h1>
        <p className="text-slate-500 mt-1">{t('إعدادات عامة للنظام', 'General system settings')}</p>
      </div>

      <div className="space-y-5">
        {/* Language Section */}
        <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('اللغة والمنطقة', 'Language & Region')}</h2>
                <p className="text-sm text-slate-500">{t('إعدادات اللغة والمنطقة الزمنية', 'Language and timezone settings')}</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('اللغة الافتراضية', 'Default Language')}</p>
                <p className="text-sm text-slate-400 mt-0.5">{t('العربية', 'Arabic')}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                {t('تغيير', 'Change')}
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('المنطقة الزمنية', 'Timezone')}</p>
                <p className="text-sm text-slate-400 mt-0.5">Asia/Damascus (UTC+3)</p>
              </div>
              <Button size="sm" variant="ghost" className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                {t('تغيير', 'Change')}
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('الإشعارات', 'Notifications')}</h2>
                <p className="text-sm text-slate-500">{t('إعدادات الإشعارات للمدير', 'Admin notification settings')}</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('إشعار شركة جديدة', 'New Company Alert')}</p>
                <p className="text-sm text-slate-500 mt-0.5">{t('عند تسجيل شركة جديدة', 'When new company registers')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('إشعار انتهاء الاشتراك', 'Subscription Expiry')}</p>
                <p className="text-sm text-slate-500 mt-0.5">{t('قبل انتهاء الاشتراك', 'Before subscription expires')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('تقارير يومية', 'Daily Reports')}</p>
                <p className="text-sm text-slate-500 mt-0.5">{t('إرسال تقرير يومي بالبريد', 'Send daily report by email')}</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('الأمان', 'Security')}</h2>
                <p className="text-sm text-slate-500">{t('إعدادات الأمان والحماية', 'Security settings')}</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('المصادقة الثنائية', 'Two-Factor Auth')}</p>
                <p className="text-sm text-slate-500 mt-0.5">{t('تفعيل المصادقة الثنائية للنظام؛ العيادات تفعّلها من إعداداتها', 'Enable 2FA for the system; clinics enable it in their settings')}</p>
              </div>
              {mfaLoading ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                <Switch checked={mfaEnabled} onCheckedChange={onMfaToggle} disabled={mfaSaving} />
              )}
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="font-medium text-white">{t('تسجيل الأنشطة', 'Activity Logging')}</p>
                <p className="text-sm text-slate-500 mt-0.5">{t('تسجيل جميع الأنشطة', 'Log all activities')}</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Database Section */}
        <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('قاعدة البيانات', 'Database')}</h2>
                <p className="text-sm text-slate-500">{t('معلومات قاعدة البيانات', 'Database information')}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xs text-slate-500 mb-1">{t('نوع القاعدة', 'Type')}</p>
                <p className="font-semibold text-white">MongoDB</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xs text-slate-500 mb-1">{t('الحالة', 'Status')}</p>
                <p className="font-semibold text-emerald-400">{t('متصل', 'Connected')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

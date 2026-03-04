import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/services/api';

const ChangePasswordPage = () => {
  const { t, language } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('كلمة المرور الجديدة غير متطابقة', 'New passwords do not match'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'Password must be at least 6 characters'));
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      toast.success(t('تم تغيير كلمة المرور بنجاح', 'Password changed successfully'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('فشل في تغيير كلمة المرور', 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border-2 shadow-xl border-teal-200/60 dark:border-teal-800/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-teal-700 dark:text-teal-400">
              {t('تغيير كلمة المرور', 'Change Password')}
            </CardTitle>
            <CardDescription>
              {t('أدخل كلمة المرور الحالية والجديدة', 'Enter your current and new password')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">{t('كلمة المرور الحالية', 'Current Password')}</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">{t('كلمة المرور الجديدة', 'New Password')}</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 bg-white dark:bg-slate-900"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t('تأكيد كلمة المرور الجديدة', 'Confirm New Password')}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 bg-white dark:bg-slate-900"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 h-12" disabled={loading}>
                  {loading ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                </Button>
                <Button type="button" variant="outline" asChild className="h-12">
                  <Link to="/dashboard">
                    <ArrowLeft className="w-4 h-4 me-2" />
                    {t('رجوع', 'Back')}
                  </Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChangePasswordPage;

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/services/api';

const ResetPasswordPage = () => {
  const { t, language } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error(t('رابط غير صالح', 'Invalid link'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('كلمة المرور غير متطابقة', 'Passwords do not match'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'Password must be at least 6 characters'));
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword);
      toast.success(t('تم تعيين كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.', 'Password has been reset. You can log in now.'));
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('رابط منتهي أو غير صالح', 'Link expired or invalid'));
    } finally {
      setLoading(false);
    }
  };

  const isRtl = language === 'ar';

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <Card className="max-w-md w-full rounded-2xl border-2 shadow-xl border-teal-200/60 dark:border-teal-800/60">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 dark:text-slate-300 mb-4">{t('رابط إعادة التعيين غير صالح أو ناقص.', 'Reset link is invalid or missing.')}</p>
            <Button asChild>
              <Link to="/forgot-password">{t('طلب رابط جديد', 'Request new link')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border-2 shadow-xl border-teal-200/60 dark:border-teal-800/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-teal-700 dark:text-teal-400">
              {t('تعيين كلمة مرور جديدة', 'Set New Password')}
            </CardTitle>
            <CardDescription>
              {t('أدخل كلمة المرور الجديدة', 'Enter your new password')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="confirm">{t('تأكيد كلمة المرور', 'Confirm Password')}</Label>
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
                  {loading ? t('جاري الحفظ...', 'Saving...') : t('تعيين كلمة المرور', 'Set Password')}
                </Button>
                <Button type="button" variant="outline" asChild className="h-12">
                  <Link to="/login">
                    <ArrowLeft className="w-4 h-4 me-2" />
                    {t('رجوع لتسجيل الدخول', 'Back to Login')}
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

export default ResetPasswordPage;

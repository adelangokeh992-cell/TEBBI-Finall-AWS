import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/services/api';

const ForgotPasswordPage = () => {
  const { t, language } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSent(false);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
      toast.success(t('إذا كان البريد مسجلاً، ستتلقى رابط إعادة التعيين', 'If the email is registered, you will receive a reset link'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('حدث خطأ', 'Something went wrong'));
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
              <Mail className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-teal-700 dark:text-teal-400">
              {t('نسيت كلمة المرور', 'Forgot Password')}
            </CardTitle>
            <CardDescription>
              {t('أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين', 'Enter your email and we will send you a reset link')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {sent ? (
              <div className="space-y-4 text-center text-slate-600 dark:text-slate-300">
                <p>{t('تم إرسال الطلب. تحقق من بريدك الإلكتروني.', 'Request sent. Check your email.')}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="w-4 h-4 me-2" />
                    {t('العودة لتسجيل الدخول', 'Back to Login')}
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('البريد الإلكتروني', 'Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('أدخل بريدك الإلكتروني', 'Enter your email')}
                    className="h-12 bg-white dark:bg-slate-900"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 h-12" disabled={loading}>
                    {loading ? t('جاري الإرسال...', 'Sending...') : t('إرسال رابط إعادة التعيين', 'Send Reset Link')}
                  </Button>
                  <Button type="button" variant="outline" asChild className="h-12">
                    <Link to="/login">
                      <ArrowLeft className="w-4 h-4 me-2" />
                      {t('رجوع', 'Back')}
                    </Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

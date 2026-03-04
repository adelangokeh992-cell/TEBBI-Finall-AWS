import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Stethoscope, Globe, AlertCircle, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const LoginPage = () => {
  const { login, t, toggleLanguage, language, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(email, password);
      if (userData && userData.requires_mfa_setup) {
        navigate('/mfa-setup', { state: { temp_token: userData.temp_token, user: userData.user } });
        return;
      }
      if (userData && userData.requires_mfa) {
        navigate('/mfa-challenge', { state: { temp_token: userData.temp_token, user: userData.user } });
        return;
      }
      const redirectPath = getRedirectPath(userData);
      navigate(redirectPath);
    } catch (err) {
      setError(t('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230D9488' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Language Toggle */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
            data-testid="language-toggle"
          >
            <Globe className="w-4 h-4" />
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
        </div>

        <Card className="rounded-2xl border-2 shadow-xl border-teal-200/60 dark:border-teal-800/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-teal-700 dark:text-teal-400">
              Tebbi
            </CardTitle>
            <CardDescription className="text-lg">
              {t('طبّي - نظام إدارة العيادات', 'Tebbi - Clinic Management System')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
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
                  data-testid="login-email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('كلمة المرور', 'Password')}</Label>
                  <Link to="/forgot-password" className="text-sm text-teal-600 hover:underline">
                    {t('نسيت كلمة المرور؟', 'Forgot password?')}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('أدخل كلمة المرور', 'Enter your password')}
                  className="h-12 bg-white dark:bg-slate-900"
                  data-testid="login-password"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg bg-teal-600 hover:bg-teal-700 text-white"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? t('جاري الدخول...', 'Signing in...') : t('تسجيل الدخول', 'Sign In')}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-muted-foreground text-center mb-3">
                {t('بيانات تجريبية للدخول:', 'Demo credentials:')}
              </p>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="font-bold text-purple-700 dark:text-purple-300 text-xs mb-1">{t('مدير النظام', 'Super Admin')}</p>
                  <p className="font-mono text-xs">superadmin@tebbi.com / super123</p>
                </div>
                <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg border border-teal-200 dark:border-teal-800">
                  <p className="font-bold text-teal-700 dark:text-teal-300 text-xs mb-1">{t('طبيب 1 - قلب', 'Doctor 1 - Cardiology')}</p>
                  <p className="font-mono text-xs">doctor@tebbi.com / doctor123</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-bold text-blue-700 dark:text-blue-300 text-xs mb-1">{t('طبيب 2 - أطفال', 'Doctor 2 - Pediatrics')}</p>
                  <p className="font-mono text-xs">doctor2@tebbi.com / doctor123</p>
                </div>
              </div>
            </div>

            {/* Public Booking Link */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Link to="/booking">
                <Button variant="outline" className="w-full gap-2" data-testid="public-booking-link">
                  <Calendar className="w-4 h-4" />
                  {t('احجز موعدك أونلاين (للمرضى)', 'Book Appointment Online (For Patients)')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;

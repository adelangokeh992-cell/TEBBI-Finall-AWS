import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

const MfaChallengePage = () => {
  const { completeMfaChallenge, getRedirectPath, t, language } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { temp_token, user } = location.state || {};
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!temp_token) {
      navigate('/login');
    }
  }, [temp_token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!temp_token || !code.trim() || code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await completeMfaChallenge(temp_token, code.trim());
      const redirectPath = getRedirectPath(user || {});
      navigate(redirectPath);
    } catch (e) {
      setError(e.response?.data?.detail || t('رمز غير صحيح', 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  if (!temp_token) return null;

  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900" dir={isRtl ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-600" />
            <CardTitle>{t('المصادقة الثنائية', 'Two-Factor Authentication')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة لديك.', 'Enter the 6-digit code from your authenticator app.')}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-challenge-code">{t('رمز التحقق', 'Verification code')}</Label>
              <Input
                id="mfa-challenge-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-lg tracking-widest"
                aria-label={t('رمز التحقق المكون من 6 أرقام', '6-digit verification code')}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? t('جاري التحقق...', 'Verifying...') : t('تحقق والدخول', 'Verify and sign in')}
            </Button>
          </form>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>
            {t('العودة لتسجيل الدخول', 'Back to login')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaChallengePage;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MfaSetupPage = () => {
  const { completeMfaSetup, getRedirectPath, t, language } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { temp_token, user } = location.state || {};
  const [secret, setSecret] = useState(null);
  const [provisioningUri, setProvisioningUri] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!temp_token) {
      navigate('/login');
    }
  }, [temp_token, navigate]);

  const handleStartSetup = async () => {
    if (!temp_token) return;
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.mfaSetup(temp_token);
      setSecret(res.data.secret);
      setProvisioningUri(res.data.provisioning_uri);
    } catch (e) {
      setError(e.response?.data?.detail || t('فشل في إعداد المصادقة الثنائية', 'Failed to set up MFA'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!temp_token || !code.trim()) return;
    setLoading(true);
    setError('');
    try {
      await completeMfaSetup(temp_token, code.trim());
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
          <CardTitle>{t('إعداد المصادقة الثنائية (MFA)', 'Set up two-factor authentication (MFA)')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!secret ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('يجب تفعيل المصادقة الثنائية لتسجيل الدخول. انقر أدناه للحصول على الرمز أو رمز QR.', 'You must set up two-factor authentication to sign in. Click below to get the secret or QR code.')}
              </p>
              <Button onClick={handleStartSetup} disabled={loading} className="w-full">
                {loading ? t('جاري التحميل...', 'Loading...') : t('بدء الإعداد', 'Start setup')}
              </Button>
            </>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('أدخل الرمز من تطبيق المصادقة (Google Authenticator أو غيره).', 'Enter the code from your authenticator app (e.g. Google Authenticator).')}
              </p>
              {provisioningUri && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t('امسح رمز QR بتطبيق المصادقة:', 'Scan this QR code with your authenticator app:')}
                  </p>
                  <div className="inline-block rounded-lg border border-border bg-white p-3" aria-hidden="true">
                    <QRCodeSVG value={provisioningUri} size={200} level="M" includeMargin />
                  </div>
                  <p className="text-xs break-all text-muted-foreground">
                    {t('أو أدخل الرابط يدوياً:', 'Or enter the URI manually:')} <span className="font-mono">{provisioningUri.substring(0, 50)}…</span>
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mfa-code">{t('رمز التحقق', 'Verification code')}</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MfaSetupPage;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  MessageSquare, Phone, Settings, Save, TestTube,
  CheckCircle, XCircle, AlertTriangle, Eye, EyeOff,
  Smartphone, Send, Bell, Key
} from 'lucide-react';
import { PageHeader, LoadingSpinner } from '../components/common';

const NotificationSettingsPage = () => {
  const { t, language } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const [settings, setSettings] = useState({
    notifications_enabled: false,
    sms_enabled: false,
    whatsapp_enabled: false,
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    twilio_whatsapp_number: '',
    // Notification triggers
    on_booking_created: true,
    on_booking_confirmed: true,
    on_booking_cancelled: true,
    on_booking_reminder: true,
    reminder_hours_before: 24,
    reminder_2h_enabled: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.getNotifications();
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateNotifications(settings);
      toast.success(t('تم حفظ الإعدادات بنجاح', 'Settings saved successfully'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في حفظ الإعدادات', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast.error(t('أدخل رقم الهاتف للاختبار', 'Enter phone number for testing'));
      return;
    }
    setTesting(true);
    try {
      await settingsAPI.testNotification({
        type: 'sms',
        phone: testPhone
      });
      toast.success(t('تم إرسال رسالة الاختبار', 'Test message sent'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في إرسال الرسالة', 'Failed to send message'));
    } finally {
      setTesting(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      toast.error(t('أدخل رقم الهاتف للاختبار', 'Enter phone number for testing'));
      return;
    }
    setTesting(true);
    try {
      await settingsAPI.testNotification({
        type: 'whatsapp',
        phone: testPhone
      });
      toast.success(t('تم إرسال رسالة واتساب الاختبارية', 'Test WhatsApp message sent'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في إرسال الرسالة', 'Failed to send message'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner className="min-h-[50vh]" />;
  }

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="notification-settings" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('إعدادات الإشعارات', 'Notification Settings')}
        description={t('إعداد SMS و WhatsApp للإشعارات التلقائية', 'Configure SMS & WhatsApp for automatic notifications')}
        icon={Bell}
        actions={
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="gap-2 bg-teal-600 hover:bg-teal-700"
            data-testid="save-settings"
          >
            <Save className="w-4 h-4" />
            {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ الإعدادات', 'Save Settings')}
          </Button>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      {/* Main Toggle */}
      <Card className="rounded-xl border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{t('تفعيل الإشعارات', 'Enable Notifications')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('إرسال إشعارات تلقائية للمرضى عند الحجز', 'Send automatic notifications to patients on booking')}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.notifications_enabled}
              onCheckedChange={(checked) => setSettings({...settings, notifications_enabled: checked})}
              data-testid="toggle-notifications"
            />
          </div>
        </CardContent>
      </Card>

      {settings.notifications_enabled && (
        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md rounded-xl">
            <TabsTrigger value="channels" className="gap-2">
              <Phone className="w-4 h-4" />
              {t('القنوات', 'Channels')}
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-2">
              <Key className="w-4 h-4" />
              {t('الاعتمادات', 'Credentials')}
            </TabsTrigger>
            <TabsTrigger value="triggers" className="gap-2">
              <Settings className="w-4 h-4" />
              {t('المحفزات', 'Triggers')}
            </TabsTrigger>
          </TabsList>

          {/* Channels Tab */}
          <TabsContent value="channels" className="mt-4 space-y-4">
            {/* SMS Card */}
            <Card className={settings.sms_enabled ? 'border-teal-500' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      settings.sms_enabled ? 'bg-teal-100 dark:bg-teal-900' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <Phone className={`w-6 h-6 ${settings.sms_enabled ? 'text-teal-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        SMS
                        {settings.sms_enabled && <Badge className="bg-teal-600">{t('مفعل', 'Active')}</Badge>}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('إرسال رسائل نصية قصيرة للمرضى', 'Send SMS text messages to patients')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.sms_enabled}
                    onCheckedChange={(checked) => setSettings({...settings, sms_enabled: checked})}
                    data-testid="toggle-sms"
                  />
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Card */}
            <Card className={settings.whatsapp_enabled ? 'border-green-500' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      settings.whatsapp_enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <MessageSquare className={`w-6 h-6 ${settings.whatsapp_enabled ? 'text-green-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        WhatsApp
                        {settings.whatsapp_enabled && <Badge className="bg-green-600">{t('مفعل', 'Active')}</Badge>}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('إرسال رسائل واتساب للمرضى', 'Send WhatsApp messages to patients')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.whatsapp_enabled}
                    onCheckedChange={(checked) => setSettings({...settings, whatsapp_enabled: checked})}
                    data-testid="toggle-whatsapp"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Test Section */}
            {(settings.sms_enabled || settings.whatsapp_enabled) && (
              <Card className="bg-slate-50 dark:bg-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TestTube className="w-5 h-5" />
                    {t('اختبار الإرسال', 'Test Send')}
                  </CardTitle>
                  <CardDescription>
                    {t('اختبر إرسال رسالة للتأكد من صحة الإعدادات', 'Test sending a message to verify settings')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder={t('رقم الهاتف مع رمز الدولة (+963...)', 'Phone with country code (+963...)')}
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        data-testid="test-phone"
                      />
                    </div>
                    {settings.sms_enabled && (
                      <Button
                        variant="outline"
                        onClick={handleTestSMS}
                        disabled={testing}
                        className="gap-2"
                        data-testid="test-sms"
                      >
                        <Phone className="w-4 h-4" />
                        {t('اختبار SMS', 'Test SMS')}
                      </Button>
                    )}
                    {settings.whatsapp_enabled && (
                      <Button
                        variant="outline"
                        onClick={handleTestWhatsApp}
                        disabled={testing}
                        className="gap-2 text-green-600 border-green-600 hover:bg-green-50"
                        data-testid="test-whatsapp"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {t('اختبار WhatsApp', 'Test WhatsApp')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  {t('اعتمادات Twilio', 'Twilio Credentials')}
                </CardTitle>
                <CardDescription>
                  {t('احصل على هذه البيانات من', 'Get these from')}{' '}
                  <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">
                    Twilio Console
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    {t('احتفظ بهذه البيانات بشكل آمن ولا تشاركها مع أحد', 'Keep these credentials secure and do not share them')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('Account SID', 'Account SID')}</Label>
                    <Input
                      type={showKeys ? 'text' : 'password'}
                      value={settings.twilio_account_sid}
                      onChange={(e) => setSettings({...settings, twilio_account_sid: e.target.value})}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      data-testid="twilio-sid"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('Auth Token', 'Auth Token')}</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showKeys ? 'text' : 'password'}
                        value={settings.twilio_auth_token}
                        onChange={(e) => setSettings({...settings, twilio_auth_token: e.target.value})}
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="flex-1"
                        data-testid="twilio-token"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowKeys(!showKeys)}
                      >
                        {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('رقم هاتف Twilio (للـ SMS)', 'Twilio Phone Number (for SMS)')}</Label>
                    <Input
                      value={settings.twilio_phone_number}
                      onChange={(e) => setSettings({...settings, twilio_phone_number: e.target.value})}
                      placeholder="+1234567890"
                      data-testid="twilio-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('رقم WhatsApp (اختياري)', 'WhatsApp Number (optional)')}</Label>
                    <Input
                      value={settings.twilio_whatsapp_number}
                      onChange={(e) => setSettings({...settings, twilio_whatsapp_number: e.target.value})}
                      placeholder="whatsapp:+1234567890"
                      data-testid="twilio-whatsapp"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('استخدم رقم Twilio Sandbox للتجربة: whatsapp:+14155238886', 'Use Twilio Sandbox for testing: whatsapp:+14155238886')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Triggers Tab */}
          <TabsContent value="triggers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('متى يتم إرسال الإشعارات؟', 'When to Send Notifications?')}</CardTitle>
                <CardDescription>{t('اختر الأحداث التي تريد إرسال إشعارات عندها', 'Choose events that trigger notifications')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">{t('عند إنشاء حجز جديد', 'On New Booking')}</p>
                    <p className="text-sm text-muted-foreground">{t('إرسال تأكيد الحجز للمريض', 'Send booking confirmation to patient')}</p>
                  </div>
                  <Switch
                    checked={settings.on_booking_created}
                    onCheckedChange={(checked) => setSettings({...settings, on_booking_created: checked})}
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">{t('عند تأكيد الحجز', 'On Booking Confirmed')}</p>
                    <p className="text-sm text-muted-foreground">{t('إخطار المريض بتأكيد موعده', 'Notify patient of confirmed appointment')}</p>
                  </div>
                  <Switch
                    checked={settings.on_booking_confirmed}
                    onCheckedChange={(checked) => setSettings({...settings, on_booking_confirmed: checked})}
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">{t('عند إلغاء الحجز', 'On Booking Cancelled')}</p>
                    <p className="text-sm text-muted-foreground">{t('إخطار المريض بإلغاء موعده', 'Notify patient of cancelled appointment')}</p>
                  </div>
                  <Switch
                    checked={settings.on_booking_cancelled}
                    onCheckedChange={(checked) => setSettings({...settings, on_booking_cancelled: checked})}
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{t('تذكير قبل الموعد', 'Appointment Reminder')}</p>
                    <p className="text-sm text-muted-foreground">{t('إرسال تذكير للمريض قبل الموعد', 'Send reminder before appointment')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="72"
                      value={settings.reminder_hours_before}
                      onChange={(e) => setSettings({...settings, reminder_hours_before: parseInt(e.target.value) || 24})}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{t('ساعة', 'hours')}</span>
                    <Switch
                      checked={settings.on_booking_reminder}
                      onCheckedChange={(checked) => setSettings({...settings, on_booking_reminder: checked})}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-t">
                  <div>
                    <p className="font-medium">{t('تذكير إضافي قبل ساعتين', 'Additional reminder 2h before')}</p>
                    <p className="text-sm text-muted-foreground">{t('إرسال تذكير ثانٍ قبل الموعد بساعتين', 'Send a second reminder 2 hours before appointment')}</p>
                  </div>
                  <Switch
                    checked={!!settings.reminder_2h_enabled}
                    onCheckedChange={(checked) => setSettings({...settings, reminder_2h_enabled: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default NotificationSettingsPage;

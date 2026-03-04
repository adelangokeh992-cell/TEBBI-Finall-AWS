import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { companiesAPI, settingsMfaAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Settings, Phone, Key, Link2, Loader2, CheckCircle, XCircle, Check,
  BellRing, Timer, FileText, Copy, Info, Brain, MessageSquare, Clock, Printer, Shield
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageHeader } from '../components/common';

const CompanySettingsPage = () => {
  const { user, t, language } = useAuth();
  const [notificationSettings, setNotificationSettings] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    whatsapp_number: '',
    sms_enabled: false,
    whatsapp_enabled: false,
    sms_connected: false,
    whatsapp_connected: false,
    openai_api_key_set: false,
    ai_connected: false,
    auto_reminder_enabled: true,
    reminder_hours_before: 24,
    reminder_2h_enabled: false,
    reminder_channel: 'sms',
    templates: {
      booking_confirmation: 'مرحباً {patient_name}، تم تأكيد موعدك في {clinic_name} يوم {date} الساعة {time} مع {doctor_name}. رقم التأكيد: {confirmation_code}',
      booking_reminder: 'تذكير: لديك موعد غداً في {clinic_name} الساعة {time} مع {doctor_name}. نتطلع لرؤيتك!',
      booking_cancelled: 'تم إلغاء موعدك في {clinic_name} يوم {date}. للحجز مجدداً تواصل معنا.',
      booking_completed: 'شكراً لزيارتك {clinic_name}! نتمنى لك الصحة والعافية.'
    }
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState('');
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiConnectLoading, setAiConnectLoading] = useState(false);
  const [aiConnectError, setAiConnectError] = useState(null);
  const [printersList, setPrintersList] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [settingsTab, setSettingsTab] = useState('notifications');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaAllowed, setMfaAllowed] = useState(false);
  const [mfaSecurityLoading, setMfaSecurityLoading] = useState(false);
  const [mfaSecuritySaving, setMfaSecuritySaving] = useState(false);

  const companyId = user?.company_id;

  useEffect(() => {
    if (companyId) fetchNotificationSettings();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setMfaSecurityLoading(true);
    Promise.all([
      companiesAPI.getOne(companyId).then((r) => r.data).catch(() => ({})),
      settingsMfaAPI.getMfaAllowed().then((r) => r.data?.mfa_enabled ?? false).catch(() => false)
    ]).then(([company, allowed]) => {
      setMfaRequired(!!company?.mfa_required);
      setMfaAllowed(!!allowed);
    }).finally(() => setMfaSecurityLoading(false));
  }, [companyId]);

  const fetchPrinters = async () => {
    if (!companyId) return;
    setLoadingPrinters(true);
    try {
      const res = await companiesAPI.getPrinters(companyId);
      setPrintersList(Array.isArray(res.data?.printers) ? res.data.printers : []);
    } catch {
      setPrintersList([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const fetchNotificationSettings = async () => {
    if (!companyId) return;
    try {
      const [setRes, printRes] = await Promise.all([
        companiesAPI.getNotificationSettings(companyId),
        companiesAPI.getPrintSettings(companyId).catch(() => ({ data: {} }))
      ]);
      const res = setRes;
      const printData = printRes?.data || {};
      if (res.data) {
        setNotificationSettings(prev => ({
          ...prev,
          ...res.data,
          twilio_auth_token: res.data.twilio_auth_token ? '••••••••••••' : '',
          print_clinic_name: res.data.print_clinic_name ?? printData.print_clinic_name ?? '',
          print_header_invoice: res.data.print_header_invoice ?? printData.print_header_invoice ?? '',
          print_header_prescription: res.data.print_header_prescription ?? printData.print_header_prescription ?? '',
          print_header_consent: res.data.print_header_consent ?? printData.print_header_consent ?? '',
          print_footer: res.data.print_footer ?? printData.print_footer ?? '',
          print_primary_color: res.data.print_primary_color ?? printData.print_primary_color ?? '#0d9488',
          print_logo_url: res.data.print_logo_url ?? printData.print_logo_url ?? '',
          print_default_printer: res.data.print_default_printer ?? printData.print_default_printer ?? '',
          logo_base64: res.data.logo_base64 ?? printData.logo_base64 ?? '',
          print_invoice_name_ar: res.data.print_invoice_name_ar ?? printData.print_invoice_name_ar ?? '',
          print_invoice_name_en: res.data.print_invoice_name_en ?? printData.print_invoice_name_en ?? '',
          print_invoice_address: res.data.print_invoice_address ?? printData.print_invoice_address ?? '',
          print_invoice_phone: res.data.print_invoice_phone ?? printData.print_invoice_phone ?? '',
          print_invoice_email: res.data.print_invoice_email ?? printData.print_invoice_email ?? '',
          print_invoice_tax_number: res.data.print_invoice_tax_number ?? printData.print_invoice_tax_number ?? '',
          print_show_logo: res.data.print_show_logo ?? printData.print_show_logo ?? true
        }));
        if (res.data.ai_provider === 'gemini' || res.data.ai_provider === 'openai') {
          setAiProvider(res.data.ai_provider);
        }
      }
      if (companyId) fetchPrinters();
      if (!res.data && printData && Object.keys(printData).length > 0) {
        setNotificationSettings(prev => ({
          ...prev,
          print_clinic_name: printData.print_clinic_name ?? prev.print_clinic_name,
          print_invoice_name_ar: printData.print_invoice_name_ar ?? prev.print_invoice_name_ar,
          print_invoice_name_en: printData.print_invoice_name_en ?? prev.print_invoice_name_en,
          print_invoice_address: printData.print_invoice_address ?? prev.print_invoice_address,
          print_invoice_phone: printData.print_invoice_phone ?? prev.print_invoice_phone,
          print_invoice_email: printData.print_invoice_email ?? prev.print_invoice_email,
          print_invoice_tax_number: printData.print_invoice_tax_number ?? prev.print_invoice_tax_number,
          print_show_logo: printData.print_show_logo !== false,
          print_primary_color: printData.print_primary_color ?? prev.print_primary_color,
          print_footer: printData.print_footer ?? prev.print_footer,
          logo_base64: printData.logo_base64 ?? prev.logo_base64
        }));
      }
    } catch (error) {
    }
  };

  const handleConnectAI = async () => {
    const key = (openaiApiKeyInput || '').trim();
    if (!key) {
      toast.error(t('أدخل مفتاح API', 'Enter API key'));
      return;
    }
    setAiConnectLoading(true);
    setAiConnectError(null);
    try {
      const res = await companiesAPI.testAi(companyId, {
        openai_api_key: key,
        provider: aiProvider
      });
      if (res.data && res.data.success) {
        toast.success(res.data.message || t('تم ربط المفتاح بنجاح', 'Key connected successfully'));
        setOpenaiApiKeyInput('');
        fetchNotificationSettings();
      } else {
        const err = res.data?.error || t('فشل الربط', 'Connection failed');
        setAiConnectError(err);
        toast.error(err);
      }
    } catch (error) {
      const err = error?.response?.data?.error || error?.response?.data?.detail || error?.message || t('فشل الربط', 'Connection failed');
      setAiConnectError(err);
      toast.error(err);
    } finally {
      setAiConnectLoading(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingSettings(true);
    try {
      await companiesAPI.saveNotificationSettings(companyId, {
        twilio_account_sid: notificationSettings.twilio_account_sid,
        twilio_auth_token: notificationSettings.twilio_auth_token?.includes?.('•') ? undefined : notificationSettings.twilio_auth_token,
        twilio_phone_number: notificationSettings.twilio_phone_number,
        whatsapp_number: notificationSettings.whatsapp_number,
        sms_enabled: notificationSettings.sms_enabled,
        whatsapp_enabled: notificationSettings.whatsapp_enabled,
        auto_reminder_enabled: notificationSettings.auto_reminder_enabled,
        reminder_hours_before: notificationSettings.reminder_hours_before,
        reminder_2h_enabled: notificationSettings.reminder_2h_enabled,
        reminder_channel: notificationSettings.reminder_channel,
        templates: notificationSettings.templates,
        print_clinic_name: notificationSettings.print_clinic_name ?? '',
        print_header_invoice: notificationSettings.print_header_invoice ?? '',
        print_header_prescription: notificationSettings.print_header_prescription ?? '',
        print_header_consent: notificationSettings.print_header_consent ?? '',
        print_footer: notificationSettings.print_footer ?? '',
        print_primary_color: notificationSettings.print_primary_color || '#0d9488',
        print_logo_url: notificationSettings.print_logo_url ?? '',
        print_default_printer: notificationSettings.print_default_printer ?? '',
        print_invoice_name_ar: notificationSettings.print_invoice_name_ar ?? '',
        print_invoice_name_en: notificationSettings.print_invoice_name_en ?? '',
        print_invoice_address: notificationSettings.print_invoice_address ?? '',
        print_invoice_phone: notificationSettings.print_invoice_phone ?? '',
        print_invoice_email: notificationSettings.print_invoice_email ?? '',
        print_invoice_tax_number: notificationSettings.print_invoice_tax_number ?? '',
        print_show_logo: notificationSettings.print_show_logo !== false
      });
      toast.success(t('تم حفظ الإعدادات', 'Settings saved'));
      fetchNotificationSettings();
    } catch (error) {
      toast.error(t('فشل في حفظ الإعدادات', 'Failed to save settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async (type) => {
    setTestingConnection(true);
    try {
      const res = await companiesAPI.testNotification(companyId, { type });
      if (res.data.success) {
        toast.success(t('تم الربط بنجاح!', 'Connected successfully!'));
        setNotificationSettings(prev => ({
          ...prev,
          [type === 'sms' ? 'sms_connected' : 'whatsapp_connected']: true
        }));
      } else {
        toast.error(res.data.error || t('فشل في الربط', 'Connection failed'));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في الربط - تأكد من صحة المفاتيح', 'Connection failed - check your keys'));
    } finally {
      setTestingConnection(false);
    }
  };

  const isRtl = language === 'ar';

  if (!companyId) return null;

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('الإعدادات', 'Settings')}
        description={t('ربط الذكاء الاصطناعي و SMS وواتساب وإعدادات التذكير وقوالب الرسائل', 'AI, SMS, WhatsApp, reminders and message templates')}
        icon={Settings}
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-3xl">
          <TabsTrigger value="notifications" className="gap-2 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white">
            <MessageSquare className="w-4 h-4" />
            {t('الإشعارات', 'Notifications')}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white">
            <Brain className="w-4 h-4" />
            {t('الذكاء الاصطناعي', 'AI')}
          </TabsTrigger>
          <TabsTrigger value="print" className="gap-2 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white">
            <Printer className="w-4 h-4" />
            {t('الطباعة والفاتورة', 'Print & Invoice')}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white">
            <Shield className="w-4 h-4" />
            {t('الأمان', 'Security')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {t('إعدادات الإشعارات', 'Notification Settings')}
              </CardTitle>
              <CardDescription>
                {t('ربط خدمات SMS و WhatsApp وإعدادات التذكير وقوالب الرسائل', 'Connect SMS & WhatsApp, reminders and message templates')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
          {/* SMS Settings */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('رسائل SMS', 'SMS Messages')}</h3>
                  <p className="text-sm text-muted-foreground">{t('عبر Twilio', 'via Twilio')}</p>
                </div>
              </div>
              {notificationSettings.sms_connected && (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 me-1" />
                  {t('متصل', 'Connected')}
                </Badge>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('Account SID', 'Account SID')}</Label>
                <div className="relative">
                  <Key className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={notificationSettings.twilio_account_sid}
                    onChange={(e) => setNotificationSettings({...notificationSettings, twilio_account_sid: e.target.value})}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="ps-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('Auth Token', 'Auth Token')}</Label>
                <div className="relative">
                  <Key className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={notificationSettings.twilio_auth_token}
                    onChange={(e) => setNotificationSettings({...notificationSettings, twilio_auth_token: e.target.value})}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="ps-9"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('رقم هاتف Twilio', 'Twilio Phone Number')}</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={notificationSettings.twilio_phone_number}
                  onChange={(e) => setNotificationSettings({...notificationSettings, twilio_phone_number: e.target.value})}
                  placeholder="+1234567890"
                  className="ps-9"
                />
              </div>
            </div>
            <Button
              onClick={() => handleTestConnection('sms')}
              disabled={testingConnection || !notificationSettings.twilio_account_sid}
              variant="outline"
              className="gap-2"
            >
              {testingConnection ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {t('ربط المفتاح', 'Connect Key')}
            </Button>
          </div>

          {/* WhatsApp Settings */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('واتساب', 'WhatsApp')}</h3>
                  <p className="text-sm text-muted-foreground">{t('عبر Twilio WhatsApp', 'via Twilio WhatsApp')}</p>
                </div>
              </div>
              {notificationSettings.whatsapp_connected && (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 me-1" />
                  {t('متصل', 'Connected')}
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('رقم WhatsApp', 'WhatsApp Number')}</Label>
              <div className="relative">
                <MessageSquare className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={notificationSettings.whatsapp_number}
                  onChange={(e) => setNotificationSettings({...notificationSettings, whatsapp_number: e.target.value})}
                  placeholder="whatsapp:+1234567890"
                  className="ps-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('استخدم نفس مفاتيح Twilio أعلاه', 'Uses same Twilio keys above')}
              </p>
            </div>
            <Button
              onClick={() => handleTestConnection('whatsapp')}
              disabled={testingConnection || !notificationSettings.twilio_account_sid || !notificationSettings.whatsapp_number}
              variant="outline"
              className="gap-2"
            >
              {testingConnection ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {t('ربط المفتاح', 'Connect Key')}
            </Button>
          </div>

          {/* Auto Reminder Settings */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <BellRing className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('التذكير التلقائي', 'Auto Reminder')}</h3>
                  <p className="text-sm text-muted-foreground">{t('إرسال تذكير تلقائي قبل الموعد', 'Send automatic reminder before appointment')}</p>
                </div>
              </div>
              <Switch
                checked={notificationSettings.auto_reminder_enabled}
                onCheckedChange={(checked) => setNotificationSettings({
                  ...notificationSettings,
                  auto_reminder_enabled: checked
                })}
              />
            </div>
            {notificationSettings.auto_reminder_enabled && (
              <div className="space-y-4 pt-2">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-amber-600" />
                      {t('إرسال التذكير قبل', 'Send reminder before')}
                    </Label>
                    <Select
                      value={String(notificationSettings.reminder_hours_before)}
                      onValueChange={(v) => setNotificationSettings({
                        ...notificationSettings,
                        reminder_hours_before: parseInt(v)
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t('ساعة واحدة', '1 hour')}</SelectItem>
                        <SelectItem value="2">{t('ساعتين', '2 hours')}</SelectItem>
                        <SelectItem value="6">{t('6 ساعات', '6 hours')}</SelectItem>
                        <SelectItem value="12">{t('12 ساعة', '12 hours')}</SelectItem>
                        <SelectItem value="24">{t('24 ساعة (يوم)', '24 hours (1 day)')}</SelectItem>
                        <SelectItem value="48">{t('48 ساعة (يومين)', '48 hours (2 days)')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      {t('طريقة الإرسال', 'Send via')}
                    </Label>
                    <Select
                      value={notificationSettings.reminder_channel}
                      onValueChange={(v) => setNotificationSettings({
                        ...notificationSettings,
                        reminder_channel: v
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">{t('SMS فقط', 'SMS only')}</SelectItem>
                        <SelectItem value="whatsapp">{t('واتساب فقط', 'WhatsApp only')}</SelectItem>
                        <SelectItem value="both">{t('SMS + واتساب', 'SMS + WhatsApp')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <Label>{t('تذكير ثانٍ قبل ساعتين', 'Second reminder 2h before')}</Label>
                  <Switch
                    checked={!!notificationSettings.reminder_2h_enabled}
                    onCheckedChange={(checked) => setNotificationSettings({
                      ...notificationSettings,
                      reminder_2h_enabled: checked
                    })}
                  />
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {t(
                        `سيتم إرسال تذكير تلقائي للمرضى قبل ${notificationSettings.reminder_hours_before} ساعة من موعدهم${notificationSettings.reminder_2h_enabled ? ' وتذكير ثانٍ قبل ساعتين' : ''}`,
                        `Automatic reminder will be sent ${notificationSettings.reminder_hours_before} hours before appointment${notificationSettings.reminder_2h_enabled ? ' and a second reminder 2 hours before' : ''}`
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Message Templates */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('قوالب الرسائل', 'Message Templates')}</h3>
                  <p className="text-sm text-muted-foreground">{t('تخصيص رسائل الإشعارات لعيادتك', 'Customize notification messages for your clinic')}</p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('المتغيرات المتاحة:', 'Available variables:')} {t('(رابط البوابة = {portal_link})', '(portal link = {portal_link})')}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['{patient_name}', '{clinic_name}', '{doctor_name}', '{date}', '{time}', '{confirmation_code}', '{portal_link}'].map((variable) => (
                      <Badge
                        key={variable}
                        variant="outline"
                        className="font-mono text-xs cursor-pointer hover:bg-blue-100"
                        onClick={() => {
                          navigator.clipboard.writeText(variable);
                          toast.success(t('تم نسخ المتغير', 'Variable copied'));
                        }}
                      >
                        {variable}
                        <Copy className="w-3 h-3 ms-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {t('رسالة تأكيد الحجز', 'Booking Confirmation')}
              </Label>
              <Textarea
                value={notificationSettings.templates?.booking_confirmation || ''}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  templates: { ...notificationSettings.templates, booking_confirmation: e.target.value }
                })}
                placeholder={t('مثال: مرحباً {patient_name}، تم تأكيد موعدك...', 'Example: Hello {patient_name}, your appointment is confirmed...')}
                rows={3}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                {t('رسالة التذكير', 'Reminder')}
              </Label>
              <Textarea
                value={notificationSettings.templates?.booking_reminder || ''}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  templates: { ...notificationSettings.templates, booking_reminder: e.target.value }
                })}
                placeholder={t('مثال: تذكير: لديك موعد غداً...', 'Example: Reminder: You have an appointment tomorrow...')}
                rows={3}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                {t('رسالة إلغاء الحجز', 'Booking Cancellation')}
              </Label>
              <Textarea
                value={notificationSettings.templates?.booking_cancelled || ''}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  templates: { ...notificationSettings.templates, booking_cancelled: e.target.value }
                })}
                placeholder={t('مثال: تم إلغاء موعدك...', 'Example: Your appointment has been cancelled...')}
                rows={3}
                dir="rtl"
              />
            </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600" />
                    {t('رسالة بعد الزيارة', 'After Visit')}
                  </Label>
                  <Textarea
                    value={notificationSettings.templates?.booking_completed || ''}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      templates: { ...notificationSettings.templates, booking_completed: e.target.value }
                    })}
                    placeholder={t('مثال: شكراً لزيارتك...', 'Example: Thank you for your visit...')}
                    rows={3}
                    dir="rtl"
                  />
                </div>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                {t('الذكاء الاصطناعي', 'AI')}
              </CardTitle>
              <CardDescription>
                {t('ربط مفتاح API لتحليل الأعراض والصور والدردشة والتقارير', 'Connect API key for symptoms, images, chat and reports')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('ربط مفتاح الذكاء الاصطناعي', 'AI API Key')}</h3>
                  <p className="text-sm text-muted-foreground">{t('اختر المزود وأدخل المفتاح لتحليل الأعراض والصور والدردشة والتقارير', 'Choose provider and enter key for symptoms, images, chat and reports')}</p>
                </div>
              </div>
              {notificationSettings.ai_connected && (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 me-1" />
                  {t('متصل', 'Connected')} ({notificationSettings.ai_provider === 'gemini' ? 'Gemini' : 'OpenAI'})
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('نوع المزود', 'Provider')}</Label>
              <Select value={aiProvider} onValueChange={(v) => { setAiProvider(v); setAiConnectError(null); }}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{aiProvider === 'gemini' ? t('مفتاح API (Gemini)', 'API Key (Gemini)') : t('مفتاح API (OpenAI)', 'API Key (OpenAI)')}</Label>
              <div className="relative">
                <Key className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={openaiApiKeyInput}
                  onChange={(e) => { setOpenaiApiKeyInput(e.target.value); setAiConnectError(null); }}
                  placeholder={aiProvider === 'gemini' ? 'AIza...' : 'sk-...'}
                  className="ps-9"
                />
              </div>
            </div>
            <Button
              onClick={handleConnectAI}
              disabled={aiConnectLoading || !openaiApiKeyInput.trim()}
              variant="outline"
              className="gap-2"
            >
              {aiConnectLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {t('ربط', 'Connect')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t('الحالة:', 'Status:')}{' '}
              {notificationSettings.ai_connected ? (
                <span className="text-green-600 font-medium">{t('متصل', 'Connected')}</span>
              ) : aiConnectError ? (
                <span className="text-red-600">{t('فشل الربط', 'Connection failed')}: {aiConnectError}</span>
              ) : (
                <span className="text-muted-foreground">{t('غير مضبوط', 'Not configured')}</span>
              )}
            </p>
          </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="print" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                {t('قوالب الطباعة والطابعات', 'Print Templates & Printers')}
              </CardTitle>
              <CardDescription>
                {t('شكل الفاتورة والروشتة والموافقات والطابعات', 'Invoice, prescription, consent layout and printers')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
          {/* Print templates: invoice, prescription, consent */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Printer className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold">{t('قوالب الطباعة', 'Print Templates')}</h3>
                <p className="text-sm text-muted-foreground">{t('تساوي شكل الفاتورة والروشتة والموافقات — لوجو ورأس وتذييل ولون', 'Customize invoice, prescription and consent look — logo, header, footer, color')}</p>
              </div>
            </div>

            {/* Invoice design: settings first, then preview */}
            <div className="border rounded-xl p-4 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-semibold text-base">{t('الفاتورة', 'Invoice')}</h3>
              <p className="text-sm text-muted-foreground">{t('الاسم، العنوان، البريد، الهاتف، الشعار، الشكل العام للفاتورة', 'Name, Address, Email, Phone, Logo, general invoice layout')}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* First: Settings form (clear, no overlay) */}
                <div className="space-y-4 order-1 bg-white dark:bg-transparent rounded-lg p-0">
                  <div className="space-y-2">
                    <Label>{t('رابط الشعار أو رفع صورة', 'Logo link or upload image')}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={notificationSettings.print_logo_url || ''}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_logo_url: e.target.value })}
                        placeholder="https://..."
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="invoice-logo-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !companyId) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const dataUrl = reader.result;
                            const base64 = typeof dataUrl === 'string' && dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                            companiesAPI.update(companyId, { logo_base64: base64 }).then(() => {
                              toast.success(t('تم حفظ اللوجو', 'Logo saved'));
                              fetchNotificationSettings();
                            }).catch(() => toast.error(t('فشل رفع اللوجو', 'Logo upload failed')));
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('invoice-logo-upload')?.click()}>
                        {t('رفع', 'Upload')}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('اسم الشركة (عربي)', 'Company Name (Arabic)')}</Label>
                      <Input
                        value={notificationSettings.print_invoice_name_ar ?? ''}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_invoice_name_ar: e.target.value })}
                        placeholder={language === 'ar' ? 'مثال: عيادة النور' : 'e.g. Al Noor Clinic'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('اسم الشركة (EN)', 'Company Name (EN)')}</Label>
                      <Input
                        value={notificationSettings.print_invoice_name_en ?? ''}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_invoice_name_en: e.target.value })}
                        placeholder="e.g. Al Noor Clinic"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('العنوان', 'Address')}</Label>
                    <Input
                      value={notificationSettings.print_invoice_address ?? ''}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, print_invoice_address: e.target.value })}
                      placeholder={t('عنوان العيادة', 'Clinic address')}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('الهاتف', 'Phone')}</Label>
                      <Input
                        value={notificationSettings.print_invoice_phone ?? ''}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_invoice_phone: e.target.value })}
                        placeholder="+966..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('البريد الإلكتروني', 'Email')}</Label>
                      <Input
                        value={notificationSettings.print_invoice_email ?? ''}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_invoice_email: e.target.value })}
                        placeholder="info@clinic.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('الرقم الضريبي', 'Tax Number')}</Label>
                    <Input
                      value={notificationSettings.print_invoice_tax_number ?? ''}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, print_invoice_tax_number: e.target.value })}
                      placeholder={t('اختياري', 'Optional')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('تذييل الفاتورة / ملاحظات', 'Invoice footer / Notes')}</Label>
                    <Textarea
                      value={notificationSettings.print_footer || ''}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, print_footer: e.target.value })}
                      placeholder={t('انسخ هنا أي نص إضافي يظهر أسفل الفاتورة', 'Paste any text to appear at bottom of invoice')}
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('اللون الرئيسي', 'Primary color')}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={notificationSettings.print_primary_color || '#0d9488'}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_primary_color: e.target.value })}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={notificationSettings.print_primary_color || '#0d9488'}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, print_primary_color: e.target.value })}
                        className="max-w-[120px] font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="print-show-logo"
                      checked={notificationSettings.print_show_logo !== false}
                      onCheckedChange={(v) => setNotificationSettings({ ...notificationSettings, print_show_logo: v })}
                    />
                    <Label htmlFor="print-show-logo" className="cursor-pointer">{t('إظهار الشعار', 'Show logo')}</Label>
                  </div>
                </div>
                {/* Second: A4 preview (smaller on screen) */}
                <div className="space-y-2 order-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{t('معاينة الفاتورة', 'Invoice preview')}</Label>
                    <span className="text-xs text-muted-foreground">A4</span>
                  </div>
                  <div
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 overflow-auto max-h-[520px]"
                    style={{ boxSizing: 'border-box' }}
                    dir="rtl"
                  >
                    {notificationSettings.print_show_logo !== false && (notificationSettings.print_logo_url || notificationSettings.logo_base64) && (
                      <div className="mb-4 flex justify-center">
                        {notificationSettings.print_logo_url ? (
                          <img src={notificationSettings.print_logo_url} alt="Logo" className="max-h-16 max-w-[180px] object-contain" />
                        ) : notificationSettings.logo_base64 ? (
                          <img src={notificationSettings.logo_base64.includes('base64') ? notificationSettings.logo_base64 : `data:image/png;base64,${notificationSettings.logo_base64}`} alt="Logo" className="max-h-16 max-w-[180px] object-contain" />
                        ) : null}
                      </div>
                    )}
                    <div className="border-b-2 mb-4 pb-3" style={{ borderColor: notificationSettings.print_primary_color || '#0d9488' }}>
                      <h2 className="text-lg font-semibold" style={{ color: notificationSettings.print_primary_color || '#0d9488' }}>
                        {notificationSettings.print_invoice_name_ar || notificationSettings.print_clinic_name || (language === 'ar' ? 'اسم العيادة' : 'Clinic Name')}
                      </h2>
                      {(notificationSettings.print_invoice_name_en || '').trim() && <p className="text-sm text-muted-foreground">{notificationSettings.print_invoice_name_en}</p>}
                      {(notificationSettings.print_invoice_address || '').trim() && <p className="text-xs mt-1">{notificationSettings.print_invoice_address}</p>}
                      {(notificationSettings.print_invoice_phone || '').trim() && <p className="text-xs">{notificationSettings.print_invoice_phone}</p>}
                      {(notificationSettings.print_invoice_email || '').trim() && <p className="text-xs">{notificationSettings.print_invoice_email}</p>}
                      {(notificationSettings.print_invoice_tax_number || '').trim() && <p className="text-xs">{t('الرقم الضريبي:', 'Tax No:')} {notificationSettings.print_invoice_tax_number}</p>}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><strong>{t('رقم الفاتورة', 'Invoice Number')}</strong>: INV-001</p>
                      <p>{t('التاريخ', 'Date')}: —</p>
                      <p>{t('تاريخ الاستحقاق', 'Due Date')}: —</p>
                      <p>{t('العميل / مفوتر إليه', 'Client / Billed To')}: —</p>
                    </div>
                    <table className="w-full border-collapse mt-4 text-sm">
                      <thead>
                        <tr style={{ background: notificationSettings.print_primary_color || '#0d9488', color: 'white' }}>
                          <th className="p-2 text-right">{t('البيان', 'Description')}</th>
                          <th className="p-2">{t('الكمية', 'Qty')}</th>
                          <th className="p-2">{t('السعر', 'Price')}</th>
                          <th className="p-2">{t('الإجمالي', 'Total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b"><td className="p-2">—</td><td className="p-2">—</td><td className="p-2">—</td><td className="p-2">—</td></tr>
                      </tbody>
                    </table>
                    <div className="mt-4 space-y-1 text-sm">
                      <p>{t('المجموع الفرعي', 'Subtotal')}: —</p>
                      <p>{t('الضريبة', 'Tax')}: —</p>
                      <p><strong>{t('الإجمالي', 'Total')}: —</strong></p>
                    </div>
                    {(notificationSettings.print_footer || '').trim() && (
                      <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
                        {notificationSettings.print_footer}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('اسم العيادة على الطباعة (للموافقات والروشتة)', 'Clinic name on print (consent/prescription)')}</Label>
              <Input
                value={notificationSettings.print_clinic_name || ''}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, print_clinic_name: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: عيادة النور' : 'e.g. Al Noor Clinic'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('عنوان يظهر فوق الفاتورة (فارغ = افتراضي)', 'Title above invoice (empty = default)')}</Label>
              <Input
                value={notificationSettings.print_header_invoice || ''}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, print_header_invoice: e.target.value })}
                placeholder={t('فاتورة', 'Invoice')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('عنوان يظهر فوق الروشتة (فارغ = افتراضي)', 'Title above prescription (empty = default)')}</Label>
              <Input
                value={notificationSettings.print_header_prescription || ''}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, print_header_prescription: e.target.value })}
                placeholder={t('روشيتة طبية', 'Medical Prescription')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('عنوان يظهر فوق الموافقات (فارغ = افتراضي)', 'Title above consent (empty = default)')}</Label>
              <Input
                value={notificationSettings.print_header_consent || ''}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, print_header_consent: e.target.value })}
                placeholder={t('نموذج موافقة', 'Consent Form')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('نص التذييل (يظهر أسفل كل ورقة طباعة)', 'Footer text (bottom of every print)')}</Label>
              <Input
                value={notificationSettings.print_footer || ''}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, print_footer: e.target.value })}
                placeholder={language === 'ar' ? 'شكراً لثقتكم — نظام طبّي' : 'Thank you — Medical System'}
              />
            </div>

            {/* Printers: list from Windows (when backend runs on Windows) + preferred printer */}
            <div className="p-4 border rounded-lg space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Printer className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('الطابعات', 'Printers')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('طابعات ويندوز المعروضة من السيرفر. عند الطباعة اختر الطابعة من نافذة ويندوز.', 'Windows printers from server. When printing, choose the printer from the Windows dialog.')}
                  </p>
                </div>
              </div>
              {loadingPrinters ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('جاري جلب الطابعات...', 'Loading printers...')}
                </p>
              ) : printersList.length > 0 ? (
                <div className="space-y-2">
                  <Label>{t('الطابعة المفضلة (للعرض فقط — الاختيار الفعلي من نافذة الطباعة)', 'Preferred printer (display only — choose in print dialog)')}</Label>
                  <Select
                    value={notificationSettings.print_default_printer || '__none__'}
                    onValueChange={(v) => setNotificationSettings({ ...notificationSettings, print_default_printer: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder={t('اختر طابعة', 'Select printer')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('بدون تفضيل', 'No preference')}</SelectItem>
                      {printersList.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('قائمة الطابعات المتاحة على جهاز السيرفر (ويندوز):', 'Available printers on server (Windows):')}
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    {printersList.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('لم يتم العثور على طابعات. إن كان السيرفر يعمل على ويندوز ستظهر الطابعات هنا. الطباعة تتم من نافذة المتصفح — اختر الطابعة من قائمة ويندوز.', 'No printers found. If the server runs on Windows they will appear here. Printing uses the browser dialog — choose the printer from Windows.')}
                </p>
              )}
            </div>
          </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('الأمان', 'Security')}
              </CardTitle>
              <CardDescription>
                {t('تفعيل المصادقة الثنائية (2FA) لمستخدمي العيادة', 'Enable two-factor authentication (2FA) for clinic users')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{t('المصادقة الثنائية للعيادة', 'Two-Factor Auth for Clinic')}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {mfaAllowed
                        ? t('عند التفعيل، سيُطلب من المستخدمين إعداد أو إدخال رمز المصادقة عند تسجيل الدخول.', 'When enabled, users will be required to set up or enter 2FA code on login.')
                        : t('يجب على مدير النظام تفعيل المصادقة الثنائية من إعدادات السوبر أدمن أولاً.', 'System admin must enable 2FA in Super Admin settings first.')}
                    </p>
                  </div>
                  {mfaSecurityLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={mfaRequired}
                      disabled={!mfaAllowed || mfaSecuritySaving}
                      onCheckedChange={async (checked) => {
                        setMfaSecuritySaving(true);
                        try {
                          await companiesAPI.update(companyId, { mfa_required: checked });
                          setMfaRequired(checked);
                          toast.success(t('تم حفظ الإعداد', 'Settings saved'));
                        } catch {
                          toast.error(t('فشل الحفظ', 'Failed to save'));
                        } finally {
                          setMfaSecuritySaving(false);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          onClick={handleSaveNotificationSettings}
          disabled={savingSettings}
          className="gap-2 bg-teal-600 hover:bg-teal-700"
        >
          {savingSettings ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {t('حفظ الإعدادات', 'Save Settings')}
        </Button>
      </div>
    </div>
  );
};

export default CompanySettingsPage;

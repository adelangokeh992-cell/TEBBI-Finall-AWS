import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { marketingAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Megaphone, Send } from 'lucide-react';

export default function MarketingPage() {
  const { t, language } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const fetch = () => {
    setLoading(true);
    marketingAPI.listCampaigns().then((r) => setCampaigns(r.data || [])).catch(() => toast.error(t('فشل', 'Failed'))).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleSend = () => {
    if (!name.trim() || !message.trim()) { toast.error(t('الاسم والرسالة مطلوبان', 'Name and message required')); return; }
    setSending(true);
    marketingAPI.createCampaign({ name, message, channel: 'sms', segment: 'all' })
      .then((r) => { toast.success(t('تم الإرسال إلى', 'Sent to') + ' ' + (r.data?.sent_count ?? 0) + ' ' + t('مريض', 'patients')); setName(''); setMessage(''); fetch(); })
      .catch((e) => toast.error(e?.response?.data?.detail || t('فشل. تأكد من إعداد Twilio في الإشعارات.', 'Failed. Ensure Twilio is set in Notifications.')))
      .finally(() => setSending(false));
  };

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('التسويق والحملات', 'Marketing & Campaigns')}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" /> {t('حملة SMS جديدة', 'New SMS campaign')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('يُرسل إلى كل المرضى الذين لديهم رقم هاتف. يجب إعداد Twilio في الإعدادات.', 'Sends to all patients with a phone number. Configure Twilio in Settings.')}</p>
          <Input placeholder={t('اسم الحملة', 'Campaign name')} value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="w-full min-h-[120px] rounded-md border px-3 py-2" placeholder={t('نص الرسالة (SMS)', 'Message text (SMS)')} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button onClick={handleSend} disabled={sending} className="gap-2"><Send className="w-4 h-4" /> {sending ? t('جاري الإرسال...', 'Sending...') : t('إرسال للجميع', 'Send to all')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('الحملات السابقة', 'Past campaigns')}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div> : (
            campaigns.length === 0 ? <p className="text-muted-foreground">{t('لا حملات سابقة', 'No past campaigns')}</p> : (
              <ul className="space-y-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex justify-between text-sm border-b pb-2">
                    <span>{c.name} — {c.sent_count} {t('مريض', 'patients')}</span>
                    <span className="text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</span>
                  </li>
                ))}
              </ul>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

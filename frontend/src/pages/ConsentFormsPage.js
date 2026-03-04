import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { consentAPI, companiesAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileSignature, Plus, Printer } from 'lucide-react';
import { buildConsentHtml, printHtml } from '../utils/printTemplate';

export default function ConsentFormsPage() {
  const { t, language, user } = useAuth();
  const companyId = user?.company_id;

  const printForm = async (form) => {
    try {
      const printSettings = companyId ? (await companiesAPI.getPrintSettings(companyId)).data : {};
      printHtml(buildConsentHtml(printSettings, form, { language, t }));
    } catch (e) {
      printHtml(buildConsentHtml({}, form, { language, t }));
    }
  };
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [bodyEn, setBodyEn] = useState('');

  const fetch = () => {
    setLoading(true);
    consentAPI.listForms().then((r) => setForms(r.data || [])).catch(() => toast.error(t('فشل', 'Failed'))).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = () => {
    if (!titleAr.trim()) { toast.error(t('العنوان بالعربي مطلوب', 'Arabic title required')); return; }
    if (!bodyAr.trim()) { toast.error(t('النص بالعربي مطلوب', 'Arabic body required')); return; }
    consentAPI.createForm({ title_ar: titleAr, title_en: titleEn || undefined, body_ar: bodyAr, body_en: bodyEn || undefined })
      .then(() => { toast.success(t('تم إنشاء النموذج', 'Form created')); setShowAdd(false); setTitleAr(''); setTitleEn(''); setBodyAr(''); setBodyEn(''); fetch(); })
      .catch(() => toast.error(t('فشل', 'Failed')));
  };

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('نماذج الموافقة والتوقيع', 'Consent Forms')}</h1>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-2"><Plus className="w-4 h-4" /> {t('نموذج جديد', 'New form')}</Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('إضافة نموذج موافقة', 'Add consent form')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder={t('العنوان (عربي)', 'Title (Arabic)')} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
            <Input placeholder={t('العنوان (إنجليزي)', 'Title (English)')} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
            <textarea className="w-full min-h-[100px] rounded-md border px-3 py-2" placeholder={t('نص الموافقة (عربي)', 'Body (Arabic)')} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} />
            <textarea className="w-full min-h-[80px] rounded-md border px-3 py-2" placeholder={t('نص الموافقة (إنجليزي)', 'Body (English)')} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handleCreate}>{t('حفظ', 'Save')}</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>{t('إلغاء', 'Cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">{t('من ملف المريض يمكن طلب توقيع المريض على نموذج معين عبر POST /consent-forms/:id/sign', 'From patient detail you can request patient signature via API.')}</p>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div> : (
        <div className="grid gap-3">
          {forms.length === 0 && <Card><CardContent className="pt-6">{t('لا نماذج. أضف نموذجاً أعلاه.', 'No forms. Add one above.')}</CardContent></Card>}
          {forms.map((f) => (
            <Card key={f.id}>
              <CardContent className="pt-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{language === 'ar' ? (f.title_ar || f.title_en) : (f.title_en || f.title_ar)}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{language === 'ar' ? (f.body_ar || f.body_en) : (f.body_en || f.body_ar)}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => printForm(f)}>
                  <Printer className="w-4 h-4" />{t('طباعة', 'Print')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

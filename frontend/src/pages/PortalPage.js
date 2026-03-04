import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { portalAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Calendar, Receipt, MessageCircle, User, LogOut, Send, FileText, Eye, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function PortalPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [portalToken, setPortalToken] = useState(() => sessionStorage.getItem('portal_token'));
  const [patientName, setPatientName] = useState(() => sessionStorage.getItem('portal_patient_name') || '');
  const [loading, setLoading] = useState(!!tokenFromUrl && !portalToken);
  const [error, setError] = useState(null);

  const [me, setMe] = useState(null);
  const [visits, setVisits] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);

  useEffect(() => {
    if (tokenFromUrl && !portalToken) {
      setLoading(true);
      setError(null);
      portalAPI()
        .login(tokenFromUrl)
        .then((res) => {
          const { access_token, patient_name } = res.data;
          setPortalToken(access_token);
          setPatientName(patient_name || '');
          sessionStorage.setItem('portal_token', access_token);
          sessionStorage.setItem('portal_patient_name', patient_name || '');
          window.history.replaceState({}, '', '/portal');
        })
        .catch((err) => {
          setError(err?.response?.data?.detail || 'رابط غير صالح أو منتهي');
          toast.error(err?.response?.data?.detail || 'رابط غير صالح أو منتهي');
        })
        .finally(() => setLoading(false));
    }
  }, [tokenFromUrl, portalToken]);

  useEffect(() => {
    if (!portalToken) return;
    const api = portalAPI(portalToken);
    setDataLoading(true);
    Promise.all([
      api.getMe().then((r) => r.data).catch(() => null),
      api.getVisits().then((r) => r.data?.visits || []).catch(() => []),
      api.getInvoices().then((r) => r.data?.invoices || []).catch(() => []),
      api.getMessages().then((r) => r.data?.messages || []).catch(() => []),
      api.getDocuments().then((r) => r.data?.documents || []).catch(() => []),
    ])
      .then(([meData, v, inv, msg, docs]) => {
        setMe(meData);
        setVisits(v);
        setInvoices(inv);
        setMessages(msg);
        setDocuments(docs);
      })
      .finally(() => setDataLoading(false));
  }, [portalToken]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    portalAPI(portalToken).sendMessage(messageText.trim()).then(() => {
      setMessageText('');
      return portalAPI(portalToken).getMessages();
    }).then((r) => setMessages(r.data?.messages || [])).then(() => toast.success('تم الإرسال'));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_token');
    sessionStorage.removeItem('portal_patient_name');
    setPortalToken(null);
    setPatientName('');
    setMe(null);
    setVisits([]);
    setInvoices([]);
    setMessages([]);
    setDocuments([]);
  };

  const printDocument = (doc) => {
    if (!doc) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${doc.title || 'مستند'}</title></head><body style="font-family: Arial; padding: 20px;">${doc.content || ''}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!portalToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>بوابة المريض</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            <p className="text-slate-600 dark:text-slate-400">
              للدخول استخدم الرابط الذي أرسلته لك العيادة (يحتوي على رمز خاص). إن لم يكن لديك رابط، اطلبه من العيادة.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" dir="rtl">
      <header className="bg-white dark:bg-slate-900 border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold">بوابة المريض</h1>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400">{patientName}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {dataLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
          </div>
        ) : (
          <Tabs defaultValue="visits" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="visits" className="gap-1">
                <Calendar className="w-4 h-4" /> الزيارات
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1">
                <Receipt className="w-4 h-4" /> الفواتير
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1">
                <FileText className="w-4 h-4" /> مستنداتي
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1">
                <MessageCircle className="w-4 h-4" /> الرسائل
              </TabsTrigger>
              <TabsTrigger value="me" className="gap-1">
                <User className="w-4 h-4" /> بياناتي
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visits" className="space-y-3">
              {visits.length === 0 ? (
                <Card><CardContent className="pt-6">لا توجد زيارات مسجلة.</CardContent></Card>
              ) : (
                visits.map((v) => (
                  <Card key={v.created_at + (v.reason || '')}>
                    <CardContent className="pt-4">
                      <p className="text-sm text-slate-500">{String(v.created_at).slice(0, 10)}</p>
                      <p><strong>السبب:</strong> {v.reason || '-'}</p>
                      <p><strong>التشخيص:</strong> {v.diagnosis || '-'}</p>
                      {v.prescription?.length > 0 && (
                        <p className="text-sm mt-2"><strong>الوصفة:</strong> {v.prescription.map((p) => p.medication_name).join('، ')}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-3">
              {documents.length === 0 ? (
                <Card><CardContent className="pt-6">لا توجد مستندات (تقارير أو روشيتات) محفوظة لعرضها.</CardContent></Card>
              ) : (
                documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{doc.title || (doc.type === 'prescription' ? 'روشيتة' : 'تقرير')}</p>
                        <p className="text-sm text-slate-500">{doc.created_at ? String(doc.created_at).slice(0, 10) : ''}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setViewDoc(doc)}>
                          <Eye className="w-4 h-4" /> عرض
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => printDocument(doc)}>
                          <Printer className="w-4 h-4" /> طباعة
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="invoices" className="space-y-3">
              {invoices.length === 0 ? (
                <Card><CardContent className="pt-6">لا توجد فواتير.</CardContent></Card>
              ) : (
                invoices.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="pt-4 flex justify-between items-center">
                      <div>
                        <p className="text-sm text-slate-500">{String(inv.created_at).slice(0, 10)}</p>
                        <p>المبلغ: {inv.total} | المدفوع: {inv.paid_amount || 0}</p>
                      </div>
                      <span className={inv.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}>
                        {inv.payment_status === 'paid' ? 'مدفوع' : inv.payment_status === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع'}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <Card><CardContent className="pt-6">لا توجد رسائل.</CardContent></Card>
                ) : (
                  messages.map((m) => (
                    <Card key={m.id} className={m.direction === 'clinic_to_patient' ? 'bg-teal-50 dark:bg-teal-950/30' : ''}>
                      <CardContent className="pt-4">
                        <p className="text-xs text-slate-500">{m.direction === 'clinic_to_patient' ? 'من العيادة' : 'منك'} — {String(m.created_at).slice(0, 16)}</p>
                        <p>{m.body}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="اكتب رسالتك للعيادة..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage}><Send className="w-4 h-4" /></Button>
              </div>
            </TabsContent>

            <TabsContent value="me" className="space-y-2">
              <Card>
                <CardContent className="pt-4">
                  {me && (
                    <>
                      <p><strong>الاسم:</strong> {me.name_ar || me.name}</p>
                      <p><strong>تاريخ الميلاد:</strong> {me.date_of_birth || '-'}</p>
                      <p><strong>الجنس:</strong> {me.gender === 'male' ? 'ذكر' : me.gender === 'female' ? 'أنثى' : '-'}</p>
                      <p><strong>فصيلة الدم:</strong> {me.blood_type || '-'}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={!!viewDoc} onOpenChange={(open) => !open && setViewDoc(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewDoc?.title || 'مستند'}</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 rounded border bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-800 dark:text-slate-100 [&_*]:text-slate-800 dark:[&_*]:text-slate-100" dir="rtl" dangerouslySetInnerHTML={viewDoc ? { __html: viewDoc.content || '' } : { __html: '' }} />
            {viewDoc && (
              <Button className="w-full gap-2 mt-2" onClick={() => printDocument(viewDoc)}><Printer className="w-4 h-4" /> طباعة</Button>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

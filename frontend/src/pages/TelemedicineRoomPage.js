import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { telemedicineAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, PhoneOff, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function TelemedicineRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    telemedicineAPI.getSession(roomId).then((r) => setSession(r.data)).catch(() => toast.error('Session not found')).finally(() => setLoading(false));
  }, [roomId]);

  const handleStart = () => {
    telemedicineAPI.startSession(roomId).then(() => setSession((s) => ({ ...s, status: 'live' }))).catch(() => toast.error('Failed'));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('تم نسخ الرابط');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" /></div>;
  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Session not found</p></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Video className="w-6 h-6" /> استشارة فيديو</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}><PhoneOff className="w-4 h-4" /> خروج</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300">رقم الغرفة: <code className="bg-slate-700 px-2 py-1 rounded">{session.room_id}</code></p>
            <Button onClick={copyLink} variant="secondary" className="gap-2"><Copy className="w-4 h-4" /> نسخ رابط الاستشارة</Button>
            {session.status === 'scheduled' && (
              <Button onClick={handleStart} className="gap-2 bg-green-600 hover:bg-green-700"><Video className="w-4 h-4" /> بدء الاستشارة</Button>
            )}
            {session.status === 'live' && (
              <div className="rounded-lg bg-slate-700 p-8 text-center">
                <p className="text-slate-300 mb-4">لإجراء مكالمة الفيديو استخدم تطبيقاً خارجياً (مثل Zoom أو Google Meet) وشارك هذا الرابط مع المريض، أو قم بتكامل لاحقاً مع خدمة فيديو.</p>
                <p className="text-sm text-slate-400">بعد الانتهاء استخدم زر "إنهاء الاستشارة" من صفحة المواعيد أو ملف المريض لإضافة الوصفة والدفع.</p>
              </div>
            )}
            {session.status === 'ended' && <p className="text-green-400">انتهت الاستشارة.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auditAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScrollText } from 'lucide-react';

export default function AuditLogsPage() {
  const { t, language } = useAuth();
  const [data, setData] = useState({ logs: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetch = () => {
    setLoading(true);
    auditAPI.getLogs({ page, limit: 50 }).then((r) => setData(r.data)).catch(() => toast.error(t('فشل', 'Failed'))).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page]);

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="w-6 h-6" /> {t('سجلات التدقيق', 'Audit logs')}</h1>
      <p className="text-sm text-muted-foreground">{t('سجل الإجراءات (تسجيل دخول، إنشاء/تعديل سجلات، إلخ).', 'Log of actions (login, create/update records, etc.).')}</p>

      <Card>
        <CardContent className="pt-6">
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{t('الوقت', 'Time')}</th>
                      <th className="text-left p-2">{t('الإجراء', 'Action')}</th>
                      <th className="text-left p-2">{t('النوع', 'Resource')}</th>
                      <th className="text-left p-2">{t('المستخدم', 'User')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs?.map((log) => (
                      <tr key={log.timestamp + (log.resource_id || '')} className="border-b">
                        <td className="p-2">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                        <td className="p-2">{log.action}</td>
                        <td className="p-2">{log.resource_type || '-'}</td>
                        <td className="p-2">{log.user_id || (log.user && (log.user.name_ar || log.user.name)) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.pages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('السابق', 'Prev')}</Button>
                  <span className="py-2 px-2">{page} / {data.pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>{t('التالي', 'Next')}</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

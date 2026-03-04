import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Database, Download, Upload, Clock, CheckCircle, AlertTriangle, HardDrive, FileArchive, Sparkles } from 'lucide-react';

const BackupPage = () => {
  const { t } = useAuth();
  const [loading, setLoading] = useState(false);

  const backups = [
    { id: 1, date: '2026-03-02 10:30', size: '15.2 MB', status: 'success', type: 'auto' },
    { id: 2, date: '2026-03-01 10:30', size: '14.8 MB', status: 'success', type: 'auto' },
    { id: 3, date: '2026-02-28 10:30', size: '14.5 MB', status: 'success', type: 'manual' },
  ];

  const handleBackup = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success(t('تم إنشاء النسخة الاحتياطية', 'Backup created'));
    } catch (error) {
      toast.error(t('فشل في إنشاء النسخة', 'Backup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="backup-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('النسخ الاحتياطي', 'Backup & Restore')}</h1>
        <p className="text-slate-500 mt-1">{t('إدارة النسخ الاحتياطية للنظام', 'Manage system backups')}</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#12121a] border border-cyan-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
            <Database className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-cyan-400">15.2 MB</p>
          <p className="text-sm text-slate-500 mt-1">{t('حجم قاعدة البيانات', 'Database Size')}</p>
        </div>
        <div className="rounded-2xl bg-[#12121a] border border-violet-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
            <FileArchive className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-violet-400">3</p>
          <p className="text-sm text-slate-500 mt-1">{t('نسخ احتياطية', 'Backups')}</p>
        </div>
        <div className="rounded-2xl bg-[#12121a] border border-emerald-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{t('اليوم', 'Today')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('آخر نسخة', 'Last Backup')}</p>
        </div>
      </div>

      {/* Create Backup */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-600/10 via-purple-600/5 to-violet-600/10 border border-violet-500/20 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('إنشاء نسخة احتياطية', 'Create Backup')}</h2>
            <p className="text-slate-400 text-sm mt-1">{t('إنشاء نسخة احتياطية يدوية الآن', 'Create a manual backup now')}</p>
          </div>
          <Button 
            onClick={handleBackup} 
            disabled={loading} 
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
          >
            {loading ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {loading ? t('جاري الإنشاء...', 'Creating...') : t('نسخ احتياطي', 'Backup Now')}
          </Button>
        </div>
      </div>

      {/* Backup History */}
      <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{t('سجل النسخ الاحتياطية', 'Backup History')}</h2>
        </div>
        <div className="divide-y divide-white/5">
          {backups.map(backup => (
            <div key={backup.id} className="flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${backup.status === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  {backup.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">{backup.date}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <HardDrive className="w-3 h-3" />{backup.size}
                    </span>
                    <Badge className={`text-xs ${backup.type === 'auto' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-violet-500/10 text-violet-400 border-violet-500/20'} border`}>
                      {backup.type === 'auto' ? t('تلقائي', 'Auto') : t('يدوي', 'Manual')}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/10">
                  <Download className="w-4 h-4 me-1" />{t('تحميل', 'Download')}
                </Button>
                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/10">
                  <Upload className="w-4 h-4 me-1" />{t('استعادة', 'Restore')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BackupPage;

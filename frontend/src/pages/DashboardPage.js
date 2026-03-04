import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, seedAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, FileText, Plus, UserPlus, CalendarPlus, Brain, TrendingUp, Clock, DollarSign, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader, PageEmptyState, StatCard as CommonStatCard, LoadingSpinner } from '../components/common';

function QuickActionButton({ icon: Icon, label, color, onClick }) {
  return (
    <Button className={'w-full justify-start gap-3 text-white ' + color} onClick={onClick}>
      <Icon className="w-5 h-5" />{label}
    </Button>
  );
}

function AppointmentItem({ appt, language, t }) {
  const patientName = language === 'ar' ? (appt.patient_name_ar || appt.patient_name) : appt.patient_name;
  const reason = language === 'ar' ? (appt.reason_ar || appt.reason) : appt.reason;
  const statusText = appt.status === 'scheduled' ? t('مجدول', 'Scheduled') : appt.status === 'completed' ? t('مكتمل', 'Completed') : t('ملغي', 'Cancelled');
  
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
          <Users className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <p className="font-medium">{patientName}</p>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </div>
      </div>
      <div className="text-end">
        <p className="font-medium text-teal-600">{appt.time}</p>
        <Badge variant={appt.status === 'scheduled' ? 'default' : 'secondary'}>{statusText}</Badge>
      </div>
    </div>
  );
}

function PatientCard({ patient, language, onClick }) {
  const pName = language === 'ar' ? (patient.name_ar || patient.name) : patient.name;
  const initial = pName ? pName[0].toUpperCase() : 'P';
  
  return (
    <div className="p-4 border rounded-lg hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-medium">{initial}</div>
        <div>
          <p className="font-medium">{pName}</p>
          <p className="text-sm text-muted-foreground">{patient.phone}</p>
        </div>
      </div>
    </div>
  );
}

const DashboardPage = () => {
  const { t, language, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [demoSeeding, setDemoSeeding] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedAPI.seed();
      await fetchStats();
      toast.success(t('تم إعداد البيانات التجريبية', 'Demo data set up'));
    } catch (error) {
      console.error('Seed failed:', error);
      toast.error(t('فشل الإعداد', 'Setup failed'));
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedDemoPatients = async () => {
    setDemoSeeding(true);
    try {
      const res = await seedAPI.seedDemoPatients(100);
      await fetchStats();
      const count = res.data?.count ?? 100;
      const appCount = res.data?.appointments_count;
      const msg = appCount != null
        ? t('تم إضافة ' + count + ' مريض و ' + appCount + ' موعد', count + ' patients and ' + appCount + ' appointments added')
        : t('تم إضافة ' + count + ' مريض تجريبي', count + ' demo patients added');
      toast.success(msg);
    } catch (error) {
      console.error('Seed demo patients failed:', error);
      const status = error.response?.status;
      const data = error.response?.data;
      const detail = data?.detail;
      let msg = t('فشل تحميل المرضى', 'Failed to load patients');
      if (status === 404) {
        const url = error.config?.url || '';
        msg = (url ? url + ' — ' : '') + t('الرابط غير موجود (404)', 'Not Found (404)');
      } else if (status === 401) {
        msg = t('انتهت الجلسة. سجّل الدخول من جديد.', 'Session expired. Please log in again.');
      } else if (detail) {
        msg = Array.isArray(detail) ? (detail[0]?.msg || detail[0] || String(detail)) : String(detail);
      }
      toast.error(msg);
    } finally {
      setDemoSeeding(false);
    }
  };

  if (loading) {
    return <LoadingSpinner className="min-h-[50vh]" />;
  }

  const userName = user ? (language === 'ar' ? (user.name_ar || user.name) : user.name) : '';
  const totalPatients = stats ? stats.total_patients : 0;
  const todayAppointments = stats ? stats.today_appointments : 0;
  const pendingInvoices = stats ? stats.pending_invoices : 0;
  const totalAppointments = stats ? stats.total_appointments : 0;
  const recentPatients = stats && stats.recent_patients ? stats.recent_patients : [];
  const todayAppointmentsList = stats && stats.today_appointments_list ? stats.today_appointments_list : [];
  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="dashboard" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('مرحباً', 'Welcome') + ', ' + userName + '!'}
        description={t('هذه نظرة عامة على عيادتك اليوم', "Here's an overview of your clinic today")}
        actions={
          <>
            <Button variant="outline" onClick={handleSeed} disabled={seeding} className="gap-2" data-testid="seed-button">
              <Plus className="w-4 h-4" />
              {seeding ? t('جاري الإعداد...', 'Setting up...') : t('إعداد بيانات تجريبية', 'Seed Demo Data')}
            </Button>
            <Button variant="outline" onClick={handleSeedDemoPatients} disabled={demoSeeding} className="gap-2" data-testid="seed-demo-patients-button">
              <Download className="w-4 h-4" />
              {demoSeeding ? t('جاري التحميل...', 'Loading...') : t('تحميل 100 مريض تجريبي', 'Load 100 Demo Patients')}
            </Button>
          </>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CommonStatCard title={t('إجمالي المرضى', 'Total Patients')} value={totalPatients} icon={Users} color="teal" />
        <CommonStatCard title={t('مواعيد اليوم', "Today's Appointments")} value={todayAppointments} icon={Calendar} color="amber" />
        <CommonStatCard title={t('فواتير معلقة', 'Pending Invoices')} value={pendingInvoices} icon={FileText} color="rose" />
        <CommonStatCard title={t('إجمالي المواعيد', 'Total Appointments')} value={totalAppointments} icon={TrendingUp} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-xl border-2">
          <CardHeader>
            <CardTitle>{t('إجراءات سريعة', 'Quick Actions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionButton icon={UserPlus} label={t('مريض جديد', 'New Patient')} color="bg-teal-600 hover:bg-teal-700" onClick={function() { navigate('/patients?new=true'); }} />
            <QuickActionButton icon={CalendarPlus} label={t('موعد جديد', 'New Appointment')} color="bg-amber-600 hover:bg-amber-700" onClick={function() { navigate('/appointments?new=true'); }} />
            <QuickActionButton icon={Brain} label={t('مساعد AI', 'AI Assistant')} color="bg-blue-600 hover:bg-blue-700" onClick={function() { navigate('/ai'); }} />
            <QuickActionButton icon={DollarSign} label={t('فاتورة جديدة', 'New Invoice')} color="bg-emerald-600 hover:bg-emerald-700" onClick={function() { navigate('/billing?new=true'); }} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              {t('مواعيد اليوم', "Today's Appointments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointmentsList.length > 0 ? (
              <div className="space-y-3">
                {todayAppointmentsList.slice(0, 5).map(function(appt, index) {
                  return <AppointmentItem key={index} appt={appt} language={language} t={t} />;
                })}
              </div>
            ) : (
              <PageEmptyState
                icon={Calendar}
                message={t('لا توجد مواعيد اليوم', 'No appointments today')}
                dir={isRtl ? 'rtl' : 'ltr'}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            {t('أحدث المرضى', 'Recent Patients')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPatients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentPatients.map(function(patient, index) {
                return <PatientCard key={index} patient={patient} language={language} onClick={function() { navigate('/patients/' + patient.id); }} />;
              })}
            </div>
          ) : (
            <PageEmptyState
              icon={Users}
              message={t('لا يوجد مرضى بعد', 'No patients yet')}
              actionLabel={t('إضافة مريض جديد', 'Add new patient')}
              onAction={function() { navigate('/patients?new=true'); }}
              dir={isRtl ? 'rtl' : 'ltr'}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;

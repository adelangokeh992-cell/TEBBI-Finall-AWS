import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { companiesAPI, onlineBookingsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Building2, Calendar, Clock, CheckCircle, XCircle, Phone,
  DollarSign, UserPlus, CalendarCheck, RefreshCw, Eye, X, Filter,
  FileText, Search, BarChart3
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { PageHeader, LoadingSpinner } from '../components/common';

const CompanyAdminDashboard = () => {
  const { user, t, language } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [reportSeries, setReportSeries] = useState([]);
  const [reportPeriod, setReportPeriod] = useState('month');

  const companyId = user?.company_id;

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);

  const fetchData = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bookingsRes, statsRes] = await Promise.all([
        companiesAPI.getOnlineBookings(companyId),
        companiesAPI.getDashboardStats(companyId).catch(() => ({ data: null })),
      ]);

      const bookingsList = bookingsRes.data.bookings || bookingsRes.data || [];
      setBookings(Array.isArray(bookingsList) ? bookingsList : []);
      setDashboardStats(statsRes.data || null);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    if (!companyId) return;
    try {
      const res = await companiesAPI.getReports(companyId, { period: reportPeriod });
      setReportSeries(res.data.series || []);
    } catch (_) {
      setReportSeries([]);
    }
  };

  useEffect(() => {
    if (companyId && reportPeriod) fetchReports();
  }, [companyId, reportPeriod]);

  const handleConfirmBooking = async (bookingId) => {
    try {
      await onlineBookingsAPI.confirm(bookingId);
      toast.success(t('تم تأكيد الحجز', 'Booking confirmed'));
      fetchData();
    } catch (error) {
      toast.error(t('فشل في تأكيد الحجز', 'Failed to confirm booking'));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t('هل أنت متأكد من إلغاء هذا الحجز؟', 'Are you sure you want to cancel this booking?'))) return;
    try {
      await onlineBookingsAPI.cancel(bookingId);
      toast.success(t('تم إلغاء الحجز', 'Booking cancelled'));
      fetchData();
    } catch (error) {
      toast.error(t('فشل في إلغاء الحجز', 'Failed to cancel booking'));
    }
  };

  const handleCompleteBooking = async (bookingId) => {
    try {
      await onlineBookingsAPI.complete(bookingId);
      toast.success(t('تم إتمام الزيارة', 'Visit completed'));
      fetchData();
    } catch (error) {
      toast.error(t('فشل في إتمام الزيارة', 'Failed to complete visit'));
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
    const matchesDate = !filterDate || booking.date === filterDate;
    const matchesSearch = 
      booking.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.patient_phone?.includes(searchTerm) ||
      booking.confirmation_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesDate && matchesSearch;
  });

  const pendingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'scheduled').length;
  const todayBookings = bookings.filter(b => b.date === new Date().toISOString().split('T')[0]).length;

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    scheduled: 'bg-amber-100 text-amber-700 border-amber-200',
    confirmed: 'bg-green-100 text-green-700 border-green-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    no_show: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const statusLabels = {
    pending: t('بانتظار التأكيد', 'Pending'),
    scheduled: t('بانتظار التأكيد', 'Scheduled'),
    confirmed: t('مؤكد', 'Confirmed'),
    completed: t('مكتمل', 'Completed'),
    cancelled: t('ملغي', 'Cancelled'),
    no_show: t('لم يحضر', 'No Show')
  };

  if (loading) {
    return <LoadingSpinner className="min-h-[50vh]" />;
  }

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="company-admin-dashboard" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('إدارة الحجوزات الأونلاين', 'Online Bookings')}
        description={t('عرض وإدارة حجوزات المرضى عبر الإنترنت', 'View and manage online patient bookings')}
        icon={Building2}
        actions={
          <Button onClick={fetchData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('تحديث', 'Refresh')}
          </Button>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      {/* Stats Cards - use API stats when available */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">{t('حجوزات أونلاين اليوم', 'Online bookings today')}</p>
                <p className="text-3xl font-bold">{dashboardStats?.today_online_bookings ?? todayBookings}</p>
              </div>
              <CalendarCheck className="w-10 h-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-2 bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm">{t('المرضى', 'Patients')}</p>
                <p className="text-3xl font-bold">{dashboardStats?.total_patients ?? '-'}</p>
              </div>
              <UserPlus className="w-10 h-10 text-teal-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-2 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">{t('الإيرادات', 'Revenue')}</p>
                <p className="text-3xl font-bold">{dashboardStats?.revenue != null ? `${dashboardStats.revenue}` : '-'}</p>
              </div>
              <DollarSign className="w-10 h-10 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-2 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">{t('مواعيد اليوم', 'Appointments today')}</p>
                <p className="text-3xl font-bold">{dashboardStats?.today_appointments ?? todayBookings}</p>
              </div>
              <Calendar className="w-10 h-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('نظرة عامة', 'Overview')}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            <CalendarCheck className="w-4 h-4" />
            {t('الحجوزات', 'Bookings')}
            {pendingBookings > 0 && (
              <Badge className="bg-amber-500 text-white ms-1">{pendingBookings}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card className="rounded-xl border-2">
            <CardHeader>
              <CardTitle>{t('التقارير', 'Reports')}</CardTitle>
              <CardDescription>{t('حجوزات وإيرادات حسب الفترة', 'Bookings and revenue by period')}</CardDescription>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Button variant={reportPeriod === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setReportPeriod('week')}>
                  {t('أسبوع', 'Week')}
                </Button>
                <Button variant={reportPeriod === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setReportPeriod('month')}>
                  {t('شهر', 'Month')}
                </Button>
                {reportSeries.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                      const data = reportSeries.slice(-14).reverse().map(r => ({ [t('التاريخ', 'Date')]: r.date, [t('الحجوزات', 'Bookings')]: r.bookings ?? 0, [t('الإيرادات', 'Revenue')]: r.revenue ?? 0 }));
                      const ws = XLSX.utils.json_to_sheet(data);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, t('التقارير', 'Reports'));
                      XLSX.writeFile(wb, `reports-${reportPeriod}-${new Date().toISOString().slice(0, 10)}.xlsx`);
                      toast.success(t('تم تصدير Excel', 'Excel exported'));
                    }}>
                      <FileText className="w-4 h-4" />{t('تصدير Excel', 'Export Excel')}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                      const rows = reportSeries.slice(-14).reverse();
                      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                      doc.setFontSize(14);
                      doc.text(t('تقارير الحجوزات والإيرادات', 'Bookings & Revenue Report'), 14, 18);
                      doc.setFontSize(10);
                      const colW = [40, 45, 45];
                      let y = 28;
                      doc.text(t('التاريخ', 'Date'), 14, y);
                      doc.text(t('الحجوزات', 'Bookings'), 14 + colW[0], y);
                      doc.text(t('الإيرادات', 'Revenue'), 14 + colW[0] + colW[1], y);
                      y += 7;
                      rows.forEach(r => {
                        if (y > 275) { doc.addPage(); y = 20; }
                        doc.text(String(r.date), 14, y);
                        doc.text(String(r.bookings ?? 0), 14 + colW[0], y);
                        doc.text(String(r.revenue ?? 0), 14 + colW[0] + colW[1], y);
                        y += 6;
                      });
                      doc.save(`reports-${reportPeriod}-${new Date().toISOString().slice(0, 10)}.pdf`);
                      toast.success(t('تم تصدير PDF', 'PDF exported'));
                    }}>
                      <FileText className="w-4 h-4" />{t('تصدير PDF', 'Export PDF')}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {reportSeries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('لا توجد بيانات', 'No data')}</p>
              ) : (
                <>
                  <div className="h-72 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={reportSeries.slice(-14).reverse()}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value, name) => [name === 'bookings' ? value : value, name === 'bookings' ? t('الحجوزات', 'Bookings') : t('الإيرادات', 'Revenue')]}
                          labelFormatter={(label) => t('التاريخ', 'Date') + ': ' + label}
                        />
                        <Legend formatter={(v) => v === 'bookings' ? t('الحجوزات', 'Bookings') : t('الإيرادات', 'Revenue')} />
                        <Line yAxisId="left" type="monotone" dataKey="bookings" name="bookings" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" name="revenue" stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-start py-2">{t('التاريخ', 'Date')}</th>
                          <th className="text-end py-2">{t('الحجوزات', 'Bookings')}</th>
                          <th className="text-end py-2">{t('الإيرادات', 'Revenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportSeries.slice(-14).reverse().map((row) => (
                          <tr key={row.date} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2">{row.date}</td>
                            <td className="text-end">{row.bookings ?? 0}</td>
                            <td className="text-end">{row.revenue ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>{t('الحجوزات الأونلاين', 'Online Bookings')}</CardTitle>
                  <CardDescription>{t('إدارة حجوزات المرضى عبر الإنترنت', 'Manage online patient bookings')}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('بحث...', 'Search...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="ps-9 w-48"
                      data-testid="search-bookings"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40" data-testid="filter-status">
                      <Filter className="w-4 h-4 me-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('الكل', 'All')}</SelectItem>
                      <SelectItem value="scheduled">{t('بانتظار', 'Scheduled')}</SelectItem>
                      <SelectItem value="confirmed">{t('مؤكد', 'Confirmed')}</SelectItem>
                      <SelectItem value="completed">{t('مكتمل', 'Completed')}</SelectItem>
                      <SelectItem value="cancelled">{t('ملغي', 'Cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-40"
                    data-testid="filter-date"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('لا توجد حجوزات', 'No bookings found')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`p-4 rounded-lg border-2 ${statusColors[booking.status] || statusColors.pending}`}
                      data-testid={`booking-${booking.id}`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="font-mono">
                              {booking.confirmation_code}
                            </Badge>
                            <Badge className={statusColors[booking.status]}>
                              {statusLabels[booking.status]}
                            </Badge>
                          </div>
                          <h3 className="font-bold text-lg">{booking.patient_name}</h3>
                          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {booking.patient_phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {booking.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {booking.time}
                            </span>
                          </div>
                          {booking.reason && (
                            <p className="mt-2 text-sm">{t('السبب:', 'Reason:')} {booking.reason}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {(booking.status === 'pending' || booking.status === 'scheduled') && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 gap-1"
                                onClick={() => handleConfirmBooking(booking.id)}
                                data-testid={`confirm-${booking.id}`}
                              >
                                <Check className="w-4 h-4" />
                                {t('تأكيد', 'Confirm')}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => handleCancelBooking(booking.id)}
                                data-testid={`cancel-${booking.id}`}
                              >
                                <X className="w-4 h-4" />
                                {t('إلغاء', 'Cancel')}
                              </Button>
                            </>
                          )}
                          {booking.status === 'confirmed' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 gap-1"
                                onClick={() => handleCompleteBooking(booking.id)}
                                data-testid={`complete-${booking.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                                {t('إتمام', 'Complete')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => handleCancelBooking(booking.id)}
                              >
                                <X className="w-4 h-4" />
                                {t('إلغاء', 'Cancel')}
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowBookingDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Details Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('تفاصيل الحجز', 'Booking Details')}</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-lg">
                  {selectedBooking.confirmation_code}
                </Badge>
                <Badge className={statusColors[selectedBooking.status]}>
                  {statusLabels[selectedBooking.status]}
                </Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">{t('اسم المريض', 'Patient Name')}</label>
                  <p className="font-medium">{selectedBooking.patient_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">{t('الهاتف', 'Phone')}</label>
                    <p className="font-medium">{selectedBooking.patient_phone}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">{t('البريد', 'Email')}</label>
                    <p className="font-medium">{selectedBooking.patient_email || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">{t('التاريخ', 'Date')}</label>
                    <p className="font-medium">{selectedBooking.date}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">{t('الوقت', 'Time')}</label>
                    <p className="font-medium">{selectedBooking.time}</p>
                  </div>
                </div>
                {selectedBooking.reason && (
                  <div>
                    <label className="text-sm text-muted-foreground">{t('سبب الزيارة', 'Visit Reason')}</label>
                    <p className="font-medium">{selectedBooking.reason}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-muted-foreground">{t('تاريخ الإنشاء', 'Created At')}</label>
                  <p className="font-medium">{new Date(selectedBooking.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyAdminDashboard;

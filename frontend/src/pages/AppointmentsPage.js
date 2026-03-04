import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { appointmentsAPI, patientsAPI, usersAPI, companiesAPI, onlineBookingsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Plus, Clock, User, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, CalendarDays, List, Trash2, CalendarRange, CalendarCheck, Check, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageEmptyState, LoadingSpinner } from '../components/common';

const AppointmentsPage = () => {
  const { user, t, language } = useAuth();
  const canAccessPatients = (user?.allowed_features || []).includes('patients');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(searchParams.get('new') === 'true');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('week'); // 'day', 'week', 'month', 'list'
  const [filterDoctorId, setFilterDoctorId] = useState('__all__');
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [formData, setFormData] = useState({
    patient_id: '', doctor_id: '', date: '', time: '',
    duration_minutes: 30, reason: '', reason_ar: '', notes: ''
  });
  const companyId = user?.company_id;
  const [onlineBookings, setOnlineBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [filterBookingStatus, setFilterBookingStatus] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  function getWeekDays(startDate) {
    const days = [];
    const start = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  }

  function getMonthRange(firstDayStr) {
    const d = new Date(firstDayStr + 'T12:00:00');
    const y = d.getFullYear();
    const m = d.getMonth();
    const lastDay = new Date(y, m + 1, 0);
    const date_from = firstDayStr;
    const date_to = lastDay.toISOString().split('T')[0];
    return { date_from, date_to };
  }

  function getMonthGrid(firstDayStr) {
    const d = new Date(firstDayStr + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const grid = [];
    let day = 1;
    for (let row = 0; row < 6; row++) {
      const rowDays = [];
      for (let col = 0; col < 7; col++) {
        const cellIndex = row * 7 + col;
        if (cellIndex < startPad || day > daysInMonth) {
          rowDays.push(null);
        } else {
          const dateStr = new Date(year, month, day).toISOString().split('T')[0];
          rowDays.push(dateStr);
          day++;
        }
      }
      grid.push(rowDays);
    }
    return grid;
  }

  const weekDays = getWeekDays(weekStart);

  useEffect(() => {
    fetchData();
  }, [selectedDate, weekStart, monthStart, viewMode, filterDoctorId]);

  useEffect(() => {
    if (companyId) fetchOnlineBookings();
  }, [companyId]);

  const fetchOnlineBookings = async () => {
    if (!companyId) return;
    setLoadingBookings(true);
    try {
      const res = await companiesAPI.getOnlineBookings(companyId);
      const list = res.data?.bookings || res.data || [];
      setOnlineBookings(Array.isArray(list) ? list : []);
    } catch (e) {
      setOnlineBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const promises = [usersAPI.getDoctors()];
      if (canAccessPatients) {
        promises.push(patientsAPI.getAll());
      }
      const results = await Promise.all(promises);
      setDoctors(results[0]?.data || []);
      setPatients(canAccessPatients ? (results[1]?.data || []) : []);

      const doctorParam = filterDoctorId && filterDoctorId !== '__all__' ? filterDoctorId : undefined;

      if (viewMode === 'day') {
        const res = await appointmentsAPI.getAll({ date: selectedDate, doctor_id: doctorParam });
        const list = res.data || [];
        setAllAppointments(list);
        setAppointments(list);
      } else if (viewMode === 'month') {
        const { date_from, date_to } = getMonthRange(monthStart);
        const res = await appointmentsAPI.getAll({ date_from, date_to, doctor_id: doctorParam });
        const list = res.data || [];
        setAllAppointments(list);
        setAppointments(list.filter(a => a.date === selectedDate));
      } else {
        const weekAppts = [];
        for (const day of weekDays) {
          try {
            const res = await appointmentsAPI.getAll({ date: day, doctor_id: doctorParam });
            weekAppts.push(...(res.data || []).map(a => ({ ...a, date: day })));
          } catch (e) {}
        }
        setAllAppointments(weekAppts);
        const dayRes = await appointmentsAPI.getAll({ date: selectedDate, doctor_id: doctorParam });
        setAppointments(dayRes.data || []);
      }
    } catch (error) {
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await appointmentsAPI.create(formData);
      toast.success(t('تم إضافة الموعد بنجاح', 'Appointment added successfully'));
      setShowNewDialog(false);
      setFormData({
        patient_id: '', doctor_id: '', date: '', time: '',
        duration_minutes: 30, reason: '', reason_ar: '', notes: ''
      });
      fetchData();
    } catch (error) {
      toast.error(t('فشل في إضافة الموعد', 'Failed to add appointment'));
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const appt = allAppointments.find(a => a.id === appointmentId) || appointments.find(a => a.id === appointmentId);
      await appointmentsAPI.update(appointmentId, { ...appt, status: newStatus });
      toast.success(t('تم تحديث الحالة', 'Status updated'));
      fetchData();
    } catch (error) {
      toast.error(t('فشل في تحديث الحالة', 'Failed to update status'));
    }
  };

  const handleDelete = async (appointmentId) => {
    if (!window.confirm(t('هل تريد حذف هذا الموعد؟', 'Delete this appointment?'))) return;
    try {
      await appointmentsAPI.delete(appointmentId);
      toast.success(t('تم حذف الموعد', 'Appointment deleted'));
      fetchData();
    } catch (error) {
      toast.error(t('فشل في الحذف', 'Failed to Delete'));
    }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await onlineBookingsAPI.confirm(bookingId);
      toast.success(t('تم تأكيد الحجز', 'Booking confirmed'));
      fetchOnlineBookings();
    } catch (e) {
      toast.error(t('فشل في التأكيد', 'Failed to confirm'));
    }
  };
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t('هل أنت متأكد من إلغاء هذا الحجز؟', 'Cancel this booking?'))) return;
    try {
      await onlineBookingsAPI.cancel(bookingId);
      toast.success(t('تم إلغاء الحجز', 'Booking cancelled'));
      fetchOnlineBookings();
    } catch (e) {
      toast.error(t('فشل في الإلغاء', 'Failed to cancel'));
    }
  };
  const handleCompleteBooking = async (bookingId) => {
    try {
      await onlineBookingsAPI.complete(bookingId);
      toast.success(t('تم إتمام الزيارة', 'Visit completed'));
      fetchOnlineBookings();
    } catch (e) {
      toast.error(t('فشل في الإتمام', 'Failed to complete'));
    }
  };

  const bookingStatusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    scheduled: 'bg-amber-100 text-amber-700 border-amber-200',
    confirmed: 'bg-green-100 text-green-700 border-green-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    no_show: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  const bookingStatusLabels = {
    pending: t('بانتظار التأكيد', 'Pending'),
    scheduled: t('بانتظار التأكيد', 'Scheduled'),
    confirmed: t('مؤكد', 'Confirmed'),
    completed: t('مكتمل', 'Completed'),
    cancelled: t('ملغي', 'Cancelled'),
    no_show: t('لم يحضر', 'No Show')
  };
  const filteredOnlineBookings = onlineBookings.filter(b => {
    const ok = filterBookingStatus === 'all' || b.status === filterBookingStatus;
    return ok;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'no_show': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'no_show': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const hours = Array.from({ length: 13 }, (_, i) => 8 + i);

  const formatDayName = (dateStr) => {
    const d = new Date(dateStr);
    return language === 'ar' 
      ? d.toLocaleDateString('ar-SA', { weekday: 'short' })
      : d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDayNum = (dateStr) => new Date(dateStr).getDate();

  const isToday = (dateStr) => dateStr === new Date().toISOString().split('T')[0];

  const getAppointmentsForDay = (dateStr) => {
    return allAppointments.filter(a => a.date === dateStr);
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setWeekStart(getWeekStart(new Date()));
    setSelectedDate(today);
    setMonthStart(today.slice(0, 8) + '01');
  };

  const prevMonth = () => {
    const d = new Date(monthStart + 'T12:00:00');
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    setMonthStart(d.toISOString().split('T')[0]);
  };

  const nextMonth = () => {
    const d = new Date(monthStart + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    setMonthStart(d.toISOString().split('T')[0]);
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const monthGrid = getMonthGrid(monthStart);

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="appointments-page" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* موافقة حجوزات أونلاين - أعلى الصفحة */}
      {companyId && (
        <Card className="rounded-xl border-2 border-teal-200 dark:border-teal-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-teal-600" />
              {t('موافقة حجوزات أونلاين', 'Online Bookings Approval')}
            </CardTitle>
            <CardDescription>{t('حجوزات المرضى عبر الإنترنت — تأكيد أو إلغاء', 'Patient online bookings — confirm or cancel')}</CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Select value={filterBookingStatus} onValueChange={setFilterBookingStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('الكل', 'All')}</SelectItem>
                  <SelectItem value="pending">{t('بانتظار', 'Pending')}</SelectItem>
                  <SelectItem value="scheduled">{t('مجدول', 'Scheduled')}</SelectItem>
                  <SelectItem value="confirmed">{t('مؤكد', 'Confirmed')}</SelectItem>
                  <SelectItem value="completed">{t('مكتمل', 'Completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('ملغي', 'Cancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchOnlineBookings} disabled={loadingBookings}>
                {t('تحديث', 'Refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBookings ? (
              <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
            ) : filteredOnlineBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('لا توجد حجوزات أونلاين', 'No online bookings')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredOnlineBookings.slice(0, 10).map((booking) => (
                  <div key={booking.id} className={`p-3 rounded-lg border ${bookingStatusColors[booking.status] || bookingStatusColors.pending}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <span className="font-mono text-xs me-2">{booking.confirmation_code}</span>
                        <span className="font-medium">{booking.patient_name}</span>
                        <span className="text-muted-foreground text-sm ms-2">{booking.date} {booking.time}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {(booking.status === 'pending' || booking.status === 'scheduled') && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" onClick={() => handleConfirmBooking(booking.id)}><Check className="w-4 h-4" /></Button>
                            <Button size="sm" variant="destructive" className="h-8" onClick={() => handleCancelBooking(booking.id)}><X className="w-4 h-4" /></Button>
                          </>
                        )}
                        {booking.status === 'confirmed' && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8" onClick={() => handleCompleteBooking(booking.id)}><CheckCircle className="w-4 h-4" /></Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setSelectedBooking(booking); setShowBookingDialog(true); }}><Eye className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredOnlineBookings.length > 10 && <p className="text-xs text-muted-foreground">{t('عرض أول 10', 'Showing first 10')}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PageHeader
        title={t('المواعيد', 'Appointments')}
        description={t('إدارة مواعيد المرضى', 'Manage patient appointments')}
        icon={Calendar}
        actions={
          <>
            <Select value={filterDoctorId} onValueChange={setFilterDoctorId}>
              <SelectTrigger className="w-44" data-testid="filter-doctor">
                <User className="w-4 h-4 me-2" />
                <SelectValue placeholder={t('كل الأطباء', 'All doctors')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('كل الأطباء', 'All doctors')}</SelectItem>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{language === 'ar' ? d.name_ar || d.name : d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex bg-muted rounded-xl p-1">
              <Button 
                variant={viewMode === 'day' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('day')}
                className={viewMode === 'day' ? 'bg-teal-600' : ''}
              >
                <Calendar className="w-4 h-4 me-1" />{t('يوم', 'Day')}
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('week')}
                className={viewMode === 'week' ? 'bg-teal-600' : ''}
              >
                <CalendarDays className="w-4 h-4 me-1" />{t('أسبوع', 'Week')}
              </Button>
              <Button 
                variant={viewMode === 'month' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('month')}
                className={viewMode === 'month' ? 'bg-teal-600' : ''}
              >
                <CalendarRange className="w-4 h-4 me-1" />{t('شهر', 'Month')}
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-teal-600' : ''}
              >
                <List className="w-4 h-4 me-1" />{t('قائمة', 'List')}
              </Button>
            </div>
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="add-appointment-btn">
                  <Plus className="w-4 h-4" />
                  {t('موعد جديد', 'New')}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('إضافة موعد جديد', 'Add New Appointment')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('المريض', 'Patient')} *</Label>
                  <Select value={formData.patient_id} onValueChange={(v) => setFormData({...formData, patient_id: v})}>
                    <SelectTrigger data-testid="appointment-patient">
                      <SelectValue placeholder={t('اختر المريض', 'Select patient')} />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {language === 'ar' ? p.name_ar || p.name : p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('الطبيب', 'Doctor')} *</Label>
                  <Select value={formData.doctor_id} onValueChange={(v) => setFormData({...formData, doctor_id: v})}>
                    <SelectTrigger data-testid="appointment-doctor">
                      <SelectValue placeholder={t('اختر الطبيب', 'Select doctor')} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {language === 'ar' ? d.name_ar || d.name : d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('التاريخ', 'Date')} *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                      data-testid="appointment-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('الوقت', 'Time')} *</Label>
                    <Select value={formData.time} onValueChange={(v) => setFormData({...formData, time: v})}>
                      <SelectTrigger data-testid="appointment-time">
                        <SelectValue placeholder={t('اختر', 'Select')} />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('مدة الموعد', 'Duration')}</Label>
                  <Select value={String(formData.duration_minutes)} onValueChange={(v) => setFormData({...formData, duration_minutes: parseInt(v)})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 {t('دقيقة', 'min')}</SelectItem>
                      <SelectItem value="30">30 {t('دقيقة', 'min')}</SelectItem>
                      <SelectItem value="45">45 {t('دقيقة', 'min')}</SelectItem>
                      <SelectItem value="60">60 {t('دقيقة', 'min')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('السبب', 'Reason')}</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value, reason_ar: e.target.value})}
                    placeholder={t('سبب الزيارة', 'Reason for visit')}
                    data-testid="appointment-reason"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                    {t('إلغاء', 'Cancel')}
                  </Button>
                  <Button type="submit" className="bg-teal-600 hover:bg-teal-700" data-testid="save-appointment-btn">
                    {t('حفظ', 'Save')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      {/* Day Navigation */}
      {viewMode === 'day' && (
        <Card className="rounded-xl border-2">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevDay}>
                  {language === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('اليوم', 'Today')}
                </Button>
                <Button variant="outline" size="icon" onClick={nextDay}>
                  {language === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
              <span className="font-medium">
                {new Date(selectedDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day View - يوم واحد لكل الدكتور */}
      {viewMode === 'day' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3 border-b bg-muted/50 font-medium text-center">
              {t('اليوم', 'Day')}: {selectedDate} — {appointments.length} {t('موعد', 'appointment(s)')}
            </div>
            <div className="p-4 min-h-[300px]">
              {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" /></div>
              ) : appointments.length > 0 ? (
                <div className="space-y-2">
                  {appointments.sort((a, b) => a.time.localeCompare(b.time)).map(appt => {
                    const patient = patients.find(p => p.id === appt.patient_id);
                    const doctor = doctors.find(d => d.id === appt.doctor_id);
                    return (
                      <div
                        key={appt.id}
                        className={`p-3 rounded-lg text-white flex items-center justify-between ${getStatusColor(appt.status)}`}
                      >
                        <div>
                          <span className="font-bold">{appt.time}</span>
                          <span className="ms-2 opacity-90">{patient ? (language === 'ar' ? patient.name_ar || patient.name : patient.name) : '?'}</span>
                          {doctor && <span className="ms-2 text-sm opacity-80">— {language === 'ar' ? doctor.name_ar || doctor.name : doctor.name}</span>}
                        </div>
                        <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => patient && navigate(`/patients/${patient.id}`)}>
                          {t('عرض', 'View')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">{t('لا مواعيد في هذا اليوم', 'No appointments on this day')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Navigation */}
      {viewMode === 'week' && (
        <Card className="rounded-xl border-2">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevWeek}>
                  {language === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('اليوم', 'Today')}
                </Button>
                <Button variant="outline" size="icon" onClick={nextWeek}>
                  {language === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
              <span className="font-medium">
                {new Date(weekStart).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Navigation */}
      {viewMode === 'month' && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                  {language === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('اليوم', 'Today')}
                </Button>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                  {language === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
              <span className="font-medium">
                {new Date(monthStart + 'T12:00:00').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const d = new Date(2024, 0, 1 + i);
                const name = language === 'ar'
                  ? d.toLocaleDateString('ar-SA', { weekday: 'short' })
                  : d.toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <div key={i} className="p-2 text-center text-xs font-medium text-muted-foreground border-e last:border-e-0">
                    {name}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid.flatMap((row, rowIdx) =>
                row.map((dateStr, colIdx) => {
                  if (!dateStr) {
                    return <div key={`m-${rowIdx}-${colIdx}`} className="min-h-[80px] border-e border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30" />;
                  }
                  const count = getAppointmentsForDay(dateStr).length;
                  const today = isToday(dateStr);
                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[80px] border-e border-b border-slate-200 dark:border-slate-800 p-2 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors ${selectedDate === dateStr ? 'bg-teal-100 dark:bg-teal-900/40' : ''} ${today ? 'ring-1 ring-teal-400 ring-inset' : ''}`}
                      onClick={() => setSelectedDate(dateStr)}
                    >
                      <p className={`text-sm font-medium ${today ? 'text-teal-600' : ''}`}>{formatDayNum(dateStr)}</p>
                      {count > 0 && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {count}
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {selectedDate && (
              <div className="border-t p-4 bg-slate-50 dark:bg-slate-900/30">
                <h4 className="font-medium mb-2">{selectedDate} – {getAppointmentsForDay(selectedDate).length} {t('موعد', 'appointment(s)')}</h4>
                {getAppointmentsForDay(selectedDate).length > 0 ? (
                  <div className="space-y-2">
                    {getAppointmentsForDay(selectedDate).sort((a, b) => a.time.localeCompare(b.time)).map((appt) => {
                      const patient = patients.find(p => p.id === appt.patient_id);
                      return (
                        <div
                          key={appt.id}
                          className={`p-2 rounded-lg text-white text-sm flex items-center justify-between ${getStatusColor(appt.status)}`}
                        >
                          <span>{appt.time} – {patient ? (language === 'ar' ? patient.name_ar || patient.name : patient.name) : '?'}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-white hover:bg-white/20 h-8"
                            onClick={(e) => { e.stopPropagation(); patient && navigate(`/patients/${patient.id}`); }}
                          >
                            {t('عرض', 'View')}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('لا مواعيد في هذا اليوم', 'No appointments on this day')}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map(day => (
                <div 
                  key={day} 
                  className={`p-3 text-center border-e last:border-e-0 cursor-pointer hover:bg-muted/50 transition-colors ${isToday(day) ? 'bg-teal-50' : ''} ${selectedDate === day ? 'bg-teal-100' : ''}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <p className="text-xs text-muted-foreground">{formatDayName(day)}</p>
                  <p className={`text-xl font-bold ${isToday(day) ? 'text-teal-600' : ''}`}>{formatDayNum(day)}</p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {getAppointmentsForDay(day).length}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Time Grid */}
            <div className="grid grid-cols-7 max-h-[500px] overflow-y-auto">
              {weekDays.map(day => (
                <div key={day} className="border-e last:border-e-0 min-h-[400px]">
                  {getAppointmentsForDay(day).length > 0 ? (
                    <div className="p-2 space-y-2">
                      {getAppointmentsForDay(day).sort((a, b) => a.time.localeCompare(b.time)).map(appt => {
                        const patient = patients.find(p => p.id === appt.patient_id);
                        return (
                          <div 
                            key={appt.id} 
                            className={`p-2 rounded-lg text-white text-xs cursor-pointer hover:opacity-90 ${getStatusColor(appt.status)}`}
                            onClick={() => patient && navigate(`/patients/${patient.id}`)}
                          >
                            <p className="font-bold">{appt.time}</p>
                            <p className="truncate">{patient ? (language === 'ar' ? patient.name_ar || patient.name : patient.name) : '?'}</p>
                            {appt.reason && <p className="truncate opacity-80">{appt.reason}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs p-4">
                      {t('لا مواعيد', 'No appts')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {/* Date Selector */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-teal-600" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                  data-testid="date-selector"
                />
                <span className="text-muted-foreground">
                  {appointments.length} {t('موعد', 'appointment(s)')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Appointments List */}
          {loading ? (
            <LoadingSpinner className="min-h-[8rem]" />
          ) : appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.sort((a, b) => a.time.localeCompare(b.time)).map((appt, index) => {
                const patient = patients.find(p => p.id === appt.patient_id);
                const doctor = doctors.find(d => d.id === appt.doctor_id);
                
                return (
                  <Card key={appt.id} className="rounded-xl border-2 hover:shadow-lg transition-all" data-testid={`appointment-item-${index}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="text-center p-3 bg-teal-50 rounded-xl min-w-[80px]">
                            <p className="text-xl font-bold text-teal-600">{appt.time}</p>
                            <p className="text-xs text-muted-foreground">{appt.duration_minutes} {t('د', 'm')}</p>
                          </div>
                          <div>
                            <h3 
                              className="font-semibold text-lg cursor-pointer hover:text-teal-600"
                              onClick={() => patient && navigate(`/patients/${patient.id}`)}
                            >
                              {patient ? (language === 'ar' ? patient.name_ar || patient.name : patient.name) : t('مريض محذوف', 'Deleted patient')}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {doctor ? (language === 'ar' ? doctor.name_ar || doctor.name : doctor.name) : '-'}
                            </p>
                            {appt.reason && (
                              <p className="text-sm text-muted-foreground mt-1">{appt.reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`gap-1 ${getStatusBadgeClass(appt.status)}`}>
                            {appt.status === 'scheduled' ? t('مجدول', 'Scheduled') :
                             appt.status === 'completed' ? t('مكتمل', 'Completed') :
                             appt.status === 'cancelled' ? t('ملغي', 'Cancelled') :
                             t('لم يحضر', 'No Show')}
                          </Badge>
                          {appt.status === 'scheduled' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleStatusChange(appt.id, 'completed')}
                                title={t('مكتمل', 'Complete')}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 hover:bg-amber-50"
                                onClick={() => handleStatusChange(appt.id, 'no_show')}
                                title={t('لم يحضر', 'No Show')}
                              >
                                <AlertCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleStatusChange(appt.id, 'cancelled')}
                                title={t('إلغاء', 'Cancel')}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(appt.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <PageEmptyState
              icon={Calendar}
              message={t('لا توجد مواعيد في هذا اليوم', 'No appointments on this day')}
              dir={isRtl ? 'rtl' : 'ltr'}
            />
          )}
        </>
      )}

      {/* تفاصيل حجز أونلاين */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('تفاصيل الحجز', 'Booking Details')}</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-lg">{selectedBooking.confirmation_code}</Badge>
                <Badge className={bookingStatusColors[selectedBooking.status]}>{bookingStatusLabels[selectedBooking.status]}</Badge>
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
                    <label className="text-sm text-muted-foreground">{t('التاريخ', 'Date')}</label>
                    <p className="font-medium">{selectedBooking.date} {selectedBooking.time}</p>
                  </div>
                </div>
                {selectedBooking.reason && (
                  <div>
                    <label className="text-sm text-muted-foreground">{t('السبب', 'Reason')}</label>
                    <p className="font-medium">{selectedBooking.reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {allAppointments.filter(a => a.status === 'scheduled').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('مجدول', 'Scheduled')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {allAppointments.filter(a => a.status === 'completed').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('مكتمل', 'Completed')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {allAppointments.filter(a => a.status === 'cancelled').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('ملغي', 'Cancelled')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {allAppointments.filter(a => a.status === 'no_show').length}
            </p>
            <p className="text-xs text-muted-foreground">{t('لم يحضر', 'No Show')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppointmentsPage;

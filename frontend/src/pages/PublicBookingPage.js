import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Stethoscope, Calendar, Clock, User, Phone, Mail,
  MapPin, CheckCircle, ArrowLeft, ArrowRight, Globe,
  Building2, Search
} from 'lucide-react';

const PublicBookingPage = () => {
  const { clinicCode } = useParams();
  const [language, setLanguage] = useState('ar');
  const [step, setStep] = useState(1);
  const [doctors, setDoctors] = useState([]);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [bookingResult, setBookingResult] = useState(null);
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [patientInfo, setPatientInfo] = useState({
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    reason: '',
    notes: ''
  });

  const t = (ar, en) => language === 'ar' ? ar : en;
  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (clinicCode) {
        try {
          const [companyRes, doctorsRes] = await Promise.all([
            publicAPI.getCompanyByCode(clinicCode),
            publicAPI.getDoctors({ company_code: clinicCode }),
          ]);
          setClinic(companyRes.data);
          const doctorsList = doctorsRes.data.doctors || doctorsRes.data || [];
          setDoctors(Array.isArray(doctorsList) ? doctorsList : []);
        } catch (err) {
          if (err.response?.status === 404) {
            toast.error(t('العيادة غير موجودة', 'Clinic not found'));
            setClinic(null);
            setDoctors([]);
          } else {
            toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
            setDoctors([]);
          }
        } finally {
          setLoading(false);
        }
      } else {
        try {
          const res = await publicAPI.getDoctors();
          const doctorsList = res.data.doctors || res.data || [];
          setDoctors(Array.isArray(doctorsList) ? doctorsList : []);
        } catch (error) {
          console.error('Error fetching doctors:', error);
          toast.error(t('فشل في تحميل قائمة الأطباء', 'Failed to load doctors'));
          setDoctors([]);
        } finally {
          setLoading(false);
        }
      }
    };
    load();
  }, [clinicCode]);

  const fetchAvailableSlots = async (doctorId, date) => {
    try {
      const res = await publicAPI.getSlots(doctorId, date);
      // API returns {available_slots: [...], booked_slots: [...], ...} format
      const slots = res.data.available_slots || res.data || [];
      setAvailableSlots(Array.isArray(slots) ? slots : []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    }
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setStep(2);
  };

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedTime('');
    if (selectedDoctor && date) {
      fetchAvailableSlots(selectedDoctor.id, date);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      toast.error(t('يرجى اختيار الطبيب والتاريخ والوقت', 'Please select doctor, date and time'));
      return;
    }

    try {
      const res = await publicAPI.book({
        ...patientInfo,
        doctor_id: selectedDoctor.id,
        company_id: selectedDoctor.company_id,
        date: selectedDate,
        time: selectedTime
      });
      setBookingResult(res.data);
      setStep(4);
      toast.success(t('تم الحجز بنجاح!', 'Booking successful!'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في الحجز', 'Booking failed'));
    }
  };

  const specialties = [
    { value: 'all', label: t('جميع التخصصات', 'All Specialties') },
    { value: 'general', label: t('طب عام', 'General Medicine') },
    { value: 'cardiology', label: t('أمراض القلب', 'Cardiology') },
    { value: 'pediatrics', label: t('طب الأطفال', 'Pediatrics') },
    { value: 'dermatology', label: t('الجلدية', 'Dermatology') },
    { value: 'orthopedics', label: t('العظام', 'Orthopedics') },
    { value: 'dentistry', label: t('طب الأسنان', 'Dentistry') },
    { value: 'ophthalmology', label: t('العيون', 'Ophthalmology') },
    { value: 'gynecology', label: t('النسائية', 'Gynecology') },
    { value: 'ent', label: t('أنف وأذن وحنجرة', 'ENT') },
    { value: 'neurology', label: t('الأعصاب', 'Neurology') }
  ];

  const filteredDoctors = doctors.filter(doctor => {
    const matchesSpecialty = filterSpecialty === 'all' || doctor.specialty === filterSpecialty;
    const matchesSearch = 
      doctor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.name_ar?.includes(searchTerm) ||
      doctor.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSpecialty && matchesSearch;
  });

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  const clinicName = clinic ? (language === 'ar' ? (clinic.name_ar || clinic.name) : clinic.name) : 'Tebbi';
  const clinicSubtitle = clinic ? (language === 'ar' ? (clinic.address_ar || clinic.address) || t('حجز موعد', 'Book an appointment') : (clinic.address || t('Book an appointment'))) : t('حجز المواعيد', 'Online Booking');

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 ${isRTL ? 'font-arabic' : 'font-sans'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {clinic?.logo_base64 ? (
                <img src={`data:image/png;base64,${clinic.logo_base64}`} alt={clinicName} className="w-12 h-12 object-contain rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-teal-700 dark:text-teal-400 tracking-tight">{clinicName}</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[220px] sm:max-w-none truncate mt-0.5">{clinicSubtitle}</p>
                {clinic?.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {clinic.phone}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="gap-2"
              data-testid="language-toggle"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Steps Progress */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-semibold text-base sm:text-lg transition-all shadow-sm ${
                  step >= s 
                    ? 'bg-teal-600 text-white ring-2 ring-teal-200 dark:ring-teal-800' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {step > s ? <CheckCircle className="w-6 h-6" /> : s}
                </div>
                {s < 4 && (
                  <div className={`w-8 sm:w-16 md:w-24 h-1 mx-1 sm:mx-2 rounded-full ${
                    step > s ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {step === 1 && t('اختر الطبيب', 'Select Doctor')}
              {step === 2 && t('اختر الموعد', 'Select Appointment')}
              {step === 3 && t('بياناتك', 'Your Information')}
              {step === 4 && t('تم الحجز', 'Booking Confirmed')}
            </p>
          </div>
        </div>

        {/* Step 1: Select Doctor */}
        {step === 1 && (
          <div className="space-y-6" data-testid="step-1">
            <Card className="rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{t('اختر الطبيب', 'Select a Doctor')}</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">{t('تصفح الأطباء المتاحين واختر طبيبك', 'Browse available doctors and choose yours')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('ابحث عن طبيب أو عيادة...', 'Search doctor or clinic...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="ps-9"
                      data-testid="search-doctors"
                    />
                  </div>
                  <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
                    <SelectTrigger className="w-full sm:w-[200px]" data-testid="filter-specialty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('لا يوجد أطباء متاحين', 'No doctors available')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {filteredDoctors.map((doctor) => (
                      <Card
                        key={doctor.id}
                        className="cursor-pointer hover:border-teal-500 hover:shadow-xl hover:shadow-teal-500/10 transition-all duration-200 border-2"
                        onClick={() => handleDoctorSelect(doctor)}
                        data-testid={`doctor-card-${doctor.id}`}
                      >
                        <CardContent className="p-5 sm:p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-teal-100 dark:bg-teal-900/50 rounded-2xl flex items-center justify-center">
                              <Stethoscope className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                                {language === 'ar' ? doctor.name_ar || doctor.name : doctor.name}
                              </h3>
                              <Badge className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 mt-2 border-0">
                                {specialties.find(s => s.value === doctor.specialty)?.label || doctor.specialty}
                              </Badge>
                              <div className="flex items-center gap-1.5 mt-3 text-sm text-slate-600 dark:text-slate-400">
                                <Building2 className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{doctor.company_name}</span>
                              </div>
                              {doctor.consultation_fee > 0 && (
                                <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 mt-2">
                                  {t('رسوم الكشف:', 'Fee:')} {doctor.consultation_fee} {t('ريال', 'SAR')}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Select Date/Time */}
        {step === 2 && selectedDoctor && (
          <div className="space-y-6" data-testid="step-2">
            <Card className="rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('اختر الموعد', 'Select Appointment')}</CardTitle>
                    <CardDescription>
                      {t('الطبيب:', 'Doctor:')} {language === 'ar' ? selectedDoctor.name_ar || selectedDoctor.name : selectedDoctor.name}
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setStep(1)} data-testid="back-to-doctors">
                    {isRTL ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />}
                    {t('رجوع', 'Back')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('اختر التاريخ', 'Select Date')}</Label>
                      <Input
                        type="date"
                        min={today}
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="text-lg"
                        data-testid="select-date"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>{t('الأوقات المتاحة', 'Available Times')}</Label>
                    {!selectedDate ? (
                      <p className="text-muted-foreground text-sm">{t('اختر التاريخ أولاً', 'Select a date first')}</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('لا توجد مواعيد متاحة', 'No available slots')}</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        {availableSlots.map((slot) => (
                          <Button
                            key={slot}
                            variant={selectedTime === slot ? 'default' : 'outline'}
                            className={`min-h-[44px] sm:min-h-[40px] ${selectedTime === slot ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
                            onClick={() => setSelectedTime(slot)}
                            data-testid={`time-slot-${slot}`}
                          >
                            <Clock className="w-4 h-4 me-1.5 flex-shrink-0" />
                            <span className="font-medium">{slot}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(3)}
                    data-testid="continue-to-info"
                  >
                    {t('متابعة', 'Continue')}
                    {isRTL ? <ArrowLeft className="w-4 h-4 ms-2" /> : <ArrowRight className="w-4 h-4 ms-2" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Patient Info */}
        {step === 3 && (
          <div className="space-y-6" data-testid="step-3">
            <Card className="rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{t('بياناتك الشخصية', 'Your Information')}</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">{t('أدخل بياناتك لإتمام الحجز', 'Enter your details to complete booking')}</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setStep(2)} data-testid="back-to-time">
                    {isRTL ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />}
                    {t('رجوع', 'Back')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBooking} className="space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300 font-medium">{t('الاسم الكامل *', 'Full Name *')}</Label>
                      <div className="relative">
                        <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          value={patientInfo.patient_name}
                          onChange={(e) => setPatientInfo({...patientInfo, patient_name: e.target.value})}
                          className="ps-10 h-12 sm:h-11 text-base"
                          required
                          data-testid="patient-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('رقم الهاتف *', 'Phone Number *')}</Label>
                      <div className="relative">
                        <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={patientInfo.patient_phone}
                          onChange={(e) => setPatientInfo({...patientInfo, patient_phone: e.target.value})}
                          className="ps-9"
                          required
                          data-testid="patient-phone"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('البريد الإلكتروني (اختياري)', 'Email (optional)')}</Label>
                    <div className="relative">
                      <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={patientInfo.patient_email}
                        onChange={(e) => setPatientInfo({...patientInfo, patient_email: e.target.value})}
                        className="ps-9"
                        data-testid="patient-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('سبب الزيارة', 'Reason for Visit')}</Label>
                    <Textarea
                      value={patientInfo.reason}
                      onChange={(e) => setPatientInfo({...patientInfo, reason: e.target.value})}
                      placeholder={t('صف شكواك باختصار...', 'Briefly describe your complaint...')}
                      data-testid="visit-reason"
                    />
                  </div>

                  {/* Booking Summary */}
                  <Card className="rounded-xl border-2 bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800">
                    <CardContent className="p-4">
                      <h4 className="font-bold mb-3">{t('ملخص الحجز', 'Booking Summary')}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('الطبيب:', 'Doctor:')}</span>
                          <span className="font-medium">
                            {language === 'ar' ? selectedDoctor?.name_ar || selectedDoctor?.name : selectedDoctor?.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('التخصص:', 'Specialty:')}</span>
                          <span>{specialties.find(s => s.value === selectedDoctor?.specialty)?.label}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('التاريخ:', 'Date:')}</span>
                          <span>{selectedDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('الوقت:', 'Time:')}</span>
                          <span>{selectedTime}</span>
                        </div>
                        {selectedDoctor?.consultation_fee > 0 && (
                          <div className="flex justify-between border-t pt-2 mt-2">
                            <span className="text-muted-foreground">{t('رسوم الكشف:', 'Consultation Fee:')}</span>
                            <span className="font-bold text-teal-600">{selectedDoctor.consultation_fee} {t('ريال', 'SAR')}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 min-h-[48px]"
                      data-testid="submit-booking"
                    >
                      <CheckCircle className="w-5 h-5 me-2" />
                      {t('تأكيد الحجز', 'Confirm Booking')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && bookingResult && (
          <div className="max-w-lg mx-auto px-2" data-testid="step-4">
            <Card className="text-center rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
              <CardContent className="p-6 sm:p-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2">
                  {t('تم الحجز بنجاح!', 'Booking Confirmed!')}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {t('سيتم التواصل معك قريباً لتأكيد الموعد', 'We will contact you soon to confirm your appointment')}
                </p>

                <Card className="rounded-xl border-2 border-slate-200/60 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800 text-start">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-muted-foreground">{t('رمز الحجز:', 'Booking Code:')}</span>
                      <Badge className="bg-teal-600 text-lg px-4 py-1">{bookingResult.confirmation_code}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('الاسم:', 'Name:')}</span>
                      <span className="font-medium">{bookingResult.patient_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('التاريخ:', 'Date:')}</span>
                      <span>{bookingResult.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('الوقت:', 'Time:')}</span>
                      <span>{bookingResult.time}</span>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-sm text-muted-foreground mt-6">
                  {t('احتفظ برمز الحجز للمراجعة', 'Keep your booking code for reference')}
                </p>

                <Button
                  className="mt-6 bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    setStep(1);
                    setSelectedDoctor(null);
                    setSelectedDate('');
                    setSelectedTime('');
                    setBookingResult(null);
                    setPatientInfo({ patient_name: '', patient_phone: '', patient_email: '', reason: '', notes: '' });
                  }}
                  data-testid="new-booking"
                >
                  {t('حجز موعد جديد', 'Book Another Appointment')}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Tebbi Medical System. {t('جميع الحقوق محفوظة', 'All rights reserved.')}</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicBookingPage;

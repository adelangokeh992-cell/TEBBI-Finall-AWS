import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { publicAPI } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Stethoscope, Search, Calendar, FileText, Star,
  Heart, Eye, Baby, Bone, Smile, Brain, Activity,
  ChevronLeft, ChevronRight, Globe, LogIn, Sparkles,
  Clock, CheckCircle, UserPlus, ArrowLeft
} from 'lucide-react';

const HomePage = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState('ar');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [searchName, setSearchName] = useState('');

  const t = (ar, en) => language === 'ar' ? ar : en;
  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    fetchDoctors();
  }, [isRTL]);

  const fetchDoctors = async () => {
    try {
      const res = await publicAPI.getDoctors();
      const doctorsList = res.data.doctors || res.data || [];
      setDoctors(Array.isArray(doctorsList) ? doctorsList : []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedSpecialty) params.set('specialty', selectedSpecialty);
    if (searchName) params.set('search', searchName);
    navigate(`/booking?${params.toString()}`);
  };

  const specialties = [
    { value: 'general', label: t('طب عام', 'General'), icon: Activity, color: 'bg-blue-500' },
    { value: 'dentistry', label: t('طب أسنان', 'Dentistry'), icon: Smile, color: 'bg-pink-500' },
    { value: 'ophthalmology', label: t('طب عيون', 'Ophthalmology'), icon: Eye, color: 'bg-purple-500' },
    { value: 'pediatrics', label: t('طب أطفال', 'Pediatrics'), icon: Baby, color: 'bg-orange-500' },
    { value: 'gynecology', label: t('نساء وولادة', 'Gynecology'), icon: Heart, color: 'bg-red-500' },
    { value: 'cardiology', label: t('قلب وأوعية', 'Cardiology'), icon: Heart, color: 'bg-rose-500' },
    { value: 'orthopedics', label: t('عظام', 'Orthopedics'), icon: Bone, color: 'bg-amber-500' },
    { value: 'neurology', label: t('أعصاب', 'Neurology'), icon: Brain, color: 'bg-indigo-500' },
  ];

  const steps = [
    {
      number: 1,
      title: t('ابحث عن طبيبك', 'Find Your Doctor'),
      description: t('اختر التخصص للعثور على أفضل الأطباء', 'Select specialty to find the best doctors'),
      icon: Search
    },
    {
      number: 2,
      title: t('احجز موعدك', 'Book Your Appointment'),
      description: t('اختر الوقت المناسب واحجز فوراً', 'Choose convenient time and book instantly'),
      icon: Calendar
    },
    {
      number: 3,
      title: t('استلم التأكيد', 'Get Confirmation'),
      description: t('احصل على رمز الحجز وتفاصيل الموعد', 'Receive booking code and appointment details'),
      icon: CheckCircle
    }
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 ${isRTL ? 'font-arabic' : 'font-sans'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-teal-700 dark:text-teal-400">Tebbi</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('مدعوم بالذكاء الاصطناعي', 'AI Powered')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                {language === 'ar' ? 'EN' : 'عربي'}
              </Button>
              <Link to="/login">
                <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="login-btn">
                  <LogIn className="w-4 h-4" />
                  {t('تسجيل الدخول', 'Login')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230D9488' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 px-4 py-1">
              {t('أول منصة طبية ذكية', 'First Smart Medical Platform')}
            </Badge>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-800 dark:text-white mb-6">
              {t('احجز موعدك الطبي', 'Book Your Medical')}
              <br />
              <span className="text-teal-600">{t('بثوانٍ معدودة', 'Appointment in Seconds')}</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t(
                'اختر طبيبك من جميع التخصصات واحجز موعدك بسهولة. أطباء معتمدون، حجز فوري، تأكيد مباشر.',
                'Choose your doctor from all specialties and book easily. Certified doctors, instant booking, direct confirmation.'
              )}
            </p>
          </div>

          {/* Search Box */}
          <Card className="max-w-4xl mx-auto rounded-2xl border-2 shadow-2xl border-teal-200/60 dark:border-teal-800/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('التخصص', 'Specialty')}
                  </label>
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger className="h-12" data-testid="hero-specialty">
                      <SelectValue placeholder={t('اختر التخصص', 'Select Specialty')} />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            <s.icon className="w-4 h-4" />
                            {s.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('اسم الطبيب', 'Doctor Name')}
                  </label>
                  <Input
                    placeholder={t('ابحث باسم الطبيب...', 'Search by doctor name...')}
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="h-12"
                    data-testid="hero-search"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    className="w-full h-12 text-lg bg-teal-600 hover:bg-teal-700 gap-2"
                    onClick={handleSearch}
                    data-testid="hero-search-btn"
                  >
                    <Search className="w-5 h-5" />
                    {t('بحث', 'Search')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-6 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                  </div>
                  {t('أطباء متخصصين', 'Expert Doctors')}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  {t('حجز فوري', 'Instant Booking')}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <Star className="w-4 h-4 text-green-600" />
                  </div>
                  {t('تقييمات حقيقية', 'Real Reviews')}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Specialties Section */}
      <section className="py-16 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2">
              {t('التخصصات الطبية', 'Medical Specialties')}
            </h3>
            <p className="text-muted-foreground">
              {t('اختر التخصص المناسب للوصول لأفضل الأطباء', 'Choose the right specialty to reach the best doctors')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {specialties.map((specialty) => (
              <Card
                key={specialty.value}
                className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-300 border-0"
                onClick={() => {
                  setSelectedSpecialty(specialty.value);
                  navigate(`/booking?specialty=${specialty.value}`);
                }}
                data-testid={`specialty-${specialty.value}`}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-14 h-14 ${specialty.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                    <specialty.icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="font-medium text-sm">{specialty.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Doctors Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2">
                {t('أطباء مميزون', 'Featured Doctors')}
              </h3>
              <p className="text-muted-foreground">
                {t('تم اختيارهم بناءً على كفاءتهم العالية', 'Selected based on their high efficiency')}
              </p>
            </div>
            <Link to="/booking">
              <Button variant="outline" className="gap-2">
                {t('عرض المزيد', 'View More')}
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('لا يوجد أطباء متاحين حالياً', 'No doctors available currently')}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {doctors.slice(0, 4).map((doctor) => (
                <Card
                  key={doctor.id}
                  className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                  onClick={() => navigate(`/booking?doctor=${doctor.id}`)}
                  data-testid={`doctor-card-${doctor.id}`}
                >
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-center">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform">
                        <Stethoscope className="w-10 h-10 text-teal-600" />
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-lg mb-1">
                        {language === 'ar' ? doctor.name_ar || doctor.name : doctor.name}
                      </h4>
                      <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 mb-3">
                        {specialties.find(s => s.value === doctor.specialty)?.label || doctor.specialty}
                      </Badge>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t('رسوم الكشف', 'Fee')}
                        </span>
                        <span className="font-bold text-teal-600">
                          {doctor.consultation_fee > 0 ? `${doctor.consultation_fee} ${t('ل.س', 'SYP')}` : t('مجاني', 'Free')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
              {t('كيف يعمل؟', 'How It Works?')}
            </h3>
            <p className="text-teal-100">
              {t('احجز موعدك في 3 خطوات بسيطة', 'Book your appointment in 3 simple steps')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="text-center relative">
                {index < steps.length - 1 && (
                  <div className={`hidden md:block absolute top-12 ${isRTL ? 'left-0' : 'right-0'} w-1/2 h-0.5 bg-teal-400/30`} />
                )}
                <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 relative">
                  <step.icon className="w-12 h-12" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-white text-teal-600 rounded-full flex items-center justify-center font-bold shadow-lg">
                    {step.number}
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-2">{step.title}</h4>
                <p className="text-teal-100">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/booking">
              <Button size="lg" className="bg-white text-teal-600 hover:bg-teal-50 gap-2 text-lg px-8" data-testid="cta-book-btn">
                {t('احجز موعدك الآن', 'Book Now')}
                {isRTL ? <ArrowLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Doctor CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="bg-gradient-to-br from-purple-600 to-purple-800 border-0 overflow-hidden">
            <CardContent className="p-8 md:p-12 text-white text-center">
              <UserPlus className="w-16 h-16 mx-auto mb-6 opacity-80" />
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                {t('هل أنت طبيب؟', 'Are You a Doctor?')}
              </h3>
              <p className="text-purple-100 mb-6 max-w-xl mx-auto">
                {t(
                  'انضم إلى منصتنا واستقبل حجوزات المرضى أونلاين. زِد عدد مرضاك وأدر مواعيدك بكفاءة.',
                  'Join our platform and receive patient bookings online. Increase your patients and manage appointments efficiently.'
                )}
              </p>
              <Link to="/login">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-purple-50 gap-2">
                  {t('سجل كطبيب', 'Register as Doctor')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">Tebbi</span>
              </div>
              <p className="text-slate-400 text-sm">
                {t('منصة حجز طبي ذكية لحجز المواعيد مع أفضل الأطباء', 'Smart medical booking platform to book with the best doctors')}
              </p>
            </div>

            <div>
              <h5 className="font-bold mb-4">{t('روابط سريعة', 'Quick Links')}</h5>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link to="/booking" className="hover:text-white transition-colors">{t('احجز موعد', 'Book Appointment')}</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">{t('تسجيل الدخول', 'Login')}</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-4">{t('التخصصات', 'Specialties')}</h5>
              <ul className="space-y-2 text-slate-400 text-sm">
                {specialties.slice(0, 4).map(s => (
                  <li key={s.value}>
                    <Link to={`/booking?specialty=${s.value}`} className="hover:text-white transition-colors">{s.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h5 className="font-bold mb-4">{t('للأطباء', 'For Doctors')}</h5>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link to="/login" className="hover:text-white transition-colors">{t('انضم كطبيب', 'Join as Doctor')}</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">{t('لوحة التحكم', 'Dashboard')}</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-slate-400 text-sm">
            <p>© 2024 Tebbi Medical System. {t('جميع الحقوق محفوظة', 'All rights reserved.')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

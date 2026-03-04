import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicAPI } from '../services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/common';
import {
  Stethoscope, MapPin, Phone, Clock, DollarSign, Star,
  Calendar, Globe, Share2, Award, GraduationCap, Languages,
  ChevronLeft, User, MessageSquare, CheckCircle, Send,
  Facebook, Twitter, Linkedin, Copy, Building2
} from 'lucide-react';

const DoctorProfilePage = () => {
  const { identifier } = useParams();
  const [language, setLanguage] = useState('ar');
  const [doctor, setDoctor] = useState(null);
  const [company, setCompany] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ average_rating: 0, review_count: 0 });
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  
  // Booking form
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [patientInfo, setPatientInfo] = useState({
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    reason: ''
  });
  
  // Review form
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: '',
    patient_name: ''
  });

  const t = (ar, en) => language === 'ar' ? ar : en;
  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    fetchDoctorProfile();
  }, [identifier]);

  const fetchDoctorProfile = async () => {
    try {
      const res = await publicAPI.getDoctor(identifier);
      setDoctor(res.data.doctor);
      setCompany(res.data.company);
      setReviews(res.data.reviews || []);
      setStats(res.data.stats);
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('فشل في تحميل البيانات', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async (date) => {
    if (!doctor?.id || !date) return;
    try {
      const res = await publicAPI.getSlots(doctor.id, date);
      setAvailableSlots(res.data.available_slots || []);
    } catch (error) {
      setAvailableSlots([]);
    }
  };

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedTime('');
    fetchSlots(date);
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      toast.error(t('اختر التاريخ والوقت', 'Select date and time'));
      return;
    }
    
    try {
      const res = await publicAPI.book({
        ...patientInfo,
        doctor_id: doctor.id,
        company_id: doctor.company_id,
        date: selectedDate,
        time: selectedTime
      });
      
      toast.success(t('تم الحجز بنجاح!', 'Booking successful!'));
      setShowBooking(false);
      // Show confirmation code
      alert(`${t('رقم التأكيد:', 'Confirmation Code:')} ${res.data.booking?.confirmation_code || res.data.confirmation_code}`);
    } catch (error) {
      toast.error(t('فشل في الحجز', 'Booking failed'));
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newReview.patient_name || !newReview.rating) {
      toast.error(t('أدخل اسمك والتقييم', 'Enter your name and rating'));
      return;
    }
    
    try {
      await publicAPI.postReview({
        doctor_id: doctor.id,
        ...newReview
      });
      
      toast.success(t('شكراً لتقييمك!', 'Thank you for your review!'));
      setShowReviewForm(false);
      setNewReview({ rating: 5, comment: '', patient_name: '' });
      fetchDoctorProfile(); // Refresh reviews
    } catch (error) {
      toast.error(t('فشل في إرسال التقييم', 'Failed to submit review'));
    }
  };

  const shareUrl = window.location.href;
  
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success(t('تم نسخ الرابط', 'Link copied'));
  };

  const specialtyLabels = {
    cardiology: { ar: 'أمراض القلب', en: 'Cardiology' },
    pediatrics: { ar: 'طب الأطفال', en: 'Pediatrics' },
    general: { ar: 'طب عام', en: 'General Medicine' },
    dermatology: { ar: 'الجلدية', en: 'Dermatology' },
    orthopedics: { ar: 'العظام', en: 'Orthopedics' },
    dentistry: { ar: 'طب الأسنان', en: 'Dentistry' },
    ophthalmology: { ar: 'العيون', en: 'Ophthalmology' },
    gynecology: { ar: 'النسائية', en: 'Gynecology' },
    neurology: { ar: 'الأعصاب', en: 'Neurology' },
    internal: { ar: 'الباطنية', en: 'Internal Medicine' },
  };

  const getSpecialtyLabel = (spec) => {
    const label = specialtyLabels[spec];
    return label ? (language === 'ar' ? label.ar : label.en) : spec;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Stethoscope className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl">{t('الطبيب غير موجود', 'Doctor not found')}</h2>
          <Link to="/booking">
            <Button className="mt-4">{t('العودة للحجز', 'Back to Booking')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/booking" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            <span className="text-sm">{t('جميع الأطباء', 'All Doctors')}</span>
          </Link>
          
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Tebbi</span>
          </Link>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')}
            className="text-slate-400 hover:text-white"
          >
            <Globe className="w-4 h-4 me-1" />
            {language === 'ar' ? 'EN' : 'ع'}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Doctor Card */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border-2 border-white/10 overflow-hidden mb-8">
          {/* Cover */}
          <div className="h-32 bg-gradient-to-r from-teal-600/30 via-cyan-600/20 to-teal-600/30 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10"></div>
          </div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6 -mt-16 relative">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 border-4 border-slate-800 flex items-center justify-center shadow-2xl">
                {doctor.photo_base64 ? (
                  <img src={doctor.photo_base64} alt={doctor.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Stethoscope className="w-16 h-16 text-white" />
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 pt-4 md:pt-8">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {language === 'ar' ? doctor.name_ar || doctor.name : doctor.name}
                  </h1>
                  <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
                    {getSpecialtyLabel(doctor.specialty)}
                  </Badge>
                </div>
                
                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <Star 
                        key={i} 
                        className={`w-5 h-5 ${i <= Math.round(stats.average_rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-yellow-400 font-bold">{stats.average_rating}</span>
                  <span className="text-slate-500">({stats.review_count} {t('تقييم', 'reviews')})</span>
                </div>
                
                {/* Quick Info */}
                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                  {company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>{language === 'ar' ? company.name_ar || company.name : company.name}</span>
                    </div>
                  )}
                  {company?.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{language === 'ar' ? company.address_ar || company.address : company.address}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* CTA */}
              <div className="w-full md:w-auto md:pt-8">
                <Button 
                  size="lg"
                  onClick={() => setShowBooking(true)}
                  className="w-full md:w-auto bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-teal-500/25"
                  data-testid="book-now-btn"
                >
                  <Calendar className="w-5 h-5 me-2" />
                  {t('احجز موعدك الآن', 'Book Now')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bio */}
            {(doctor.bio || doctor.bio_ar) && (
              <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-teal-400" />
                  {t('نبذة عني', 'About Me')}
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  {language === 'ar' ? doctor.bio_ar || doctor.bio : doctor.bio}
                </p>
              </div>
            )}

            {/* Reviews */}
            <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal-400" />
                  {t('تقييمات المرضى', 'Patient Reviews')}
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowReviewForm(true)}
                  className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                  data-testid="add-review-btn"
                >
                  <Star className="w-4 h-4 me-1" />
                  {t('أضف تقييم', 'Add Review')}
                </Button>
              </div>
              
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('لا توجد تقييمات بعد', 'No reviews yet')}</p>
                  <p className="text-sm mt-1">{t('كن أول من يقيّم!', 'Be the first to review!')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-slate-900/50 rounded-xl p-4 border border-white/5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-teal-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{review.patient_name}</p>
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(i => (
                                <Star 
                                  key={i} 
                                  className={`w-3 h-3 ${i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} 
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        {review.is_verified && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle className="w-3 h-3 me-1" />
                            {t('موثق', 'Verified')}
                          </Badge>
                        )}
                      </div>
                      {review.comment && (
                        <p className="text-slate-300 text-sm mt-2">{review.comment}</p>
                      )}
                      {review.doctor_reply && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <p className="text-xs text-teal-400 mb-1">{t('رد الطبيب:', 'Doctor reply:')}</p>
                          <p className="text-slate-400 text-sm">{review.doctor_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Consultation Fee */}
            <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                {t('رسوم الكشف', 'Consultation Fee')}
              </h3>
              <div className="text-3xl font-bold text-emerald-400">
                {doctor.consultation_fee || 0}
                <span className="text-sm text-slate-500 ms-2">{t('ل.س', 'SYP')}</span>
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                {t('ساعات العمل', 'Working Hours')}
              </h3>
              <div className="space-y-2 text-sm">
                {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'].map(day => {
                  const hours = doctor.working_hours?.[day];
                  const dayNames = {
                    sunday: { ar: 'الأحد', en: 'Sunday' },
                    monday: { ar: 'الإثنين', en: 'Monday' },
                    tuesday: { ar: 'الثلاثاء', en: 'Tuesday' },
                    wednesday: { ar: 'الأربعاء', en: 'Wednesday' },
                    thursday: { ar: 'الخميس', en: 'Thursday' },
                  };
                  return (
                    <div key={day} className="flex justify-between text-slate-400">
                      <span>{language === 'ar' ? dayNames[day].ar : dayNames[day].en}</span>
                      <span className="text-white">
                        {hours ? `${hours.start} - ${hours.end}` : '09:00 - 17:00'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Share */}
            <div className="bg-slate-800/30 rounded-2xl border border-white/5 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-400" />
                {t('مشاركة', 'Share')}
              </h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(`https://facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank')}
                  className="border-white/10 hover:bg-blue-500/20 hover:border-blue-500/30"
                >
                  <Facebook className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}`, '_blank')}
                  className="border-white/10 hover:bg-sky-500/20 hover:border-sky-500/30"
                >
                  <Twitter className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => window.open(`https://linkedin.com/shareArticle?url=${shareUrl}`, '_blank')}
                  className="border-white/10 hover:bg-blue-600/20 hover:border-blue-600/30"
                >
                  <Linkedin className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyLink}
                  className="border-white/10 hover:bg-white/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Booking Dialog */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-400" />
              {t('حجز موعد', 'Book Appointment')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleBooking} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('التاريخ', 'Date')}</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-slate-800 border-white/10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('الوقت', 'Time')}</Label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-slate-800 border border-white/10 text-white"
                  required
                >
                  <option value="">{t('اختر', 'Select')}</option>
                  {availableSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t('اسمك الكامل', 'Your Full Name')}</Label>
              <Input
                value={patientInfo.patient_name}
                onChange={(e) => setPatientInfo({...patientInfo, patient_name: e.target.value})}
                className="bg-slate-800 border-white/10"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('رقم الهاتف', 'Phone Number')}</Label>
              <Input
                value={patientInfo.patient_phone}
                onChange={(e) => setPatientInfo({...patientInfo, patient_phone: e.target.value})}
                className="bg-slate-800 border-white/10"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('البريد الإلكتروني (اختياري)', 'Email (optional)')}</Label>
              <Input
                type="email"
                value={patientInfo.patient_email}
                onChange={(e) => setPatientInfo({...patientInfo, patient_email: e.target.value})}
                className="bg-slate-800 border-white/10"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('سبب الزيارة', 'Reason for Visit')}</Label>
              <Textarea
                value={patientInfo.reason}
                onChange={(e) => setPatientInfo({...patientInfo, reason: e.target.value})}
                className="bg-slate-800 border-white/10"
                rows={3}
              />
            </div>
            
            <Button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-cyan-600">
              <Send className="w-4 h-4 me-2" />
              {t('تأكيد الحجز', 'Confirm Booking')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              {t('أضف تقييمك', 'Add Your Review')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('التقييم', 'Rating')}</Label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNewReview({...newReview, rating: i})}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-8 h-8 ${i <= newReview.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} 
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t('اسمك', 'Your Name')}</Label>
              <Input
                value={newReview.patient_name}
                onChange={(e) => setNewReview({...newReview, patient_name: e.target.value})}
                className="bg-slate-800 border-white/10"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('تعليقك (اختياري)', 'Your Comment (optional)')}</Label>
              <Textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                placeholder={t('شاركنا تجربتك...', 'Share your experience...')}
                className="bg-slate-800 border-white/10"
                rows={4}
              />
            </div>
            
            <Button type="submit" className="w-full bg-gradient-to-r from-yellow-500 to-amber-600">
              <Send className="w-4 h-4 me-2" />
              {t('إرسال التقييم', 'Submit Review')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2026 Tebbi - {t('نظام إدارة العيادات', 'Clinic Management System')}</p>
        </div>
      </footer>
    </div>
  );
};

export default DoctorProfilePage;

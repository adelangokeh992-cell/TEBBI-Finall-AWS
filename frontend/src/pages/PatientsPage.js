import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { patientsAPI, referenceAPI, invoicesAPI } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Search, Phone, Droplet, ArrowRight, ArrowLeft, AlertCircle, Baby, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageEmptyState, LoadingSpinner } from '../components/common';

const PatientsPage = () => {
  const { t, language, isRTL } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(searchParams.get('new') === 'true');
  const [allergiesList, setAllergiesList] = useState([]);
  const [patientInvoices, setPatientInvoices] = useState({});
  
  const [formData, setFormData] = useState({
    name: '', name_ar: '', national_id: '', date_of_birth: '',
    gender: '', phone: '', address: '', blood_type: '',
    height_cm: '', weight_kg: '', chronic_conditions: '',
    is_pregnant: false, pregnancy_weeks: '',
    initial_allergies: []
  });

  useEffect(() => { 
    fetchPatients();
    fetchAllergies();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await patientsAPI.getAll(search);
      setPatients(res.data);
      // Fetch invoice status for each patient
      const invoicePromises = res.data.map(p => 
        invoicesAPI.getByPatient(p.id).then(inv => ({ id: p.id, ...inv.data.summary })).catch(() => null)
      );
      const invoiceResults = await Promise.all(invoicePromises);
      const invoiceMap = {};
      invoiceResults.forEach(r => { if (r) invoiceMap[r.id] = r; });
      setPatientInvoices(invoiceMap);
    } catch (e) { toast.error(t('فشل', 'Failed')); }
    finally { setLoading(false); }
  };

  const fetchAllergies = async () => {
    try {
      const res = await referenceAPI.getAllergies();
      const all = [...(res.data.common || []), ...(res.data.custom || [])];
      setAllergiesList(all);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '' && formData[key] !== null && formData[key] !== false) {
          if (key === 'height_cm' || key === 'weight_kg' || key === 'pregnancy_weeks') {
            if (formData[key]) data[key] = parseFloat(formData[key]);
          } else if (key === 'initial_allergies') {
            if (formData[key].length > 0) data[key] = formData[key];
          } else {
            data[key] = formData[key];
          }
        }
      });
      await patientsAPI.create(data);
      toast.success(t('تمت الإضافة', 'Added'));
      setShowNewDialog(false);
      resetForm();
      fetchPatients();
    } catch (e) { toast.error(t('فشل', 'Failed')); }
  };

  const resetForm = () => {
    setFormData({
      name: '', name_ar: '', national_id: '', date_of_birth: '',
      gender: '', phone: '', address: '', blood_type: '',
      height_cm: '', weight_kg: '', chronic_conditions: '',
      is_pregnant: false, pregnancy_weeks: '',
      initial_allergies: []
    });
  };

  const handleAllergyToggle = (allergyId) => {
    const current = formData.initial_allergies || [];
    if (current.includes(allergyId)) {
      setFormData({ ...formData, initial_allergies: current.filter(a => a !== allergyId) });
    } else {
      setFormData({ ...formData, initial_allergies: [...current, allergyId] });
    }
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const isRtl = language === 'ar';

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const pregnancyMonth = (weeks) => {
    if (weeks == null || weeks === undefined) return null;
    return Math.round(Number(weeks) / 4.33);
  };

  return (
    <div className="space-y-6" data-testid="patients-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('المرضى', 'Patients')}
        description={t('إدارة سجلات المرضى', 'Manage patient records')}
        icon={Users}
        actions={
          <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="add-patient-btn">
                <Plus className="w-4 h-4" />{t('مريض جديد', 'New Patient')}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t('إضافة مريض', 'Add Patient')}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name (EN)</Label>
                  <Input data-testid="patient-name-en" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div>
                  <Label>Name (AR)</Label>
                  <Input data-testid="patient-name-ar" value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} dir="rtl" />
                </div>
                <div>
                  <Label>{t('رقم الهوية', 'ID')}</Label>
                  <Input value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} />
                </div>
                <div>
                  <Label>{t('تاريخ الميلاد', 'DOB')}</Label>
                  <Input type="date" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} />
                </div>
                <div>
                  <Label>{t('الجنس', 'Gender')}</Label>
                  <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v, is_pregnant: false, pregnancy_weeks: ''})}>
                    <SelectTrigger><SelectValue placeholder={t('اختر', 'Select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('ذكر', 'Male')}</SelectItem>
                      <SelectItem value="female">{t('أنثى', 'Female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('الهاتف', 'Phone')}</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <Label>{t('فصيلة الدم', 'Blood')}</Label>
                  <Select value={formData.blood_type} onValueChange={v => setFormData({...formData, blood_type: v})}>
                    <SelectTrigger><SelectValue placeholder={t('اختر', 'Select')} /></SelectTrigger>
                    <SelectContent>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('الطول (سم)', 'Height cm')}</Label>
                  <Input type="number" value={formData.height_cm} onChange={e => setFormData({...formData, height_cm: e.target.value})} />
                </div>
                <div>
                  <Label>{t('الوزن (كغ)', 'Weight kg')}</Label>
                  <Input type="number" value={formData.weight_kg} onChange={e => setFormData({...formData, weight_kg: e.target.value})} />
                </div>
              </div>

              {/* Pregnancy Section - Only for females */}
              {formData.gender === 'female' && (
                <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Baby className="w-5 h-5 text-pink-600" />
                    <Label className="text-pink-700 dark:text-pink-300 font-medium">{t('معلومات الحمل', 'Pregnancy Info')}</Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="pregnant" 
                        checked={formData.is_pregnant}
                        onCheckedChange={(checked) => setFormData({...formData, is_pregnant: checked, pregnancy_weeks: checked ? formData.pregnancy_weeks : ''})}
                      />
                      <Label htmlFor="pregnant">{t('حامل', 'Pregnant')}</Label>
                    </div>
                    {formData.is_pregnant && (
                      <div className="flex items-center gap-2">
                        <Label>{t('الأسبوع', 'Week')}</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          max="42"
                          className="w-20"
                          value={formData.pregnancy_weeks} 
                          onChange={e => setFormData({...formData, pregnancy_weeks: e.target.value})}
                          placeholder="1-42"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Allergies Section */}
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <Label className="text-red-700 dark:text-red-300 font-medium">{t('الحساسيات', 'Allergies')}</Label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {allergiesList.map(allergy => (
                    <div key={allergy.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`allergy-${allergy.id}`}
                        checked={(formData.initial_allergies || []).includes(allergy.id)}
                        onCheckedChange={() => handleAllergyToggle(allergy.id)}
                      />
                      <Label htmlFor={`allergy-${allergy.id}`} className="text-sm cursor-pointer">
                        {language === 'ar' ? allergy.name_ar : allergy.name_en}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>{t('الحالات المزمنة', 'Chronic Conditions')}</Label>
                <Textarea value={formData.chronic_conditions} onChange={e => setFormData({...formData, chronic_conditions: e.target.value})} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowNewDialog(false); resetForm(); }}>
                  {t('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" className="bg-teal-600" data-testid="save-patient-btn">
                  {t('حفظ', 'Save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      <form onSubmit={e => { e.preventDefault(); fetchPatients(); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('بحث...', 'Search...')} className="ps-10" />
        </div>
        <Button type="submit" variant="outline">{t('بحث', 'Search')}</Button>
      </form>

      {loading ? (
        <LoadingSpinner />
      ) : patients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p, i) => {
            const name = language === 'ar' ? (p.name_ar || p.name) : p.name;
            const invoiceInfo = patientInvoices[p.id];
            const hasPending = invoiceInfo?.has_pending;
            const age = getAge(p.date_of_birth);
            const lastVisit = p.last_visit_date ? new Date(p.last_visit_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
            const pregMonth = p.is_pregnant && p.pregnancy_weeks != null ? pregnancyMonth(p.pregnancy_weeks) : null;
            return (
              <Card 
                key={p.id} 
                className={`rounded-xl border-2 hover:border-teal-300 hover:shadow-lg transition-all cursor-pointer group ${hasPending ? 'border-orange-300' : ''}`} 
                onClick={() => navigate('/patients/' + p.id)} 
                data-testid={'patient-card-' + i}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xl font-bold">
                        {name ? name[0].toUpperCase() : 'P'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{name}</h3>
                        {p.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</p>}
                      </div>
                    </div>
                    <ArrowIcon className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    {lastVisit && (
                      <span className="flex items-center gap-1" title={t('آخر زيارة', 'Last visit')}>
                        <Calendar className="w-4 h-4" />
                        {lastVisit}
                      </span>
                    )}
                    {age != null && (
                      <span className="flex items-center gap-1" title={t('العمر', 'Age')}>
                        <User className="w-4 h-4" />
                        {age} {t('سنة', 'y')}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {p.blood_type && <Badge variant="outline" className="gap-1"><Droplet className="w-3 h-3 text-red-500" />{p.blood_type}</Badge>}
                    {p.gender && <Badge variant="secondary">{p.gender === 'male' ? t('ذكر', 'M') : t('أنثى', 'F')}</Badge>}
                    {p.is_pregnant && (
                      <Badge className="bg-pink-500 gap-1">
                        <Baby className="w-3 h-3" />
                        {t('حامل', 'Pregnant')}
                        {pregMonth != null ? ` - ${t('الشهر', 'Month')} ${pregMonth}` : p.pregnancy_weeks != null ? ` ${p.pregnancy_weeks}${t('أ', 'w')}` : ''}
                      </Badge>
                    )}
                    {hasPending && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t('مستحق', 'Due')}: {invoiceInfo.total_pending?.toFixed(0)}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <PageEmptyState
          icon={Users}
          message={t('لا يوجد مرضى', 'No patients')}
          actionLabel={t('مريض جديد', 'New Patient')}
          onAction={() => setShowNewDialog(true)}
          dir={isRtl ? 'rtl' : 'ltr'}
        />
      )}
    </div>
  );
};

export default PatientsPage;

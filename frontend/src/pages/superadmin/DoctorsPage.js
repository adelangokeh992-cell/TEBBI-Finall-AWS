import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, usersAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Stethoscope, Search, Building2, Mail, Sparkles, 
  Phone, Edit2, Filter, X, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

const DoctorsPage = () => {
  const { t, language, isRTL } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  
  // Edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    name_ar: '',
    specialty: '',
    consultation_fee: 0,
    phone: '',
    company_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [doctorsRes, companiesRes] = await Promise.all([
        usersAPI.getAll({ role: 'doctor' }),
        adminAPI.listCompanies()
      ]);
      
      const doctorsList = doctorsRes.data || [];
      setDoctors(Array.isArray(doctorsList) ? doctorsList : []);
      
      const companiesList = companiesRes.data.companies || companiesRes.data || [];
      setCompanies(Array.isArray(companiesList) ? companiesList : []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const specialties = [
    { value: 'cardiology', ar: 'قلب', en: 'Cardiology' },
    { value: 'pediatrics', ar: 'أطفال', en: 'Pediatrics' },
    { value: 'general', ar: 'عام', en: 'General' },
    { value: 'dermatology', ar: 'جلدية', en: 'Dermatology' },
    { value: 'orthopedics', ar: 'عظام', en: 'Orthopedics' },
    { value: 'dentistry', ar: 'أسنان', en: 'Dentistry' },
    { value: 'ophthalmology', ar: 'عيون', en: 'Ophthalmology' },
    { value: 'gynecology', ar: 'نسائية', en: 'Gynecology' },
    { value: 'neurology', ar: 'أعصاب', en: 'Neurology' },
    { value: 'internal', ar: 'داخلية', en: 'Internal Medicine' },
  ];

  const getSpecialtyLabel = (value) => {
    const spec = specialties.find(s => s.value === value);
    return spec ? (language === 'ar' ? spec.ar : spec.en) : value;
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company ? (language === 'ar' ? company.name_ar || company.name : company.name) : '-';
  };

  // Get unique specialties from doctors
  const uniqueSpecialties = [...new Set(doctors.map(d => d.specialty).filter(Boolean))];

  const filteredDoctors = doctors.filter(d => {
    const matchesSearch = 
      d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.name_ar?.includes(searchTerm) ||
      d.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSpecialty = filterSpecialty === 'all' || d.specialty === filterSpecialty;
    const matchesCompany = filterCompany === 'all' || d.company_id === filterCompany;
    
    return matchesSearch && matchesSpecialty && matchesCompany;
  });

  const openEditDialog = (doctor) => {
    setEditingDoctor(doctor);
    setEditForm({
      name: doctor.name || '',
      name_ar: doctor.name_ar || '',
      specialty: doctor.specialty || '',
      consultation_fee: doctor.consultation_fee || 0,
      phone: doctor.phone || '',
      company_id: doctor.company_id || ''
    });
    setEditDialog(true);
  };

  const handleEditSubmit = async () => {
    try {
      await usersAPI.update(editingDoctor.id, editForm);
      toast.success(t('تم التحديث بنجاح', 'Updated successfully'));
      setEditDialog(false);
      fetchData();
    } catch (error) {
      toast.error(t('فشل في التحديث', 'Failed to update'));
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterSpecialty('all');
    setFilterCompany('all');
  };

  const hasActiveFilters = searchTerm || filterSpecialty !== 'all' || filterCompany !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="doctors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('الأطباء', 'Doctors')}</h1>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <span>{t('جميع الأطباء المسجلين في النظام', 'All registered doctors')}</span>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              {doctors.length}
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-[#12121a] border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">{t('الفلاتر', 'Filters')}</span>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="ms-auto text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <X className="w-4 h-4 me-1" />
              {t('مسح الفلاتر', 'Clear Filters')}
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500`} />
            <Input 
              placeholder={t('بحث بالاسم أو البريد...', 'Search by name or email...')} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className={`${isRTL ? 'pr-10' : 'pl-10'} bg-[#0a0a0f] border-white/10 focus:border-cyan-500/50 text-white placeholder:text-slate-500`}
              data-testid="search-doctors"
            />
          </div>

          {/* Specialty Filter */}
          <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
            <SelectTrigger 
              className="bg-[#0a0a0f] border-white/10 text-white"
              data-testid="filter-specialty"
            >
              <SelectValue placeholder={t('الاختصاص', 'Specialty')} />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a24] border-white/10">
              <SelectItem value="all" className="text-white hover:bg-white/5">
                {t('جميع الاختصاصات', 'All Specialties')}
              </SelectItem>
              {uniqueSpecialties.map(spec => (
                <SelectItem key={spec} value={spec} className="text-white hover:bg-white/5">
                  {getSpecialtyLabel(spec)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Company Filter */}
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger 
              className="bg-[#0a0a0f] border-white/10 text-white"
              data-testid="filter-company"
            >
              <SelectValue placeholder={t('العيادة/المشفى', 'Clinic/Hospital')} />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a24] border-white/10">
              <SelectItem value="all" className="text-white hover:bg-white/5">
                {t('جميع العيادات', 'All Clinics')}
              </SelectItem>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id} className="text-white hover:bg-white/5">
                  {language === 'ar' ? company.name_ar || company.name : company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <div className="text-sm text-slate-400">
          {t('عرض', 'Showing')} <span className="text-cyan-400 font-bold">{filteredDoctors.length}</span> {t('من', 'of')} {doctors.length} {t('أطباء', 'doctors')}
        </div>
      )}

      {/* Doctors Grid */}
      {filteredDoctors.length === 0 ? (
        <div className="rounded-2xl bg-[#12121a] border border-white/5 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-slate-400">{t('لا يوجد أطباء', 'No doctors found')}</p>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="mt-4 text-cyan-400 hover:text-cyan-300"
            >
              {t('مسح الفلاتر وعرض الكل', 'Clear filters and show all')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDoctors.map((doc) => (
            <div 
              key={doc.id} 
              className="group rounded-2xl bg-[#12121a] border border-white/5 p-5 hover:border-cyan-500/30 transition-all duration-300"
              data-testid={`doctor-card-${doc.id}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Stethoscope className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">
                      {language === 'ar' ? doc.name_ar || doc.name : doc.name}
                    </h3>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mt-1">
                      {getSpecialtyLabel(doc.specialty)}
                    </Badge>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(doc)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                  data-testid={`edit-doctor-${doc.id}`}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-400">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>{getCompanyName(doc.company_id)}</span>
                </div>
                {doc.email && (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="truncate">{doc.email}</span>
                  </div>
                )}
                {doc.phone && (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span>{doc.phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-slate-500">{t('سعر الكشفية', 'Consultation Fee')}</span>
                  <span className="font-bold text-cyan-400 text-lg">
                    {doc.consultation_fee || 0} 
                    <span className="text-xs text-slate-500 ms-1">{t('ل.س', 'SYP')}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="bg-[#12121a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {t('تعديل بيانات الطبيب', 'Edit Doctor')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (إنجليزي)', 'Name (English)')}</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="bg-[#0a0a0f] border-white/10 text-white"
                  data-testid="edit-doctor-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">{t('الاسم (عربي)', 'Name (Arabic)')}</Label>
                <Input
                  value={editForm.name_ar}
                  onChange={(e) => setEditForm({...editForm, name_ar: e.target.value})}
                  className="bg-[#0a0a0f] border-white/10 text-white"
                  dir="rtl"
                  data-testid="edit-doctor-name-ar"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">{t('الاختصاص', 'Specialty')}</Label>
              <Select 
                value={editForm.specialty} 
                onValueChange={(v) => setEditForm({...editForm, specialty: v})}
              >
                <SelectTrigger className="bg-[#0a0a0f] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a24] border-white/10">
                  {specialties.map(spec => (
                    <SelectItem key={spec.value} value={spec.value} className="text-white hover:bg-white/5">
                      {language === 'ar' ? spec.ar : spec.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">{t('العيادة/المشفى', 'Clinic/Hospital')}</Label>
              <Select 
                value={editForm.company_id} 
                onValueChange={(v) => setEditForm({...editForm, company_id: v})}
              >
                <SelectTrigger className="bg-[#0a0a0f] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a24] border-white/10">
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id} className="text-white hover:bg-white/5">
                      {language === 'ar' ? company.name_ar || company.name : company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">{t('رقم الهاتف', 'Phone')}</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                className="bg-[#0a0a0f] border-white/10 text-white"
                data-testid="edit-doctor-phone"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                {t('سعر الكشفية', 'Consultation Fee')}
              </Label>
              <Input
                type="number"
                value={editForm.consultation_fee}
                onChange={(e) => setEditForm({...editForm, consultation_fee: parseInt(e.target.value) || 0})}
                className="bg-[#0a0a0f] border-white/10 text-white"
                data-testid="edit-doctor-fee"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialog(false)} className="text-slate-400">
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button 
              onClick={handleEditSubmit}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              data-testid="save-doctor-edit"
            >
              {t('حفظ التغييرات', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorsPage;

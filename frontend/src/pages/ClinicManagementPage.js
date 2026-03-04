import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { companiesAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Users, Stethoscope, Clock, Mail, Trash2, Plus, Edit, Check, Loader2
} from 'lucide-react';
import { PageHeader, LoadingSpinner } from '../components/common';

const ClinicManagementPage = () => {
  const { user, t, language } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffDetailTab, setStaffDetailTab] = useState('profile');
  const [editForm, setEditForm] = useState({});
  const [savingStaff, setSavingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '', name_ar: '', email: '', phone: '', password: '',
    role: 'doctor', specialty: '', consultation_fee: ''
  });

  const companyId = user?.company_id;

  const roles = [
    { value: 'company_admin', label: t('مدير العيادة', 'Clinic Admin') },
    { value: 'doctor', label: t('طبيب', 'Doctor') },
    { value: 'nurse', label: t('ممرض/ة', 'Nurse') },
    { value: 'receptionist', label: t('موظف استقبال', 'Receptionist') },
    { value: 'accountant', label: t('محاسب', 'Accountant') },
  ];

  const specialties = [
    { value: 'general', label: t('طب عام', 'General') },
    { value: 'cardiology', label: t('قلب', 'Cardiology') },
    { value: 'pediatrics', label: t('أطفال', 'Pediatrics') },
    { value: 'dermatology', label: t('جلدية', 'Dermatology') },
    { value: 'orthopedics', label: t('عظام', 'Orthopedics') },
    { value: 'dentistry', label: t('أسنان', 'Dentistry') },
    { value: 'ophthalmology', label: t('عيون', 'Ophthalmology') },
    { value: 'gynecology', label: t('نسائية', 'Gynecology') },
  ];

  useEffect(() => {
    if (companyId) {
      fetchStaff();
    } else {
      setLoading(false);
    }
  }, [companyId]);

  const fetchStaff = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const staffRes = await companiesAPI.getStaff(companyId);
      const staffData = staffRes.data?.staff ?? staffRes.data ?? [];
      setStaff(Array.isArray(staffData) ? staffData : []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error(t('فشل في تحميل الموظفين', 'Failed to load staff'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await companiesAPI.addStaff(companyId, {
        ...newStaff,
        company_id: companyId,
        consultation_fee: parseFloat(newStaff.consultation_fee) || 0
      });
      toast.success(t('تم إضافة الموظف', 'Staff added'));
      setShowAddStaff(false);
      setNewStaff({ name: '', name_ar: '', email: '', phone: '', password: '', role: 'doctor', specialty: '', consultation_fee: '' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('فشل في الإضافة', 'Failed to add'));
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذا الموظف؟', 'Delete this staff member?'))) return;
    try {
      await companiesAPI.deleteStaff(companyId, staffId);
      toast.success(t('تم الحذف', 'Deleted'));
      fetchStaff();
    } catch (error) {
      toast.error(t('فشل في الحذف', 'Failed to delete'));
    }
  };

  const handleSaveWorkingHours = async (staffId, workingHours) => {
    try {
      await companiesAPI.updateStaff(companyId, staffId, { working_hours: workingHours });
      toast.success(t('تم حفظ ساعات العمل', 'Working hours saved'));
      fetchStaff();
      if (selectedStaff?.id === staffId) setSelectedStaff(s => s ? { ...s, working_hours: workingHours } : null);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('فشل في الحفظ', 'Failed to save'));
    }
  };

  const openStaffDetail = (member) => {
    setSelectedStaff(member);
    setStaffDetailTab('profile');
    setEditForm({
      name: member.name || '',
      name_ar: member.name_ar || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'doctor',
      specialty: member.specialty || '',
      consultation_fee: member.consultation_fee != null ? String(member.consultation_fee) : '',
    });
  };

  const handleSaveProfile = async () => {
    if (!selectedStaff) return;
    setSavingStaff(true);
    try {
      const payload = {
        name: editForm.name,
        name_ar: editForm.name_ar || undefined,
        email: editForm.email,
        phone: editForm.phone || undefined,
        role: editForm.role,
        specialty: editForm.specialty || undefined,
        consultation_fee: editForm.consultation_fee ? parseFloat(editForm.consultation_fee) : undefined,
      };
      await companiesAPI.updateStaff(companyId, selectedStaff.id, payload);
      toast.success(t('تم حفظ البيانات', 'Profile saved'));
      fetchStaff();
      setSelectedStaff(s => s ? { ...s, ...payload } : null);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('فشل في الحفظ', 'Failed to save'));
    } finally {
      setSavingStaff(false);
    }
  };

  const handleSaveUnavailable = async (ranges) => {
    if (!selectedStaff) return;
    try {
      await companiesAPI.updateStaff(companyId, selectedStaff.id, { unavailable_ranges: ranges });
      toast.success(t('تم حفظ فترات عدم التوفر', 'Unavailable periods saved'));
      fetchStaff();
      setSelectedStaff(s => s ? { ...s, unavailable_ranges: ranges } : null);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('فشل في الحفظ', 'Failed to save'));
    }
  };

  const formatWorkingHoursSummary = (working_hours) => {
    if (!working_hours || typeof working_hours !== 'object') return t('غير مضبوطة', 'Not set');
    const days = Object.keys(working_hours).filter(d => working_hours[d]?.start && working_hours[d]?.end);
    if (days.length === 0) return t('غير مضبوطة', 'Not set');
    const first = working_hours[days[0]];
    const same = days.every(d => working_hours[d].start === first.start && working_hours[d].end === first.end);
    if (same && days.length >= 5) return `${first.start}-${first.end}`;
    return t('مضبوطة', 'Set');
  };

  if (loading && staff.length === 0) {
    return <LoadingSpinner className="min-h-[50vh]" />;
  }

  const isRtl = language === 'ar';

  return (
    <div className="space-y-6" data-testid="clinic-management-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <PageHeader
        title={t('الموظفين', 'Staff')}
        description={t('إدارة موظفي العيادة — انقر على الموظف لتعديل بياناته وساعات العمل وفترات عدم التوفر', 'Manage clinic staff — click a staff member to edit profile, working hours and unavailable periods')}
        icon={Users}
        dir={isRtl ? 'rtl' : 'ltr'}
      />

      <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{t('الموظفين', 'Staff Members')}</CardTitle>
                  <CardDescription>{t('إدارة موظفي العيادة — انقر على الموظف لتعديل بياناته وساعات العمل وفترات عدم التوفر', 'Manage clinic staff — click a staff member to edit profile, working hours and unavailable periods')}</CardDescription>
                </div>
                <Button onClick={() => setShowAddStaff(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('إضافة موظف', 'Add Staff')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {staff.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('لا يوجد موظفين', 'No staff members')}</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staff.map((member) => (
                    <Card
                      key={member.id}
                      className="border cursor-pointer hover:border-teal-400 hover:shadow-md transition-all"
                      data-testid={`staff-${member.id}`}
                      onClick={() => openStaffDetail(member)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                              member.role === 'doctor' ? 'bg-teal-100 text-teal-700' :
                              member.role === 'nurse' ? 'bg-pink-100 text-pink-700' :
                              member.role === 'company_admin' ? 'bg-purple-100 text-purple-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {member.role === 'doctor' ? <Stethoscope className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold truncate">{language === 'ar' ? member.name_ar || member.name : member.name}</h4>
                              <Badge variant="outline" className="mt-1">
                                {roles.find(r => r.value === member.role)?.label || member.role}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteStaff(member.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground space-y-1">
                          <p className="flex items-center gap-1 truncate">
                            <Mail className="w-4 h-4 shrink-0" />
                            {member.email}
                          </p>
                          {member.specialty && (
                            <p className="flex items-center gap-2 flex-wrap">
                              <span>{t('التخصص:', 'Specialty:')} {specialties.find(s => s.value === member.specialty)?.label || member.specialty}</span>
                              <span className="text-xs">• {t('ساعات العمل:', 'Hours:')} {formatWorkingHoursSummary(member.working_hours)}</span>
                            </p>
                          )}
                          {!member.specialty && (member.role === 'doctor' || member.working_hours) && (
                            <p className="text-xs">{t('ساعات العمل:', 'Hours:')} {formatWorkingHoursSummary(member.working_hours)}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('إضافة موظف جديد', 'Add New Staff')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('الاسم (English)', 'Name (EN)')}</Label>
                <Input
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('الاسم (عربي)', 'Name (AR)')}</Label>
                <Input
                  value={newStaff.name_ar}
                  onChange={(e) => setNewStaff({...newStaff, name_ar: e.target.value})}
                  dir="rtl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('البريد', 'Email')}</Label>
                <Input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('كلمة المرور', 'Password')}</Label>
                <Input
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('الدور', 'Role')}</Label>
                <Select value={newStaff.role} onValueChange={(v) => setNewStaff({...newStaff, role: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newStaff.role === 'doctor' && (
                <div className="space-y-2">
                  <Label>{t('التخصص', 'Specialty')}</Label>
                  <Select value={newStaff.specialty} onValueChange={(v) => setNewStaff({...newStaff, specialty: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('اختر', 'Select')} />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddStaff(false)}>
                {t('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit">
                {t('إضافة', 'Add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Staff Detail Dialog — بيانات الموظف / ساعات العمل / غير متاح من و الى */}
      <Dialog open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedStaff && (language === 'ar' ? selectedStaff.name_ar || selectedStaff.name : selectedStaff.name)}
            </DialogTitle>
            <CardDescription>{t('تعديل البيانات وساعات العمل وفترات عدم التوفر', 'Edit profile, working hours and unavailable periods')}</CardDescription>
          </DialogHeader>
          {selectedStaff && (
            <>
              <Tabs value={staffDetailTab} onValueChange={setStaffDetailTab} className="flex-1 overflow-hidden flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profile" className="gap-1">{t('بيانات الموظف', 'Profile')}</TabsTrigger>
                  <TabsTrigger value="working-hours" className="gap-1"><Clock className="w-4 h-4" /> {t('ساعات العمل', 'Working Hours')}</TabsTrigger>
                  <TabsTrigger value="unavailable" className="gap-1">{t('غير متاح من - إلى', 'Unavailable')}</TabsTrigger>
                </TabsList>
                <div className="flex-1 overflow-y-auto mt-4 min-h-0">
                  <TabsContent value="profile" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('الاسم (English)', 'Name (EN)')}</Label>
                        <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('الاسم (عربي)', 'Name (AR)')}</Label>
                        <Input value={editForm.name_ar} onChange={(e) => setEditForm(f => ({ ...f, name_ar: e.target.value }))} dir="rtl" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('البريد / اسم المستخدم', 'Email / Username')}</Label>
                      <Input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('رقم الجوال', 'Phone')}</Label>
                      <Input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+966..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('الدور', 'Role')}</Label>
                        <Select value={editForm.role} onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {roles.map(r => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      {editForm.role === 'doctor' && (
                        <div className="space-y-2">
                          <Label>{t('التخصص', 'Specialty')}</Label>
                          <Select value={editForm.specialty} onValueChange={(v) => setEditForm(f => ({ ...f, specialty: v }))}>
                            <SelectTrigger><SelectValue placeholder={t('اختر', 'Select')} /></SelectTrigger>
                            <SelectContent>
                              {specialties.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {editForm.role === 'doctor' && (
                      <div className="space-y-2">
                        <Label>{t('أجر الكشف', 'Consultation fee')}</Label>
                        <Input type="number" step="0.01" value={editForm.consultation_fee} onChange={(e) => setEditForm(f => ({ ...f, consultation_fee: e.target.value }))} placeholder="0" />
                      </div>
                    )}
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSaveProfile} disabled={savingStaff} className="gap-2">
                        {savingStaff ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('حفظ البيانات', 'Save profile')}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="working-hours" className="mt-0">
                    <WorkingHoursForm
                      initialHours={selectedStaff.working_hours || {}}
                      onSave={(hours) => handleSaveWorkingHours(selectedStaff.id, hours)}
                      onCancel={() => setSelectedStaff(null)}
                      t={t}
                    />
                  </TabsContent>
                  <TabsContent value="unavailable" className="mt-0">
                    <UnavailableForm
                      initialRanges={selectedStaff.unavailable_ranges || []}
                      onSave={handleSaveUnavailable}
                      t={t}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS_AR = { sunday: 'الأحد', monday: 'الإثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة', saturday: 'السبت' };
const DAY_LABELS_EN = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

function UnavailableForm({ initialRanges, onSave, t }) {
  const [ranges, setRanges] = useState(() => (initialRanges || []).map(r => ({ from: r.from || r.from_date || '', to: r.to || r.to_date || '' })));
  const addRow = () => setRanges(prev => [...prev, { from: '', to: '' }]);
  const removeRow = (i) => setRanges(prev => prev.filter((_, idx) => idx !== i));
  const setRange = (i, field, value) => setRanges(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const handleSave = () => {
    const valid = ranges.filter(r => r.from && r.to);
    onSave(valid);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('فترات عدم التوفر (إجازة أو غياب) — من تاريخ إلى تاريخ', 'Unavailable periods (leave or absence) — from date to date')}</p>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {ranges.map((r, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={r.from} onChange={(e) => setRange(i, 'from', e.target.value)} className="w-40" placeholder={t('من', 'From')} />
            <Input type="date" value={r.to} onChange={(e) => setRange(i, 'to', e.target.value)} className="w-40" placeholder={t('إلى', 'To')} />
            <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => removeRow(i)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1"><Plus className="w-4 h-4" />{t('إضافة فترة', 'Add period')}</Button>
        <Button onClick={handleSave}>{t('حفظ', 'Save')}</Button>
      </div>
    </div>
  );
}

function WorkingHoursForm({ initialHours, onSave, onCancel, t }) {
  const [hours, setHours] = useState(() => {
    const h = {};
    DAYS.forEach(day => {
      h[day] = initialHours[day] || { start: '09:00', end: '17:00' };
    });
    return h;
  });
  const handleChange = (day, field, value) => {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-2 max-h-80 overflow-y-auto">
        {DAYS.map(day => (
          <div key={day} className="grid grid-cols-3 gap-2 items-center">
            <Label className="capitalize">{t(DAY_LABELS_AR[day], DAY_LABELS_EN[day])}</Label>
            <Input type="time" value={hours[day]?.start || '09:00'} onChange={(e) => handleChange(day, 'start', e.target.value)} />
            <Input type="time" value={hours[day]?.end || '17:00'} onChange={(e) => handleChange(day, 'end', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>{t('إلغاء', 'Cancel')}</Button>
        <Button onClick={() => onSave(hours)}>{t('حفظ', 'Save')}</Button>
      </div>
    </div>
  );
}

export default ClinicManagementPage;

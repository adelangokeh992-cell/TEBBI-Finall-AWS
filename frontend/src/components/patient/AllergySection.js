import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { allergiesAPI, referenceAPI } from '../../services/api';

function AllergySection({ patientId, allergies, onRefresh, t, language }) {
  const [showDialog, setShowDialog] = useState(false);
  const [allergiesList, setAllergiesList] = useState([]);
  const [selectedAllergy, setSelectedAllergy] = useState('');
  const [customAllergen, setCustomAllergen] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [reaction, setReaction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetchAllergies();
  }, []);

  const fetchAllergies = async () => {
    try {
      const res = await referenceAPI.getAllergies();
      const all = [...(res.data.common || []), ...(res.data.custom || [])];
      setAllergiesList(all);
    } catch (e) { console.error(e); }
  };

  const filteredAllergies = allergiesList.filter(a => 
    a.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.name_en?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    let allergenName = '';
    
    if (showCustom) {
      if (!customAllergen.trim()) {
        toast.error(t('أدخل اسم الحساسية', 'Enter allergy name'));
        return;
      }
      // Add custom allergy to database
      try {
        const newAllergy = await referenceAPI.addAllergy({ 
          name_ar: customAllergen, 
          name_en: customAllergen 
        });
        allergenName = customAllergen;
        fetchAllergies();
      } catch (e) {
        allergenName = customAllergen;
      }
    } else {
      if (!selectedAllergy) {
        toast.error(t('اختر حساسية', 'Select allergy'));
        return;
      }
      const found = allergiesList.find(a => a.id === selectedAllergy);
      allergenName = language === 'ar' ? (found?.name_ar || found?.name_en) : (found?.name_en || found?.name_ar);
    }

    try {
      await allergiesAPI.create({ 
        patient_id: patientId, 
        allergen: allergenName, 
        severity, 
        reaction 
      });
      toast.success(t('تمت الإضافة', 'Added'));
      setShowDialog(false);
      resetForm();
      onRefresh();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const resetForm = () => {
    setSelectedAllergy('');
    setCustomAllergen('');
    setSeverity('moderate');
    setReaction('');
    setSearchTerm('');
    setShowCustom(false);
  };

  const handleDelete = (id) => {
    if (window.confirm(t('متأكد؟', 'Sure?'))) {
      allergiesAPI.delete(id).then(() => {
        toast.success(t('تم', 'Done'));
        onRefresh();
      });
    }
  };

  const getSeverityColor = (sev) => {
    switch(sev) {
      case 'severe': return 'destructive';
      case 'moderate': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">{t('الحساسيات', 'Allergies')}</CardTitle>
        <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-teal-600" data-testid="add-allergy-btn">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('إضافة حساسية', 'Add Allergy')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!showCustom ? (
                <>
                  <div>
                    <Label>{t('بحث عن حساسية', 'Search Allergy')}</Label>
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={t('ابحث...', 'Search...')}
                        className="ps-10"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                    {filteredAllergies.length > 0 ? filteredAllergies.map(a => (
                      <div 
                        key={a.id}
                        className={`p-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedAllergy === a.id ? 'bg-teal-100 dark:bg-teal-900' : ''}`}
                        onClick={() => setSelectedAllergy(a.id)}
                      >
                        {language === 'ar' ? a.name_ar : a.name_en}
                        <span className="text-xs text-muted-foreground ms-2">
                          ({language === 'ar' ? a.name_en : a.name_ar})
                        </span>
                      </div>
                    )) : (
                      <p className="text-center text-muted-foreground py-4">{t('لا توجد نتائج', 'No results')}</p>
                    )}
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setShowCustom(true)}>
                    {t('إضافة حساسية جديدة', 'Add Custom Allergy')}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>{t('اسم الحساسية', 'Allergy Name')}</Label>
                    <Input 
                      value={customAllergen}
                      onChange={e => setCustomAllergen(e.target.value)}
                      placeholder={t('أدخل اسم الحساسية', 'Enter allergy name')}
                      required
                    />
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setShowCustom(false)}>
                    {t('العودة للقائمة', 'Back to List')}
                  </Button>
                </>
              )}
              
              <div>
                <Label>{t('الشدة', 'Severity')}</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">{t('خفيفة', 'Mild')}</SelectItem>
                    <SelectItem value="moderate">{t('متوسطة', 'Moderate')}</SelectItem>
                    <SelectItem value="severe">{t('شديدة', 'Severe')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('التفاعل', 'Reaction')}</Label>
                <Textarea value={reaction} onChange={e => setReaction(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-teal-600">{t('حفظ', 'Save')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {allergies.length > 0 ? allergies.map((a, i) => (
          <div key={i} className="flex items-center justify-between p-3 mb-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200">
            <div>
              <p className="font-medium">{a.allergen}</p>
              {a.reaction && <p className="text-sm text-muted-foreground">{a.reaction}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getSeverityColor(a.severity)}>
                {a.severity === 'severe' ? t('شديدة', 'Severe') : a.severity === 'moderate' ? t('متوسطة', 'Moderate') : t('خفيفة', 'Mild')}
              </Badge>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        )) : (
          <p className="text-center text-muted-foreground py-4">{t('لا توجد حساسيات', 'No allergies')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default AllergySection;

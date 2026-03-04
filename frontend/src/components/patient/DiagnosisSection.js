import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { diagnosesAPI, referenceAPI } from '../../services/api';

function DiagnosisSection({ patientId, diagnoses, onRefresh, t, language }) {
  const [showDialog, setShowDialog] = useState(false);
  const [diagnosesList, setDiagnosesList] = useState([]);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
  const [customDiagnosis, setCustomDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetchDiagnoses();
  }, []);

  const fetchDiagnoses = async () => {
    try {
      const res = await referenceAPI.getDiagnoses();
      const all = [...(res.data.common || []), ...(res.data.custom || [])];
      setDiagnosesList(all);
    } catch (e) { console.error(e); }
  };

  const filteredDiagnoses = diagnosesList.filter(d => 
    d.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.name_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleDiagnosis = (diagId) => {
    if (selectedDiagnoses.includes(diagId)) {
      setSelectedDiagnoses(selectedDiagnoses.filter(d => d !== diagId));
    } else {
      setSelectedDiagnoses([...selectedDiagnoses, diagId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (showCustom && customDiagnosis.trim()) {
        // Add single custom diagnosis
        await diagnosesAPI.create({ 
          patient_id: patientId, 
          diagnosis: customDiagnosis, 
          notes 
        });
        // Also add to reference list
        try {
          await referenceAPI.addDiagnosis({ 
            name_ar: customDiagnosis, 
            name_en: customDiagnosis 
          });
          fetchDiagnoses();
        } catch (e) {}
      } else if (selectedDiagnoses.length > 0) {
        // Add multiple selected diagnoses
        for (const diagId of selectedDiagnoses) {
          const found = diagnosesList.find(d => d.id === diagId);
          const diagName = language === 'ar' 
            ? (found?.name_ar || found?.name_en) 
            : (found?.name_en || found?.name_ar);
          await diagnosesAPI.create({ 
            patient_id: patientId, 
            diagnosis: diagName,
            diagnosis_code: found?.id,
            notes: selectedDiagnoses.length === 1 ? notes : ''
          });
        }
      } else {
        toast.error(t('اختر تشخيص واحد على الأقل', 'Select at least one diagnosis'));
        return;
      }

      toast.success(t('تمت الإضافة', 'Added'));
      setShowDialog(false);
      resetForm();
      onRefresh();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const resetForm = () => {
    setSelectedDiagnoses([]);
    setCustomDiagnosis('');
    setNotes('');
    setSearchTerm('');
    setShowCustom(false);
  };

  const handleDelete = (id) => {
    if (window.confirm(t('متأكد؟', 'Sure?'))) {
      diagnosesAPI.delete(id).then(() => {
        toast.success(t('تم', 'Done'));
        onRefresh();
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">{t('التشخيصات', 'Diagnoses')}</CardTitle>
        <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-teal-600" data-testid="add-diagnosis-btn">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('إضافة تشخيص', 'Add Diagnosis')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!showCustom ? (
                <>
                  <div>
                    <Label>{t('بحث عن تشخيص (ICD-10)', 'Search Diagnosis (ICD-10)')}</Label>
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={t('ابحث بالاسم أو الكود...', 'Search by name or code...')}
                        className="ps-10"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto border rounded-lg p-2">
                    {filteredDiagnoses.length > 0 ? filteredDiagnoses.map(d => (
                      <div 
                        key={d.id}
                        className={`p-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 ${selectedDiagnoses.includes(d.id) ? 'bg-teal-100 dark:bg-teal-900' : ''}`}
                        onClick={() => handleToggleDiagnosis(d.id)}
                      >
                        <Checkbox 
                          checked={selectedDiagnoses.includes(d.id)}
                          onCheckedChange={() => handleToggleDiagnosis(d.id)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{language === 'ar' ? d.name_ar : d.name_en}</span>
                          <span className="text-xs text-muted-foreground ms-2">
                            [{d.id}] ({language === 'ar' ? d.name_en : d.name_ar})
                          </span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center text-muted-foreground py-4">{t('لا توجد نتائج', 'No results')}</p>
                    )}
                  </div>
                  {selectedDiagnoses.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedDiagnoses.map(id => {
                        const d = diagnosesList.find(x => x.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1">
                            {language === 'ar' ? d?.name_ar : d?.name_en}
                            <button type="button" onClick={() => handleToggleDiagnosis(id)} className="ms-1 hover:text-red-500">×</button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <Button type="button" variant="outline" className="w-full" onClick={() => setShowCustom(true)}>
                    {t('إضافة تشخيص جديد', 'Add Custom Diagnosis')}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>{t('اسم التشخيص', 'Diagnosis Name')}</Label>
                    <Input 
                      value={customDiagnosis}
                      onChange={e => setCustomDiagnosis(e.target.value)}
                      placeholder={t('أدخل اسم التشخيص', 'Enter diagnosis name')}
                      required
                    />
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setShowCustom(false)}>
                    {t('العودة للقائمة', 'Back to List')}
                  </Button>
                </>
              )}
              
              <div>
                <Label>{t('ملاحظات', 'Notes')}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-teal-600">{t('حفظ', 'Save')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {diagnoses.length > 0 ? diagnoses.map((d, i) => (
          <div key={i} className="flex items-center justify-between p-3 mb-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <p className="font-medium">{d.diagnosis}</p>
              {d.diagnosis_code && <Badge variant="outline" className="text-xs mt-1">{d.diagnosis_code}</Badge>}
              {d.notes && <p className="text-sm text-muted-foreground mt-1">{d.notes}</p>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        )) : (
          <p className="text-center text-muted-foreground py-4">{t('لا توجد تشخيصات', 'No diagnoses')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default DiagnosisSection;

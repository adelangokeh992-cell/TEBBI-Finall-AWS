import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Plus, X, Loader2, AlertTriangle, CheckCircle, HelpCircle, Activity, FileText } from 'lucide-react';
import { aiAPI } from '../../services/api';
import { toast } from 'sonner';

export default function SmartSymptomsDialog({ open, onOpenChange, patientId, patientName, onSaveToPatient, t, language }) {
  const [symptoms, setSymptoms] = useState([]);
  const [newSymptom, setNewSymptom] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  var commonSymptoms = language === 'ar' ? [
    'صداع', 'حرارة', 'سعال', 'ألم في البطن', 'غثيان', 'دوخة',
    'ضيق تنفس', 'ألم صدر', 'إرهاق', 'ألم مفاصل', 'طفح جلدي', 'إسهال'
  ] : [
    'Headache', 'Fever', 'Cough', 'Abdominal pain', 'Nausea', 'Dizziness',
    'Shortness of breath', 'Chest pain', 'Fatigue', 'Joint pain', 'Rash', 'Diarrhea'
  ];

  function addSymptom(s) {
    if (s && !symptoms.includes(s)) {
      setSymptoms(symptoms.concat([s]));
    }
    setNewSymptom('');
  }

  function removeSymptom(s) {
    setSymptoms(symptoms.filter(function(x) { return x !== s; }));
  }

  async function analyze() {
    if (symptoms.length === 0) {
      toast.error(t('أضف عرضاً واحداً على الأقل', 'Add at least one symptom'));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      var res = await aiAPI.smartSymptoms({
        symptoms: symptoms,
        patient_id: patientId,
        language: language
      });
      setResult(res.data);
    } catch (e) {
      var msg = e?.response?.data?.detail || t('فشل التحليل', 'Analysis failed');
      toast.error(typeof msg === 'string' ? msg : t('فشل التحليل', 'Analysis failed'));
    }
    setLoading(false);
  }

  function reset() {
    setSymptoms([]);
    setResult(null);
  }

  var isRtl = language === 'ar';
  return React.createElement(Dialog, { open: open, onOpenChange: onOpenChange },
    React.createElement(DialogContent, { className: 'max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl', dir: isRtl ? 'rtl' : 'ltr' },
      React.createElement(DialogHeader, { className: 'border-b pb-4' },
        React.createElement(DialogTitle, { className: 'flex items-center gap-2' },
          React.createElement(Stethoscope, { className: 'w-5 h-5 text-teal-600 shrink-0' }),
          t('تحليل الأعراض الذكي', 'Smart Symptom Analysis')
        )
      ),
      
      !result ? React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', null,
          React.createElement(Label, null, t('الأعراض الشائعة', 'Common Symptoms')),
          React.createElement('div', { className: 'flex flex-wrap gap-2 mt-2' },
            commonSymptoms.map(function(s) {
              var isSelected = symptoms.includes(s);
              return React.createElement(Badge, {
                key: s,
                variant: isSelected ? 'default' : 'outline',
                className: 'cursor-pointer ' + (isSelected ? 'bg-teal-600' : 'hover:bg-teal-50'),
                onClick: function() { isSelected ? removeSymptom(s) : addSymptom(s); }
              }, s);
            })
          )
        ),
        React.createElement('div', null,
          React.createElement(Label, null, t('أضف عرضاً آخر', 'Add another symptom')),
          React.createElement('div', { className: 'flex gap-2 mt-2' },
            React.createElement(Input, {
              value: newSymptom,
              onChange: function(e) { setNewSymptom(e.target.value); },
              onKeyPress: function(e) { if (e.key === 'Enter') addSymptom(newSymptom); },
              placeholder: t('اكتب العرض...', 'Type symptom...')
            }),
            React.createElement(Button, { onClick: function() { addSymptom(newSymptom); }, size: 'icon' },
              React.createElement(Plus, { className: 'w-4 h-4' })
            )
          )
        ),
        symptoms.length > 0 ? React.createElement('div', null,
          React.createElement(Label, null, t('الأعراض المختارة', 'Selected Symptoms')),
          React.createElement('div', { className: 'flex flex-wrap gap-2 mt-2' },
            symptoms.map(function(s) {
              return React.createElement(Badge, { key: s, className: 'bg-teal-600 gap-1' },
                s,
                React.createElement(X, { className: 'w-3 h-3 cursor-pointer', onClick: function() { removeSymptom(s); } })
              );
            })
          )
        ) : null,
        React.createElement(Button, {
          onClick: analyze,
          disabled: loading || symptoms.length === 0,
          className: 'w-full bg-teal-600 hover:bg-teal-700 h-11'
        },
          loading ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin me-2' }) : React.createElement(Activity, { className: 'w-4 h-4 me-2' }),
          t('تحليل الأعراض', 'Analyze Symptoms')
        )
      ) : React.createElement('div', { className: 'space-y-4' },
        result.primary_diagnosis ? React.createElement('div', { className: 'p-4 bg-teal-50 dark:bg-teal-950/30 rounded-xl border-2 border-teal-200 dark:border-teal-800' },
          React.createElement('h4', { className: 'font-bold text-teal-700 dark:text-teal-300 mb-2' }, t('التشخيص الأرجح', 'Primary Diagnosis')),
          React.createElement('p', { className: 'text-lg font-medium text-slate-800 dark:text-slate-100' }, result.primary_diagnosis.name),
          result.primary_diagnosis.probability ? React.createElement('div', { className: 'flex items-center gap-2 mt-1' },
            React.createElement(Badge, { variant: 'outline', className: 'text-xs' }, t('احتمال اقتراحي', 'Suggested probability') + ': ' + result.primary_diagnosis.probability)
          ) : null,
          result.primary_diagnosis.icd_code ? React.createElement(Badge, { variant: 'secondary', className: 'mt-1' }, result.primary_diagnosis.icd_code) : null
        ) : null,
        
        result.differential_diagnoses && result.differential_diagnoses.length > 0 ? React.createElement('div', { className: 'p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border-2 border-blue-200 dark:border-blue-800' },
          React.createElement('h4', { className: 'font-bold text-blue-700 dark:text-blue-300 mb-2' }, t('تشخيصات تفريقية', 'Differential Diagnoses')),
          React.createElement('ul', { className: 'space-y-2 list-disc text-slate-800 dark:text-slate-100 ' + (isRtl ? 'pr-4' : 'pl-4') },
            result.differential_diagnoses.map(function(d, i) {
              return React.createElement('li', { key: i, className: 'text-sm' },
                React.createElement('span', { className: 'font-medium' }, d.name),
                d.probability ? ' - ' + d.probability : '',
                d.reasoning ? React.createElement('p', { className: 'text-xs text-muted-foreground mt-0.5' }, d.reasoning) : null
              );
            })
          )
        ) : null,
        
        result.red_flags && result.red_flags.length > 0 ? React.createElement('div', { className: 'p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border-2 border-red-200 dark:border-red-800' },
          React.createElement('h4', { className: 'font-bold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2' },
            React.createElement(AlertTriangle, { className: 'w-4 h-4 shrink-0' }),
            t('علامات خطر', 'Red Flags')
          ),
          React.createElement('ul', { className: 'space-y-1 list-disc ' + (isRtl ? 'pr-4' : 'pl-4') },
            result.red_flags.map(function(f, i) { return React.createElement('li', { key: i, className: 'text-sm text-red-700 dark:text-red-300' }, '⚠️ ' + f); })
          )
        ) : null,
        
        result.follow_up_questions && result.follow_up_questions.length > 0 ? React.createElement('div', { className: 'p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border-2 border-amber-200 dark:border-amber-800' },
          React.createElement('h4', { className: 'font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2' },
            React.createElement(HelpCircle, { className: 'w-4 h-4 shrink-0' }),
            t('أسئلة إضافية', 'Follow-up Questions')
          ),
          React.createElement('ul', { className: 'space-y-1 list-disc text-slate-800 dark:text-slate-100 ' + (isRtl ? 'pr-4' : 'pl-4') },
            result.follow_up_questions.map(function(q, i) { return React.createElement('li', { key: i, className: 'text-sm' }, '❓ ' + q); })
          )
        ) : null,
        
        result.recommended_tests && result.recommended_tests.length > 0 ? React.createElement('div', { className: 'p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border-2 border-purple-200 dark:border-purple-800' },
          React.createElement('h4', { className: 'font-bold text-purple-700 dark:text-purple-300 mb-2' }, t('فحوصات مطلوبة', 'Recommended Tests')),
          React.createElement('ul', { className: 'space-y-1 list-disc text-slate-800 dark:text-slate-100 ' + (isRtl ? 'pr-4' : 'pl-4') },
            result.recommended_tests.map(function(r, i) { return React.createElement('li', { key: i, className: 'text-sm' }, '🔬 ' + r); })
          )
        ) : null,
        
        result.home_care && result.home_care.length > 0 ? React.createElement('div', { className: 'p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border-2 border-green-200 dark:border-green-800' },
          React.createElement('h4', { className: 'font-bold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2' },
            React.createElement(CheckCircle, { className: 'w-4 h-4 shrink-0' }),
            t('العناية المنزلية', 'Home Care')
          ),
          React.createElement('ul', { className: 'space-y-1 list-disc text-slate-800 dark:text-slate-100 ' + (isRtl ? 'pr-4' : 'pl-4') },
            result.home_care.map(function(c, i) { return React.createElement('li', { key: i, className: 'text-sm' }, '✓ ' + c); })
          )
        ) : null,
        
        React.createElement('div', { className: 'p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-xs text-muted-foreground' },
          '⚕️ ' + t('هذا تحليل مساعد ولا يغني عن الفحص السريري وقرار الطبيب.', 'This is assistive analysis only and does not replace clinical examination and physician decision.')
        ),
        patientId && onSaveToPatient ? React.createElement(Button, { variant: 'outline', size: 'sm', className: 'w-full gap-1', onClick: function() { onSaveToPatient(result); } },
          React.createElement(FileText, { className: 'w-4 h-4' }),
          t('حفظ في ملف المريض', 'Save to patient file')
        ) : null,
        React.createElement(Button, { onClick: reset, variant: 'outline', className: 'w-full' },
          t('تحليل جديد', 'New Analysis')
        )
      ),
      
      React.createElement(DialogFooter, null,
        React.createElement(Button, { variant: 'outline', onClick: function() { onOpenChange(false); } },
          t('إغلاق', 'Close')
        )
      )
    )
  );
}

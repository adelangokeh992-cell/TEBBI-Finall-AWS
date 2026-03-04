import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Brain, Loader2 } from 'lucide-react';

export default function AIAnalysisDialog(props) {
  var open = props.open;
  var onOpenChange = props.onOpenChange;
  var analyzing = props.analyzing;
  var result = props.result;
  var onRetry = props.onRetry;
  var t = props.t;

  function close() {
    onOpenChange(false);
  }

  function renderList(items) {
    if (!items || items.length === 0) return null;
    return React.createElement('ul', { className: 'text-sm space-y-1' },
      items.map(function(item, i) {
        return React.createElement('li', { key: i }, '• ' + item);
      })
    );
  }

  var stats = (result && result.data_analyzed) ? result.data_analyzed : {};

  return React.createElement(Dialog, { open: open, onOpenChange: onOpenChange },
    React.createElement(DialogContent, { className: 'max-w-3xl max-h-[85vh] overflow-y-auto' },
      React.createElement(DialogHeader, null,
        React.createElement(DialogTitle, { className: 'flex items-center gap-2' },
          React.createElement(Brain, { className: 'w-5 h-5 text-blue-600' }),
          t('تحليل AI الشامل', 'AI Analysis')
        )
      ),
      analyzing ? 
        React.createElement('div', { className: 'text-center py-12' },
          React.createElement(Loader2, { className: 'w-12 h-12 mx-auto animate-spin text-blue-600 mb-4' }),
          React.createElement('p', null, t('جاري التحليل...', 'Analyzing...'))
        ) :
      result ?
        React.createElement('div', { className: 'space-y-4' },
          React.createElement('div', { className: 'grid grid-cols-5 gap-2 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-center text-sm text-slate-800 dark:text-slate-100' },
            React.createElement('div', null, React.createElement('span', { className: 'font-bold text-blue-600 dark:text-blue-400' }, stats.visits_count || 0), React.createElement('br'), t('زيارات', 'Visits')),
            React.createElement('div', null, React.createElement('span', { className: 'font-bold text-amber-600 dark:text-amber-400' }, stats.allergies_count || 0), React.createElement('br'), t('حساسيات', 'Allergies')),
            React.createElement('div', null, React.createElement('span', { className: 'font-bold text-purple-600 dark:text-purple-400' }, stats.diagnoses_count || 0), React.createElement('br'), t('تشخيصات', 'Diagnoses')),
            React.createElement('div', null, React.createElement('span', { className: 'font-bold text-green-600 dark:text-green-400' }, stats.medications_count || 0), React.createElement('br'), t('أدوية', 'Meds')),
            React.createElement('div', null, React.createElement('span', { className: 'font-bold text-cyan-600 dark:text-cyan-400' }, stats.images_count || 0), React.createElement('br'), t('صور', 'Images'))
          ),
          result.summary ? React.createElement('div', { className: 'p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-blue-700 dark:text-blue-300' }, t('الملخص', 'Summary')),
            React.createElement('p', { className: 'text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap' }, result.summary)
          ) : null,
          result.analysis ? React.createElement('div', { className: 'p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-slate-800 dark:text-slate-100' }, t('التحليل', 'Analysis')),
            React.createElement('p', { className: 'text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap' }, result.analysis)
          ) : null,
          (result.risks && result.risks.length > 0) ? React.createElement('div', { className: 'p-4 bg-red-50 dark:bg-red-950/40 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-red-700 dark:text-red-300' }, t('المخاطر', 'Risks')),
            React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' }, result.risks.map(function(item, i) { return React.createElement('li', { key: i }, '• ', item); }))
          ) : null,
          (result.drug_interactions && result.drug_interactions.length > 0) ? React.createElement('div', { className: 'p-4 bg-orange-50 dark:bg-orange-950/40 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-orange-700 dark:text-orange-300' }, t('التداخلات الدوائية', 'Drug Interactions')),
            React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' }, result.drug_interactions.map(function(item, i) { return React.createElement('li', { key: i }, '• ', item); }))
          ) : null,
          (result.recommendations && result.recommendations.length > 0) ? React.createElement('div', { className: 'p-4 bg-green-50 dark:bg-green-950/40 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-green-700 dark:text-green-300' }, t('التوصيات', 'Recommendations')),
            React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' }, result.recommendations.map(function(item, i) { return React.createElement('li', { key: i }, '• ', item); }))
          ) : null,
          (result.patient_advice && result.patient_advice.length > 0) ? React.createElement('div', { className: 'p-4 bg-pink-50 dark:bg-pink-950/40 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-pink-700 dark:text-pink-300' }, t('نصائح للمريض', 'Patient Advice')),
            React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' }, result.patient_advice.map(function(item, i) { return React.createElement('li', { key: i }, '• ', item); }))
          ) : null,
          (result.follow_up && result.follow_up.length > 0) ? React.createElement('div', { className: 'p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg' },
            React.createElement('h4', { className: 'font-bold mb-2 text-blue-700 dark:text-blue-300' }, t('المتابعة', 'Follow-up')),
            React.createElement('ul', { className: 'text-sm text-slate-800 dark:text-slate-100 space-y-1' }, result.follow_up.map(function(item, i) { return React.createElement('li', { key: i }, '• ', item); }))
          ) : null,
          React.createElement('div', { className: 'p-3 bg-slate-100 rounded-lg text-center text-xs text-muted-foreground' },
            '⚕️ ' + t('هذا تحليل مساعد ولا يغني عن الفحص السريري وقرار الطبيب.', 'This is assistive analysis only and does not replace clinical examination and physician decision.')
          )
        ) :
        React.createElement('div', { className: 'text-center py-8' },
          React.createElement(Brain, { className: 'w-16 h-16 mx-auto text-muted-foreground opacity-30 mb-4' }),
          React.createElement('p', { className: 'text-muted-foreground' }, t('اضغط تحليل للبدء', 'Click analyze to start'))
        ),
      React.createElement(DialogFooter, null,
        React.createElement(Button, { variant: 'outline', onClick: close }, t('إغلاق', 'Close')),
        React.createElement(Button, { onClick: onRetry, disabled: analyzing, className: 'bg-blue-600 gap-2' },
          analyzing ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }) : React.createElement(Brain, { className: 'w-4 h-4' }),
          t('تحليل', 'Analyze')
        )
      )
    )
  );
}

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, AlertCircle, Info, Calendar, Pill, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { aiAPI } from '../../services/api';

export default function SmartAlertsPanel({ patientId, t, language }) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(function() {
    if (patientId) {
      fetchAlerts();
    }
  }, [patientId]);

  async function fetchAlerts() {
    setLoading(true);
    setError(null);
    try {
      var res = await aiAPI.getAlerts(patientId);
      var data = res.data || {};
      setAlerts({
        critical_alerts: data.critical_alerts || [],
        warnings: data.warnings || [],
        reminders: data.reminders || [],
        medication_alerts: data.medication_alerts || [],
        follow_up_needed: data.follow_up_needed || [],
        lab_tests_due: data.lab_tests_due || [],
        _error: data._error,
        generated_at: data.generated_at,
      });
    } catch (e) {
      setError(e?.response?.data?.detail || t('فشل تحميل التنبيهات', 'Failed to load alerts'));
    }
    setLoading(false);
  }

  if (loading) {
    return React.createElement(Card, null,
      React.createElement(CardContent, { className: 'p-6 text-center' },
        React.createElement(Loader2, { className: 'w-8 h-8 animate-spin mx-auto text-blue-600' }),
        React.createElement('p', { className: 'text-sm text-muted-foreground mt-2' }, t('جاري تحليل البيانات...', 'Analyzing data...'))
      )
    );
  }

  if (error) {
    return React.createElement(Card, null,
      React.createElement(CardContent, { className: 'p-6 text-center' },
        React.createElement(AlertCircle, { className: 'w-8 h-8 mx-auto text-red-500' }),
        React.createElement('p', { className: 'text-sm text-red-500 mt-2' }, error),
        React.createElement(Button, { onClick: fetchAlerts, variant: 'outline', size: 'sm', className: 'mt-2' },
          React.createElement(RefreshCw, { className: 'w-4 h-4 me-1' }),
          t('إعادة المحاولة', 'Retry')
        )
      )
    );
  }

  if (!alerts) return null;

  var criticalCount = (alerts.critical_alerts || []).length;
  var warningCount = (alerts.warnings || []).length;
  var reminderCount = (alerts.reminders || []).length;
  var medCount = (alerts.medication_alerts || []).length;
  var followCount = (alerts.follow_up_needed || []).length;
  var labCount = (alerts.lab_tests_due || []).length;
  var hasAnyAlert = criticalCount > 0 || warningCount > 0 || reminderCount > 0 || medCount > 0 || followCount > 0 || labCount > 0;

  return React.createElement(Card, null,
    React.createElement(CardHeader, { className: 'pb-2' },
      React.createElement(CardTitle, { className: 'flex items-center justify-between text-base' },
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement(Bell, { className: 'w-5 h-5 text-blue-600' }),
          t('التنبيهات الذكية', 'Smart Alerts')
        ),
        React.createElement(Button, { onClick: fetchAlerts, variant: 'ghost', size: 'sm' },
          React.createElement(RefreshCw, { className: 'w-4 h-4' })
        )
      )
    ),
    React.createElement(CardContent, { className: 'space-y-3' },
      alerts._error ? React.createElement('p', { className: 'text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded' }, t('ملاحظة: التحليل غير متوفر حالياً', 'Note: Analysis temporarily unavailable')) : null,
      criticalCount > 0 ? React.createElement('div', { className: 'space-y-2' },
        React.createElement('p', { className: 'text-xs font-semibold text-red-600 uppercase tracking-wide' }, t('حرجة', 'Critical')),
        alerts.critical_alerts.map(function(alert, i) {
          return React.createElement('div', { key: 'c' + i, className: 'p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800' },
            React.createElement('div', { className: 'flex items-start gap-2' },
              React.createElement(AlertTriangle, { className: 'w-5 h-5 text-red-600 mt-0.5 shrink-0' }),
              React.createElement('div', { className: 'min-w-0' },
                React.createElement('p', { className: 'font-medium text-red-700 dark:text-red-300' }, alert.message),
                alert.action ? React.createElement('p', { className: 'text-sm text-red-600 dark:text-red-400 mt-1' }, '→ ' + alert.action) : null
              )
            )
          );
        })
      ) : null,
      
      warningCount > 0 ? React.createElement('div', { className: 'space-y-2' },
        React.createElement('p', { className: 'text-xs font-semibold text-amber-600 uppercase tracking-wide' }, t('تحذير', 'Warning')),
        alerts.warnings.map(function(alert, i) {
          return React.createElement('div', { key: 'w' + i, className: 'p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800' },
            React.createElement('div', { className: 'flex items-start gap-2' },
              React.createElement(AlertCircle, { className: 'w-5 h-5 text-amber-600 mt-0.5 shrink-0' }),
              React.createElement('div', { className: 'min-w-0' },
                React.createElement('p', { className: 'font-medium text-amber-700 dark:text-amber-300' }, alert.message),
                alert.action ? React.createElement('p', { className: 'text-sm text-amber-600 dark:text-amber-400 mt-1' }, '→ ' + alert.action) : null
              )
            )
          );
        })
      ) : null,
      
      (alerts.medication_alerts || []).length > 0 ? alerts.medication_alerts.map(function(alert, i) {
        return React.createElement('div', { key: 'm' + i, className: 'p-3 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200 dark:border-orange-800' },
          React.createElement('div', { className: 'flex items-start gap-2' },
            React.createElement(Pill, { className: 'w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5' }),
            React.createElement('div', null,
              React.createElement('p', { className: 'font-medium text-slate-800 dark:text-slate-100' }, alert.drug + ': ' + alert.alert),
              React.createElement(Badge, { variant: 'outline', className: 'mt-1 text-xs' }, alert.severity)
            )
          )
        );
      }) : null,
      
      (alerts.follow_up_needed || []).length > 0 ? alerts.follow_up_needed.map(function(f, i) {
        return React.createElement('div', { key: 'f' + i, className: 'p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800' },
          React.createElement('div', { className: 'flex items-start gap-2' },
            React.createElement(Calendar, { className: 'w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5' }),
            React.createElement('div', null,
              React.createElement('p', { className: 'font-medium text-blue-700 dark:text-blue-300' }, f.reason),
              f.recommended_date ? React.createElement('p', { className: 'text-sm text-slate-800 dark:text-slate-100' }, t('موعد مقترح: ', 'Suggested: ') + f.recommended_date) : null
            )
          )
        );
      }) : null,
      
      (alerts.lab_tests_due || []).length > 0 ? alerts.lab_tests_due.map(function(lab, i) {
        return React.createElement('div', { key: 'l' + i, className: 'p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800' },
          React.createElement('div', { className: 'flex items-start gap-2' },
            React.createElement(Activity, { className: 'w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5' }),
            React.createElement('div', null,
              React.createElement('p', { className: 'font-medium text-purple-700 dark:text-purple-300' }, lab.test),
              React.createElement('p', { className: 'text-sm text-slate-800 dark:text-slate-100' }, lab.reason),
              React.createElement(Badge, { variant: 'outline', className: 'mt-1 text-xs' }, lab.urgency)
            )
          )
        );
      }) : null,
      
      !hasAnyAlert ?
        React.createElement('div', { className: 'text-center py-4' },
          React.createElement(Info, { className: 'w-8 h-8 mx-auto text-green-500' }),
          React.createElement('p', { className: 'text-sm text-muted-foreground mt-2' }, t('لا توجد تنبيهات حالياً', 'No alerts currently'))
        ) : null
    )
  );
}

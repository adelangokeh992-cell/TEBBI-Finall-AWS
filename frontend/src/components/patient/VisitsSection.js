import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Eye, Thermometer, Heart, Activity, Stethoscope, Pill, MessageSquare, FileText } from 'lucide-react';
import { visitsAPI } from '../../services/api';

export default function VisitsSection({ patientId, t, language }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [visitDetail, setVisitDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    visitsAPI.getByPatient(patientId)
      .then(res => setVisits(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    if (!selectedVisitId) {
      setVisitDetail(null);
      return;
    }
    setDetailLoading(true);
    visitsAPI.getOne(selectedVisitId)
      .then(res => setVisitDetail(res.data))
      .catch(() => setVisitDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedVisitId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const pharmacyItems = visitDetail && visitDetail.pharmacy ? visitDetail.pharmacy : [];
  const prescriptionItems = visitDetail && visitDetail.prescription ? visitDetail.prescription : [];

  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t('الزيارات', 'Visits')} ({visits.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visits.length > 0 ? (
            <div className="space-y-3">
              {visits.map((v, i) => (
                <div
                  key={v.id || i}
                  className="p-4 border rounded-lg hover:border-teal-400 hover:bg-teal-50/30 dark:hover:bg-teal-900/20 cursor-pointer transition-colors flex items-center justify-between gap-2"
                  onClick={() => setSelectedVisitId(v.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedVisitId(v.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-2 flex-wrap gap-2">
                      <Badge variant="outline">
                        {new Date(v.created_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en')}
                      </Badge>
                      {v.total_amount > 0 && (
                        <Badge className={v.payment_status === 'paid' ? 'bg-green-500' : 'bg-orange-500'}>
                          {v.total_amount}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium">{v.reason}</p>
                    {v.diagnosis && (
                      <p className="text-sm text-muted-foreground">
                        {t('التشخيص', 'Dx')}: {v.diagnosis}
                      </p>
                    )}
                    {v.temperature && (
                      <p className="text-xs text-muted-foreground mt-1">
                        🌡️ {v.temperature}° | 💓 {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} | ❤️ {v.heart_rate}
                      </p>
                    )}
                  </div>
                  <Eye className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t('لا توجد زيارات', 'No visits')}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedVisitId} onOpenChange={(open) => !open && setSelectedVisitId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('تفاصيل الزيارة', 'Visit Details')}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : visitDetail ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{visitDetail.visit_number}</Badge>
                <Badge>{new Date(visitDetail.created_at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB')}</Badge>
                {visitDetail.doctor_name && <Badge variant="secondary">{visitDetail.doctor_name}</Badge>}
              </div>
              <div>
                <p className="text-muted-foreground">{t('سبب الزيارة', 'Reason')}</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">{visitDetail.reason}</p>
              </div>
              {visitDetail.diagnosis && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Stethoscope className="w-4 h-4" />{t('التشخيص', 'Diagnosis')}</p>
                  <p className="text-slate-800 dark:text-slate-100">{visitDetail.diagnosis}</p>
                </div>
              )}
              {(visitDetail.temperature != null || visitDetail.blood_pressure_systolic != null || visitDetail.heart_rate != null) && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <p className="text-muted-foreground mb-2">{t('العلامات الحيوية', 'Vital Signs')}</p>
                  <div className="flex flex-wrap gap-4 text-slate-800 dark:text-slate-100">
                    {visitDetail.temperature != null && <span className="flex items-center gap-1"><Thermometer className="w-4 h-4" /> {visitDetail.temperature}°C</span>}
                    {(visitDetail.blood_pressure_systolic != null || visitDetail.blood_pressure_diastolic != null) && <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {visitDetail.blood_pressure_systolic}/{visitDetail.blood_pressure_diastolic}</span>}
                    {visitDetail.heart_rate != null && <span className="flex items-center gap-1"><Activity className="w-4 h-4" /> {visitDetail.heart_rate}</span>}
                    {visitDetail.oxygen_saturation != null && <span>O2: {visitDetail.oxygen_saturation}%</span>}
                  </div>
                </div>
              )}
              {visitDetail.notes && (
                <div>
                  <p className="text-muted-foreground">{t('ملاحظات', 'Notes')}</p>
                  <p className="text-slate-800 dark:text-slate-100">{visitDetail.notes}</p>
                </div>
              )}
              {visitDetail.doctor_notes && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
                  <p className="text-muted-foreground flex items-center gap-1"><MessageSquare className="w-4 h-4" />{t('ملاحظات الدكتور', 'Doctor notes')}</p>
                  <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">{visitDetail.doctor_notes}</p>
                </div>
              )}
              {pharmacyItems.length > 0 && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Pill className="w-4 h-4" />{t('الصيدلية / من العيادة', 'Pharmacy')}</p>
                  <ul className="list-disc list-inside text-slate-800 dark:text-slate-100">
                    {pharmacyItems.map((item, idx) => (
                      <li key={idx}>{item.description_ar || item.description} — {item.quantity} × {(item.unit_price || 0).toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {prescriptionItems.length > 0 && (
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><FileText className="w-4 h-4" />{t('الوصفة', 'Prescription')}</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-800 dark:text-slate-100">
                    {prescriptionItems.map((item, idx) => (
                      <li key={idx}>{item.medication_name} — {item.dosage}, {item.frequency}</li>
                    ))}
                  </ul>
                </div>
              )}
              {visitDetail.total_amount > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground">{t('المبلغ', 'Amount')}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{visitDetail.total_amount} — {visitDetail.payment_status === 'paid' ? t('مدفوعة', 'Paid') : t('معلقة', 'Pending')}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">{t('لا تتوفر تفاصيل', 'Details not available')}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

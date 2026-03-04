import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Thermometer, Heart, Activity, Wind, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { patientsAPI } from '../../services/api';

function VitalsSection({ patient, onRefresh, t }) {
  const [editing, setEditing] = useState(false);
  const [vitals, setVitals] = useState({
    temperature: patient?.temperature || '',
    blood_pressure_systolic: patient?.blood_pressure_systolic || '',
    blood_pressure_diastolic: patient?.blood_pressure_diastolic || '',
    heart_rate: patient?.heart_rate || '',
    oxygen_saturation: patient?.oxygen_saturation || '',
    height_cm: patient?.height_cm || '',
    weight_kg: patient?.weight_kg || ''
  });

  const handleSave = async () => {
    try {
      const data = {};
      Object.keys(vitals).forEach(key => {
        if (vitals[key] !== '' && vitals[key] !== null) {
          data[key] = parseFloat(vitals[key]);
        }
      });
      await patientsAPI.update(patient.id, { ...patient, ...data });
      toast.success(t('تم الحفظ', 'Saved'));
      setEditing(false);
      onRefresh();
    } catch (e) {
      toast.error(t('فشل', 'Failed'));
    }
  };

  const getTemperatureColor = (temp) => {
    if (!temp) return 'text-muted-foreground';
    if (temp >= 38) return 'text-red-600';
    if (temp >= 37.5) return 'text-orange-500';
    return 'text-green-600';
  };

  const getOxygenColor = (o2) => {
    if (!o2) return 'text-muted-foreground';
    if (o2 < 90) return 'text-red-600';
    if (o2 < 95) return 'text-orange-500';
    return 'text-green-600';
  };

  const getBPColor = (sys, dia) => {
    if (!sys || !dia) return 'text-muted-foreground';
    if (sys >= 140 || dia >= 90) return 'text-red-600';
    if (sys >= 130 || dia >= 85) return 'text-orange-500';
    return 'text-green-600';
  };

  const getHRColor = (hr) => {
    if (!hr) return 'text-muted-foreground';
    if (hr > 100 || hr < 60) return 'text-orange-500';
    return 'text-green-600';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">{t('العلامات الحيوية', 'Vital Signs')}</CardTitle>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
            <Button size="sm" className="bg-teal-600" onClick={handleSave}>
              <Save className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="edit-vitals-btn">
            <Edit2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Temperature */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-5 h-5 text-red-500" />
              <span className="text-sm text-muted-foreground">{t('الحرارة', 'Temp')}</span>
            </div>
            {editing ? (
              <Input 
                type="number" 
                step="0.1"
                value={vitals.temperature}
                onChange={e => setVitals({...vitals, temperature: e.target.value})}
                className="h-8"
                placeholder="37.0"
              />
            ) : (
              <p className={`text-2xl font-bold ${getTemperatureColor(patient?.temperature)}`}>
                {patient?.temperature ? `${patient.temperature}°` : '-'}
              </p>
            )}
          </div>

          {/* Blood Pressure */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">{t('الضغط', 'BP')}</span>
            </div>
            {editing ? (
              <div className="flex gap-1 items-center">
                <Input 
                  type="number"
                  value={vitals.blood_pressure_systolic}
                  onChange={e => setVitals({...vitals, blood_pressure_systolic: e.target.value})}
                  className="h-8 w-16"
                  placeholder="120"
                />
                <span>/</span>
                <Input 
                  type="number"
                  value={vitals.blood_pressure_diastolic}
                  onChange={e => setVitals({...vitals, blood_pressure_diastolic: e.target.value})}
                  className="h-8 w-16"
                  placeholder="80"
                />
              </div>
            ) : (
              <p className={`text-2xl font-bold ${getBPColor(patient?.blood_pressure_systolic, patient?.blood_pressure_diastolic)}`}>
                {patient?.blood_pressure_systolic && patient?.blood_pressure_diastolic 
                  ? `${patient.blood_pressure_systolic}/${patient.blood_pressure_diastolic}` 
                  : '-'}
              </p>
            )}
          </div>

          {/* Heart Rate */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-red-500" />
              <span className="text-sm text-muted-foreground">{t('النبض', 'HR')}</span>
            </div>
            {editing ? (
              <Input 
                type="number"
                value={vitals.heart_rate}
                onChange={e => setVitals({...vitals, heart_rate: e.target.value})}
                className="h-8"
                placeholder="72"
              />
            ) : (
              <p className={`text-2xl font-bold ${getHRColor(patient?.heart_rate)}`}>
                {patient?.heart_rate ? `${patient.heart_rate}` : '-'}
                {patient?.heart_rate && <span className="text-sm font-normal text-muted-foreground"> bpm</span>}
              </p>
            )}
          </div>

          {/* Oxygen Saturation */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">{t('الأكسجين', 'SpO2')}</span>
            </div>
            {editing ? (
              <Input 
                type="number"
                min="0"
                max="100"
                value={vitals.oxygen_saturation}
                onChange={e => setVitals({...vitals, oxygen_saturation: e.target.value})}
                className="h-8"
                placeholder="98"
              />
            ) : (
              <p className={`text-2xl font-bold ${getOxygenColor(patient?.oxygen_saturation)}`}>
                {patient?.oxygen_saturation ? `${patient.oxygen_saturation}%` : '-'}
              </p>
            )}
          </div>
        </div>

        {/* Height and Weight */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border">
            <Label className="text-muted-foreground text-sm">{t('الطول', 'Height')}</Label>
            {editing ? (
              <Input 
                type="number"
                value={vitals.height_cm}
                onChange={e => setVitals({...vitals, height_cm: e.target.value})}
                className="h-8 mt-1"
                placeholder="175"
              />
            ) : (
              <p className="text-xl font-semibold">{patient?.height_cm ? `${patient.height_cm} cm` : '-'}</p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border">
            <Label className="text-muted-foreground text-sm">{t('الوزن', 'Weight')}</Label>
            {editing ? (
              <Input 
                type="number"
                value={vitals.weight_kg}
                onChange={e => setVitals({...vitals, weight_kg: e.target.value})}
                className="h-8 mt-1"
                placeholder="70"
              />
            ) : (
              <p className="text-xl font-semibold">{patient?.weight_kg ? `${patient.weight_kg} kg` : '-'}</p>
            )}
          </div>
        </div>

        {/* BMI Calculation */}
        {patient?.height_cm && patient?.weight_kg && (
          <div className="mt-4 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('مؤشر كتلة الجسم', 'BMI')}</span>
              <span className="text-lg font-bold text-teal-600">
                {(patient.weight_kg / Math.pow(patient.height_cm / 100, 2)).toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VitalsSection;

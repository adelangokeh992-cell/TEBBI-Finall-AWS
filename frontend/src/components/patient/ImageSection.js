import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { medicalImagesAPI } from '../../services/api';

function ImageSection({ patientId, images, onRefresh, t }) {
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState('');
  const [imageType, setImageType] = useState('xray');
  const [preview, setPreview] = useState(null);
  const [base64, setBase64] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!base64) {
      toast.error(t('اختر صورة', 'Select image'));
      return;
    }
    medicalImagesAPI.create({ patient_id: patientId, title, image_type: imageType, image_base64: base64 })
      .then(() => {
        toast.success(t('تمت الإضافة', 'Added'));
        setShowDialog(false);
        setTitle('');
        setPreview(null);
        setBase64('');
        onRefresh();
      })
      .catch(() => toast.error(t('فشل', 'Failed')));
  };

  const handleDelete = (id) => {
    if (window.confirm(t('متأكد؟', 'Sure?'))) {
      medicalImagesAPI.delete(id).then(() => {
        toast.success(t('تم', 'Done'));
        onRefresh();
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">{t('الصور الطبية', 'Medical Images')}</CardTitle>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-teal-600" data-testid="add-image-btn">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('إضافة صورة', 'Add Image')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t('العنوان', 'Title')}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label>{t('النوع', 'Type')}</Label>
                <Select value={imageType} onValueChange={setImageType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xray">{t('أشعة', 'X-Ray')}</SelectItem>
                    <SelectItem value="ecg">{t('تخطيط قلب', 'ECG')}</SelectItem>
                    <SelectItem value="lab_test">{t('تحليل', 'Lab')}</SelectItem>
                    <SelectItem value="other">{t('أخرى', 'Other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-2 border-dashed rounded-xl p-4 text-center">
                {preview ? (
                  <div>
                    <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded" />
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { setPreview(null); setBase64(''); }}>
                      {t('إزالة', 'Remove')}
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t('اختر صورة', 'Select')}</p>
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </label>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-teal-600">{t('حفظ', 'Save')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <img src={img.image_base64} alt={img.title} className="w-full h-32 object-cover" />
                <div className="p-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{img.title}</p>
                    <Badge variant="secondary" className="text-xs">{img.image_type}</Badge>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(img.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">{t('لا توجد صور', 'No images')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default ImageSection;

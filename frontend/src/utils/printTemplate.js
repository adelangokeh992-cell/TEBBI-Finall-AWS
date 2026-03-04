/**
 * Build print HTML for invoice, prescription, and consent using company print settings.
 * @param {object} opts - { printSettings, language, t }
 * printSettings: { company_name, company_name_ar, logo_base64, print_logo_url, print_clinic_name,
 *   print_header_invoice, print_header_prescription, print_header_consent, print_footer, print_primary_color }
 */

function getClinicName(printSettings, language) {
  const name = printSettings.print_clinic_name?.trim() || (language === 'ar' ? (printSettings.company_name_ar || printSettings.company_name) : (printSettings.company_name || printSettings.company_name_ar));
  return name || 'العيادة';
}

function getLogoImg(printSettings, showLogo = true) {
  if (showLogo === false) return '';
  if (printSettings.print_logo_url?.trim()) {
    return `<img src="${printSettings.print_logo_url.replace(/"/g, '&quot;')}" alt="Logo" style="max-height: 64px; max-width: 180px; object-fit: contain;" />`;
  }
  if (printSettings.logo_base64) {
    const src = printSettings.logo_base64.includes('base64,') ? printSettings.logo_base64 : `data:image/png;base64,${printSettings.logo_base64}`;
    return `<img src="${src}" alt="Logo" style="max-height: 64px; max-width: 180px; object-fit: contain;" />`;
  }
  return '';
}

/** Invoice: company block (name, address, phone, email, tax number) like design template */
function getInvoiceCompanyBlock(printSettings, language, t) {
  const ps = printSettings || {};
  const showLogo = ps.print_show_logo !== false;
  const logo = getLogoImg(ps, showLogo);
  const nameAr = (ps.print_invoice_name_ar || ps.print_clinic_name || ps.company_name_ar || ps.company_name || '').trim();
  const nameEn = (ps.print_invoice_name_en || ps.company_name || ps.company_name_ar || '').trim();
  const address = (ps.print_invoice_address || '').trim();
  const phone = (ps.print_invoice_phone || '').trim();
  const email = (ps.print_invoice_email || '').trim();
  const taxNumber = (ps.print_invoice_tax_number || '').trim();
  const color = ps.print_primary_color || '#0d9488';
  const parts = [];
  if (logo) parts.push(`<div style="margin-bottom: 8px;">${logo}</div>`);
  if (nameAr) parts.push(`<h1 style="color: ${color}; margin: 4px 0; font-size: 22px;">${nameAr}</h1>`);
  if (nameEn) parts.push(`<p style="margin: 2px 0; font-size: 14px; color: #555;">${nameEn}</p>`);
  if (address) parts.push(`<p style="margin: 2px 0; font-size: 12px;">${address}</p>`);
  if (phone) parts.push(`<p style="margin: 2px 0; font-size: 12px;">${phone}</p>`);
  if (email) parts.push(`<p style="margin: 2px 0; font-size: 12px;">${email}</p>`);
  if (taxNumber) parts.push(`<p style="margin: 2px 0; font-size: 12px;">${t('الرقم الضريبي:', 'Tax No:')} ${taxNumber}</p>`);
  if (parts.length === 0) return '';
  return `<div class="invoice-company" style="border-bottom: 3px solid ${color}; padding-bottom: 16px; margin-bottom: 20px;">${parts.join('')}</div>`;
}

function getHeaderHtml(printSettings, type, language, t) {
  const color = printSettings.print_primary_color || '#0d9488';
  const clinicName = getClinicName(printSettings, language);
  const logo = getLogoImg(printSettings, printSettings.print_show_logo !== false);
  let title = '';
  if (type === 'invoice') title = printSettings.print_header_invoice?.trim() || t('فاتورة', 'Invoice');
  else if (type === 'prescription') title = printSettings.print_header_prescription?.trim() || t('روشيتة طبية', 'Medical Prescription');
  else if (type === 'consent') title = printSettings.print_header_consent?.trim() || t('نموذج موافقة', 'Consent Form');
  return `
    <div class="print-header" style="text-align: center; border-bottom: 3px solid ${color}; padding-bottom: 16px; margin-bottom: 24px;">
      ${logo ? `<div style="margin-bottom: 8px;">${logo}</div>` : ''}
      <h1 style="color: ${color}; margin: 8px 0; font-size: 24px;">${clinicName}</h1>
      <p style="margin: 4px 0; font-size: 14px; color: #555;">${title}</p>
    </div>`;
}

function getFooterHtml(printSettings, language) {
  const text = printSettings.print_footer?.trim() || (language === 'ar' ? 'شكراً لثقتكم — نظام طبّي' : 'Thank you — Medical System');
  return `
    <div class="print-footer" style="margin-top: 32px; text-align: center; padding: 16px; background: #f8f9fa; border-radius: 8px;">
      <p style="margin: 4px 0; color: #666; font-size: 12px;">${text}</p>
    </div>`;
}

function getBaseStyles(primaryColor) {
  const color = primaryColor || '#0d9488';
  return `
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: ${color}; color: white; padding: 10px 12px; text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
    .total-row { background: #e6f7f5; font-weight: bold; }
    .total-row td { color: ${color}; }
  `;
}

/**
 * Build full HTML for invoice print.
 */
export function buildInvoiceHtml(printSettings, invoice, opts = {}) {
  const { language = 'ar', t = (a, b) => language === 'ar' ? a : b } = opts;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const ps = printSettings || {};
  const color = ps.print_primary_color || '#0d9488';
  const useCompanyBlock = (ps.print_invoice_name_ar || ps.print_invoice_name_en || ps.print_invoice_address || ps.print_invoice_phone || ps.print_invoice_email || ps.print_invoice_tax_number);
  const companyBlock = useCompanyBlock ? getInvoiceCompanyBlock(ps, language, t) : '';
  const header = useCompanyBlock ? '' : getHeaderHtml(ps, 'invoice', language, t);
  const titleLine = (ps.print_header_invoice || t('فاتورة', 'Invoice')).trim();
  const footer = getFooterHtml(ps, language);
  const dateStr = invoice.created_at ? new Date(invoice.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '';
  const rows = (invoice.items || []).map(i => {
    const total = i.total != null ? i.total : (i.quantity || 1) * (i.unit_price || 0);
    return `<tr><td>${i.description || '-'}</td><td>${i.quantity || 1}</td><td>${(i.unit_price || 0).toFixed(2)}</td><td>${total.toFixed(2)}</td></tr>`;
  }).join('');
  const statusText = invoice.payment_status === 'paid' ? t('مدفوعة', 'Paid') : invoice.payment_status === 'partial' ? t('جزئي', 'Partial') : t('معلقة', 'Pending');
  const billedTo = (invoice.patient_name || invoice.billed_to || '').trim();
  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>${t('فاتورة', 'Invoice')} ${invoice.invoice_number || invoice.id}</title><style>${getBaseStyles(color)}</style></head><body>
${companyBlock}
${header}
${titleLine ? `<p style="font-size: 14px; color: #555; margin-bottom: 12px;">${titleLine}</p>` : ''}
<p><strong>${t('رقم الفاتورة', 'Invoice Number')}</strong>: ${invoice.invoice_number || invoice.id}</p>
<p>${t('التاريخ', 'Date')}: ${dateStr}</p>
${billedTo ? `<p>${t('العميل / مفوتر إليه', 'Client / Billed To')}: ${billedTo}</p>` : ''}
<table>
<thead><tr><th style="text-align:right;">${t('البيان', 'Description')}</th><th>${t('الكمية', 'Qty')}</th><th>${t('السعر', 'Price')}</th><th>${t('الإجمالي', 'Total')}</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p><strong>${t('الإجمالي', 'Total')}: ${(invoice.total != null ? invoice.total : 0).toFixed(2)}</strong></p>
<p>${t('الحالة', 'Status')}: ${statusText}</p>
${footer}
</body></html>`;
}

/**
 * Build full HTML for prescription print.
 */
export function buildPrescriptionHtml(printSettings, visit, patientName, opts = {}) {
  const { language = 'ar', t = (a, b) => language === 'ar' ? a : b } = opts;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const color = printSettings?.print_primary_color || '#0d9488';
  const header = getHeaderHtml(printSettings || {}, 'prescription', language, t);
  const footer = getFooterHtml(printSettings || {}, language);
  const dateStr = visit?.created_at ? new Date(visit.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB') : '';
  const prescriptions = visit?.prescription || [];
  const rows = prescriptions.length
    ? prescriptions.map(p => `<tr><td>${p.medication_name || p.name || '-'}</td><td>${p.dosage || '-'}</td><td>${p.frequency || p.freq || '-'}</td></tr>`).join('')
    : `<tr><td colspan="3">${t('لا وصفة', 'No prescription')}</td></tr>`;
  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>${t('روشيتة', 'Prescription')}</title><style>${getBaseStyles(color)}</style></head><body>
${header}
<p><strong>${patientName || '-'}</strong></p>
<p>${t('التاريخ', 'Date')}: ${dateStr}</p>
<table>
<thead><tr><th style="text-align:right;">${t('الدواء', 'Medication')}</th><th>${t('الجرعة', 'Dosage')}</th><th>${t('التكرار', 'Frequency')}</th></tr></thead>
<tbody>${rows}</tbody>
</table>
${footer}
</body></html>`;
}

/**
 * Build full HTML for consent form print.
 */
export function buildConsentHtml(printSettings, form, opts = {}) {
  const { language = 'ar', t = (a, b) => language === 'ar' ? a : b } = opts;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const color = printSettings?.print_primary_color || '#0d9488';
  const header = getHeaderHtml(printSettings || {}, 'consent', language, t);
  const footer = getFooterHtml(printSettings || {}, language);
  const title = language === 'ar' ? (form.title_ar || form.title_en) : (form.title_en || form.title_ar);
  const body = language === 'ar' ? (form.body_ar || form.body_en) : (form.body_en || form.body_ar);
  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><title>${title || t('موافقة', 'Consent')}</title><style>${getBaseStyles(color)} body { padding: 32px; } .consent-body { white-space: pre-wrap; margin: 20px 0; }</style></head><body>
${header}
<h2 style="margin-bottom: 12px;">${title || ''}</h2>
<div class="consent-body">${(body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
${footer}
</body></html>`;
}

/**
 * Open print window with HTML (use after fetching print settings).
 */
export function printHtml(html) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

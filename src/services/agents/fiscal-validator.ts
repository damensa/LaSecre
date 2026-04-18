import { ExtractedReceiptData, FiscalValidationIssue, FiscalValidationResult } from '../../types/fiscal';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDate(input: string): string {
  const value = (input || '').trim();
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return value;
  const dd = match[1].padStart(2, '0');
  const mm = match[2].padStart(2, '0');
  const yyyy = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeNif(value: string): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isValidDniNieCif(value: string): boolean {
  const nif = normalizeNif(value);
  if (!nif) return false;

  const dniMatch = nif.match(/^(\d{8})([A-Z])$/);
  if (dniMatch) {
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    return letters[Number(dniMatch[1]) % 23] === dniMatch[2];
  }

  const nieMatch = nif.match(/^[XYZ](\d{7})([A-Z])$/);
  if (nieMatch) {
    const prefix = { X: '0', Y: '1', Z: '2' }[nif[0]];
    const num = `${prefix}${nieMatch[1]}`;
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    return letters[Number(num) % 23] === nieMatch[2];
  }

  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif);
}

function inferDocumentType(data: ExtractedReceiptData): ExtractedReceiptData['tipus_document'] {
  if (data.numero_factura && data.cif && data.base_imposable > 0) return 'Factura';
  if (data.comerç && data.import_total > 0) return 'Factura simplificada';
  return 'Desconegut';
}

function inferVatRate(base: number, vat: number): number {
  if (base <= 0 || vat <= 0) return 0;
  return round2((vat / base) * 100);
}

export function validateFiscalData(extracted: ExtractedReceiptData, userNif?: string): FiscalValidationResult {
  const issues: FiscalValidationIssue[] = [];
  const normalizedData: ExtractedReceiptData = {
    ...extracted,
    cif: normalizeNif(extracted.cif),
    data: normalizeDate(extracted.data),
    import_total: round2(extracted.import_total || 0),
    base_imposable: round2(extracted.base_imposable || 0),
    import_iva: round2(extracted.import_iva || 0),
    import_retencio: round2(extracted.import_retencio || 0),
    percentatge_iva: round2(extracted.percentatge_iva || 0),
    percentatge_retencio: round2(extracted.percentatge_retencio || 0),
    comerç: (extracted.comerç || '').trim(),
    numero_factura: (extracted.numero_factura || '').trim(),
    categoria: (extracted.categoria || 'Altres').trim() || 'Altres',
    warnings: [...(extracted.warnings || [])],
  };

  if (!normalizedData.comerç) {
    issues.push({ code: 'MISSING_MERCHANT', severity: 'warning', message: 'Falta el nom del comerç', field: 'comerç' });
  }

  if (!normalizedData.cif) {
    issues.push({ code: 'MISSING_CIF', severity: 'warning', message: 'Falta el CIF/NIF de l\'emissor', field: 'cif' });
  } else if (!isValidDniNieCif(normalizedData.cif)) {
    issues.push({ code: 'INVALID_CIF', severity: 'warning', message: 'El CIF/NIF no supera la validació formal', field: 'cif' });
  }

  if (!normalizedData.data) {
    issues.push({ code: 'MISSING_DATE', severity: 'warning', message: 'Falta la data del document', field: 'data' });
  }

  if (normalizedData.import_total <= 0) {
    issues.push({ code: 'INVALID_TOTAL', severity: 'error', message: 'L\'import total no és vàlid', field: 'import_total' });
  }

  const computedVatRate = inferVatRate(normalizedData.base_imposable, normalizedData.import_iva);
  if (!normalizedData.percentatge_iva && computedVatRate) {
    normalizedData.percentatge_iva = computedVatRate;
    issues.push({ code: 'INFERRED_VAT_RATE', severity: 'info', message: 'S\'ha inferit el percentatge d\'IVA a partir de base i quota', field: 'percentatge_iva' });
  }

  if (!normalizedData.import_iva && normalizedData.base_imposable > 0 && normalizedData.percentatge_iva > 0) {
    normalizedData.import_iva = round2(normalizedData.base_imposable * normalizedData.percentatge_iva / 100);
    issues.push({ code: 'INFERRED_VAT_AMOUNT', severity: 'info', message: 'S\'ha inferit la quota d\'IVA', field: 'import_iva' });
  }

  if (!normalizedData.base_imposable && normalizedData.import_total > 0) {
    if (normalizedData.import_iva > 0 && normalizedData.import_retencio >= 0) {
      normalizedData.base_imposable = round2(normalizedData.import_total - normalizedData.import_iva + normalizedData.import_retencio);
      issues.push({ code: 'INFERRED_BASE', severity: 'info', message: 'S\'ha inferit la base imposable', field: 'base_imposable' });
    }
  }

  const expectedTotal = round2(normalizedData.base_imposable + normalizedData.import_iva - normalizedData.import_retencio);
  if (normalizedData.import_total > 0 && normalizedData.base_imposable > 0) {
    const delta = Math.abs(expectedTotal - normalizedData.import_total);
    if (delta > 0.05) {
      issues.push({
        code: 'TOTAL_MISMATCH',
        severity: 'warning',
        message: `La suma base + IVA - retenció no quadra amb el total (delta ${delta.toFixed(2)}€)`,
        field: 'import_total'
      });
    }
  }

  if (!normalizedData.tipus_document || normalizedData.tipus_document === 'Desconegut') {
    normalizedData.tipus_document = inferDocumentType(normalizedData);
    issues.push({ code: 'INFERRED_DOCUMENT_TYPE', severity: 'info', message: 'S\'ha inferit el tipus de document', field: 'tipus_document' });
  }

  const normalizedUserNif = normalizeNif(userNif || '');
  if (normalizedUserNif && normalizedData.cif && normalizedData.cif === normalizedUserNif) {
    normalizedData.tipus = 'VENDA';
    issues.push({ code: 'SELF_ISSUED_DOCUMENT', severity: 'info', message: 'L\'emissor coincideix amb el NIF de l\'usuari', field: 'tipus' });
  }

  const suspiciousVatRates = [4, 10, 21, 0];
  if (normalizedData.percentatge_iva && !suspiciousVatRates.includes(normalizedData.percentatge_iva)) {
    issues.push({ code: 'UNCOMMON_VAT_RATE', severity: 'warning', message: 'Percentatge d\'IVA poc habitual, podria requerir criteri AEAT', field: 'percentatge_iva' });
  }

  const needsAeatResearch = issues.some(issue => issue.code === 'UNCOMMON_VAT_RATE') ||
    normalizedData.percentatge_retencio > 0 ||
    /intracomunit|exempt|exento|rec[aà]rrec|equival[eè]ncia/i.test(`${normalizedData.categoria} ${(normalizedData.warnings || []).join(' ')}`);

  const reviewRequired = issues.some(issue => issue.severity === 'error' || issue.code === 'INVALID_CIF' || issue.code === 'TOTAL_MISMATCH');

  const status: FiscalValidationResult['status'] = needsAeatResearch
    ? 'NEEDS_AEAT_RULE'
    : reviewRequired
      ? 'NEEDS_REVIEW'
      : 'VALID';

  return {
    status,
    normalizedData,
    issues,
    needsAeatResearch,
    reviewRequired,
  };
}

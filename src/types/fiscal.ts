export type ReceiptDocumentType = 'Factura' | 'Factura simplificada' | 'Desconegut';
export type ReceiptDirection = 'COMPRA' | 'VENDA';
export type ValidationStatus = 'VALID' | 'NEEDS_REVIEW' | 'NEEDS_AEAT_RULE';

export interface ExtractedReceiptData {
  comerç: string;
  cif: string;
  numero_factura: string;
  tipus_document: ReceiptDocumentType;
  data: string;
  import_total: number;
  base_imposable: number;
  percentatge_iva: number;
  import_iva: number;
  import_retencio: number;
  percentatge_retencio: number;
  categoria: string;
  tipus: ReceiptDirection;
  resposta_lasecre?: string;
  confidence?: Partial<Record<keyof Omit<ExtractedReceiptData, 'confidence' | 'warnings' | 'rawText' | 'rawModel' | 'resposta_lasecre'>, number>>;
  warnings?: string[];
  rawText?: string;
  rawModel?: string;
}

export interface FiscalValidationIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  field?: keyof ExtractedReceiptData | string;
}

export interface AeatResearchSummary {
  consulted: boolean;
  summary: string;
  sources: { title: string; url: string }[];
  findings: string[];
}

export interface FiscalValidationResult {
  status: ValidationStatus;
  normalizedData: ExtractedReceiptData;
  issues: FiscalValidationIssue[];
  needsAeatResearch: boolean;
  reviewRequired: boolean;
  aeatResearch?: AeatResearchSummary;
}

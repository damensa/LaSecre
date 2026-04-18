import { extractReceiptData } from './agents/receipt-extractor';
import { buildReceiptUserResponse } from './agents/final-response';
import { researchAeatCriteria } from './agents/aeat-research';
import { validateFiscalData } from './agents/fiscal-validator';
import { ExtractedReceiptData, FiscalValidationResult } from '../types/fiscal';

export interface ReceiptFlowInput {
  base64Image: string;
  languageHint?: string;
  userNif?: string;
}

export interface ReceiptFlowResult {
  extracted: ExtractedReceiptData;
  validation: FiscalValidationResult;
  final: ExtractedReceiptData;
}

export async function runReceiptAnalysisFlow(input: ReceiptFlowInput): Promise<ReceiptFlowResult> {
  const extracted = await extractReceiptData(input.base64Image, input.languageHint, input.userNif);
  const validation = validateFiscalData(extracted, input.userNif);

  if (validation.needsAeatResearch) {
    validation.aeatResearch = await researchAeatCriteria(validation.normalizedData, validation.issues);
  }

  const final: ExtractedReceiptData = {
    ...validation.normalizedData,
    resposta_lasecre: buildReceiptUserResponse(validation.normalizedData, validation, input.languageHint),
    warnings: [
      ...(validation.normalizedData.warnings || []),
      ...validation.issues.map(issue => `${issue.code}: ${issue.message}`),
      ...(validation.aeatResearch?.findings || []).map(finding => `AEAT: ${finding}`),
    ],
  };

  return { extracted, validation, final };
}

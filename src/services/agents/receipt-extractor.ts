import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedReceiptData } from '../../types/fiscal';

const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || '').trim());
const ANALYSIS_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-lite'];

const DEFAULT_RESULT: ExtractedReceiptData = {
  comerç: '',
  cif: '',
  numero_factura: '',
  tipus_document: 'Desconegut',
  data: '',
  import_total: 0,
  base_imposable: 0,
  percentatge_iva: 0,
  import_iva: 0,
  import_retencio: 0,
  percentatge_retencio: 0,
  categoria: 'Altres',
  tipus: 'COMPRA',
  confidence: {},
  warnings: [],
};

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model response');
  return JSON.parse(match[0]);
}

function sanitizeJsonLikeText(text: string): string {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const normalized = value.replace(/€/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toConfidenceMap(input: any): ExtractedReceiptData['confidence'] {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num)) out[key] = Math.max(0, Math.min(1, num));
  }
  return out;
}

function normalizeResult(raw: any, modelName: string): ExtractedReceiptData {
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(String) : [];

  return {
    ...DEFAULT_RESULT,
    comerç: String(raw.comerç || raw.comerc || '').trim(),
    cif: String(raw.cif || raw.nif || '').trim().toUpperCase(),
    numero_factura: String(raw.numero_factura || raw.numero || '').trim(),
    tipus_document: raw.tipus_document === 'Factura' || raw.tipus_document === 'Factura simplificada' ? raw.tipus_document : 'Desconegut',
    data: String(raw.data || '').trim(),
    import_total: toNumber(raw.import_total),
    base_imposable: toNumber(raw.base_imposable),
    percentatge_iva: toNumber(raw.percentatge_iva),
    import_iva: toNumber(raw.import_iva),
    import_retencio: toNumber(raw.import_retencio),
    percentatge_retencio: toNumber(raw.percentatge_retencio),
    categoria: String(raw.categoria || 'Altres').trim() || 'Altres',
    tipus: raw.tipus === 'VENDA' ? 'VENDA' : 'COMPRA',
    confidence: toConfidenceMap(raw.confidence),
    warnings,
    rawText: typeof raw.rawText === 'string' ? raw.rawText : undefined,
    rawModel: modelName,
  };
}

export async function extractReceiptData(base64Image: string, languageHint = 'dedueix-ho o català', userNif?: string): Promise<ExtractedReceiptData> {
  let lastError: any = null;

  for (const modelName of ANALYSIS_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `Actua com un extractor fiscal especialitzat en tiquets i factures espanyoles. No parlis amb l'usuari. Només retorna JSON vàlid.

Objectiu:
- Extreure les dades visibles del document.
- No inventar camps.
- Si un camp no es veu clar, deixa'l buit o a 0 i afegeix un warning.
- La llengua de l'usuari és aproximadament: ${languageHint}.
- El NIF de l'usuari és: ${userNif || 'desconegut'}.
- Si el CIF/NIF emissor coincideix exactament amb el NIF de l'usuari, marca tipus=VENDA. Si no, COMPRA.

Retorna exactament aquest JSON:
{
  "comerç": "",
  "cif": "",
  "numero_factura": "",
  "tipus_document": "Factura" | "Factura simplificada" | "Desconegut",
  "data": "DD/MM/AAAA",
  "import_total": 0,
  "base_imposable": 0,
  "percentatge_iva": 0,
  "import_iva": 0,
  "import_retencio": 0,
  "percentatge_retencio": 0,
  "categoria": "",
  "tipus": "COMPRA" | "VENDA",
  "confidence": {
    "comerç": 0,
    "cif": 0,
    "numero_factura": 0,
    "tipus_document": 0,
    "data": 0,
    "import_total": 0,
    "base_imposable": 0,
    "percentatge_iva": 0,
    "import_iva": 0,
    "import_retencio": 0,
    "percentatge_retencio": 0,
    "categoria": 0,
    "tipus": 0
  },
  "warnings": []
}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();

      try {
        const parsed = extractJson(text);
        return normalizeResult(parsed, modelName);
      } catch {
        const cleaned = sanitizeJsonLikeText(text);
        const parsed = extractJson(cleaned);
        return normalizeResult(parsed, modelName);
      }
    } catch (error: any) {
      console.error(`[ReceiptExtractor] Model ${modelName} failed:`, error?.message || error);
      lastError = error;
      continue;
    }
  }

  const message = lastError?.message || 'All receipt extraction models failed';
  const wrapped = new Error(message);
  if (/No JSON object found/i.test(message)) {
    (wrapped as any).code = 'EXTRACTION_PARSE_FAILED';
  } else if (/404|not found|supported for generateContent/i.test(message)) {
    (wrapped as any).code = 'MODEL_UNAVAILABLE';
  } else {
    (wrapped as any).code = 'EXTRACTION_FAILED';
  }
  throw wrapped;
}

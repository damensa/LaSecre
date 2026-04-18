import { GoogleGenerativeAI } from '@google/generative-ai';
import { researchAeatCriteria } from './agents/aeat-research';
import { ExtractedReceiptData } from '../types/fiscal';

const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || '').trim());
const CHAT_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

export interface FiscalChatResult {
  resposta: string;
  intent: string;
  extra?: any;
  usedAeatResearch?: boolean;
}

export function looksLikeFiscalQuestion(text: string): boolean {
  return /aeat|agencia tributaria|hisenda|hacienda|iva|irpf|retenci[oó]|dedu[iï]ble|desgrava|factura simplificada|factura completa|veri\*factu|ticket|tiquet/i.test(text);
}

function buildPseudoReceiptFromText(text: string): ExtractedReceiptData {
  const lower = text.toLowerCase();
  return {
    comerç: '',
    cif: '',
    numero_factura: '',
    tipus_document: /simplificada|ticket|tiquet/.test(lower) ? 'Factura simplificada' : 'Desconegut',
    data: '',
    import_total: 0,
    base_imposable: 0,
    percentatge_iva: /\b21\b/.test(lower) ? 21 : /\b10\b/.test(lower) ? 10 : /\b4\b/.test(lower) ? 4 : 0,
    import_iva: 0,
    import_retencio: /retenci[oó]|irpf/.test(lower) ? 1 : 0,
    percentatge_retencio: /\b15\b/.test(lower) ? 15 : /\b7\b/.test(lower) ? 7 : 0,
    categoria: 'Consulta fiscal',
    tipus: 'COMPRA',
    warnings: [],
    confidence: {},
  };
}

export async function chatWithFiscalContext(history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessage: string): Promise<FiscalChatResult> {
  let aeatBlock = '';
  let usedAeatResearch = false;

  if (looksLikeFiscalQuestion(newMessage)) {
    const pseudoReceipt = buildPseudoReceiptFromText(newMessage);
    const research = await researchAeatCriteria(pseudoReceipt, []);
    if (research.consulted) {
      usedAeatResearch = true;
      aeatBlock = `\n\nContext AEAT contrastat:\n- Resum: ${research.summary}\n- Fonts: ${research.sources.map(s => `${s.title}: ${s.url}`).join(' | ')}`;
    }
  }

  let lastError = null;

  for (const modelName of CHAT_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const systemInstructions = `Ets TuSecre, un assistent fiscal per WhatsApp per a autònoms i petites empreses.
Parla clar, curt i en català o castellà segons l'usuari.
Si la consulta és fiscal, prioritza prudència i criteri pràctic. No inventis normativa.${aeatBlock}

Retorna UN JSON amb aquest format:
{
  "resposta": "text per l'usuari",
  "intent": "EXPORT_QUARTER" | "SET_ACCOUNTANT" | "SET_FISCAL_DATA" | "DELETE_DATA" | "GET_BALANCE" | "NONE",
  "extra": {}
}`;

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemInstructions }] },
          { role: 'model', parts: [{ text: "D'acord, jefe. Vaig al gra." }] },
          ...history
        ],
      });

      const result = await chat.sendMessage(newMessage);
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { resposta: text, intent: 'NONE' };
      return { ...parsed, usedAeatResearch };
    } catch (e: any) {
      lastError = e;
      continue;
    }
  }

  throw lastError || new Error('All fiscal chat models failed');
}

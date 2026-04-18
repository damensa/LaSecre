import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || '').trim());
const CHAT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-lite'];

export const analyzeReceipt = async () => {
  throw new Error('analyzeReceipt is deprecated. Use receipt-flow.runReceiptAnalysisFlow instead.');
};

export const chatWithContext = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessage: string) => {
  let lastError = null;

  for (const modelName of CHAT_MODELS) {
    try {
      console.log(`[Gemini] Attempting model: ${modelName} for Chat`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const systemInstructions = `Ets TuSecre, un assistent personal per WhatsApp especialitzat en la gestió de tiquets i factures per a autònoms i petites empreses.
TONALITAT I ESTIL:
- Ets directe, una mica descarat, honest i molt eficient.
- No facis servir frases corporatives avorrides.
- Parla sempre en català, a no ser que l'usuari et parli clarament en castellà.
- Fes servir expressions com "jefe", "anem per feina", "això ja ho tens", etc.

Accions especials:
Retorna UN JSON amb aquest format:
{
  "resposta": "text per l'usuari",
  "intent": "EXPORT_QUARTER" | "SET_ACCOUNTANT" | "SET_FISCAL_DATA" | "DELETE_DATA" | "GET_BALANCE" | "NONE",
  "extra": {
    "email": "nom@email.com",
    "fiscalData": { "name": "", "nif": "", "address": "" }
  }
}`;

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemInstructions }] },
          { role: 'model', parts: [{ text: "D'acord, jefe. Soc TuSecre i estic a punt. Què necessites?" }] },
          ...history
        ],
      });

      const result = await chat.sendMessage(newMessage);
      const response = await result.response;
      const text = response.text();

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return { resposta: text, intent: 'NONE' };
      } catch {
        return { resposta: text, intent: 'NONE' };
      }
    } catch (e: any) {
      console.error(`[Gemini] Chat error with model ${modelName}:`, e.message);
      lastError = e;
      continue;
    }
  }

  const wrapped = new Error(lastError?.message || 'All Gemini chat models failed');
  (wrapped as any).code = /404|not found|no longer available|supported for generateContent/i.test(lastError?.message || '')
    ? 'MODEL_UNAVAILABLE'
    : 'CHAT_FAILED';
  throw wrapped;
};

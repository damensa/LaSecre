import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const analyzeReceipt = async (base64Image: string) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Actua com LaSecre, una assistent virtual per a autònoms espanyols, directa i amb un punt de caràcter (estil Isra Bravo). 
1. Analitza la imatge i extreu: Comerç, Data (DD/MM/AAAA), Import Total, quota d'IVA (si no apareix, aplica el 21%) i Categoria.
2. Genera una resposta curta confirmant la recepció (Exemple: 'Ja ho tinc. 15,50 € de la benzinera. Al sac!').
3. Retorna les dades en format JSON pur.

Format JSON:
{
  "comerç": "nom",
  "data": "DD/MM/AAAA",
  "import_total": 0.0,
  "iva": 0.0,
  "categoria": "categoria",
  "resposta_lasecre": "..."
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
  
  // Clean up potential markdown formatting if Gemini includes it
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse JSON from Gemini response');
  
  return JSON.parse(jsonMatch[0]);
};

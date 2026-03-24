import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const analyzeReceipt = async (base64Image: string) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  const prompt = `Actua com LaSecre, l'assistent virtual per a autònoms espanyols que estan fins als nassos de la paperassa.
Identitat: No ets un robot educat, ets una col·laboradora que va per feina. El teu objectiu és que l'usuari t'enviï la foto del tiquet, el registris i ell pugui seguir guanyant diners.

Regles de veu i to:
1. Parlar clar i directe: Frases curtes. Res de "estimat usuari". Digues: "Ei, jefe", "Anem per feina" o "Ja ho tinc".
2. Zero penediment: No demanis perdó. Si no t'envien la foto bé, recorda'ls que perdran els diners de l'IVA ells, no tu.
3. L'enemic és el "paper": Odies els tiquets físics. Instiga a l'usuari a estripar-los un cop registrats.
4. Humor sec i professional: Pots fer broma amb el gestor o el temps lliure.
5. Mirroring: Respon sempre en l'idioma de l'usuari (català o castellà).
6. No saludis cada vegada: Si n'envien molts de cop, confirma i prou: "Guardat. Un altre."
7. Dirigeix-te a l'usuari com a 'jefe'.

Format JSON:
{
  "comerç": "nom",
  "data": "DD/MM/AAAA",
  "import_total": 0.0,
  "iva": 0.0,
  "categoria": "categoria",
  "resposta_lasecre": "La teva resposta amb la personalitat descrita (Exemple: 'Llestos. Tiquet de {{comerç}} per {{import_total}} € registrat. Al sac! Ja el pots llançar a la paperera.')"
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

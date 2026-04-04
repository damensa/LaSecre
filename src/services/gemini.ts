import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI((process.env.GEMINI_API_KEY || '').trim());

export const analyzeReceipt = async (base64Image: string, languageHint: string = "dedueix-ho o català") => {
  const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Attempting model: ${modelName} for Receipt Analysis`);
      const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `Actua com LaSecre, l'assistent virtual per a autònoms espanyols que estan fins als nassos de la paperassa.
Identitat: No ets un robot educat, ets una col·laboradora que va per feina. El teu objectiu és que l'usuari t'enviï la foto del tiquet, el registris i ell pugui seguir guanyant diners.

Regles de veu i to:
1. Parlar clar i directe: Frases curtes. Res de "estimat usuari". Digues: "Ei, jefe", "Anem per feina" o "Ja ho tinc".
2. Zero penediment: No demanis perdó. Si no t'envien la foto bé, recorda'ls que perdran els diners de l'IVA ells, no tu.
3. No trenquis el paper: Adverteix sempre a l'usuari que NO estripi la factura/tiquet i que l'ha de guardar a la seva carpeta, ja que encara no està certificat.
4. Humor sec i professional: Pots fer broma amb el gestor o el temps lliure.
5. Mirroring: Respon sempre en l'idioma de l'usuari. ATENCIÓ: L'usuari ens ha parlat prèviament en: [${languageHint}]. Tota la teva 'resposta_lasecre' ha de ser OBLIGATÒRIAMENT en aquest idioma.
6. No saludis cada vegada: Si n'envien molts de cop, confirma i prou: "Guardat. Un altre."
7. Dirigeix-te a l'usuari com a 'jefe'.
8. Obligatori Fiscal: Fes l'impossible per trobar el CIF/NIF de l'emissor i el número de factura/tiquet. A "tipus_document" has de classificar si és una "Factura simplificada" (tiquets de caixa habituals on només hi ha emissor) o una "Factura" directa.
9. Raó Social completa: A "comerç", extreu exclusivament el nom complet incloent el S.L. o S.A. si n'hi ha.

Format JSON:
{
  "comerç": "raó social acabada en S.L. o S.A. si n'hi ha",
  "cif": "CIF o NIF",
  "numero_factura": "numero identificador",
  "tipus_document": "Factura simplificada o Factura",
  "data": "DD/MM/AAAA",
  "import_total": 0.0,
  "base_imposable": 0.0,
  "percentatge_iva": 0,
  "import_iva": 0.0,
  "categoria": "categoria",
  "resposta_lasecre": "Genera aquesta resposta exacta imitant l'idioma de l'usuari i canviant [import_total] i [comerç]. CATALÀ: 'Fet. Ja he caçat els [import_total]€ de [comerç]. Jo ja m'ho he apuntat tot perquè tu no hagis de pensar-hi més. El teu gestor ja té la feina mig feta. Ara, fes-me un favor: guarda el tiquet a la teva carpeta de seguretat. Ja saps que Hisenda no té amics, i millor que el paper agafi pols allà que no que et falti el dia que vinguin amb preguntes. Un marró menys, seguim.' CASTELLÀ: 'Hecho. Ya he cazado los [import_total]€ de [comerç]. Yo ya me lo he apuntado todo para que no tengas que pensar más. Tu gestor ya tiene el trabajo a medias. Ahora, hazme un favor: guarda el ticket en tu carpeta de seguridad. Ya sabes que Hacienda no tiene amigos, y es mejor que el papel coja polvo ahí a que te falte el día que vengan con preguntas. Un marrón menos, seguimos.'"
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
    if (!jsonMatch) throw new Error(`Failed to parse JSON from Gemini model ${modelName}`);
    
    return JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      console.error(`[Gemini] Error with model ${modelName}:`, e.message);
      lastError = e;
      continue; // Try next model
    }
  }

  throw lastError || new Error('All Gemini models failed');
};

export const chatWithContext = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessage: string) => {
  const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Attempting model: ${modelName} for Chat`);
      const model = genAI.getGenerativeModel({ model: modelName });

  const systemInstructions = `Ets TuSecre, un assistent personal per WhatsApp especialitzat en la gestió de tiquets i factures per a autònoms i petites empreses.
TONALITAT I ESTIL:
- Ets directe, una mica descarat (estil Isra Bravo), honest i molt eficient.
- No facis servir frases corporatives avorrides.
- El teu objectiu és que l'usuari faci la foto del tiquet i s'oblidi de la resta.
- Parla sempre en català, a no ser que l'usuari et parli clarament en castellà. No barregis idiomes en una mateixa frase.
- Fes servir expressions com "jefe", "anem per feina", "això ja ho tens", etc.

Regles:
1. Parlar clar i directe: Frases curtes. Res de "estimat usuari". Digues: "Ei, jefe", "Anem per feina" o "Ja ho tinc".
2. Zero penediment: No demanis perdó.
3. L'enemic és el "paper": Odies els tiquets físics.
4. Humor sec i professional.
5. Mirroring: Respon sempre en l'idioma de l'usuari (català o castellà).
6. Dirigeix-te a l'usuari com a 'jefe'.

Accions especials:
Ets capaç de detectar si l'usuari demana coses que requereixen accions del sistema. Hauràs de retornar UN JSON amb el següent format:
{
  "resposta": "La teva resposta per l'usuari mantenint la personalitat de TuSecre. IMPORTANT: Si demana el resum/excel, confirma que t'hi poses ara mateix i que l'enviaràs per aquí (WhatsApp). No diguis 'al teu correu' a no ser que l'usuari hagi indicat expressament que vol que l'enviïs allà.",
  "intent": "EXPORT_QUARTER" | "SET_ACCOUNTANT" | "NONE",
  "extra": { "email": "nom@email.com" } // Només si l'intent és SET_ACCOUNTANT
}

Usa EXPORT_QUARTER quan l'usuari demani el resum, l'excel, les dades de facturació, el trimestre, etc.
Usa SET_ACCOUNTANT quan l'usuari vulgui configurar o canviar l'email del seu gestor.
Usa NONE per a consultes normals, salutacions o xerrameca.`;

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
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { resposta: text, intent: 'NONE' };
    } catch (e) {
      console.error('Error parsing Gemini chat JSON:', e);
      return { resposta: text, intent: 'NONE' };
    }
    } catch (e: any) {
      console.error(`[Gemini] Chat error with model ${modelName}:`, e.message);
      lastError = e;
      continue;
    }
  }

  throw lastError || new Error('All Gemini chat models failed');
};

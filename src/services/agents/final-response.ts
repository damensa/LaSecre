import { ExtractedReceiptData, FiscalValidationResult } from '../../types/fiscal';

function formatAmount(value: number): string {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function isSpanishLanguage(languageHint: string): boolean {
  return /castell|espa[nñ]ol|hola|quiero|factura|ticket/i.test(languageHint || '');
}

export function buildReceiptUserResponse(data: ExtractedReceiptData, validation: FiscalValidationResult, languageHint = 'ca'): string {
  const isSpanish = isSpanishLanguage(languageHint);
  const amount = formatAmount(data.import_total || 0);
  const merchant = data.comerç || (isSpanish ? 'ese comercio' : 'aquest comerç');

  if (data.tipus === 'VENDA') {
    return isSpanish
      ? `¡Hecho jefe! He registrado tu factura de venta de ${amount}€ para ${merchant}. Así me gusta, haciendo caja. Ya lo tengo apuntado para el resumen del trimestre.`
      : `Fet jefe! He registrat la teva factura de venda de ${amount}€ per a ${merchant}. Així m'agrada, fent caixa. Ja ho tinc apuntat per al resum del trimestre.`;
  }

  const needsReviewTail = validation.reviewRequired
    ? (isSpanish
        ? ' Ojo, hay un par de cosas raras y la dejo marcada para revisión.'
        : ' Ull, hi ha un parell de coses rares i la deixo marcada per revisar.')
    : '';

  const aeatTail = validation.aeatResearch?.consulted
    ? (isSpanish
        ? ' Además, he contrastado el caso con referencias AEAT para no ir a ciegas.'
        : ' A més, he contrastat el cas amb referències AEAT per no anar a cegues.')
    : validation.needsAeatResearch
      ? (isSpanish
          ? ' Además, esto huele a caso fiscal fino, así que mejor contrastarlo con criterio AEAT.'
          : ' A més, això fa pinta de cas fiscal fi, així que millor contrastar-ho amb criteri AEAT.')
      : '';

  const retentionTail = (data.import_retencio || 0) > 0
    ? (isSpanish
        ? ' He visto la retención, yo la apunto pero acuérdate del modelo 111 o de pasárselo al gestor.'
        : ' He vist la retenció, jo l’apunto però recorda el model 111 o passar-li al gestor.')
    : '';

  return isSpanish
    ? `Hecho. Ya he cazado los ${amount}€ de ${merchant}. Yo ya me lo he apuntado para que no tengas que pensar más. Guarda el ticket en tu carpeta de seguridad.${retentionTail}${needsReviewTail}${aeatTail}`
    : `Fet. Ja he caçat els ${amount}€ de ${merchant}. Jo ja m'ho he apuntat perquè tu no hi hagis de pensar més. Guarda el tiquet a la teva carpeta de seguretat.${retentionTail}${needsReviewTail}${aeatTail}`;
}

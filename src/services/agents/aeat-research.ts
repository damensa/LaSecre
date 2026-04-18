import axios from 'axios';
import { ExtractedReceiptData, FiscalValidationIssue } from '../../types/fiscal';

export interface AeatResearchResult {
  consulted: boolean;
  summary: string;
  sources: { title: string; url: string }[];
  findings: string[];
}

const AEAT_URLS = [
  {
    title: 'AEAT - Inicio',
    url: 'https://sede.agenciatributaria.gob.es/',
  },
  {
    title: 'AEAT - IVA',
    url: 'https://sede.agenciatributaria.gob.es/Sede/iva.html',
  },
  {
    title: 'AEAT - SIF y VERI*FACTU',
    url: 'https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html',
  },
];

async function fetchSnippet(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    timeout: 8000,
    responseType: 'text',
    headers: {
      'User-Agent': 'TuSecre/1.0 (+AEAT research)',
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const html = String(response.data || '');
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

function buildFindings(data: ExtractedReceiptData, issues: FiscalValidationIssue[], snippets: string[]): string[] {
  const findings: string[] = [];

  if ((data.percentatge_retencio || 0) > 0) {
    findings.push('El document inclou retenció. Cal contrastar el tractament formal i la declaració associada.');
  }

  if ((data.percentatge_iva || 0) > 0 && ![4, 10, 21].includes(data.percentatge_iva)) {
    findings.push(`S'ha detectat un IVA poc habitual (${data.percentatge_iva}%). Pot requerir verificació normativa.`);
  }

  if (issues.some(issue => issue.code === 'TOTAL_MISMATCH')) {
    findings.push('Els imports no quadren exactament. Cal revisar si hi ha línies múltiples, descomptes o lectura OCR deficient.');
  }

  if ((data.tipus_document || '') === 'Factura simplificada') {
    findings.push('Com que és una factura simplificada, convé revisar si compleix els requisits mínims per a deducció i identificació.');
  }

  if (snippets.some(text => /preguntas frecuentes|normativa|criterios interpretativos/i.test(text))) {
    findings.push('S’han trobat seccions de normativa o criteris interpretatius de l’AEAT que poden servir de suport.');
  }

  if (snippets.some(text => /veri\*factu|sistemas inform[aá]ticos de facturaci[oó]n/i.test(text))) {
    findings.push('S\'han trobat referències AEAT sobre facturació i SIF/VERI*FACTU útils per a casos d\'emissió i traçabilitat.');
  }

  return findings;
}

export async function researchAeatCriteria(data: ExtractedReceiptData, issues: FiscalValidationIssue[]): Promise<AeatResearchResult> {
  const snippets: string[] = [];
  const sources: { title: string; url: string }[] = [];

  for (const source of AEAT_URLS) {
    try {
      const text = await fetchSnippet(source.url);
      if (text) {
        snippets.push(text);
        sources.push(source);
      }
    } catch {
      continue;
    }
  }

  const findings = buildFindings(data, issues, snippets);
  const summary = findings.length
    ? findings.join(' ')
    : 'No s\'ha trobat criteri específic concloent, però convé revisar el cas al portal de l\'AEAT.';

  return {
    consulted: sources.length > 0,
    summary,
    sources,
    findings,
  };
}

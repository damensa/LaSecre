import { generateQuarterlyExcel } from '../src/services/export';
import prisma from '../src/utils/prisma';
import fs from 'fs';
import path from 'path';

async function test() {
  const TEST_PHONE = '34600000000';
  const YEAR = 2026;
  const QUARTER = 1; // Gener-Març

  console.log('--- Iniciant prova d\'exportació ---');

  // 1. Crear dades de prova
  await prisma.receipt.createMany({
    data: [
      { userPhone: TEST_PHONE, merchant: 'Benzinera Repsol', date: '15/01/2026', total: 50.0, vat: 10.5, category: 'Transport' },
      { userPhone: TEST_PHONE, merchant: 'Mercadona', date: '20/02/2026', total: 35.20, vat: 1.40, category: 'Alimentació' },
      { userPhone: TEST_PHONE, merchant: 'Apple Store', date: '05/03/2026', total: 1200.0, vat: 210.0, category: 'Tecnologia' },
      { userPhone: TEST_PHONE, merchant: 'Sopar vell', date: '20/12/2025', total: 40.0, vat: 4.0, category: 'Restauració' }, // No hauria de sortir (any passat)
    ]
  });

  console.log('✅ Dades de prova creades.');

  // 2. Generar Excel
  try {
    const filePath = await generateQuarterlyExcel(TEST_PHONE, YEAR, QUARTER);
    
    if (filePath && fs.existsSync(filePath)) {
      console.log(`✅ Excel generat correctament a: ${filePath}`);
      console.log(`Mida del fitxer: ${fs.statSync(filePath).size} bytes`);
      
      // Neteja (opcional)
      // fs.unlinkSync(filePath);
    } else {
      console.log('❌ Error: No s\'ha generat el fitxer o no s\'ha trobat.');
    }
  } catch (error) {
    console.error('❌ Error durant la generació:', error);
  } finally {
    // Netejar dades de prova
    await prisma.receipt.deleteMany({ where: { userPhone: TEST_PHONE } });
    console.log('🧹 Dades de prova esborrades.');
    await prisma.$disconnect();
  }
}

test();

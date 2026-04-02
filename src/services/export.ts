import { Workbook } from 'exceljs';
import path from 'path';
import fs from 'fs';
import { startOfQuarter, endOfQuarter, format } from 'date-fns';
import * as airtableService from './airtable';

export const generateQuarterlyExcel = async (userPhone: string, year: number, quarter: number) => {
  // 1. Calcular dates
  const startDate = startOfQuarter(new Date(year, (quarter - 1) * 3, 1));
  const endDate = endOfQuarter(new Date(year, (quarter - 1) * 3, 1));

  console.log(`[Export] Generating Excel for ${userPhone}, Quarter ${quarter} of ${year}`);

  // 2. Cercar tiquets a Airtable per obtenir enllaços permanents
  const filteredReceipts = await airtableService.getTicketsByQuarter(userPhone, startDate, endDate);

  if (!filteredReceipts || filteredReceipts.length === 0) {
    console.log(`[Export] No receipts found in Airtable for ${userPhone} in Q${quarter}`);
    return null;
  }

  // 3. Crear l'Excel (la resta de la lògica es manté igual)
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(`Trimestre ${quarter} - ${year}`);

  worksheet.columns = [
    { header: 'Data Registre', key: 'createdAt', width: 20 },
    { header: 'Data Tiquet', key: 'date', width: 15 },
    { header: 'Comerç', key: 'merchant', width: 25 },
    { header: 'CIF', key: 'cif', width: 15 },
    { header: 'Tipus Document', key: 'invoiceType', width: 20 },
    { header: 'Núm. Factura', key: 'invoiceNumber', width: 15 },
    { header: 'Import Total', key: 'total', width: 15 },
    { header: 'Base Imposable', key: 'baseAmount', width: 15 },
    { header: '% IVA', key: 'vatPercentage', width: 10 },
    { header: 'Quota_IVA', key: 'vat', width: 15 },
    { header: 'Categoria', key: 'category', width: 20 },
    { header: 'Enllaç Foto', key: 'imageUrl', width: 30 },
  ];

  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  filteredReceipts.forEach((r: any) => {
    worksheet.addRow({
      createdAt: r.createdAt.toLocaleString('ca-ES'),
      date: r.date,
      merchant: r.merchant,
      cif: r.cif,
      invoiceType: r.invoiceType,
      invoiceNumber: r.invoiceNumber,
      total: r.total,
      baseAmount: r.baseAmount,
      vatPercentage: r.vatPercentage,
      vat: r.vat,
      category: r.category,
      imageUrl: r.imageUrl ? { text: '🔗 Veure tiquet', hyperlink: r.imageUrl, tooltip: 'Obrir imatge' } : ''
    });
  });

  // 5. Guardar fitxer temporal
  const tmpDir = path.join(process.cwd(), 'tmp');
  const today = format(new Date(), 'yyyyMMdd');
  const fileName = `lasecre_${userPhone}_T${quarter}-${year}_${today}.xlsx`;
  const filePath = path.join(tmpDir, fileName);
  
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

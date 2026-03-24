import { Workbook } from 'exceljs';
import path from 'path';
import fs from 'fs';
import prisma from '../utils/prisma';
import { startOfQuarter, endOfQuarter, parse } from 'date-fns';

export const generateQuarterlyExcel = async (userPhone: string, year: number, quarter: number) => {
  // 1. Calcular dates
  // Quarter és 1-indexed (1, 2, 3, 4)
  const startDate = startOfQuarter(new Date(year, (quarter - 1) * 3, 1));
  const endDate = endOfQuarter(new Date(year, (quarter - 1) * 3, 1));

  // 2. Cercar tiquets
  // Nota: Com que la data es guarda com a String (DD/MM/AAAA), primer els portem tots i filtrem en memòria.
  // En el futur, seria millor guardar la data en format ISO o camp DateTime.
  const receipts = await prisma.receipt.findMany({
    where: { userPhone },
    orderBy: { createdAt: 'asc' }
  });

  // 3. Filtrar tiquets per data
  const filteredReceipts = receipts.filter(r => {
    if (!r.date) return false;
    try {
      // Intentem parsejar el format DD/MM/AAAA
      const receiptDate = parse(r.date, 'dd/MM/yyyy', new Date());
      return receiptDate >= startDate && receiptDate <= endDate;
    } catch (e) {
      return false;
    }
  });

  if (filteredReceipts.length === 0) {
    return null;
  }

  // 4. Crear l'Excel
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(`Trimestre ${quarter} - ${year}`);

  worksheet.columns = [
    { header: 'Data', key: 'date', width: 15 },
    { header: 'Comerç', key: 'merchant', width: 25 },
    { header: 'Import Total', key: 'total', width: 15 },
    { header: 'IVA Estimat', key: 'vat', width: 15 },
    { header: 'Categoria', key: 'category', width: 20 },
  ];

  filteredReceipts.forEach(r => {
    worksheet.addRow({
      date: r.date,
      merchant: r.merchant,
      total: r.total,
      vat: r.vat,
      category: r.category
    });
  });

  // Estil de la capçalera
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // 5. Guardar fitxer temporal
  const tmpDir = path.join(process.cwd(), 'tmp');
  const fileName = `resum_lasecre_Q${quarter}_${year}.xlsx`;
  const filePath = path.join(tmpDir, fileName);
  
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir);
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

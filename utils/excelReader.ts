// utils/excelReader.ts
import ExcelJS from 'exceljs';
import path from 'path';

/**
 * Normalize header text: trim and replace newlines
 */
function normalizeHeader(h: string): string {
  return h ? h.toString().trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ') : '';
}

/**
 * Read one sheet and convert to array of objects
 */
export async function readSheet(filePath: string, sheetName: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);

  // build headers from first non-empty row (assume header is row 1)
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(cell.text || cell.value || '');
  });

  const results: Array<Record<string, string>> = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    // Skip row if all cells empty
    const hasValues = row.values && row.values.some((v: any) => v !== null && v !== undefined && String(v).trim() !== '');
    if (!hasValues) continue;

    const obj: Record<string, string> = {};
    for (let c = 1; c <= headerRow.cellCount; c++) {
      const rawHeader = headers[c];
      if (!rawHeader) continue; // skip unnamed header cells
      const cell = row.getCell(c);
      let val: any = cell.value;
      // convert rich types to string safely
      if (val === null || val === undefined) val = '';
      else if (typeof val === 'object' && (val as any).richText) val = (val as any).richText.map((t: any) => t.text).join('');
      else if (typeof val === 'object' && (val as any).text) val = (val as any).text;
      obj[rawHeader] = String(val).trim();
    }
    results.push(obj);
  }
  return results;
}

/**
 * Read all sheets and return mapping sheetName => rows[]
 */
export async function readAllSheets(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const mapping: Record<string, Array<Record<string, string>>> = {};
  workbook.eachSheet((ws) => {
    // skip completely empty sheets
    if (!ws || ws.rowCount < 2) return;
    mapping[ws.name] = [];
    // reuse readSheet() logic locally to avoid re-reading file
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber] = normalizeHeader(cell.text || cell.value || '');
    });
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const hasValues = row.values && row.values.some((v: any) => v !== null && v !== undefined && String(v).trim() !== '');
      if (!hasValues) continue;
      const obj: Record<string, string> = {};
      for (let c = 1; c <= headerRow.cellCount; c++) {
        const rawHeader = headers[c];
        if (!rawHeader) continue;
        let val: any = row.getCell(c).value;
        if (val === null || val === undefined) val = '';
        else if (typeof val === 'object' && (val as any).richText) val = (val as any).richText.map((t: any) => t.text).join('');
        else if (typeof val === 'object' && (val as any).text) val = (val as any).text;
        obj[rawHeader] = String(val).trim();
      }
      mapping[ws.name].push(obj);
    }
  });
  return mapping;
}

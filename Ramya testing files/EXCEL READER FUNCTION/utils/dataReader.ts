import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';

/**
 * Supported data file types
 */
export type DataFileType = 'excel' | 'csv';

/**
 * Generic row type
 */
export type DataRow = Record<string, string>;

/**
 * Options for reading data
 */
export interface ReadDataOptions {
  sheetName?: string;                     // Excel only
  filter?: (row: DataRow) => boolean;     // Row filtering
  random?: boolean;                       // Return random row
}

/**
 * Universal data reader (Excel / CSV)
 */
export function readData(
  fileName: string,
  type: DataFileType,
  options: ReadDataOptions = {}
): DataRow[] | DataRow {
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ Data file not found: ${filePath}`);
  }

  let rows: DataRow[] = [];

  if (type === 'excel') {
    const workbook = xlsx.readFile(filePath);
    const sheet =
      workbook.Sheets[
        options.sheetName || workbook.SheetNames[0]
      ];

    if (!sheet) {
      throw new Error(`❌ Sheet not found in ${fileName}`);
    }

    rows = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false
    });
  }

  if (type === 'csv') {
    const workbook = xlsx.readFile(filePath, { type: 'file' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false
    });
  }

  // 🔍 Apply filtering if provided
  if (options.filter) {
    rows = rows.filter(options.filter);
  }

  if (!rows.length) {
    throw new Error(`❌ No matching rows found in ${fileName}`);
  }

  // 🎯 Random selection
  if (options.random) {
    return rows[Math.floor(Math.random() * rows.length)];
  }

  return rows;
}

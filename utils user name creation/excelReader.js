const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

function tryPaths() {
  // candidate locations (relative to this file)
  return [
    path.resolve(__dirname, 'signup information.xlsx'),
    path.resolve(__dirname, '..', 'signup information.xlsx'),
    path.resolve(__dirname, 'test-data', 'signup information.xlsx'),
    path.resolve(__dirname, '..', 'test-data', 'signup information.xlsx'),
    path.resolve(process.cwd(), 'signup information.xlsx'),
    path.resolve(process.cwd(), 'test-data', 'signup information.xlsx')
  ];
}

function normalizeHeader(h) {
  if (!h || typeof h !== 'string') return '';
  return h.trim().toLowerCase().replace(/[\s_\-]+/g, ' ');
}

function canonicalizeRow(rawRow) {
  // Map many possible header names to canonical keys expected by signup
  const map = {};
  for (const k of Object.keys(rawRow)) {
    const nk = normalizeHeader(k);
    map[nk] = rawRow[k];
  }
  // build canonical object
  return {
    Name: map['name'] || map['full name'] || map['firstname'] || map['first name'] || map['first'] || '',
    Email: map['email'] || map['e-mail'] || map['email address'] || '',
    Password: map['password'] || map['pass'] || map['pwd'] || '',
    Company: map['company'] || '',
    Address: map['address'] || map['address 1'] || map['street address'] || '',
    Address2: map['address 2'] || map['address2'] || '',
    Country: map['country'] || '',
    State: map['state'] || '',
    City: map['city'] || '',
    Zipcode: map['zipcode'] || map['zip'] || map['postal code'] || '',
    Mobile: map['mobile'] || map['mobile number'] || map['phone'] || '',
    Day: map['day'] || '',
    Month: map['month'] || '',
    Year: map['year'] || ''
  };
}

function readSignupData() {
  const candidates = tryPaths();
  let found = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { found = p; break; }
  }

  if (!found) {
    console.error('excelReader: could not find "signup information.xlsx". Tried:', candidates.join('\n  '));
    throw new Error('signup information.xlsx not found. Put it in project root or test-data/ or same folder as excelReader.js');
  }

  console.log('excelReader: using Excel file:', found);
  const workbook = xlsx.readFile(found, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  let json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  // remove fully-empty rows
  json = json.filter(row => {
    return Object.values(row).some(v => v !== '' && v !== null && v !== undefined);
  });

  // canonicalize keys and trim string values
  const cleaned = json.map((r, i) => {
    const canon = canonicalizeRow(r);
    for (const k of Object.keys(canon)) {
      if (typeof canon[k] === 'string') canon[k] = canon[k].trim();
    }
    // preserve raw for debugging
    canon._raw = r;
    canon._rowIndex = i + 2; // approximate excel row (header=1)
    return canon;
  });

  console.log(`excelReader: loaded ${cleaned.length} rows (non-empty) from sheet "${sheetName}"`);
  if (cleaned.length === 0) {
    console.warn('excelReader: WARNING - spreadsheet contains no usable rows. Check header names & content.');
  }
  return cleaned;
}

module.exports = { readSignupData };
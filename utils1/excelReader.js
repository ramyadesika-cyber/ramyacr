const xlsx = require('xlsx');

function readSignupData() {
  const workbook = xlsx.readFile('./test-data/signup information.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  console.log("Excel Data Loaded:", data);
  return data;
}

module.exports = { readSignupData };
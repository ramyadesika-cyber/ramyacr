import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { readCSV } from "../utils/csvReader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL =
  "http://91.108.104.154:8801/api/enowRiskBusinessUnit/create";

const DATA_FILE = path.join(__dirname, "../data/business-units.csv");

async function seedBusinessUnits() {
  console.log("📥 Reading data file...");
  const records = await readCSV(DATA_FILE);

  if (!records.length) {
    console.error("❌ CSV is empty");
    return;
  }

  console.log(`➡️  Preparing ${records.length} business units`);

  // 🔴 BUILD ONE BULK PAYLOAD
  const payload = records.map(record => ({
    organizationId: record.orgCode,
    businessUnitId: record.businessUnit,
    businessUnitDescription: record.description,
    updatedBy: "ADMIN"
  }));

  try {
    await axios.post(API_URL, payload, {
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json; charset=UTF-8"
      }
    });

    console.log(`✅ Successfully inserted ${payload.length} records`);
  } catch (error) {
    console.error("❌ Bulk insert failed");
    if (error.response) {
      console.error(
        "Status:",
        error.response.status,
        "Response:",
        error.response.data
      );
    } else {
      console.error(error.message);
    }
  }
}

seedBusinessUnits();

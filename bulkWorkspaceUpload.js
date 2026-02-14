import axios from "axios";
import XLSX from "xlsx";
import fs from "fs";

// ================= CONFIG =================
const BASE_URL = "http://91.108.104.154:8801";
const CREATE_API = "/api/enowadminworkspace/create";
const FILE_PATH = "Workspace_Bulk_Upload_Clean.xlsx";
const ORGANIZATION_ID = "XYZ";
const UPDATED_BY = "ADMIN";
// ==========================================

async function uploadWorkspaces() {
  console.log("📥 Reading Excel file...\n");

  const workbook = XLSX.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Do NOT use defval
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total rows found: ${data.length}\n`);

  let insertedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const rowNumber = i + 2;
    const row = data[i];

    // Clean workspace ID (remove double spaces)
    const workspaceId = row["WORKSPACE ID *"]
      ?.toString()
      .replace(/\s+/g, " ")
      .trim();

    const workspaceDescription =
      row["WORKSPACE DESCRIPTION *"]?.toString().trim() || "";

    const imagePath =
      row["IMAGE FILE PATH *"]?.toString().trim() || "";

    const uploadStatus = row["UPLOAD STATUS (Auto)"];

    // Skip fully empty rows
    if (!workspaceId && !workspaceDescription && !imagePath) {
      continue;
    }

    console.log(
      `Row ${rowNumber} → ID: ${workspaceId} | Upload Status: ${uploadStatus}`
    );

    // Skip if no workspace ID
    if (!workspaceId) {
      console.log("⚠️ Skipped (No WORKSPACE ID)\n");
      continue;
    }

    // Only process blank upload status rows
    if (uploadStatus && uploadStatus.toString().trim() !== "") {
      console.log(`⏭ Skipped ${workspaceId} (Already processed)\n`);
      continue;
    }

    // Convert image to base64
    let base64Image = "";

    if (imagePath) {
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        base64Image = imageBuffer.toString("base64");
      } else {
        console.log(`⚠️ Image not found: ${imagePath}`);
      }
    }

    const payload = {
      organizationId: ORGANIZATION_ID,
      workspaceId: workspaceId,
      workspaceDescription: workspaceDescription,
      wsImage: base64Image,
      updatedBy: UPDATED_BY,
      updatedDateTime: new Date().toISOString().slice(0, 23),
      activeStatus: "Y"
    };

    // Clean logging (hide base64)
    const logPayload = {
      ...payload,
      wsImage: base64Image ? "[BASE64 IMAGE DATA]" : ""
    };

    try {
      console.log("Sending Payload:");
      console.log(JSON.stringify(logPayload, null, 2));

      const response = await axios.post(
        BASE_URL + CREATE_API,
        payload,
        {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      console.log("API Status:", response.status);
      console.log("API Response:", response.data);

      if (response.status === 200 || response.status === 201) {
        data[i]["UPLOAD STATUS (Auto)"] = "ADDED";
        insertedCount++;
        console.log(`✅ Inserted: ${workspaceId}\n`);
      } else {
        console.log(`❌ Unexpected response for ${workspaceId}\n`);
      }

    } catch (error) {
      console.log(`❌ Failed: ${workspaceId}`);

      if (error.response) {
        console.log("Status:", error.response.status);
        console.log("Response:", error.response.data);
      } else {
        console.log(error.message);
      }

      console.log("");
    }
  }

  // Rewrite Excel with updated status
  const newSheet = XLSX.utils.json_to_sheet(data);
  workbook.Sheets[sheetName] = newSheet;
  XLSX.writeFile(workbook, FILE_PATH);

  console.log(`🎉 Completed. ${insertedCount} rows inserted.`);
}

uploadWorkspaces();

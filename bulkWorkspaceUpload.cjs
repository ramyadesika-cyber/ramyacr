const { request } = require('@playwright/test');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const BASE_URL = 'http://91.108.104.154:8801';
const API_ENDPOINT = '/api/enowadminworkspace/create';

// Excel file path
const EXCEL_PATH = './Workspace_Bulk_Upload_Clean.xlsx';

// 🔐 If login token required, paste here
const AUTH_TOKEN = '';  // Add Bearer token if required

async function uploadWorkspaces() {

    console.log("Reading Excel file...");

    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows`);

    for (const row of data) {

        const workspaceId = row["WORKSPACE ID *"];
        const description = row["WORKSPACE DESCRIPTION *"];
        const imagePath = row["IMAGE FILE PATH *"];

        if (!workspaceId || !description) {
            console.log(`Skipping invalid row`);
            continue;
        }

        try {

            let form = new FormData();

            form.append('workspaceId', workspaceId);
            form.append('workspaceDescription', description);

            if (imagePath && fs.existsSync(imagePath)) {
                form.append('file', fs.createReadStream(imagePath));
            }

            const response = await axios.post(
                BASE_URL + API_ENDPOINT,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` })
                    }
                }
            );

            console.log(`✅ Uploaded: ${workspaceId} | Status: ${response.status}`);

        } catch (error) {
            console.log(`❌ Failed: ${workspaceId}`);
            console.log(error.response?.data || error.message);
        }
    }

    console.log("Bulk upload completed.");
}

uploadWorkspaces();

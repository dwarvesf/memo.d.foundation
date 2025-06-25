import path from 'path';
import StorageUtil from '../src/lib/storage.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { queryDuckDB } from '../src/lib/db/utils.js';

dotenv.config();

const CONTRIBUTOR_FILE_PATH = 'profiles/contributors.parquet';
const CONTRIBUTOR_PARQUET_DEST_FILE_PATH =
  'public/content/contributors.parquet';
const CONTRIBUTOR_DEST_FILE_PATH = 'public/content/contributors.json';

async function main() {
  try {
    const storage = new StorageUtil();
    const data = await storage.readData(CONTRIBUTOR_FILE_PATH);

    const destinationPath = path.join(
      process.cwd(),
      CONTRIBUTOR_PARQUET_DEST_FILE_PATH,
    );

    await fs.writeFile(destinationPath, data, 'binary');

    const profiles = await queryDuckDB(`SELECT * FROM contributors;`, {
      filePath: CONTRIBUTOR_PARQUET_DEST_FILE_PATH,
      tableName: 'contributors',
    });

    const jsonProfiles = (profiles as any[]).map(profile => {
      const output: Record<string, any> = {};

      Object.keys(profile).forEach(key => {
        try {
          output[key] = JSON.parse(profile[key]);
        } catch {
          output[key] = profile[key];
        }
      });

      return output;
    });

    // Convert to JSON string with proper formatting and escaping
    const jsonContent = JSON.stringify(jsonProfiles, null, 2);

    // Write the escaped JSON to file with utf-8 encoding
    await fs.writeFile(CONTRIBUTOR_DEST_FILE_PATH, jsonContent, 'utf-8');

    await fs.rm(destinationPath, { force: true }).catch(() => {});

    console.log(`File saved to ${destinationPath}`);
  } catch (error) {
    console.error('Error fetching and saving contributor stats:', error);
  }
}

main();

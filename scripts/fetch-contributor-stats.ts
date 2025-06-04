import path from 'path';
import StorageUtil from '../src/lib/storage.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const PROMPT_FILE_PATH = 'profiles/contributors.parquet';
const PROMPT_DEST_FILE_PATH = 'public/content/contributor-stats.parquet';

async function main() {
  try {
    const storage = new StorageUtil();
    const data = await storage.readData(PROMPT_FILE_PATH);

    const destinationPath = path.join(process.cwd(), PROMPT_DEST_FILE_PATH);
    await fs.writeFile(destinationPath, data, 'binary');

    console.log(`File saved to ${destinationPath}`);
  } catch (error) {
    console.error('Error fetching and saving contributor stats:', error);
  }
}

main();

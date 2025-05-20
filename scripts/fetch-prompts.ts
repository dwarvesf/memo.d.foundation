import path from 'path';
import StorageUtil from '../src/lib/storage.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const storage = new StorageUtil();
const PROMPT_FILE_PATH = 'prompts/prompts.parquet';
const PROMPT_DEST_FILE_PATH = 'public/content/prompts.parquet';

async function main() {
  try {
    const data = await storage.readData(PROMPT_FILE_PATH);

    const destinationPath = path.join(process.cwd(), PROMPT_DEST_FILE_PATH);
    await fs.writeFile(destinationPath, data, 'binary');

    console.log(`File saved to ${destinationPath}`);
  } catch (error) {
    console.error('Error fetching and saving prompts:', error);
  }
}

main();

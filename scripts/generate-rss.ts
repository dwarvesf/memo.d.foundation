// Use dynamic import for ESM compatibility
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentRssPath = resolve(__dirname, '../src/lib/content/rss.ts');

// Dynamically load the rss module
async function importRssModule() {
  // First copy the TS file to a temporary JS file
  const tsContent = fs.readFileSync(contentRssPath, 'utf8');
  const tempJsPath = resolve(__dirname, '../temp-rss.js');
  
  fs.writeFileSync(tempJsPath, tsContent);
  
  try {
    // Use dynamic import to load the module
    const rssModule = await import(tempJsPath);
    return rssModule.generateRSSFeeds;
  } finally {
    // Clean up temp file
    fs.unlinkSync(tempJsPath);
  }
}

// Get site URL from environment or use default
const SITE_URL = process.env.SITE_URL || 'https://memo.d.foundation';
const SITE_TITLE = 'Dwarves Memo';
const SITE_DESCRIPTION = 'Knowledge sharing platform for Dwarves Foundation';

async function main() {
  console.log('Generating RSS feeds...');
  
  try {
    // Dynamically import the RSS generator function
    const generateRSSFeeds = await importRssModule();
    
    // Generate the RSS feeds
    await generateRSSFeeds(
      SITE_URL,
      SITE_TITLE,
      SITE_DESCRIPTION
    );
    
    console.log('RSS feeds generated successfully!');
  } catch (error) {
    console.error('Error generating RSS feeds:', error);
    process.exit(1);
  }
}

main();
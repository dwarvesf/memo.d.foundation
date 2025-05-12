import fs from 'fs';
import matter from 'gray-matter';

/**
 * Extracts frontmatter data from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} - The frontmatter data and content
 */
function extractFrontmatter(filePath: string): {
  data: Record<string, any>;
  content: string;
} {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return matter(fileContent);
  } catch (error) {
    console.error(`Error reading frontmatter from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Main function to process all files and interact with the contract
 */
async function main() {
  try {
    // Get command line arguments (file paths)
    const filePaths = process.argv[2]
      .trim()
      .split(',')
      .filter(Boolean)
      .map(path => `vault/${path}`);

    if (filePaths.length === 0) {
      console.log('No files to process');
      return;
    }
    for (const filePath of filePaths) {
      const content = fs.readFileSync(filePath, 'utf8');
      const { data: frontmatter } = extractFrontmatter(content);
      // TODO: Notify Discord
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
main()
  .then(() => {
    console.log('Function executed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });

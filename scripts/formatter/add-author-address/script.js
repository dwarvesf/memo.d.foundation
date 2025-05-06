import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Function to read the JSON file with GitHub usernames to addresses mapping
function readAddressMap(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading address map file: ${error.message}`);
    process.exit(1);
  }
}

// Function to find all markdown files recursively
function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Function to process a markdown file
function processMarkdownFile(filePath, addressMap) {
  try {
    // Read and parse the markdown file with frontmatter
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContent);

    // Check if the file has authors in frontmatter
    if (!data.authors) {
      console.log(`Skipping ${filePath} (no authors field)`);
      return;
    }

    // Map authors to addresses, using empty string when no address is found
    const authorAddresses = data.authors.map(author => {
      if (addressMap[author]) {
        return addressMap[author];
      } else {
        console.warn(
          `Warning: No address found for author "${author}" in ${filePath} - using empty string`,
        );
        return '';
      }
    });

    // Update the frontmatter
    data.author_addresses = authorAddresses;

    // Serialize the updated frontmatter and content
    const updatedFileContent = matter.stringify(content, data);

    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedFileContent);
    console.log(`Updated ${filePath} with author addresses`);
  } catch (error) {
    console.error(`Error processing file ${filePath}: ${error.message}`);
  }
}

// Main function
function updateAuthorAddresses(addressMapPath) {
  console.log(`Reading address mapping from ${addressMapPath}`);
  const addressMap = readAddressMap(addressMapPath);

  console.log('Finding markdown files...');
  const markdownFiles = findMarkdownFiles('vault');
  console.log(`Found ${markdownFiles.length} markdown files`);

  console.log('Processing markdown files...');
  markdownFiles.forEach(file => {
    processMarkdownFile(file, addressMap);
  });

  console.log('Done!');
}

// Check command line arguments
if (process.argv.length < 3) {
  console.error('Usage: node script.js <address_map_file.json>');
  process.exit(1);
}

// Run the script with the provided JSON file
updateAuthorAddresses(process.argv[2]);

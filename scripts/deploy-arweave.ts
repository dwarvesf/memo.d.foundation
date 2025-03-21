import Arweave from "arweave";
import fs from "fs";
import matter from "gray-matter";
import crypto from "crypto";
import yaml from "js-yaml";

const DEFAULT_IMAGE = "ar://29D_NrcYOiOLMPVROGt5v3URNxftYCDK7z1-kyNPRT0";

// Initialize Arweave
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

// TypeScript interfaces
interface DeploymentResult {
  id: string;
  digest: string;
}

interface OutputResult extends DeploymentResult {
  file: string;
}

// Generate content digest
function generateDigest(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Extract the first image from markdown content
function extractFirstImage(content: string): string | null {
  // Match Markdown image syntax: ![alt text](image-url)
  const markdownImageRegex = /!\[.*?\]\((.*?)\)/;
  // Match HTML image tags: <img src="image-url" />
  const htmlImageRegex = /<img.*?src=["'](.*?)["'].*?>/;
  
  let match = content.match(markdownImageRegex) || content.match(htmlImageRegex);
  
  if (match && match[1]) {
    // Return the captured image URL/path
    return match[1].trim();
  }
  
  return null;
}

// Check if the path is a URL
function isURL(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ar://');
}

// Resolve a relative path by prefixing it with "vault" and handling double slashes
function resolvePath(path: string): string {
  if (isURL(path)) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Prefix with "vault" and normalize any double slashes
  const resolvedPath = `vault/${cleanPath}`.replace(/\/+/g, '/');
  
  return resolvedPath;
}

// Upload image to Arweave
async function uploadImageToArweave(
  walletPath: string,
  imagePath: string
): Promise<string | null> {
  try {
    // Skip if already an Arweave URL
    if (imagePath.startsWith('ar://')) {
      return imagePath;
    }
    
    // Load wallet from file
    const wallet = JSON.parse(
      fs.readFileSync(walletPath, { encoding: "utf8" })
    );
    
    // Read the image file
    let imageData;
    try {
      imageData = fs.readFileSync(imagePath);
    } catch (error) {
      console.error(`Error reading image file at ${imagePath}:`, error);
      return null;
    }
    
    // Determine the content type based on file extension
    const extension = imagePath.split('.').pop()?.toLowerCase();
    let contentType = 'image/jpeg'; // Default
    
    if (extension === 'png') contentType = 'image/png';
    else if (extension === 'gif') contentType = 'image/gif';
    else if (extension === 'svg') contentType = 'image/svg+xml';
    else if (extension === 'webp') contentType = 'image/webp';
    
    // Create transaction for the image
    const transaction = await arweave.createTransaction({ data: imageData }, wallet);
    
    // Add content type tag
    transaction.addTag('Content-Type', contentType);
    
    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);
    
    // Submit transaction
    const response = await arweave.transactions.post(transaction);
    
    if (response.status === 200 || response.status === 202) {
      return `ar://${transaction.id}`;
    } else {
      console.error(`Image upload failed with status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error uploading image to Arweave:', error);
    return null;
  }
}

async function deployContent(
  walletPath: string,
  content: string,
  title: string,
  description: string,
  author: string
): Promise<DeploymentResult> {
  try {
    // Load wallet from file
    const wallet = JSON.parse(
      fs.readFileSync(walletPath, { encoding: "utf8" })
    );

    // Generate digest
    const digest = generateDigest(content);
    
    // Extract and upload the first image if found
    let imageUrl = DEFAULT_IMAGE;
    const imagePath = extractFirstImage(content);
    
    if (imagePath) {
      const resolvedPath = resolvePath(imagePath);
      const uploadedImageUrl = await uploadImageToArweave(walletPath, resolvedPath);
      
      if (uploadedImageUrl) {
        imageUrl = uploadedImageUrl;
      }
    }

    // Create payload
    const payload = {
      content: content,
      timestamp: Date.now(),
      type: "article",
      name: title,
      description: description,
      image: imageUrl,
      author: author
    };

    // Convert to JSON
    const data = JSON.stringify(payload);

    // Create transaction
    const transaction = await arweave.createTransaction({ data }, wallet);

    // Add standard content type tag
    transaction.addTag("Content-Type", "application/json");

    // Add additional tags
    transaction.addTag("digest", digest);

    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);

    // Submit transaction
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200 || response.status === 202) {
      return {
        id: transaction.id,
        digest: digest,
      };
    } else {
      throw new Error(`Deployment failed with status: ${response.status}`);
    }
  } catch (error) {
    throw error;
  }
}

async function processFile(
  filePath: string,
  walletPath: string
): Promise<OutputResult | null> {
  // Read the file
  const fileContent = fs.readFileSync(filePath, "utf8");

  // Parse frontmatter
  const { data, content } = matter(fileContent);

  // Check if file should be deployed
  if (!data.should_deploy_perma_storage || data.perma_storage_id) {
    return null;
  }

  // Extract needed data
  const title = data.title || "Untitled";
  const description = data.description || "";
  const author = data.author || "";

  const result = await deployContent(
    walletPath,
    content,
    title,
    description,
    author
  );

  // Update the file with the Arweave ID
  data.perma_storage_id = result.id;

  // Convert frontmatter back to YAML
  const newFrontmatter = yaml.dump(data);

  // Update the file
  const updatedContent = `---\n${newFrontmatter}---\n\n${content}`;
  fs.writeFileSync(filePath, updatedContent);

  return {
    file: filePath,
    ...result,
  };
}

// Main execution
async function main() {
  const filePaths = process.argv.slice(2);
  const walletPath = "./wallet.json";

  const results: OutputResult[] = [];

  for (const filePath of filePaths) {
    try {
      const result = await processFile(filePath, walletPath);
      if (result) {
        results.push(result);
      }
    } catch (error: any) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }

  console.log("::set-output name=deployments::" + JSON.stringify(results));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

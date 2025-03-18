import Arweave from "arweave";
import fs from "fs";
import matter from "gray-matter";
import crypto from "crypto";
import yaml from "js-yaml";

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

    // Create payload
    const payload = {
      content: content,
      version: "1.0.0",
      timestamp: Date.now(),
      type: "article",
      title: title,
      description: description,
    };

    // Convert to JSON
    const data = JSON.stringify(payload);

    // Create transaction
    const transaction = await arweave.createTransaction({ data }, wallet);

    // Add standard content type tag
    transaction.addTag("Content-Type", "application/json");

    // Add additional tags
    transaction.addTag("author", author || "");
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

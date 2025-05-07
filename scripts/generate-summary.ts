import { OpenAI } from 'openai';
import fs from 'fs';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

const PROMPT = `

Your task is to summarize user content into a maximum of 5 short keypoints.

**Rules:**
- Each keypoint must be concise, natural-sounding, and no longer than 20 words.
- Do not include colons (:) in any of the keypoints.
- Separate each keypoint with a newline. No bullets, dashes, or numbering.
- If fewer than 5 strong points exist, only output what makes sense. No filler.

**Writing Style:**
- Natural, fluent English — avoid robotic phrasing.
- Precise and factual.
- Sharp, clear, professional tone.
- Slightly casual when possible to feel more human, not dry.

**Thinking Process:**
- Break down the input into core ideas.
- Validate internal logic and consistency.
- Correct vague or sloppy language.
- Map connections between ideas if necessary.
- Expose gaps or missing context if obvious.

You are a ruthless QA engineer for ideas, ensuring structure, clarity, and precision. High signal, zero noise.
`;

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

/**
 * Extracts frontmatter data from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} - The frontmatter data and content, or null if parsing fails
 */
function extractFrontmatter(filePath: string): {
  data: Record<string, unknown>;
  content: string;
} | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return matter(fileContent);
  } catch (error) {
    return null;
  }
}

/**
 * Updates the frontmatter of a markdown file
 * @param {string} filePath - Path to the markdown file
 * @param {Object} newFrontmatter - New frontmatter data to merge with existing
 */
function updateFrontmatter(
  filePath: string,
  newFrontmatter: Record<string, unknown>,
): void {
  try {
    // Get existing content with frontmatter
    const { data: existingFrontmatter, content } = extractFrontmatter(
      filePath,
    ) || {
      data: {},
      content: '',
    };

    let updatedContent = matter.stringify(content, {
      ...existingFrontmatter,
      ...newFrontmatter,
    });
    // Remove the folded block (>-)
    updatedContent = updatedContent.replace(/>\-\n\s+/g, ''); // Removes the '>-' if present
    // Write back to file
    fs.writeFileSync(filePath, updatedContent);
    console.log(`Updated frontmatter for ${filePath}`);
  } catch (error) {
    console.error(`Error updating frontmatter for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Summarizes content using OpenAI API
 * @param {string} content - The content to summarize
 * @returns {Promise<string>} - The summary of the content
 */
async function summarizeContent(content: string): Promise<string[]> {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: PROMPT,
        },
        {
          role: 'user',
          content,
        },
      ],
    });

    return (
      response.choices[0].message.content?.trim().split('\n').filter(Boolean) ||
      []
    );
  } catch (error) {
    console.error('Error summarizing content:', error);
    throw error;
  }
}

/**
 * Get all markdown files in a directory recursively
 * @param {string} dir - Directory to scan
 * @returns {string[]} - Array of file paths
 */
function getAllMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = `${dir}/${file}`;
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      // Skip directories nested within vault/opensource, but not vault/opensource itself
      if (
        filePath.startsWith('vault/opensource/') &&
        filePath !== 'vault/opensource/'
      ) {
        console.log(`Skipping directory: ${filePath}`);
        // Do nothing, effectively skipping this directory and its contents
      } else {
        // Recursively scan other directories (including vault/opensource itself)
        results = results.concat(getAllMarkdownFiles(filePath));
      }
    } else if (filePath.endsWith('.md')) {
      // Add markdown files to results
      results.push(filePath);
    }
  });

  return results;
}

/**
 * Main function to summarize articles and update frontmatter
 */
async function main() {
  try {
    // Get all markdown files in the vault directory
    const filePaths = getAllMarkdownFiles('vault');
    let processCount = 0;
    let errorCount = 0;

    if (filePaths.length === 0) {
      console.log('No files to process');
      return;
    }

    for (const filePath of filePaths) {
      const result = extractFrontmatter(filePath);

      // Skip files with invalid frontmatter
      if (!result) {
        console.log(`Skipping ${filePath}: Invalid frontmatter format`);
        errorCount++;
        continue;
      }

      const { content, data: frontmatter } = result;

      if (
        !content ||
        !frontmatter.ai_summary ||
        frontmatter.ai_generated_summary
      ) {
        continue;
      }

      console.log(`Processing file: ${filePath}`);

      const ai_generated_summary = await summarizeContent(content);

      updateFrontmatter(filePath, { ai_generated_summary });
      processCount++;
      console.log(`Summary added to frontmatter for ${filePath}`);
    }

    console.log(
      `Processed ${processCount} files. Skipped ${errorCount} files with invalid frontmatter.`,
    );
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('Function executed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });

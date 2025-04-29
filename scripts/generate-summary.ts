import { OpenAI } from 'openai';
import fs from 'fs';
import matter from 'gray-matter';
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
 * @returns {Object} - The frontmatter data and content
 */
function extractFrontmatter(filePath: string): {
  data: Record<string, unknown>;
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
    const { data: existingFrontmatter, content } = extractFrontmatter(filePath);

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
      model: 'gpt-4o',
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
 * Main function to summarize articles and update frontmatter
 */
async function main() {
  try {
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
      console.log(`Processing file: ${filePath}`);

      const { content, data: frontmatter } = extractFrontmatter(filePath);
      if (
        !content ||
        !frontmatter.ai_summary ||
        frontmatter.ai_generated_summary
      ) {
        continue;
      }
      const ai_generated_summary = await summarizeContent(content);

      updateFrontmatter(filePath, { ai_generated_summary });
      console.log(`Summary added to frontmatter for ${filePath}`);
    }

    console.log('All files processed successfully');
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

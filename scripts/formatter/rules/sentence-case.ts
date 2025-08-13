import { RuleModule, RuleContext } from './types.js';

const extractJsonFromMarkdown = (md: string) => {
  // Regular expression to find a code block starting with ```json and capture its content.
  // The `[\s\S]*?` pattern is a non-greedy match for any character, including newlines.
  const regex = /```json\s*([\s\S]*?)\s*```/;
  const match = md.match(regex);
  // Return the captured group (the JSON content) if a match is found.
  return match ? match[1] : md;
};

// Regex patterns (copied from format-sentence-case.js)
const FRONTMATTER_TITLE_REGEX = /^title:\s*["']?(.+?)["']?\s*$/m;
const HEADING_REGEX = /^(#{1,6})\s*(.+)$/gm;
const BULLET_DEFINITION_REGEX = /^\s*(?:[-*]|\d+\.)\s+\*\*(.+?)(?::)?\*\*:?/gm;
const MARKDOWN_LINK_REGEX = /^-\s+\[([^\]]+)\]\([^)]+\)/gm;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Helper to extract items from content (adapted from format-sentence-case.js)
function extractItems(content: string): string[] {
  // Remove code blocks to avoid matching inside them
  const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');

  const items = new Set<string>();

  // Extract frontmatter title
  const frontmatterMatch = contentWithoutCodeBlocks.match(
    /^---\n([\s\S]+?)\n---/,
  );
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(FRONTMATTER_TITLE_REGEX);
    if (titleMatch) {
      items.add(titleMatch[1]);
    }
  }

  // Extract headings
  let match;
  const headingRegex = new RegExp(HEADING_REGEX); // Create new regex instance for exec
  while ((match = headingRegex.exec(contentWithoutCodeBlocks)) !== null) {
    items.add(match[2].trim());
  }

  // Extract bullet point definitions "- hello world: message"
  const bulletDefinitionRegex = new RegExp(BULLET_DEFINITION_REGEX); // Create new regex instance for exec
  while (
    (match = bulletDefinitionRegex.exec(contentWithoutCodeBlocks)) !== null
  ) {
    items.add(match[1].trim());
  }

  // Extract markdown link texts [text](url)
  const markdownLinkRegex = new RegExp(MARKDOWN_LINK_REGEX); // Create new regex instance for exec
  while ((match = markdownLinkRegex.exec(contentWithoutCodeBlocks)) !== null) {
    items.add(match[1].trim());
  }

  // Filter items based on word count and uppercase word count
  return Array.from(items).filter(item => {
    const words = item.trim().split(/\s+/);
    if (words.length === 1) {
      return false; // skip single-word items
    }
    // For more than two words, check if at least two words start with uppercase letter
    const uppercaseCount = words.reduce((count, word) => {
      return /^[A-Z]/.test(word) ? count + 1 : count;
    }, 0);
    return uppercaseCount >= 2;
  });
}

const isGithubActions =
  process.env.GITHUB_ACTIONS === 'true' || !!process.env.GITHUB_ACTIONS;

/**
 * Call OpenRouter API to convert array of strings to sentence case.
 */
async function convertToSentenceCaseWithLLM(
  items: string[],
): Promise<string[]> {
  if (!OPENROUTER_API_KEY && isGithubActions) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is not set. Cannot perform sentence case formatting.',
    );
  }

  const prompt = `
You are an expert at formatting titles. Given a list of titles (each is a short phrase, not a sentence):
- Convert each to SENTENCE CASE.
- Do NOT change, add, or remove any words, symbols, or characters. Only change capitalization as needed for sentence case.
- Do NOT add or remove any words.
- Do NOT add punctuation.
- Keep proper nouns, acronyms, and short forms as they are (e.g., Google, JavaScript, Golang, HOC, TL;DR).
- Return the result as a JSON array of strings, in the same order as input.

Input: ${JSON.stringify(items)}
Output (JSON array of strings only):
`;
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://memo.d.foundation',
      'X-Title': 'sentence case',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText} - ${await response.text()}`,
    );
  }

  const data = await response.json();
  // OpenRouter returns choices[0].message.content
  const content =
    data?.choices?.[0]?.message?.content?.trim() ||
    data?.choices?.[0]?.message?.content ||
    '';

  if (!content) throw new Error('No output from OpenRouter.');

  // Try to parse the JSON array from the response
  let arr;
  try {
    arr = JSON.parse(extractJsonFromMarkdown(content));
    if (!Array.isArray(arr)) throw new Error('Not an array');
  } catch {
    throw new Error(
      'Failed to parse OpenRouter output as JSON array: ' + content,
    );
  }
  return arr;
}

async function getNewContent(fileContent: string) {
  const originalItems = extractItems(fileContent);

  if (originalItems.length === 0) {
    return; // No items to process
  }

  const convertedItems = await convertToSentenceCaseWithLLM(originalItems);

  let newContent = fileContent;
  let changesMade = 0;

  for (let i = 0; i < originalItems.length; i++) {
    const original = originalItems[i];
    const converted = convertedItems[i];

    if (original === converted) {
      continue; // No change needed for this item
    }

    // Escape special regex characters in original string
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace all occurrences carefully:
    // For frontmatter title: replace only in frontmatter title line
    // For headings: replace in heading lines
    // For highlights: replace inside ** **
    // For bullet definitions: replace only the definition part before colon
    // For markdown links: replace only the text inside square brackets

    // Special handling for markdown links
    // Replace [original] with [converted] but keep the URL intact
    const markdownLinkRegex = new RegExp(
      `\\[${escapedOriginal}\\](\\([^\\)]+\\))`,
      'g',
    );
    newContent = newContent.replace(markdownLinkRegex, `[${converted}]$1`);

    // Special handling for headings (### Heading)
    const headingRegex = new RegExp(
      `^(#{1,6})\\s*${escapedOriginal}$`,
      'gm',
    );
    newContent = newContent.replace(headingRegex, `$1 ${converted}`);

    // Special handling for frontmatter title
    const frontmatterTitleRegex = new RegExp(
      `^title:\\s*["']?${escapedOriginal}["']?\\s*$`,
      'm',
    );
    newContent = newContent.replace(frontmatterTitleRegex, `title: "${converted}"`);

    // Special handling for bullet definitions (- **text**: description)
    const bulletDefinitionRegex = new RegExp(
      `^\\s*(?:[-*]|\\d+\\.)\\s+\\*\\*${escapedOriginal}(?::)?\\*\\*:?`,
      'gm',
    );
    newContent = newContent.replace(bulletDefinitionRegex, `**${converted}**:`);

    // Use a regex with word boundaries for other replacements
    // This is a simplified approach. A more robust solution might involve
    // parsing the markdown AST to ensure replacements are context-aware.
    // For now, we'll rely on the LLM's output being an exact replacement.
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'g');
    newContent = newContent.replace(regex, converted);
    changesMade++;
  }

  if (changesMade > 0) {
    return {
      newContent,
      changesMade,
    };
  }
}

// Rule definition
const sentenceCaseRule: RuleModule = {
  meta: {
    type: 'formatting',
    docs: {
      description:
        'Enforces sentence case for titles, headings, bullet definitions, and markdown links using an LLM.',
      category: 'Stylistic',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    isRunFormatAfterAll: true,
  },
  create: async (context: RuleContext) => {
    return {
      check: async () => {
        const fileContent = context.getSourceCode();

        // Ignore if openrouter api key is not available and is not a github action event
        if (!OPENROUTER_API_KEY && !isGithubActions) {
          return;
        }

        try {
          const { newContent = fileContent, changesMade = 0 } =
            (await getNewContent(fileContent)) || {};
          if (changesMade > 0) {
            context.report({
              ruleId: 'markdown/sentence-case',
              severity: 1,
              message: `Sentence case formatting not applied.`,
              fixableCount: 1,
              line: 1,
              column: 0,
              nodeType: 'Program',
              fix: {
                range: [0, fileContent.length], // Replace entire file content
                text: newContent,
                format: async (content: string) => {
                  const data = await getNewContent(content);
                  return data?.newContent || content;
                },
              },
            });
          }
        } catch (error: any) {
          context.report({
            ruleId: 'markdown/sentence-case',
            severity: 2,
            message: `Failed to apply sentence case formatting: ${error.message}`,
            line: 1,
            column: 0,
            nodeType: 'Program',
          });
        }
      },
    };
  },
};

export default sentenceCaseRule;

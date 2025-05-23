/**
 * Parse template variables in a string using curly braces notation
 * Supports single, double, and triple curly braces: {var}, {{var}}, {{{var}}}
 */
export interface TemplatePart {
  type: 'text' | 'variable';
  content: React.ReactNode;
}

export const promptMDParser = (text: React.ReactNode): TemplatePart[] => {
  const parts: TemplatePart[] = [];
  let lastIndex = 0;
  // Match single, double, or triple curly braces
  // Match template variables while ignoring code blocks
  // 1. (?<!function\s*|class\s*|interface\s*|=>\s*) - Negative lookbehind for code constructs
  // 2. (?<!\\) - Ignore escaped braces
  // 3. \{(?:
  //    a. [^{}\n]+ - Content without braces or newlines
  //    b. | - OR
  //    c. \{[^{}\n]+\} - Nested single level
  //    d. | - OR
  //    e. \{\{[^{}\n]+\}\} - Nested double level
  //    )\}
  const regex =
    /(?<!function\s*|class\s*|interface\s*|=>\s*)(?<!\\)\{(?:[^{}\n]+|\{[^{}\n]+\}|\{\{[^{}\n]+\}\})\}/g;
  let match;

  if (typeof text !== 'string') {
    // If the text is not a string, return it as it is
    return [
      {
        type: 'text',
        content: text,
      },
    ];
  }

  while ((match = regex.exec(text)) !== null) {
    // Add text before template variable
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    // Add template variable
    parts.push({
      type: 'variable',
      content: match[0],
    });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last template variable
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return parts;
};

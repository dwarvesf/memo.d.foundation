/**
 * Parse template variables in a string using curly braces notation
 * Supports single, double, and triple curly braces: {var}, {{var}}, {{{var}}}
 */
export interface TemplatePart {
  type: 'text' | 'variable';
  content: string;
}

export const promptMDParser = (text: string): TemplatePart[] => {
  const parts: TemplatePart[] = [];
  let lastIndex = 0;
  // Match single, double, or triple curly braces
  const regex = /(\{(?:\{(?:\{[^}]*\}|[^}])*\}|[^}])*\})/g;
  let match;

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

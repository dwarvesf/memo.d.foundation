import relativeLinkExists from './relative-link-exists.js';
import noHeading1 from './no-heading1.js';
import frontmatter from './frontmatter.js';
import formatNote from './format-note.js';
import sentenceCase from './sentence-case.js';
import { RuleModule } from './types.js'; // Import RuleModule for typing

export const MARKDOWN_RULES_NAME = {
  RELATIVE_LINK_EXISTS: 'markdown/relative-link-exists',
  NO_HEADING1: 'markdown/no-heading1',
  FRONTMATTER: 'markdown/frontmatter',
  PRETTIER: 'markdown/prettier',
  SENTENCE_CASE: 'markdown/sentence-case',
} as const;

interface RulesCollection {
  rules: {
    [key: string]: RuleModule;
  };
}

const rulesCollection: RulesCollection = {
  rules: {
    [MARKDOWN_RULES_NAME.RELATIVE_LINK_EXISTS]: relativeLinkExists,
    [MARKDOWN_RULES_NAME.NO_HEADING1]: noHeading1,
    [MARKDOWN_RULES_NAME.FRONTMATTER]: frontmatter,
    [MARKDOWN_RULES_NAME.PRETTIER]: formatNote,
    [MARKDOWN_RULES_NAME.SENTENCE_CASE]: sentenceCase,
  },
};

export default rulesCollection;

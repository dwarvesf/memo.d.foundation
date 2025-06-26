import relativeLinkExists from './relative-link-exists.js';
import noHeading1 from './no-heading1.js';
import frontmatter from './frontmatter.js';
import formatNote from './format-note.js';
import { RuleModule } from './types.js'; // Import RuleModule for typing

interface RulesCollection {
  rules: {
    [key: string]: RuleModule;
  };
}

const rulesCollection: RulesCollection = {
  rules: {
    'markdown/relative-link-exists': relativeLinkExists,
    'markdown/no-heading1': noHeading1,
    'markdown/frontmatter': frontmatter,
    'markdown/prettier': formatNote,
  },
};

export default rulesCollection;

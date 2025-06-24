import relativeLinkExists from './relative-link-exists.js';
import noHeading1 from './no-heading1.js';
import frontmatter from './frontmatter.js';

export default {
  rules: {
    'markdown/relative-link-exists': relativeLinkExists,
    'markdown/no-heading1': noHeading1,
    'markdown/frontmatter': frontmatter,
  },
};

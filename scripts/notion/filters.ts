// Notion filter configurations
// Add your custom filters here

import { FilterType } from './types.js';

// Filter definitions object
const filters: Record<string, FilterType> = {
    // Life filter - matches "Life", "Life at Dwarves", or "Life at DF" content
    life: {
        or: [
            // Filter for "Life" in Name
            {
                property: 'Name',
                rich_text: {
                    contains: 'Life'
                }
            },
            // Filter for "Life at Dwarves" in Name
            {
                property: 'Name',
                rich_text: {
                    contains: 'Life at Dwarves'
                }
            },
            // Filter for "Life at DF" in Name
            {
                property: 'Name',
                rich_text: {
                    contains: 'Life at DF'
                }
            },
            // Filter for "Life at Dwarves" in Content Type (using multi_select instead of select)
            {
                property: 'Content Type',
                multi_select: {
                    contains: 'Life at Dwarves'
                }
            }
        ]
    },

    // Example project filter - matches content with Type = "Project"
    projects: {
        property: 'Type',
        select: {
            equals: 'Project'
        }
    },

    // Example recent filter - matches content from the last 30 days
    recent: {
        property: 'Created at',
        date: {
            after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
    },

    changelog: {
        property: 'Tags',
        multi_select: {
            contains: 'changelog'
        }
    }
};

export default filters;


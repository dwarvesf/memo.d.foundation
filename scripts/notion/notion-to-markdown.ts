import fs from 'fs';
import path from 'path';
import { Client } from '@notionhq/client';
import axios from 'axios';

// Configure your Notion API credentials
const NOTION_API_KEY = process.env.NOTION_API_KEY || 'your-notion-api-key';
const DATABASE_ID = process.env.NOTION_DATABASE_ID || 'your-database-id';

// Setup directories - now inside the notion folder
const SCRIPTS_DIR = path.join(process.cwd(), 'scripts', 'notion');
const CONTENT_DIR = path.join(SCRIPTS_DIR, 'notion-output', 'content');
const IMAGES_DIR = path.join(SCRIPTS_DIR, 'notion-output', 'assets');

// Ensure directories exist
if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Initialize Notion client
const notion = new Client({ auth: NOTION_API_KEY });

// Function to download an image
async function downloadImage(url: string, imagePath: string): Promise<string> {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(imagePath, response.data);
        return imagePath;
    } catch (error) {
        console.error(`Failed to download image from ${url}:`, error);
        throw error;
    }
}

// Helper function to create a simple slug
function createSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to replace all occurrences of a string
function replaceAll(text: string, search: string, replacement: string): string {
    return text.split(search).join(replacement);
}

async function getBlockChildren(blockId: string, allBlocks: any[] = []): Promise<any[]> {
    try {
        const response = await notion.blocks.children.list({
            block_id: blockId,
        });

        const blocks = response.results;
        allBlocks.push(...blocks);

        // Get children recursively
        for (const block of blocks) {
            // Type check for has_children property
            if (block && typeof block === 'object' && 'has_children' in block && block.has_children) {
                await getBlockChildren(block.id, allBlocks);
            }
        }

        return allBlocks;
    } catch (error) {
        console.error(`Error getting block children for ${blockId}:`, error);
        return allBlocks;
    }
}

async function processImageInBlock(block: any): Promise<{ original: string; local: string } | null> {
    try {
        if (block.type === 'image') {
            let imageUrl;
            if (block.image.type === 'file') {
                imageUrl = block.image.file.url;
            } else if (block.image.type === 'external') {
                imageUrl = block.image.external.url;
            }

            if (imageUrl) {
                const filename = `notion-image-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.png`;
                const imagePath = path.join(IMAGES_DIR, filename);

                await downloadImage(imageUrl, imagePath);

                // Relative path from content directory
                const relativePath = path.relative(CONTENT_DIR, path.join(IMAGES_DIR, filename)).replace(/\\/g, '/');

                return {
                    original: imageUrl,
                    local: relativePath
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`Error processing image in block:`, error);
        return null;
    }
}

async function blockToMarkdown(block: any, imageMap: Map<string, string>): Promise<string> {
    const { type } = block;
    let markdown = '';

    try {
        switch (type) {
            case 'paragraph':
                markdown = block.paragraph.rich_text.map((text: any) => text.plain_text).join('');
                if (markdown) markdown = `${markdown}\n\n`;
                break;

            case 'heading_1':
                markdown = `# ${block.heading_1.rich_text.map((text: any) => text.plain_text).join('')}\n\n`;
                break;

            case 'heading_2':
                markdown = `## ${block.heading_2.rich_text.map((text: any) => text.plain_text).join('')}\n\n`;
                break;

            case 'heading_3':
                markdown = `### ${block.heading_3.rich_text.map((text: any) => text.plain_text).join('')}\n\n`;
                break;

            case 'bulleted_list_item':
                markdown = `- ${block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join('')}\n`;
                break;

            case 'numbered_list_item':
                markdown = `1. ${block.numbered_list_item.rich_text.map((text: any) => text.plain_text).join('')}\n`;
                break;

            case 'code':
                const language = block.code.language || '';
                markdown = `\`\`\`${language}\n${block.code.rich_text.map((text: any) => text.plain_text).join('')}\n\`\`\`\n\n`;
                break;

            case 'quote':
                markdown = `> ${block.quote.rich_text.map((text: any) => text.plain_text).join('')}\n\n`;
                break;

            case 'divider':
                markdown = `---\n\n`;
                break;

            case 'image':
                const imageResult = await processImageInBlock(block);
                if (imageResult) {
                    imageMap.set(imageResult.original, imageResult.local);
                    const caption = block.image.caption?.map((text: any) => text.plain_text).join('') || '';
                    markdown = `![${caption}](${imageResult.local})\n\n`;
                }
                break;

            default:
                // Skip unknown block types
                break;
        }

        return markdown;
    } catch (error) {
        console.error(`Error converting block of type ${type} to markdown:`, error);
        return '';
    }
}

// Function to parse date from various formats
function parseAndFormatDate(dateStr: string): string | null {
    if (!dateStr) return null;

    try {
        // Try to parse the date
        const date = new Date(dateStr);

        // Check if the date is valid
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]; // YYYY-MM-DD format
        }
    } catch (e) {
        console.error(`Error parsing date: ${dateStr}`, e);
    }

    return null;
}

async function getPageProperties(pageId: string): Promise<Record<string, any>> {
    try {
        const page = await notion.pages.retrieve({ page_id: pageId });
        const result: Record<string, any> = {};

        // Need to use 'any' to access properties
        const properties = (page as any).properties;

        // Get system metadata timestamps
        if ((page as any).created_time) {
            result.system_created_at = new Date((page as any).created_time).toISOString().split('T')[0];
        }

        if ((page as any).last_edited_time) {
            result.last_edited_at = new Date((page as any).last_edited_time).toISOString().split('T')[0];
        }

        if (properties) {
            for (const key in properties) {
                const property = properties[key];
                const lowerKey = key.toLowerCase();

                try {
                    switch (property.type) {
                        case 'title':
                            result[lowerKey] = property.title?.map((t: any) => t.plain_text).join('') || '';
                            break;
                        case 'rich_text':
                            result[lowerKey] = property.rich_text?.map((t: any) => t.plain_text).join('') || '';
                            break;
                        case 'date':
                            if (property.date?.start) {
                                // For "Created at" or "Created" property specifically, set it as created_at
                                if (lowerKey === 'created at' || lowerKey === 'created') {
                                    result.created_at = property.date.start;
                                }
                                result[lowerKey] = property.date.start;
                            }
                            break;
                        case 'select':
                            result[lowerKey] = property.select?.name || '';
                            break;
                        case 'multi_select':
                            result[lowerKey] = property.multi_select?.map((s: any) => s.name) || [];
                            break;
                        case 'checkbox':
                            result[lowerKey] = property.checkbox || false;
                            break;
                        case 'url':
                            result[lowerKey] = property.url || '';
                            break;
                        // Add other property types as needed
                    }
                } catch (propError) {
                    console.error(`Error processing property ${key}:`, propError);
                }
            }
        }

        return result;
    } catch (error) {
        console.error(`Error getting page properties for ${pageId}:`, error);
        return {};
    }
}

async function convertPageToMarkdown(pageId: string): Promise<{ markdown: string; frontmatter: Record<string, any> }> {
    // Get page properties for frontmatter
    const properties = await getPageProperties(pageId);

    // Get all blocks
    const blocks = await getBlockChildren(pageId);

    // Process images and generate markdown
    const imageMap = new Map<string, string>();
    let markdownContent = '';

    for (const block of blocks) {
        const blockMd = await blockToMarkdown(block, imageMap);
        markdownContent += blockMd;
    }

    // Determine the date to use, prioritizing custom fields
    let dateToUse = properties.created_at;  // First try custom "Created at" property

    if (!dateToUse) {
        // For properties that might represent creation date
        const possibleDateProps = ['date', 'published', 'published at', 'published_at'];
        for (const prop of possibleDateProps) {
            if (properties[prop]) {
                dateToUse = properties[prop];
                break;
            }
        }
    }

    // If no custom date found, fall back to system metadata
    if (!dateToUse) {
        dateToUse = properties.system_created_at;
    }

    // Last resort - use current date
    if (!dateToUse) {
        dateToUse = new Date().toISOString().split('T')[0];
    }

    // Create frontmatter
    const frontmatter = {
        title: properties.title || properties.name || 'Untitled',
        date: dateToUse,
        last_edited: properties.last_edited_at || '',
        tags: properties.tags || [],
        description: properties.description || '',
        // Add other frontmatter properties as needed
    };

    return {
        markdown: markdownContent,
        frontmatter
    };
}

function createFrontmatterString(frontmatter: Record<string, any>): string {
    let frontmatterStr = '---\n';

    for (const [key, value] of Object.entries(frontmatter)) {
        if (value === '' || value === null || value === undefined) {
            continue; // Skip empty values
        }

        if (Array.isArray(value)) {
            if (value.length === 0) continue; // Skip empty arrays
            frontmatterStr += `${key}: [${value.map(v => `"${v}"`).join(', ')}]\n`;
        } else if (typeof value === 'string') {
            frontmatterStr += `${key}: "${value}"\n`;
        } else {
            frontmatterStr += `${key}: ${value}\n`;
        }
    }

    frontmatterStr += '---\n\n';
    return frontmatterStr;
}

async function convertNotionToMarkdown() {
    try {
        // Query Notion database
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
        });

        console.log(`Found ${response.results.length} pages in the Notion database`);
        console.log(`Saving markdown files to: ${CONTENT_DIR}`);
        console.log(`Saving images to: ${IMAGES_DIR}`);

        for (const page of response.results) {
            try {
                const pageId = page.id;

                console.log(`Processing page: ${pageId}`);

                // Convert page to markdown with frontmatter
                const { markdown, frontmatter } = await convertPageToMarkdown(pageId);

                // Generate a slug from the title
                const slug = createSlug(frontmatter.title);

                // Combine frontmatter and content
                const frontmatterStr = createFrontmatterString(frontmatter);
                const fileContent = frontmatterStr + markdown;

                // Write to file
                const outputPath = path.join(CONTENT_DIR, `${slug}.md`);
                fs.writeFileSync(outputPath, fileContent);

                console.log(`Saved: ${outputPath}`);
            } catch (pageError) {
                console.error(`Error processing page ${page.id}:`, pageError);
            }
        }

        console.log('Conversion completed');
    } catch (error) {
        console.error('Error converting Notion pages:', error);
    }
}

// Run the converter
convertNotionToMarkdown(); 
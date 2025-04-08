import fs from 'fs';
import path from 'path';
import { Client } from '@notionhq/client';
import axios from 'axios';
import { SubpageInfo, PageMetadata, ConversionOptions } from './types.js';

// Configure your Notion API credentials
const NOTION_API_KEY = process.env.NOTION_API_KEY || 'your-notion-api-key';
const PAGE_ID = process.env.NOTION_PAGE_ID || 'your-page-id';
const MAX_DEPTH = parseInt(process.env.NOTION_MAX_DEPTH || '1', 10);
const INCLUDE_SUBPAGES = process.env.NOTION_INCLUDE_SUBPAGES !== 'false';

// Setup directories
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

// Function to extract page ID from a Notion URL
function extractPageIdFromNotionUrl(url: string): string | null {
    // Default return value
    let pageId = null;

    try {
        // Parse the URL
        const urlObj = new URL(url);

        // Extract the path part
        const pathParts = urlObj.pathname.split('/');

        // Find the ID from the path
        // The ID is usually in the path as a UUID or a hashed ID
        for (const part of pathParts) {
            // Match either the 32-character hex ID or the hyphenated UUID format
            if (part.match(/^[a-f0-9]{32}$/) || part.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)) {
                pageId = part;
                break;
            }
        }

        return pageId;
    } catch (error) {
        console.error('Error parsing Notion URL:', error);
        return null;
    }
}

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

async function findSubpages(blockId: string): Promise<SubpageInfo[]> {
    const subpages: SubpageInfo[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
        try {
            const response = await notion.blocks.children.list({
                block_id: blockId,
                start_cursor: startCursor,
            });

            for (const block of response.results) {
                if (block.type === 'child_page') {
                    subpages.push({
                        id: block.id,
                        title: (block as any).child_page.title || 'Untitled',
                        type: 'page',
                        parent_id: blockId,
                        url: `https://notion.so/${block.id.replace(/-/g, '')}`
                    });
                } else if (block.type === 'child_database') {
                    subpages.push({
                        id: block.id,
                        title: (block as any).child_database.title || 'Untitled Database',
                        type: 'database',
                        parent_id: blockId,
                        url: `https://notion.so/${block.id.replace(/-/g, '')}`
                    });
                }
            }

            hasMore = response.has_more;
            startCursor = response.next_cursor || undefined;
        } catch (error) {
            console.error(`Error finding subpages for ${blockId}:`, error);
            break;
        }
    }

    return subpages;
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

async function blockToMarkdown(block: any, imageMap: Map<string, string>, options: ConversionOptions): Promise<string> {
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

            case 'child_page':
                if (options.include_subpages && options.current_depth < options.max_depth) {
                    const pageId = block.id;
                    markdown = `\n[📄 ${block.child_page.title}](${pageId.replace(/-/g, '')})\n\n`;
                }
                break;

            case 'child_database':
                if (options.include_subpages && options.current_depth < options.max_depth) {
                    const dbId = block.id;
                    markdown = `\n[📊 ${block.child_database.title}](${dbId.replace(/-/g, '')})\n\n`;
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

async function getPageMetadata(pageId: string): Promise<PageMetadata> {
    try {
        const page = await notion.pages.retrieve({ page_id: pageId });
        const metadata: PageMetadata = {
            title: 'Untitled',
        };

        // Try to get the page title and other properties
        try {
            const properties = (page as any).properties;

            if (properties) {
                // Process all properties
                for (const [key, value] of Object.entries(properties)) {
                    const prop = value as any;
                    switch (prop.type) {
                        case 'title':
                            metadata.title = prop.title?.map((t: any) => t.plain_text).join('') || 'Untitled';
                            break;
                        case 'rich_text':
                            metadata[key.toLowerCase()] = prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
                            break;
                        case 'date':
                            metadata[key.toLowerCase()] = prop.date?.start || '';
                            break;
                        case 'select':
                            metadata[key.toLowerCase()] = prop.select?.name || '';
                            break;
                        case 'multi_select':
                            metadata[key.toLowerCase()] = prop.multi_select?.map((s: any) => s.name) || [];
                            break;
                        case 'checkbox':
                            metadata[key.toLowerCase()] = prop.checkbox || false;
                            break;
                        case 'url':
                            metadata[key.toLowerCase()] = prop.url || '';
                            break;
                        // Add other property types as needed
                    }
                }
            }
        } catch (e) {
            console.error('Error getting page properties:', e);
        }

        // Add system metadata
        metadata.source = `https://notion.so/${pageId.replace(/-/g, '')}`;

        if ((page as any).created_time) {
            metadata.created_at = new Date((page as any).created_time).toISOString().split('T')[0];
        }

        if ((page as any).last_edited_time) {
            metadata.last_edited_at = new Date((page as any).last_edited_time).toISOString().split('T')[0];
        }

        // Add parent information if available
        const parent = (page as any).parent;
        if (parent) {
            if (parent.type === 'page_id') {
                metadata.parent_page = parent.page_id;
            } else if (parent.type === 'database_id') {
                metadata.parent_database = parent.database_id;
            }
        }

        return metadata;
    } catch (error) {
        console.error(`Error getting page metadata for ${pageId}:`, error);
        return { title: `Notion Page ${pageId.substring(0, 8)}` };
    }
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

async function convertPageToMarkdown(pageId: string, options: ConversionOptions = { max_depth: 1, current_depth: 0, include_subpages: true }): Promise<boolean> {
    try {
        console.log(`Processing page: ${pageId} (Depth: ${options.current_depth}/${options.max_depth})`);

        // Get page metadata
        const metadata = await getPageMetadata(pageId);

        // Get all blocks
        const blocks = await getBlockChildren(pageId);
        console.log(`Retrieved ${blocks.length} blocks from the page`);

        // Process images and generate markdown
        const imageMap = new Map<string, string>();
        let markdownContent = '';

        // Process blocks
        for (const block of blocks) {
            const blockMd = await blockToMarkdown(block, imageMap, options);
            markdownContent += blockMd;
        }

        // Create frontmatter
        const frontmatterStr = createFrontmatterString(metadata);
        const fileContent = frontmatterStr + markdownContent;

        // Generate a slug from the title
        const slug = createSlug(metadata.title);

        // Write to file
        const outputPath = path.join(CONTENT_DIR, `${slug}.md`);
        fs.writeFileSync(outputPath, fileContent);

        console.log(`Saved Markdown file to: ${outputPath}`);
        console.log(`Saved ${imageMap.size} images to: ${IMAGES_DIR}`);

        // Process subpages if needed
        if (options.include_subpages && options.current_depth < options.max_depth) {
            const subpages = await findSubpages(pageId);
            console.log(`Found ${subpages.length} subpages`);

            for (const subpage of subpages) {
                if (subpage.type === 'page') {
                    // Process child page
                    await convertPageToMarkdown(subpage.id, {
                        ...options,
                        current_depth: options.current_depth + 1,
                        parent_info: {
                            id: pageId,
                            title: metadata.title,
                            type: 'page'
                        }
                    });
                } else if (subpage.type === 'database') {
                    // Process child database using the database converter
                    console.log(`Processing child database: ${subpage.title}`);
                    // You would need to implement or call your database conversion logic here
                    // For example: await convertDatabaseToMarkdown(subpage.id, options);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error converting Notion page:', error);
        return false;
    }
}

// Run the converter
convertPageToMarkdown(PAGE_ID, {
    max_depth: MAX_DEPTH,
    current_depth: 0,
    include_subpages: INCLUDE_SUBPAGES
}); 
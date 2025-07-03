import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown, { Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 text-xl font-semibold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-lg font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 text-base font-semibold">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-element-margin list-disc space-y-2 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-element-margin list-decimal space-y-2 pl-6">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-5">{children}</li>,
  hr: () => <hr className="border-border my-6 border-t" />,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
};

interface MarkdownPrinterProps {
  spr_content: string;
  title?: string;
}

const getContent = ({ title, spr_content }: MarkdownPrinterProps) => {
  const contentTitle = `# ${title}\n`;
  // Replace <hr> tags with newlines for better formatting
  const replacedContent = spr_content
    .replace(/<hr\s*\/?>/gi, '\n')
    .replace(/\\n/gi, '\n');
  const rawLines = replacedContent.split('\n').map(line => line.trim());
  const lines = replacedContent.split('\n').filter(line => line.trim() !== '');
  // Ignore if there are empty lines at the start or end
  const isContainsStartDelimiter = lines[0] === '---';
  const isContainsEndDelimiter = lines[lines.length - 1] === '---';
  if (isContainsStartDelimiter && isContainsEndDelimiter) {
    const startIndex = rawLines.indexOf('---') + 1;
    const endIndex = rawLines.lastIndexOf('---');
    return [contentTitle, ...rawLines.slice(startIndex, endIndex)].join('\n');
  }
  return [contentTitle, ...rawLines].join('\n');
};
const createIframeContent = ({ title }: MarkdownPrinterProps) => {
  const mmToPx = 3.7795275591; // 1mm = 3.7795275591px at 96dpi
  const marginMm = 25;
  const paddingPx = Math.round(marginMm * mmToPx);

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title || 'Document'}</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
          <style>
            /* Reset and base styles */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            
            body {
              font-family: 'Public Sans', sans-serif;
              font-size: 12pt;
              line-height: 1.5;
              color: #000000;
              background: #ffffff;
              margin: 0;
              padding: ${paddingPx}px;
              box-sizing: border-box;
            }
            
            /* Headings - matching your component styles */
            h1 { 
              font-size: 16pt; 
              font-weight: 600; 
              margin: 0 0 12pt 0; 
              page-break-after: avoid; 
              color: #000000; 
            }
            h2 { 
              font-size: 14pt; 
              font-weight: 600; 
              margin: 0 0 6pt 0; 
              page-break-after: avoid; 
              color: #000000; 
            }
            h3 { 
              font-size: 12pt; 
              font-weight: 600; 
              margin: 0 0 6pt 0; 
              page-break-after: avoid; 
              color: #000000; 
            }
            h4, h5, h6 { 
              font-size: 12pt; 
              font-weight: 600; 
              margin: 0 0 6pt 0; 
              page-break-after: avoid; 
              color: #000000; 
            }
            
            /* Paragraphs - matching your component styles */
            p { 
              margin: 0 0 6pt 0; 
              color: #000000; 
              text-align: left;
            }
            
            /* Lists - matching your component styles */
            ul { 
              margin: 0 0 8pt 0; 
              padding-left: 18pt; 
              list-style-type: disc;
              color: #000000; 
            }
            ol { 
              margin: 0 0 6pt 0; 
              padding-left: 18pt; 
              list-style-type: decimal;
              color: #000000; 
            }
            li { 
              margin: 3pt 0; 
              line-height: 1.25;
              color: #000000; 
            }
            
            /* Horizontal rule - matching your component styles */
            hr { 
              border: none;
              border-top: 1pt solid #e5e7eb;
              margin: 18pt 0;
            }
            
            /* Strong text - matching your component styles */
            strong { 
              font-weight: bold;
              color: #000000;
            }
            
            /* Code blocks */
            pre { 
              background: #f5f5f5; 
              border: 1px solid #dddddd; 
              padding: 0;
              margin: 8pt 0; 
              font-family: 'Courier New', monospace; 
              font-size: 10pt; 
              page-break-inside: avoid;
              color: #000000;
            }
            code { 
              font-family: 'Courier New', monospace; 
              font-size: 10pt; 
              background: #f5f5f5; 
              padding: 1pt 2pt;
              color: #000000;
            }
            
            /* Tables */
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin: 8pt 0; 
              page-break-inside: avoid;
            }
            th, td { 
              border: 1px solid #000000; 
              padding: 4pt 8pt; 
              text-align: left;
              color: #000000;
            }
            th { 
              background: #f0f0f0; 
              font-weight: bold;
              color: #000000;
            }
            
            /* Blockquotes */
            blockquote { 
              border-left: 3pt solid #cccccc; 
              margin: 4pt 0; 
              padding-left: 12pt;
              font-style: italic;
              color: #000000;
            }
            
            /* Links */
            a { 
              color: #000000; 
              text-decoration: underline; 
            }
            
            /* Images */
            img { 
              max-width: 100%; 
              height: auto; 
              page-break-inside: avoid; 
            }
            
            /* Print styles */
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 14mm 16mm; size: A4; size: 21cm 29.7cm; }
            }
          </style>
        </head>
        <body>
          <div id="content"></div>
          <script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
          <script>
            // This will be populated by the parent component
          </script>
        </body>
      </html>
    `;
};

export const createPrintableMarkdown = (p: MarkdownPrinterProps) => {
  // Create iframe for isolated printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  // Write HTML content to iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(createIframeContent(p));
  iframeDoc.close();

  // Populate content in iframe using React DOM server
  const contentDiv = iframeDoc.getElementById('content');
  if (contentDiv) {
    contentDiv.innerHTML = ReactDOMServer.renderToString(
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkParse, remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {getContent(p)}
      </ReactMarkdown>,
    );
  }

  // Wait for content to load, then trigger print
  setTimeout(() => {
    iframe.contentWindow?.print();

    // Remove iframe after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
};

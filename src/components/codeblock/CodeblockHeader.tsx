import { IMetadata } from '@/types';
import React, { useEffect } from 'react';
import ReactDOMServer from 'react-dom/server';
import { toast } from 'sonner';

interface Props {
  language?: string;
}

const CodeblockHeader = (props: Props) => {
  const { language } = props;

  return (
    <div className="codeblock-header bg-background-tertiary-light dark:bg-background-tertiary text-muted-foreground -mx-4 -mt-2.5 mb-4 flex h-[38px] items-center justify-between px-4 font-sans text-[13px]">
      <span>{language}</span>
      <div className="flex items-center gap-2">
        <button
          className="copy-button font-ibm-sans inline-flex cursor-pointer items-center justify-center gap-0.5 border-none bg-none p-0"
          title="Copy to clipboard"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.0385 11.6667C5.70172 11.6667 5.41667 11.5501 5.18333 11.3167C4.95 11.0834 4.83333 10.7984 4.83333 10.4616V2.87191C4.83333 2.53514 4.95 2.25008 5.18333 2.01675C5.41667 1.78341 5.70172 1.66675 6.0385 1.66675H11.6282C11.9649 1.66675 12.25 1.78341 12.4833 2.01675C12.7167 2.25008 12.8333 2.53514 12.8333 2.87191V10.4616C12.8333 10.7984 12.7167 11.0834 12.4833 11.3167C12.25 11.5501 11.9649 11.6667 11.6282 11.6667H6.0385ZM6.0385 10.6667H11.6282C11.6795 10.6667 11.7265 10.6454 11.7692 10.6026C11.8119 10.5599 11.8333 10.5129 11.8333 10.4616V2.87191C11.8333 2.82058 11.8119 2.77358 11.7692 2.73091C11.7265 2.68814 11.6795 2.66675 11.6282 2.66675H6.0385C5.98717 2.66675 5.94017 2.68814 5.8975 2.73091C5.85472 2.77358 5.83333 2.82058 5.83333 2.87191V10.4616C5.83333 10.5129 5.85472 10.5599 5.8975 10.6026C5.94017 10.6454 5.98717 10.6667 6.0385 10.6667ZM3.70517 14.0001C3.36839 14.0001 3.08333 13.8834 2.85 13.6501C2.61667 13.4167 2.5 13.1317 2.5 12.7949V4.20525H3.5V12.7949C3.5 12.8462 3.52139 12.8932 3.56417 12.9359C3.60683 12.9787 3.65383 13.0001 3.70517 13.0001H10.2948V14.0001H3.70517Z"
              fill="currentColor"
            />
          </svg>
          <span>Copy</span>
        </button>
      </div>
    </div>
  );
};

export default CodeblockHeader;

export function CodeblockHeaderInjector(props: { metadata?: IMetadata }) {
  const { metadata } = props;
  useEffect(() => {
    const className = 'markdown-codeblock';
    const codeBlocks = document.querySelectorAll(`pre.${className}`);
    codeBlocks.forEach(codeBlock => {
      // Check if the code block already has a header
      if (codeBlock.querySelector('.codeblock-header')) return;
      const codeClass = codeBlock.querySelector('code')?.getAttribute('class');
      const language = codeClass
        ?.split(' ')
        .find(c => c.startsWith('language-'))
        ?.replace('language-', '');
      // Generate the HTML string for the React component
      const headerHTML = ReactDOMServer.renderToString(
        <CodeblockHeader language={language} />,
      );

      // Create a container
      const headerContainer = document.createElement('div');

      // Prepend the container to the code block
      codeBlock.prepend(headerContainer);
      headerContainer.outerHTML = headerHTML;

      // Add the copy button functionality
      const copyBtn: HTMLButtonElement | null =
        codeBlock.querySelector('.copy-button');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          if (codeBlock) {
            const codeText =
              language === 'math'
                ? codeBlock.querySelector('code .katex-mathml')?.textContent
                : codeBlock.querySelector('code')?.textContent;
            if (!codeText) {
              toast.error('No code to copy!');
              return;
            }
            navigator.clipboard.writeText(codeText).then(() => {
              toast.success('Copied to clipboard!');
            });
          }
        });
      }
    });
  }, [metadata]);

  return null;
}

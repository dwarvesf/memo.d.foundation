import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
}

async function initializeMermaid() {
  await mermaid.initialize({
    startOnLoad: false,
    theme: getCurrentTheme(),
    securityLevel: 'loose',
  });
}

async function renderMermaidDiagrams() {
  try {
    await initializeMermaid();

    const mermaidElements = document.querySelectorAll('pre.language-mermaid');

    for (const element of mermaidElements) {
      const codeElement = element.querySelector('code.language-mermaid');
      if (codeElement) {
        const mermaidCode = codeElement.textContent.trim();

        const container = document.createElement('div');
        container.className = 'mermaid-container';
        element.parentNode.insertBefore(container, element.nextSibling);

        const dropdown = document.createElement('select');
        dropdown.className = 'mermaid-view-mode';
        dropdown.innerHTML = `
          <option value="preview">Preview</option>
          <option value="code">Code</option>
          <option value="split">Split</option>
        `;
        container.appendChild(dropdown);

        container.appendChild(element);

        const renderElement = document.createElement('div');
        renderElement.className = 'mermaid-rendered';
        container.appendChild(renderElement);

        await renderMermaidDiagram(mermaidCode, renderElement);

        const updateView = () => {
          switch (dropdown.value) {
            case 'code':
              element.style.display = 'block';
              renderElement.style.display = 'none';
              break;
            case 'preview':
              element.style.display = 'none';
              renderElement.style.display = 'block';
              break;
            case 'split':
              element.style.display = 'block';
              renderElement.style.display = 'block';
              break;
          }
        };

        dropdown.addEventListener('change', updateView);

        dropdown.value = 'preview';
        updateView();
      }
    }

    console.log('Mermaid diagrams rendered successfully');
  } catch (error) {
    console.error('Error rendering Mermaid diagrams:', error);
  }
}

async function renderMermaidDiagram(code, element) {
  const { svg } = await mermaid.render('mermaid-' + Math.random().toString(36).slice(2, 11), code);
  element.innerHTML = svg;
}

async function updateMermaidTheme() {
  await mermaid.initialize({ theme: getCurrentTheme() });
  const mermaidElements = document.querySelectorAll('.mermaid-rendered');
  for (const element of mermaidElements) {
    const codeElement = element.closest('.mermaid-container').querySelector('code.language-mermaid');
    if (codeElement) {
      await renderMermaidDiagram(codeElement.textContent.trim(), element);
    }
  }
}

document.addEventListener('DOMContentLoaded', renderMermaidDiagrams);

// Listen for theme changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
      updateMermaidTheme();
    }
  });
});

observer.observe(document.documentElement, { attributes: true });

// Add some basic styles for the new elements
const style = document.createElement('style');
style.textContent = `
  .mermaid-container {
    position: relative;
    margin-top: 1em;
    border: 1px solid var(--primary-border-color-light, #e1e4e8);
    border-radius: 6px;
    padding: 32px 16px 16px 16px;
    background: var(--primary-background-color-light, #ffffff);
  }
  .mermaid-view-mode {
    position: absolute;
    top: 8px;
    right: 16px;
    z-index: 1;
    padding: 4px;
    border: 1px solid var(--primary-border-color-light, #d1d5da);
    border-radius: 3px;
    background-color: var(--secondary-background-color-light, #f6f8fa);
    color: var(--primary-font-color-light, #24292e);
    font-size: 12px;
  }
  .mermaid-rendered {
    margin-top: 1em;
  }
  pre.language-mermaid {
    margin-bottom: 1em;
  }
  html[data-theme='dark'] {
    .mermaid-container {
      border: 1px solid var(--primary-border-color, #e1e4e8);
      background: var(--primary-background-color, #ffffff);
    }
    .mermaid-view-mode {
      color: var(--primary-font-color, #24292e);
      border: 1px solid var(--primary-border-color, #d1d5da);
      background-color: var(--secondary-background-color, #f6f8fa);
    }
  }
`;
document.head.appendChild(style);

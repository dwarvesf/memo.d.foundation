import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

async function renderMermaidDiagrams() {
  try {
    await mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });

    const mermaidElements = document.querySelectorAll('pre.language-mermaid');

    for (const element of mermaidElements) {
      // Extract the Mermaid code from the <code> element
      const codeElement = element.querySelector('code.language-mermaid');
      if (codeElement) {
        const mermaidCode = codeElement.textContent.trim();

        // Create a new element for the rendered diagram
        const renderElement = document.createElement('div');
        renderElement.className = 'mermaid-rendered';
        element.parentNode.insertBefore(renderElement, element.nextSibling);

        // Render the Mermaid diagram
        const { svg } = await mermaid.render('mermaid-' + Math.random().toString(36).slice(2, 11), mermaidCode);

        renderElement.innerHTML = svg;

        // Optionally, hide the original pre element
        // element.style.display = 'none';
      }
    }

    console.log('Mermaid diagrams rendered successfully');
  } catch (error) {
    console.error('Error rendering Mermaid diagrams:', error);
  }
}

document.addEventListener('DOMContentLoaded', renderMermaidDiagrams);

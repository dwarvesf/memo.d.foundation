// Helper functions
const removeNoTransition = () => {
  document.body.classList.remove("no-transition");
};

const initializeMenu = () => {
  Alpine.store("menu", {
    init() {
      const setMenu = (menuData) => {
        for (const [key, value] of Object.entries(menuData)) {
          const { next_path } = value;
          const prev = sessionStorage.getItem(`menu_${key}`);
          this[key] = prev === null ? false : prev === "true";
          if (Object.keys(next_path).length > 0) setMenu(next_path);
        }
      };
      try {
        const menuData = JSON.parse(localStorage.getItem("duckDBMenuData"));
        setMenu(menuData);
      } catch (e) {
        console.error(e);
      }
    },
    toggle(menu) {
      this[menu] = !this[menu];
      sessionStorage.setItem(`menu_${menu}`, this[menu]);
    },
  });
};

const initializeSidebar = () => {
  Alpine.store("sidebar", {
    open: false,
    close() {
      this.open = false;
    },
    toggle() {
      this.open = !this.open;
    },
  });
};

const initializeGraphFullScreen = () => {
  Alpine.store("graphFullScreen", {
    on: false,
    close() {
      this.on = false;
      if (window.$graphCenterNodes) window.$graphCenterNodes(this.on);
    },
    toggle() {
      this.on = !this.on;
      if (window.$graphCenterNodes) window.$graphCenterNodes(this.on);
    },
  });
};

const initializeReadingMode = () => {
  Alpine.store("readingMode", {
    disableTransition: true,
    on: true,
    init() {
      const pathname = location.pathname;
      const isWhitelisted = ["/", "/consulting/", "/careers/hiring/"].includes(pathname);
      const isOff = sessionStorage.getItem("df.note.reading-mode") === "false";

      if (isOff || isWhitelisted) {
        this.on = false;
        document.documentElement.setAttribute("data-reading-mode", "false");
        return;
      }

      sessionStorage.setItem("df.note.reading-mode", "true");
      document.documentElement.setAttribute("data-reading-mode", "true");
      this.disableTransition = false;
    },
    toggle() {
      this.on = !this.on;
      if (!this.on) {
        const sidebar = document.querySelector("#sidebar");
        sidebar.classList.remove("menu-reading-mode");
        Alpine.store("sidebar").close();
      }

      sessionStorage.setItem("df.note.reading-mode", this.on);
      document.documentElement.setAttribute("data-reading-mode", this.on);
    },
  });
};

const processTextNodes = () => {
  const main = document.querySelector("main");
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const nodes = [];

  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    // Check if the node is inside a KaTeX block
    let parent = node.parentElement;
    while (parent && parent !== main) {
      if (parent.classList.contains('katex') || parent.classList.contains('katex-display')) {
        return; // Skip processing this node
      }
      parent = parent.parentElement;
    }

    const results = [...node.textContent.matchAll(/(.?)@([\d\w_\-\.]{3,})/gm)];
    if (!results.length) return;

    const immediateParent = node.parentElement;
    if (!immediateParent || !immediateParent.innerHTML) return;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    results.forEach(match => {
      const [fullMatch, prefix, username] = match;
      const index = match.index;

      if (lastIndex < index) {
        frag.appendChild(document.createTextNode(node.textContent.slice(lastIndex, index)));
      }

      if (prefix) frag.appendChild(document.createTextNode(prefix));
      const a = document.createElement('a');
      a.href = `/contributor/${username}`;
      a.textContent = `@${username}`;
      frag.appendChild(a);

      lastIndex = index + fullMatch.length;
    });
    if (lastIndex < node.textContent.length) {
      frag.appendChild(document.createTextNode(node.textContent.slice(lastIndex)));
    }

    immediateParent.replaceChild(frag, node);
  });
};

const handleOutsideClick = (e) => {
  const sidebar = document.querySelector("#sidebar");
  const btn = document.querySelector("#sidebar-toggle");

  if (!sidebar.contains(e.target)) {
    if (btn.contains(e.target)) {
    } else {
      Alpine.store("sidebar").close();
    }
  }

  const graphContainer = document.querySelector("#graph-container");
  if(!graphContainer) return;
  const svg = graphContainer.querySelector("svg");
  const graphBtn = graphContainer.querySelector("button");
  if (!svg.contains(e.target) && !graphBtn.contains(e.target)) {
    Alpine.store("graphFullScreen").close();
  }
};

const resizeYoutubeVideos = () => {
  const iframes = document.getElementsByTagName("iframe");
  Array.from(iframes).forEach(iframe => {
    if (iframe.src.includes("youtube.com")) {
      iframe.style.width = '100%';
      const width = iframe.getBoundingClientRect().width;
      iframe.style.height = (width * 0.5625) + "px";
    }
  });
};

const convertMermaidElements = () => {
  const elements = document.querySelectorAll('pre.language-mermaid');
  elements.forEach(element => {
    element.classList.remove('language-mermaid');
    element.classList.add('mermaid');

    const codeElement = element.querySelector('code');
    if (codeElement) {
      element.innerHTML = codeElement.innerHTML;
    }
  });
};

const updatePrismStylesheets = () => {
  const lightStylesheet = document.querySelector('link#prism-light');
  const darkStylesheet = document.querySelector('link#prism-dark');
  const updateStylesheets = (isDark) => {
    lightStylesheet.media = isDark ? 'not all' : 'all';
    darkStylesheet.media = isDark ? 'all' : 'not all';
  };

  updateStylesheets(document.documentElement.getAttribute('data-theme') === 'dark');

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        const isDark = mutation.target.getAttribute('data-theme') === 'dark';
        updateStylesheets(isDark);
        const iframe = document.querySelector('.utterances-frame');
        if (iframe) {
          const theme = isDark ? 'github-dark' : 'github-light'
          const message = {
              type: 'set-theme',
              theme: theme
          };
           iframe.contentWindow.postMessage(message, 'https://utteranc.es');
        }
       
      }
    });
  });

  observer.observe(document.documentElement, { attributes: true });
};

const handleMathRendering = () => {
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\begin{equation}", right: "\\end{equation}", display: true },
      { left: "\\begin{align}", right: "\\end{align}", display: true },
      { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
      { left: "\\begin{gather}", right: "\\end{gather}", display: true },
      { left: "\\begin{CD}", right: "\\end{CD}", display: true },
      { left: "\\[", right: "\\]", display: true },
    ],
    throwOnError: false,
    preProcess: (text) => {
      // This function will prevent conversion for simple dollar sign cases followed by numbers
      return text.replace(/(\B\$)(\d+((,\d+)+)?\.?\d*)(\b)/g, '_TEMP_DOLLAR_$2$4');
    },
    postProcess: (text) => {
      // Restore the original dollar signs after processing
      return text.replace(/_TEMP_DOLLAR_(\d+((,\d+)+)?\.?\d*)/g, '$$$1');
    }
  });
};

// Event listeners
window.addEventListener("load", removeNoTransition);
window.addEventListener("load", resizeYoutubeVideos);
window.addEventListener("resize", resizeYoutubeVideos);

document.addEventListener("alpine:init", () => {
  initializeMenu();
  initializeSidebar();
  initializeGraphFullScreen();
  initializeReadingMode();
  processTextNodes();
});

document.addEventListener("click", handleOutsideClick);
document.addEventListener('DOMContentLoaded', convertMermaidElements);
document.addEventListener('DOMContentLoaded', updatePrismStylesheets);
document.addEventListener('DOMContentLoaded', handleMathRendering);

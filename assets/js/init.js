window.addEventListener("load", function() {
  document.body.classList.remove("no-transition");
});

document.addEventListener("alpine:init", () => {
  Alpine.store("menu", {
    init() {
      const that = this;
      function setMenu(menuData) {
        for (const [key, value] of Object.entries(menuData)) {
          const { next_path } = value;
          const prev = sessionStorage.getItem(`menu_${key}`);
          if (prev === null) {
            that[key] = false;
          } else {
            that[key] = prev === "true";
          }
          if (Object.keys(next_path).length <= 0) continue;
          setMenu(next_path);
        }
      }
      try {
        const menuData = JSON.parse(localStorage.getItem("duckDBMenuData"));
        setMenu(menuData);
      } catch (e) {
        console.error(e);
      }
    },
    toggle(menu) {
      const prev = this[menu];
      const newVal = !prev;
      sessionStorage.setItem(`menu_${menu}`, newVal);

      this[menu] = newVal;
    },
  });
  Alpine.store("sidebar", {
    open: false,
    close() {
      this.open = false;
    },
    toggle() {
      this.open = !this.open;
    },
  });

  Alpine.store("graphFullScreen", {
    on: false,
    close() {
      this.on = false;
      if (window.$graphCenterNodes) {
        window.$graphCenterNodes(this.on);
      }
    },
    toggle() {
      this.on = !this.on;
      if (window.$graphCenterNodes) {
        window.$graphCenterNodes(this.on);
      }
    },
  });

  Alpine.store("readingMode", {
    disableTransition: true,
    on: true,
    init() {
      const pathname = location.pathname;
      const isWhitelisted = ["/", "/consulting/", "/careers/hiring/"].includes(
        pathname
      );
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
      const currentState =
        document.documentElement.getAttribute("data-reading-mode") === "true";
      this.on = !currentState;

      if (!this.on) {
        const sidebar = document.querySelector("#sidebar");
        sidebar.classList.remove("menu-reading-mode");
        Alpine.store("sidebar").close();
      }

      // backup theme
      sessionStorage.setItem("df.note.reading-mode", this.on);

      document.documentElement.setAttribute("data-reading-mode", this.on);
    },
  });

  const main = document.querySelector("main");
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    const results = [...node.textContent.matchAll(/(.?)@([\d\w_\-\.]+)/gm)];
    if (!results.length) continue;

    for (const res of results) {
      const [_, t] = res;
      if (t.trim() !== "") continue;
      if (!node?.parentElement?.innerHTML) return;
      node.parentElement.innerHTML = node.textContent.replace(
        /(.?)@([\d\w_\-\.]+)/gm,
        "$1<a href='/contributor/$2'>@$2</a>"
      );
    }
  }
});

document.addEventListener("click", (e) => {
  const sidebar = document.querySelector("#sidebar");
  const btn = document.querySelector("#sidebar-toggle");

  if (sidebar.contains(e.target)) return;

  if (btn.contains(e.target)) {
    sidebar.classList.add("menu-reading-mode");
    return;
  }

  Alpine.store("sidebar").close();

  const graphContainer = document.querySelector("#graph-container");
  const svg = graphContainer.querySelector("svg");
  const graphBtn = graphContainer.querySelector("button");
  if (svg.contains(e.target) || graphBtn.contains(e.target)) return;
  Alpine.store("graphFullScreen").close();
});

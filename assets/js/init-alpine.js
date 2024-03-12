document.addEventListener("alpine:init", () => {
  Alpine.store("sidebar", {
    open: false,
    close() {
      this.open = false;
    },
    toggle() {
      this.open = !this.open;
    },
  });

  Alpine.store("readingMode", {
    on: true,
    init() {
      const isOff = sessionStorage.getItem("df.note.reading-mode") === "false";
      if (isOff) {
        this.on = false;
        document.documentElement.setAttribute("data-reading-mode", "false");
        return;
      }
      sessionStorage.setItem("df.note.reading-mode", "true");
      document.documentElement.setAttribute("data-reading-mode", "true");
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
});

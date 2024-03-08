window.onload = function() {
  const mobileNavBtn = document.querySelector("#mobile-nav-btn");
  const icons = document.querySelectorAll(".mobile-nav-btn-icon");
  const sidebar = document.querySelector("nav.mobile-menu");
  const body = document.body;
  let lockScroll = false;

  document.body.addEventListener("click", (e) => {
    if (sidebar.contains(e.target)) return;

    if (mobileNavBtn.contains(e.target)) {
      for (const icon of icons) {
        icon.classList.toggle("mobile-nav-btn-icon-show");
      }

      const isReadingMode =
        document.documentElement.getAttribute("data-reading-mode") === "true";

      sidebar.classList.toggle("show");
      if (isReadingMode) {
        sidebar.classList.add("menu-reading-mode");
      } else {
        sidebar.classList.remove("menu-reading-mode");
      }

      lockScroll = !lockScroll;

      body.style.overflow = lockScroll ? "hidden" : "";
      return;
    }

    sidebar.classList.remove("show");
    icons[0].classList.add("mobile-nav-btn-icon-show");
    icons[1].classList.remove("mobile-nav-btn-icon-show");
  });
};

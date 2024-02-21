window.onload = function() {
  const mobileNavBtn = document.querySelector("#mobile-nav-btn");
  const icons = document.querySelectorAll(".mobile-nav-btn-icon");
  const sidebar = document.querySelector("nav.menu");
  const body = document.body;
  let lockScroll = false;

  mobileNavBtn.addEventListener("click", () => {
    for (const icon of icons) {
      icon.classList.toggle("mobile-nav-btn-icon-show");
    }

    sidebar.classList.toggle("show");

    lockScroll = !lockScroll;

    body.style.overflow = lockScroll ? "hidden" : "";
  });
};

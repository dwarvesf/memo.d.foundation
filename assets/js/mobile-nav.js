window.onload = function() {
  const mobileNavBtn = document.querySelector("#mobile-nav-btn");
  const icons = document.querySelectorAll(".mobile-nav-btn-icon");
  const sidebar = document.querySelector("#sidebar");

  document.body.addEventListener("click", (e) => {
    if (sidebar.contains(e.target)) return;

    if (mobileNavBtn.contains(e.target)) {
      for (const icon of icons) {
        icon.classList.toggle("mobile-nav-btn-icon-show");
      }

      sidebar.classList.toggle("show");
      sidebar.classList.add("menu-reading-mode");
      return;
    }

    sidebar.classList.remove("show");
    /* sidebar.classList.remove("menu-reading-mode"); */
    icons[0].classList.add("mobile-nav-btn-icon-show");
    icons[1].classList.remove("mobile-nav-btn-icon-show");
  });
};

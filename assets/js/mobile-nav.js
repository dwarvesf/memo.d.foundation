window.onload = function() {
  const mobileNavBtn = document.querySelector("#mobile-nav-btn");
  const icons = document.querySelectorAll(".mobile-nav-btn-icon");
  const sidebar = document.querySelector("nav.mobile-menu");
  const body = document.body;
  let lockScroll = false;

  mobileNavBtn.addEventListener("click", (e) => {
    e.preventDefault();
    for (const icon of icons) {
      icon.classList.toggle("mobile-nav-btn-icon-show");
    }

    sidebar.classList.toggle("show");

    lockScroll = !lockScroll;

    body.style.overflow = lockScroll ? "hidden" : "";
  });
  
  sidebar.addEventListener("click", (e) => {
    if (e.target.tagName === "A") return;
    e.preventDefault()
  })
  
  body.addEventListener("click", (e) => {
    if (e.target.tagName === "A") return;
    console.log(e.defaultPrevented);
    if (e.defaultPrevented || !sidebar.classList.contains("show")) return;
    mobileNavBtn.click()
  })
};

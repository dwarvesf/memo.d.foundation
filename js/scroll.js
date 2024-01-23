let siteNav = document.querySelector(".site-nav");

window.addEventListener("DOMContentLoaded", () => {
  siteNav = document.querySelector(".site-nav");
  const topMenuScroll = sessionStorage.getItem("site-nav-scroll") || 0;
  siteNav.scrollTop = parseInt(topMenuScroll, 10);
});

window.addEventListener("beforeunload", () => {
  sessionStorage.setItem("site-nav-scroll", siteNav.scrollTop);
});

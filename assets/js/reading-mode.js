const btn = document.querySelector("#btn-reading-mode-toggler");
const sidebar = document.querySelector("#sidebar");

btn.addEventListener("click", () => {
  const isReadingMode =
    document.documentElement.getAttribute("data-reading-mode") === "true";
  if (isReadingMode) return;
  sidebar.classList.remove("menu-reading-mode");
});

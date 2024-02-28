const root = document.documentElement;

const runColorMode = (fn) => {
  if (!window.matchMedia) return;

  const query = window.matchMedia("(prefers-color-scheme: dark)");
  fn(query.matches);

  query.addEventListener("change", (event) => fn(event.matches));
};

runColorMode((isDarkMode) => {
  const preferenceTheme = localStorage.getItem("df.note.theme");
  console.log("preferenceTheme", preferenceTheme);
  if (preferenceTheme === "dark" || preferenceTheme === "light") {
    isDarkMode = preferenceTheme === "dark";
  }

  if (isDarkMode) {
    root.setAttribute("data-theme", "dark");
  } else {
    root.setAttribute("data-theme", "light");
  }
});

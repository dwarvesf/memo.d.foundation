const root = document.documentElement;

const runColorMode = (fn) => {
  if (!window.matchMedia) return;
  
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  fn(query.matches);

  query.addEventListener('change', (event) => fn(event.matches));
}

runColorMode((isDarkMode) => {
  if (isDarkMode) root.setAttribute("data-theme", "dark");
  else root.setAttribute("data-theme", "light");
})
function process() {
  const images = document.querySelectorAll("main img[title]");

  for (const img of images) {
    const modifiers = img.getAttribute("title");
    const params = new URLSearchParams(modifiers);

    for (const [k, v] of params.entries()) {
      switch (k) {
        case "s": {
          img.style.transform = `scale(${Number(v) / 100})`;
          break;
        }
        default:
          break;
      }
    }
  }
}

process();

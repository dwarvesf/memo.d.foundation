function process() {
  const images = document.querySelectorAll("main img[title]");

  for (const img of images) {
    img.style.background = "#fff";
    const modifiers = img.getAttribute("title");
    const params = new URLSearchParams(modifiers);

    for (const [k, v] of params.entries()) {
      switch (k) {
        case "s": {
          const scale = Math.min(Math.max(v, 0), 100);
          const rect = img.getBoundingClientRect();
          const aspectRatio = rect.width / rect.height;
          img.style.aspectRatio = aspectRatio;
          img.style.width = `${(rect.width * Number(scale)) / 100}px`;
          break;
        }
        case "p": {
          if (!["center", "left", "right"].includes(v)) break;
          if (v === "left") img.style.margin = "0 auto 0 0";
          if (v === "right") img.style.margin = "0 0 0 auto";
          if (v === "center") img.stule.margin = "0 auto";
          break;
        }
        default:
          break;
      }
    }
  }
}

process();

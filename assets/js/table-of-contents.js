const initTableOfContents = () => {
  const tableOfContents = document.getElementById("toc-modal");
  if (!tableOfContents) return;

  // Add tree-like styling
  tableOfContents.classList.add("table-of-contents-tree");

  // Style links based on heading level
  const links = tableOfContents.querySelectorAll("a");
  const levels = Array.from(links).map((link) => getHeadingLevel(link));
  const minLevel = Math.min(...levels);

  links.forEach((link) => {
    const level = getHeadingLevel(link) - minLevel + 1;

    link.classList.add(
      `heading-level-${level}`,
      "block",
      "text-[hsl(var(--foreground-secondary))]",
      "hover:text-[hsl(var(--foreground))]",
      "transition-colors",
      "duration-200",
      "text-[0.95rem]"
    );
  });
};

// Get heading level based on DOM structure
const getHeadingLevel = (link) => {
  let level = 1;
  let parent = link.parentElement;

  while (parent) {
    if (parent.tagName === "UL") {
      level++;
    }
    parent = parent.parentElement;
  }

  return level;
};

const updateActiveNav = (
  navs,
  pagenav = document.querySelectorAll(".toc a")
) => {
  pagenav.forEach((nav) => {
    nav.classList.remove("active");
    nav.setAttribute("active", "false");
  });

  navs?.forEach((nav) => {
    nav.classList.add("active");
    nav.setAttribute("active", "true");
  });
};

const initScroller = () => {
  const pagenav = document.querySelectorAll(".toc a");
  if (!pagenav.length) {
    document.querySelector(".toc-indicators").style.display = "none"
    return;
    
  }
  isUserClicking = false;

  const cb = (entries) => {
    if (isUserClicking) return;
    const entry = entries.find((entry) => entry.isIntersecting&&entry.target.id);
    if (!entry) return;

    const id = entry.target.id;
    if (!id) return;

    const navs = document.querySelectorAll(`.toc a[href='#${id}']`);
    if (!navs?.length) return;

    updateActiveNav(navs, pagenav);
  };

  const ob = new IntersectionObserver(cb, {
    rootMargin: "-10% 0px -50% 0px",
    threshold: 0.5,
  });
  const addedMap = new Map();

  pagenav.forEach((nav) => {
    if (!nav) return;
  
    nav.classList.add("transition", "duration-200");

    const id = nav.href.split("#")[1];
    if (addedMap.has(id)) {
      return;
    }
    addedMap.set(id, true);

    const el = document.getElementById(id);
    if (!(el instanceof Element)) {
      return;
    }
    ob.observe(el);
  });
};

const handleClickOnIndicator = (e) => {
  e.preventDefault();
};

let isUserClicking = false;

const handleClickLink = (e) => {
  const targetId = e.target.getAttribute("href").substring(1);
  const targetElement = document.getElementById(targetId);
  if (!targetElement) return;

  e.preventDefault();
  isUserClicking = true;
  
  targetElement.scrollIntoView({
    behavior: "smooth",
  });
  updateActiveNav(document.querySelectorAll(`.toc a[href='#${targetId}']`));
  
  setTimeout(() => {
    isUserClicking = false;
  }, 1000);
};

document.addEventListener("DOMContentLoaded", () => {
  initTableOfContents();
  initScroller();

  const tocIndicatorsEl = document.querySelector(".toc-indicators");
  tocIndicatorsEl.addEventListener("click", handleClickOnIndicator);
 
  const tocModalLinks = document.querySelectorAll(".toc-modal a");
  tocModalLinks.forEach((link) => {
    link.addEventListener("click", handleClickLink);
  });
});

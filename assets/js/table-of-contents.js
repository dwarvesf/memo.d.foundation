const initTableOfContents = () => {
  const tableOfContents = document.getElementById('toc-modal');
  if (!tableOfContents) return;

  // Add tree-like styling
  tableOfContents.classList.add('table-of-contents-tree');

  // Style links based on heading level
  const links = tableOfContents.querySelectorAll('a');
  const levels = Array.from(links).map(link => getHeadingLevel(link));
  const minLevel = Math.min(...levels);

  links.forEach(link => {
    const level = getHeadingLevel(link) - minLevel + 1;

    link.classList.add(
      `heading-level-${level}`,
      'block',
      'text-[hsl(var(--foreground-secondary))]',
      'hover:text-[hsl(var(--foreground))]',
      'transition-colors',
      'duration-200',
      'text-[0.95rem]'
    );
  });
};

// Get heading level based on DOM structure
const getHeadingLevel = (link) => {
  let level = 1;
  let parent = link.parentElement;

  while (parent) {
    if (parent.tagName === 'UL') {
      level++;
    }
    parent = parent.parentElement;
  }

  return level;
};

const initScroller = () => {
  const pagenav = document.querySelectorAll(".toc a");
  const update = (navs) => {
    pagenav.forEach((nav) => {
      nav.classList.remove("active");
      nav.setAttribute("active", "false");
    });
    navs.forEach((nav) => { 
    nav.classList.add("active");
    nav.setAttribute("active", "true");
    }
    );
  };

  const cb = (entries) => {
    const [entry] = entries;
    const { isIntersecting, target } = entry;
    if (!isIntersecting) return;

    const id = target.id;
    if (!id) return;

    const navs = document.querySelectorAll(`.toc a[href='#${id}']`);
    if (!navs?.length) return;

    update(navs);
  };

  const ob = new IntersectionObserver(cb, {
    rootMargin: "-10% 0px -50% 0px",
    threshold: 0.5,
  });
  const defaultActiveHref = pagenav[0]?.href;
  pagenav.forEach((nav) => {
    if (!nav) return;
    if (nav.href === defaultActiveHref) {
      nav.classList.add("active");
      nav.setAttribute("active", "true");
    }
    nav.classList.add("transition", "duration-200");
    const el = document.getElementById(`${nav.href.split("#")[1]}`);
    if (!(el instanceof Element)) return;
    ob.observe(el);
  });
};

const handleClickOnIndicator = (e) => {
  const tocModal = document.querySelector(".toc-modal");
  if (!tocModal) return;
  e.preventDefault();
  tocModal?.classList.toggle("open");
}
const closeTocModal = (e) => {
  document.querySelector(".toc-modal")?.classList.remove("open")
}
document.addEventListener("DOMContentLoaded", () => {
  initTableOfContents();
  initScroller();

  const tocIndicatorsEl = document.querySelector(".toc-indicators");
  tocIndicatorsEl.addEventListener("click", handleClickOnIndicator);
  document.addEventListener("click", (e) => {
    if (tocIndicatorsEl.contains(e.target)) return;
    closeTocModal(e);
  });
});

const initTableOfContents = () => {
  const tableOfContents = document.getElementById('TableOfContents');
  
  if (!tableOfContents) return;

  // Add tree-like styling
  tableOfContents.classList.add('table-of-contents-tree');
  
  // Style links based on heading level
  const links = tableOfContents.querySelectorAll('a');
  links.forEach(link => {
    // Get the parent li's nesting level
    const level = getHeadingLevel(link);
    
    link.classList.add(
      'heading-level-' + level,
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
  const pagenav = document.querySelectorAll("#TableOfContents a");

  const update = (nav) => {
    pagenav.forEach((nav) => {
      nav.classList.remove("text-active");
      nav.setAttribute("active", "false");
    });
    nav.classList.add("text-active");
    nav.setAttribute("active", "true");
    nav.focus({ preventScroll: true });
  };

  const cb = (entries) => {
    const [entry] = entries;
    const { isIntersecting, target } = entry;
    if (!isIntersecting) return;

    const id = target.id;
    if (!id) return;

    const nav = document.querySelector(`#TableOfContents a[href='#${id}']`);
    if (!nav) return;

    update(nav);
  };

  const ob = new IntersectionObserver(cb, {
    rootMargin: "-10% 0px -50% 0px",
    threshold: 0.5,
  });

  for (const [i, nav] of pagenav.entries()) {
    if (!nav) continue;
    if (i === 0) {
      nav.classList.add("text-active");
      nav.setAttribute("active", "true");
    }
    nav.addEventListener("click", () => {
      update(nav);
    });
    nav.classList.add("transition", "duration-200");
    const el = document.getElementById(`${nav.href.split("#")[1]}`);
    if (!(el instanceof Element)) return;
    ob.observe(el);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initTableOfContents();
  initScroller();
});

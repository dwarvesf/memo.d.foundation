const initScroller = () => {
  const pagenav = document.querySelectorAll(".pagenav a");

  const update = (nav) => {
    pagenav.forEach((nav) => {
      nav.classList.remove("text-active");
      nav.setAttribute("active", "false");
    });
    nav.classList.add("text-active");
    nav.setAttribute("active", "true");
    nav.focus();
  };

  const cb = (entries) => {
    const [entry] = entries;
    const { isIntersecting, target } = entry;
    if (!isIntersecting) return;

    const id = target.id;
    if (!id) return;

    const nav = document.querySelector(`.pagenav a[href='#${id}']`);
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
    ob.observe(el);
  }
};

document.addEventListener("DOMContentLoaded", initScroller);

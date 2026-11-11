(() => {
  const nav = document.querySelector(".bottom-nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll("a")];
  let activeLink;

  function activate(link, current = "location") {
    if (!link || link === activeLink) return;
    activeLink?.removeAttribute("aria-current");
    activeLink = link;
    link.setAttribute("aria-current", current);
    nav.style.setProperty("--active-index", links.indexOf(link));
    nav.dataset.active = "";
  }

  const sections = links.flatMap(link => {
    const url = new URL(link.href);
    if (!url.hash || url.pathname !== location.pathname) return [];
    const section = document.getElementById(url.hash.slice(1));
    return section ? [{ link, section }] : [];
  });
  if (!sections.length) {
    activate(links.find(link => link.hasAttribute("aria-current")), "page");
    return;
  }

  function update() {
    const ordered = [...sections].sort((a, b) => a.section.getBoundingClientRect().top - b.section.getBoundingClientRect().top);
    let current = ordered[0];
    for (const entry of ordered) {
      if (entry.section.getBoundingClientRect().top <= Math.min(120, innerHeight * .2)) current = entry;
    }
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) current = ordered.at(-1);
    activate(current.link);
  }

  let pending = false;
  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  }
  addEventListener("scroll", scheduleUpdate, { passive: true });
  addEventListener("resize", scheduleUpdate);
  addEventListener("load", scheduleUpdate);
  update();
})();

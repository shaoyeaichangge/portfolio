(() => {
  const nav = document.querySelector(".bottom-nav");
  if (!nav) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const reduceTransparency = matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more)");
  let setLensHover = () => {};

  // A capsule-shaped displacement map bends the real backdrop only near its rim.
  // Build it on resize rather than reading or copying the page into a canvas.
  if (typeof ResizeObserver !== "undefined" && CSS.supports("backdrop-filter", 'url("#nav-glass-lens")')) {
    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "svg");
    defs.classList.add("nav-glass-defs");
    defs.setAttribute("aria-hidden", "true");
    defs.innerHTML = '<defs><filter id="nav-glass-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="soft"/><feImage result="lens" preserveAspectRatio="none"/><feDisplacementMap in="soft" in2="lens" scale="30" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    document.body.append(defs);
    const lensImage = defs.querySelector("feImage");
    const displacement = defs.querySelector("feDisplacementMap");
    let lensFrame = 0;
    let lensStrength = 30;
    setLensHover = hovered => {
      cancelAnimationFrame(lensFrame);
      const from = lensStrength;
      const target = hovered && !reduceMotion.matches && !reduceTransparency.matches ? 42 : 30;
      const start = performance.now();
      function step(now) {
        const progress = Math.min((now - start) / 180, 1);
        lensStrength = from + (target - from) * (1 - Math.pow(1 - progress, 3));
        displacement.setAttribute("scale", lensStrength.toFixed(2));
        if (progress < 1) lensFrame = requestAnimationFrame(step);
      }
      if (reduceMotion.matches || reduceTransparency.matches) {
        lensStrength = 30;
        displacement.setAttribute("scale", "30");
      } else if (from !== target) lensFrame = requestAnimationFrame(step);
    };
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let previousSize = "";

    function updateLens() {
      if (!context || reduceTransparency.matches) return;
      const width = Math.round(nav.clientWidth);
      const height = Math.round(nav.clientHeight);
      const size = `${width}:${height}`;
      if (!width || !height || size === previousSize) return;
      previousSize = size;
      canvas.width = width;
      canvas.height = height;
      const map = context.createImageData(width, height);
      const radius = height / 2;
      const band = 16;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x + .5 - width / 2;
          const dy = y + .5 - height / 2;
          const nx = Math.max(Math.abs(dx) - (width / 2 - radius), 0);
          const ny = Math.abs(dy);
          const length = Math.hypot(nx, ny);
          const depth = radius - length;
          const bend = depth >= 0 ? Math.pow(Math.max(0, 1 - depth / band), 1.4) : 0;
          const index = (y * width + x) * 4;
          map.data[index] = 128 - (length ? nx / length * Math.sign(dx) : 0) * bend * 120;
          map.data[index + 1] = 128 - (length ? ny / length * Math.sign(dy) : 0) * bend * 120;
          map.data[index + 2] = 128;
          map.data[index + 3] = 255;
        }
      }
      context.putImageData(map, 0, 0);
      lensImage.setAttribute("href", canvas.toDataURL());
      nav.style.setProperty("--glass-optics", 'url("#nav-glass-lens") saturate(1.5)');
    }
    new ResizeObserver(updateLens).observe(nav);
    reduceTransparency.addEventListener("change", () => {
      previousSize = "";
      updateLens();
    });
  }

  let lightFrame = 0;
  let hoverItem;
  function clearItemLight() {
    if (!hoverItem) return;
    hoverItem.style.removeProperty("--content-shift-x");
    hoverItem = null;
  }
  nav.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse") return;
    cancelAnimationFrame(lightFrame);
    lightFrame = requestAnimationFrame(() => {
      const item = event.target.closest("a");
      if (item !== hoverItem) clearItemLight();
      if (item && nav.contains(item)) hoverItem = item;
      syncPreview();
      if (reduceMotion.matches || reduceTransparency.matches) return;
      const rect = nav.getBoundingClientRect();
      nav.style.setProperty("--shine-x", `${event.clientX - rect.left}px`);
      nav.style.setProperty("--shine-y", `${event.clientY - rect.top}px`);
      if (!nav.hasAttribute("data-pointer")) {
        nav.dataset.pointer = "";
        setLensHover(true);
      }
      if (!hoverItem) return;
      const bounds = item.getBoundingClientRect();
      const horizontal = (event.clientX - bounds.left) / bounds.width - .5;
      item.style.setProperty("--content-shift-x", `${horizontal * 3}px`);
    });
  });
  function resetHover() {
    cancelAnimationFrame(lightFrame);
    nav.removeAttribute("data-pointer");
    nav.style.removeProperty("--shine-x");
    nav.style.removeProperty("--shine-y");
    clearItemLight();
    syncPreview();
    setLensHover(false);
  }
  nav.addEventListener("pointerleave", resetHover);
  reduceMotion.addEventListener("change", resetHover);
  reduceTransparency.addEventListener("change", resetHover);
  const links = [...nav.querySelectorAll("a")];
  let activeLink;
  function syncPreview() {
    const item = nav.querySelector("a:focus-visible") || hoverItem;
    if (item) {
      nav.style.setProperty("--preview-index", links.indexOf(item));
      nav.dataset.preview = "";
    } else {
      nav.style.removeProperty("--preview-index");
      nav.removeAttribute("data-preview");
    }
  }
  nav.addEventListener("focusin", syncPreview);
  nav.addEventListener("focusout", () => queueMicrotask(syncPreview));
  addEventListener("blur", resetHover);

  function activate(link, current = "location") {
    if (!link || link === activeLink) return;
    for (const other of links) {
      if (other !== link) other.removeAttribute("aria-current");
    }
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

  // Keep an explicit destination selected during native smooth scrolling and
  // when a short final section cannot reach the top of the viewport.
  let destination;
  function selectDestination(hash) {
    const target = document.getElementById(hash.slice(1));
    destination = sections.find(entry => target && (entry.section === target || entry.section.contains(target)));
    if (destination) activate(destination.link);
  }
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (event.target.closest("#back-to-top")) { resumeScrollTracking(); return; }
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (url.origin === location.origin && url.pathname === location.pathname) selectDestination(url.hash);
  });
  addEventListener("hashchange", () => { selectDestination(location.hash); scheduleUpdate(); });
  function resumeScrollTracking() {
    destination = null;
    scheduleUpdate();
  }
  addEventListener("wheel", resumeScrollTracking, { passive: true });
  addEventListener("touchmove", resumeScrollTracking, { passive: true });
  addEventListener("keydown", event => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key) &&
        !event.target.closest("input, textarea, select, button, [contenteditable]")) resumeScrollTracking();
  });
  addEventListener("pointerdown", event => {
    if (event.clientX >= document.documentElement.clientWidth || event.target.closest("#back-to-top")) resumeScrollTracking();
  });
  selectDestination(location.hash);

  function update() {
    if (destination) { activate(destination.link); return; }
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

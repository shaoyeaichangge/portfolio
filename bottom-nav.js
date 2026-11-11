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
    for (const property of ["--item-shine-x", "--item-shine-y", "--item-shift-x", "--item-shift-y", "--item-tilt-x", "--item-tilt-y", "--content-shift-x"]) hoverItem.style.removeProperty(property);
    hoverItem = null;
  }
  nav.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || reduceMotion.matches || reduceTransparency.matches) return;
    cancelAnimationFrame(lightFrame);
    lightFrame = requestAnimationFrame(() => {
      const rect = nav.getBoundingClientRect();
      nav.style.setProperty("--shine-x", `${event.clientX - rect.left}px`);
      nav.style.setProperty("--shine-y", `${event.clientY - rect.top}px`);
      if (!nav.hasAttribute("data-pointer")) {
        nav.dataset.pointer = "";
        setLensHover(true);
      }
      const item = event.target.closest("a");
      if (item !== hoverItem) clearItemLight();
      if (!item || !nav.contains(item)) return;
      hoverItem = item;
      const bounds = item.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const horizontal = x / bounds.width - .5;
      const vertical = y / bounds.height - .5;
      item.style.setProperty("--item-shine-x", `${x}px`);
      item.style.setProperty("--item-shine-y", `${y}px`);
      item.style.setProperty("--item-shift-x", `${horizontal * 5}px`);
      item.style.setProperty("--item-shift-y", `${-3 + vertical * 2}px`);
      item.style.setProperty("--item-tilt-x", `${vertical * -7}deg`);
      item.style.setProperty("--item-tilt-y", `${horizontal * 7}deg`);
      item.style.setProperty("--content-shift-x", `${horizontal * 3}px`);
    });
  });
  function resetHover() {
    cancelAnimationFrame(lightFrame);
    nav.removeAttribute("data-pointer");
    nav.style.removeProperty("--shine-x");
    nav.style.removeProperty("--shine-y");
    clearItemLight();
    setLensHover(false);
  }
  nav.addEventListener("pointerleave", resetHover);
  reduceMotion.addEventListener("change", resetHover);
  reduceTransparency.addEventListener("change", resetHover);
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

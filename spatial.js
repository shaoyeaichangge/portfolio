(() => {
  const hero = document.querySelector(".hero");
  if (!hero || !CSS.supports("transform-style", "preserve-3d")) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const viewer = document.querySelector(".image-viewer");
  const clamp = value => Math.max(-1, Math.min(1, value));
  const room = document.createElement("div");
  room.className = "spatial-room";
  room.setAttribute("aria-hidden", "true");
  room.innerHTML = '<div class="spatial-floor"></div><div class="spatial-wall"></div>';
  if (!hero.classList.contains("kinetic-hero")) hero.prepend(room);
  hero.classList.add("spatial-hero");

  const records = new Map();
  const moving = new Set();
  const scene = { element: hero, x: 0, y: 0, lift: 0, tx: 0, ty: 0, tl: 0, scene: true, visible: true };
  let frame = 0;
  let previous = 0;
  let frozen = Boolean(viewer?.open);
  let scrollPending = true;
  let heroTop = 0;
  let heroHeight = 1;
  let lockedImages = [];
  const permitted = () => !reduceMotion.matches && !document.hidden && !frozen;

  function releaseImages() {
    for (const { image, transform, transition } of lockedImages) {
      image.style.transform = transform;
      image.style.transition = transition;
    }
    lockedImages = [];
  }
  // A modal removes :hover. Hold the actual image pose before it opens so
  // both ends of the viewer transition use the same stationary source.
  if (viewer) hero.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !event.target.closest(".hero-proof")) return;
    releaseImages();
    for (const image of hero.querySelectorAll(".proof-art img")) {
      const transform = image.style.transform, transition = image.style.transition;
      const pose = getComputedStyle(image).transform;
      image.style.transition = "none";
      image.style.transform = pose;
      lockedImages.push({ image, transform, transition });
    }
    setTimeout(() => { if (!viewer.open) releaseImages(); }, 0);
  }, { capture: true });

  function write(record) {
    const prefix = record.scene ? "scene" : "card";
    record.element.style.setProperty(`--${prefix}-x`, record.x.toFixed(4));
    record.element.style.setProperty(`--${prefix}-y`, record.y.toFixed(4));
    if (!record.scene) record.element.style.setProperty("--card-lift", record.lift.toFixed(4));
  }
  function schedule() {
    if (!frame && permitted()) { previous = 0; frame = requestAnimationFrame(tick); }
  }
  function tick(now) {
    frame = 0;
    if (!permitted()) return;
    const elapsed = Math.min(48, previous ? now - previous : 16);
    previous = now;
    const blend = 1 - Math.exp(-elapsed / 110);
    if (scrollPending) {
      scrollPending = false;
      if (scene.visible) hero.style.setProperty("--scene-scroll", Math.max(0, Math.min(1, (scrollY - heroTop) / heroHeight)).toFixed(4));
    }
    for (const record of moving) {
      record.x += (record.tx - record.x) * blend;
      record.y += (record.ty - record.y) * blend;
      record.lift += (record.tl - record.lift) * blend;
      if (Math.abs(record.tx - record.x) + Math.abs(record.ty - record.y) + Math.abs(record.tl - record.lift) < .002) {
        record.x = record.tx; record.y = record.ty; record.lift = record.tl;
        moving.delete(record);
        if (!record.lift) delete record.element.dataset.spatialActive;
      }
      write(record);
    }
    if (moving.size || scrollPending) frame = requestAnimationFrame(tick);
  }
  function neutral(record, immediate = false) {
    record.tx = record.ty = record.tl = 0;
    if (immediate) {
      record.x = record.y = record.lift = 0;
      moving.delete(record);
      delete record.element.dataset.spatialActive;
      write(record);
    } else { moving.add(record); schedule(); }
  }
  function attach(record) {
    const element = record.element;
    let box;
    // Cache the stable layout bounds before tilting to avoid feedback at card edges.
    element.addEventListener("pointerenter", () => { box = element.getBoundingClientRect(); }, { passive: true });
    element.addEventListener("pointermove", event => {
      if (event.pointerType !== "mouse" || !finePointer.matches || !permitted()) return;
      box ||= element.getBoundingClientRect();
      record.tx = clamp((event.clientX - box.left) / box.width * 2 - 1);
      record.ty = clamp((event.clientY - box.top) / box.height * 2 - 1);
      record.tl = 1;
      if (!record.scene) element.dataset.spatialActive = "";
      moving.add(record);
      schedule();
    }, { passive: true });
    element.addEventListener("pointerleave", () => {
      box = undefined;
      // Keep the source at its exact pose throughout the image morph.
      if (frozen) { record.tx = record.ty = record.tl = 0; return; }
      neutral(record);
    }, { passive: true });
    record.clearBounds = () => { box = undefined; };
  }
  if (!hero.classList.contains("kinetic-hero")) attach(scene);

  const cardObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      const record = records.get(target);
      if (record && !isIntersecting && !frozen) neutral(record, true);
    });
  });
  function collectCards() {
    for (const element of document.querySelectorAll(".project-gallery, .github-card, .simulation-placeholder, .about-section, .creator-channel")) {
      if (records.has(element)) continue;
      const record = { element, x: 0, y: 0, lift: 0, tx: 0, ty: 0, tl: 0 };
      element.dataset.spatialCard = "";
      records.set(element, record);
      attach(record);
      cardObserver.observe(element);
    }
    for (const [element, record] of records) {
      if (element.isConnected) continue;
      moving.delete(record);
      cardObserver.unobserve(element);
      records.delete(element);
    }
  }
  collectCards();
  const grid = document.getElementById("works-grid");
  if (grid) new MutationObserver(collectCards).observe(grid, { childList: true });

  function measure() {
    const box = hero.getBoundingClientRect();
    heroTop = box.top + scrollY;
    heroHeight = box.height;
    scene.clearBounds?.();
    records.forEach(record => record.clearBounds());
    scrollPending = true;
    schedule();
  }
  new ResizeObserver(measure).observe(hero);
  new IntersectionObserver(([entry]) => {
    scene.visible = entry.isIntersecting;
    if (!scene.visible && !frozen) neutral(scene, true);
    if (scene.visible) { scrollPending = true; schedule(); }
  }).observe(hero);
  window.addEventListener("scroll", () => {
    scene.clearBounds?.();
    records.forEach(record => {
      record.clearBounds();
      if (!frozen && record.tl) neutral(record);
    });
    if (scene.visible) { scrollPending = true; schedule(); }
  }, { passive: true });
  window.addEventListener("resize", measure, { passive: true });

  function reset() {
    cancelAnimationFrame(frame); frame = 0;
    neutral(scene, true);
    records.forEach(record => neutral(record, true));
    hero.style.setProperty("--scene-scroll", "0");
    scrollPending = true;
    schedule();
  }
  reduceMotion.addEventListener("change", reset);
  finePointer.addEventListener("change", reset);
  document.addEventListener("visibilitychange", reset);
  window.addEventListener("blur", () => { if (!frozen) { neutral(scene); records.forEach(record => neutral(record)); } });
  if (viewer) new MutationObserver(() => {
    frozen = viewer.open;
    if (frozen) { cancelAnimationFrame(frame); frame = 0; }
    else { releaseImages(); neutral(scene); records.forEach(record => neutral(record)); schedule(); }
  }).observe(viewer, { attributes: true, attributeFilter: ["open"] });
  window.addEventListener("pagehide", () => { cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener("pageshow", measure);
  measure();
})();

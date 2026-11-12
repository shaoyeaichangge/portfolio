(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const hero = document.querySelector(".hero");
  const proof = document.querySelector(".hero-proof");
  if (!hero || !proof) return;

  // Progressive enhancement: content remains visible without animations or JS.
  const headings = ["#works-title", "#simulation-title", "#skills-title", "#about-title", "#creator-title"];
  headings.forEach((selector, index) => {
    document.querySelector(selector)?.setAttribute("data-section-number", String(index + 1).padStart(2, "0"));
  });
  const glyphs = [
    '<path d="M4 26C42 26 42 9 70 9s31 17 58 17M4 42c30 0 39-20 65-20s33 20 59 20M4 58c26 0 38-16 64-16s34 16 60 16M4 74c36 0 40-6 66-6s32 6 58 6M4 90h124"/><path class="glyph-detail" d="M4 18v78m26-78v78m26-78v78m26-78v78m26-78v78"/>',
    '<path d="m25 29 44-21 44 21v50l-44 22-44-22Zm0 0 44 23 44-23M69 52v49M25 54l44 23 44-23M47 19l44 23v48M91 19 47 42v48"/><path class="glyph-detail" d="m25 79 44-21 44 21M69 8v50m-44-4 44-21 44 21"/>',
    '<path d="m19 29 48-21 48 21-48 23-48-23Zm0 23 48 23 48-23M19 75l48 23 48-23M67 52v46"/><path class="glyph-detail" d="M19 29v46m96-46v46M67 8v22m-7-7 7 7 7-7M37 21l48 23M85 16 37 37"/>'
  ];
  document.querySelectorAll(".simulation-placeholder").forEach((card, index) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "simulation-glyph");
    svg.setAttribute("viewBox", "0 0 134 110");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = glyphs[index % glyphs.length];
    card.append(svg);
  });

  // Pointer work is bounded to the hovered surface and one animation frame.
  const surfaces = document.querySelectorAll(".project-gallery, .github-card, .skill-row, .creator-channel, .site-clock");
  surfaces.forEach(surface => {
    surface.dataset.glass = "";
    let pending = 0;
    let point;
    const reset = () => {
      cancelAnimationFrame(pending);
      pending = 0;
      delete surface.dataset.glassHover;
    };
    surface.addEventListener("pointermove", event => {
      if (!finePointer.matches || reduceMotion.matches || event.pointerType !== "mouse") return;
      point = { x: event.clientX, y: event.clientY };
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        const box = surface.getBoundingClientRect();
        surface.style.setProperty("--light-x", `${point.x - box.left}px`);
        surface.style.setProperty("--light-y", `${point.y - box.top}px`);
        surface.dataset.glassHover = "";
      });
    }, { passive: true });
    surface.addEventListener("pointerleave", reset);
    reduceMotion.addEventListener("change", reset);
  });

  let tiltFrame = 0;
  let tiltPoint;
  function resetTilt() {
    cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
    proof.style.removeProperty("--tilt-x");
    proof.style.removeProperty("--tilt-y");
  }
  proof.addEventListener("pointermove", event => {
    if (!finePointer.matches || reduceMotion.matches || innerWidth <= 760 || event.pointerType !== "mouse") return;
    tiltPoint = { x: event.clientX, y: event.clientY };
    if (tiltFrame) return;
    tiltFrame = requestAnimationFrame(() => {
      tiltFrame = 0;
      const box = proof.getBoundingClientRect();
      const x = Math.max(-.5, Math.min(.5, (tiltPoint.x - box.left) / box.width - .5));
      const y = Math.max(-.5, Math.min(.5, (tiltPoint.y - box.top) / box.height - .5));
      proof.style.setProperty("--tilt-x", `${-y * 7}deg`);
      proof.style.setProperty("--tilt-y", `${x * 9}deg`);
    });
  }, { passive: true });
  proof.addEventListener("pointerleave", resetTilt);
  reduceMotion.addEventListener("change", resetTilt);

  const entrances = new Set();
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        observer.unobserve(target);
        if (reduceMotion.matches || location.hash || !target.animate) return;
        const animation = target.animate([
          { opacity: .45, transform: "translateY(18px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 700, easing: "cubic-bezier(.22,1,.36,1)" });
        entrances.add(animation);
        animation.addEventListener("finish", () => entrances.delete(animation), { once: true });
      });
    }, { threshold: .08 });
    document.querySelectorAll(".hero-copy, .project-gallery, .github-card, .skill-sheet, .about-section, .creator-intro").forEach(element => observer.observe(element));
    reduceMotion.addEventListener("change", () => {
      if (!reduceMotion.matches) return;
      entrances.forEach(animation => animation.cancel());
      entrances.clear();
    });
  }

  // Analytic decorative streamlines, cached as paths. No models or project data.
  const canvas = document.querySelector(".hero-flow");
  const context = canvas?.getContext("2d");
  if (!context) return;
  let width = 0;
  let height = 0;
  let paths = [];
  let visible = true;
  let frame = 0;
  let previous = 0;
  let phase = 0;
  let observerPaused = false;
  const canAnimate = () => visible && !document.hidden && !reduceMotion.matches && !observerPaused;

  function buildPaths() {
    const box = hero.getBoundingClientRect();
    width = box.width;
    height = box.height;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    paths = Array.from({ length: width < 600 ? 22 : 34 }, (_, row) => {
      const p = new Path2D();
      const base = row / (width < 600 ? 21 : 33);
      for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        const x = t * (width + 100) - 50;
        const bend = Math.exp(-Math.pow((t - .61) / .25, 2));
        const y = height * (.27 + base * .68) - bend * height * (.23 + Math.sin(base * Math.PI) * .18) + Math.sin(t * 5 + base * 2) * 14;
        step ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      return p;
    });
    draw();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const stroke = context.createLinearGradient(0, height, width, 0);
    stroke.addColorStop(0, "rgba(145,185,226,0)");
    stroke.addColorStop(.38, "rgba(145,185,226,.07)");
    stroke.addColorStop(.68, "rgba(175,210,248,.28)");
    stroke.addColorStop(1, "rgba(145,185,226,.08)");
    context.strokeStyle = stroke;
    context.lineWidth = .7;
    context.setLineDash([]);
    paths.forEach(path => context.stroke(path));
    context.lineWidth = 1.15;
    context.strokeStyle = "rgba(184,220,255,.38)";
    paths.forEach((path, index) => {
      if (index % 4) return;
      context.setLineDash([22, width * 1.2]);
      context.lineDashOffset = -phase - index * 67;
      context.stroke(path);
    });
    context.setLineDash([]);
  }

  function tick(now) {
    if (!canAnimate()) { frame = 0; return; }
    if (!previous || now - previous >= 32) {
      phase += Math.min(now - (previous || now), 60) * .035;
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (canAnimate()) {
      if (!frame) { previous = 0; frame = requestAnimationFrame(tick); }
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      draw();
    }
  }
  new ResizeObserver(buildPaths).observe(hero);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(hero);
  const viewer = document.querySelector(".image-viewer");
  if (viewer) new MutationObserver(() => { observerPaused = viewer.open; sync(); }).observe(viewer, { attributes: true, attributeFilter: ["open"] });
  reduceMotion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener("pageshow", sync);
  buildPaths();
  sync();
})();

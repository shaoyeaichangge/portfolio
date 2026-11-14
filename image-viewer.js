(() => {
  const viewer = document.createElement("dialog");
  if (typeof viewer.showModal !== "function") return;

  viewer.className = "image-viewer";
  viewer.setAttribute("aria-labelledby", "image-viewer-title");
  viewer.innerHTML = `
    <div class="image-viewer-toolbar">
      <div class="image-viewer-caption" aria-live="polite">
        <h2 id="image-viewer-title"></h2>
        <p class="image-viewer-position" hidden></p>
      </div>
    </div>
    <div class="image-viewer-stage">
      <div class="image-viewer-content">
        <button class="image-viewer-image" type="button" aria-label="放大图片" disabled>
          <img alt="" draggable="false">
        </button>
        <p role="status" hidden>图片加载失败。</p>
      </div>
      <div class="image-viewer-navigation" role="group" aria-label="切换图片" hidden>
        <button class="image-viewer-edge image-viewer-edge-prev" type="button" data-step="-1" aria-label="上一张">
          <span aria-hidden="true">‹</span>
        </button>
        <button class="image-viewer-edge image-viewer-edge-next" type="button" data-step="1" aria-label="下一张">
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
    <form class="image-viewer-footer" method="dialog">
      <p class="image-viewer-hint">点按图片放大</p>
      <button type="submit" autofocus><span aria-hidden="true">←</span> 返回</button>
    </form>
  `;
  document.body.append(viewer);

  const title = viewer.querySelector("h2");
  const image = viewer.querySelector("img");
  const zoomButton = viewer.querySelector(".image-viewer-image");
  const hint = viewer.querySelector(".image-viewer-hint");
  const error = viewer.querySelector('[role="status"]');
  const content = viewer.querySelector(".image-viewer-content");
  const position = viewer.querySelector(".image-viewer-position");
  const navigation = viewer.querySelector(".image-viewer-navigation");
  const previous = navigation.querySelector('[data-step="-1"]');
  const next = navigation.querySelector('[data-step="1"]');
  let opener;
  let slides = [];
  let currentIndex = 0;
  let pressedBackdrop = false;
  let touchStart;
  let swipeTime = -Infinity;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let originGallery;
  let originSource;
  let morph;
  let closing = false;

  function visibleArea(element) {
    const rect = element.getBoundingClientRect();
    const track = element.closest(".project-thumbnails")?.getBoundingClientRect();
    return Math.max(0, Math.min(rect.right, innerWidth, track?.right ?? innerWidth) - Math.max(rect.left, 0, track?.left ?? 0))
      * Math.max(0, Math.min(rect.bottom, innerHeight, track?.bottom ?? innerHeight) - Math.max(rect.top, 0, track?.top ?? 0));
  }
  function sourceFor(link) {
    const proof = originGallery?.querySelector(".proof-art");
    if (proof) {
      const candidate = proof.querySelectorAll("img")[currentIndex];
      if (candidate && visibleArea(candidate)) return candidate;
    }
    const candidates = originGallery
      ? [...originGallery.querySelectorAll("a[href] img")].filter(img => img.closest("a").href === link.href)
      : [...(link.closest("figure")?.querySelectorAll("img") || link.querySelectorAll("img"))];
    return candidates.filter(img => img.complete && img.naturalWidth && visibleArea(img)).sort((a, b) => visibleArea(b) - visibleArea(a))[0];
  }
  function paintBox(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.min(width / element.naturalWidth, height / element.naturalHeight);
    let w = element.naturalWidth * scale, h = element.naturalHeight * scale;
    let angle = 0;
    if (style.transform !== "none" && typeof DOMMatrixReadOnly !== "undefined") {
      const matrix = new DOMMatrixReadOnly(style.transform);
      angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    }
    // Account for projection inherited from a tilted/scaled card. Remove the
    // image's own rotation from the bounds before estimating its screen scale.
    const radians = angle * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
    const footprintWidth = element.offsetWidth * cos + element.offsetHeight * sin;
    const footprintHeight = element.offsetWidth * sin + element.offsetHeight * cos;
    if (footprintWidth && footprintHeight) {
      w *= rect.width / footprintWidth;
      h *= rect.height / footprintHeight;
    }
    return { left: rect.left + (rect.width - w) / 2, top: rect.top + (rect.height - h) / 2, width: w, height: h, angle };
  }
  function fittedTarget(source) {
    const rect = zoomButton.getBoundingClientRect();
    const scale = Math.min(rect.width / source.naturalWidth, rect.height / source.naturalHeight);
    const width = source.naturalWidth * scale, height = source.naturalHeight * scale;
    return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height, angle: 0 };
  }
  function boxStyles(box) {
    return { left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px", transform: `rotate(${box.angle || 0}deg)` };
  }
  function cancelMorph() {
    if (morph) {
      morph.animation?.cancel();
      morph.clone.remove();
      morph.source.style.visibility = morph.sourceVisibility;
      image.style.visibility = morph.imageVisibility;
      morph = undefined;
    }
    for (const key of ["opening", "closing", "morphing"]) delete viewer.dataset[key];
  }
  function finishOpening() {
    if (!morph?.finished || closing || image.hidden || !image.complete || !image.naturalWidth) return;
    cancelMorph();
  }
  function animateImage(source, from, to, isClosing, src) {
    const clone = document.createElement("img");
    clone.className = "image-viewer-transition";
    clone.alt = "";
    clone.setAttribute("aria-hidden", "true");
    clone.src = src || (isClosing ? (image.currentSrc || source.currentSrc) : source.currentSrc);
    Object.assign(clone.style, boxStyles(to));
    const state = { clone, source, sourceVisibility: source.style.visibility, imageVisibility: image.style.visibility };
    morph = state;
    source.style.visibility = image.style.visibility = "hidden";
    viewer.dataset.morphing = "";
    viewer.dataset[isClosing ? "closing" : "opening"] = "";
    viewer.append(clone);
    state.animation = clone.animate([
      { ...boxStyles(from), borderRadius: isClosing ? "0px" : "6px" },
      { ...boxStyles(to), borderRadius: isClosing ? "6px" : "0px" }
    ], { duration: isClosing ? 320 : 440, easing: "cubic-bezier(.22,1,.36,1)" });
    state.animation.addEventListener("finish", () => {
      if (morph !== state) return;
      state.finished = true;
      if (isClosing) viewer.close();
      else { delete viewer.dataset.opening; finishOpening(); }
    }, { once: true });
  }
  function openFrom(source) {
    if (reduceMotion.matches || !source || !source.naturalWidth || !image.animate) return;
    animateImage(source, paintBox(source), fittedTarget(source), false);
  }
  function requestClose() {
    if (closing) { viewer.close(); return; }
    const source = sourceFor(slides[currentIndex]) || (originSource?.isConnected && visibleArea(originSource) ? originSource : null);
    if (reduceMotion.matches || !source || !source.naturalWidth || (!morph && image.hidden)) { viewer.close(); return; }
    const visual = morph?.clone || image;
    const src = visual.currentSrc || visual.src;
    const rect = visual.getBoundingClientRect();
    const from = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, angle: 0 };
    const target = paintBox(source);
    const backdrop = getComputedStyle(viewer, "::backdrop");
    viewer.style.setProperty("--veil-from", backdrop.backgroundColor);
    viewer.style.setProperty("--veil-blur-from", backdrop.backdropFilter || "blur(8px)");
    cancelMorph();
    closing = true;
    animateImage(source, from, target, true, src);
  }

  function setZoom(zoomed) {
    viewer.classList.toggle("image-viewer-zoomed", zoomed);
    zoomButton.setAttribute("aria-label", zoomed ? "恢复全图" : "放大图片");
    hint.textContent = zoomed ? "点按图片恢复全图" : "点按图片放大";
    content.scrollTo(0, 0);
  }

  function showImage() {
    cancelMorph();
    const link = slides[currentIndex];
    const figure = link.closest("figure");
    title.textContent = link.dataset.imageTitle
      || link.querySelector("h3")?.textContent
      || figure?.querySelector("h2")?.textContent
      || "图片预览";
    image.alt = link.querySelector("img")?.alt || figure?.querySelector("img")?.alt || title.textContent;
    zoomButton.hidden = false;
    error.hidden = true;
    setZoom(false);
    navigation.hidden = position.hidden = slides.length < 2;
    position.textContent = (currentIndex + 1) + " / " + slides.length;
    previous.setAttribute("aria-disabled", String(currentIndex === 0));
    next.setAttribute("aria-disabled", String(currentIndex === slides.length - 1));
    previous.tabIndex = currentIndex === 0 ? -1 : 0;
    next.tabIndex = currentIndex === slides.length - 1 ? -1 : 0;
    zoomButton.disabled = true;
    hint.hidden = true;
    image.hidden = true;
    image.src = link.href;
    if (image.complete && image.naturalWidth) showLoadedImage();
  }

  function showLoadedImage() {
    if (!image.complete || !image.naturalWidth) return;
    image.hidden = false;
    zoomButton.disabled = false;
    hint.hidden = false;
    finishOpening();
  }

  function stepBy(amount) {
    if (closing) return;
    const index = currentIndex + amount;
    if (index < 0 || index >= slides.length) return;
    const focused = document.activeElement;
    currentIndex = index;
    showImage();
    if (focused === previous && index === 0) next.focus();
    if (focused === next && index === slides.length - 1) previous.focus();
  }

  previous.addEventListener("click", () => stepBy(-1));
  next.addEventListener("click", () => stepBy(1));
  zoomButton.addEventListener("click", event => {
    if (event.detail && (event.target !== image || performance.now() - swipeTime < 350)) return;
    cancelMorph();
    zoomButton.style.setProperty("--zoom-width", image.naturalWidth + "px");
    setZoom(!viewer.classList.contains("image-viewer-zoomed"));
  });
  viewer.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    swipeTime = -Infinity;
    if (slides.length < 2 || viewer.classList.contains("image-viewer-zoomed")) return;
    if (!event.target.closest(".image-viewer-stage")) return;
    touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  viewer.addEventListener("pointerup", event => {
    if (touchStart?.id !== event.pointerId) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = undefined;
    if (Math.abs(dx) < 48 || Math.abs(dx) < 1.4 * Math.abs(dy)) return;
    swipeTime = performance.now();
    stepBy(dx < 0 ? 1 : -1);
  });
  viewer.addEventListener("keydown", event => {
    if (slides.length < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    stepBy(event.key === "ArrowLeft" ? -1 : 1);
  });

  image.addEventListener("load", showLoadedImage);
  image.addEventListener("error", () => {
    if (!viewer.open) return;
    if (closing) { viewer.close(); return; }
    cancelMorph();
    zoomButton.hidden = true;
    hint.hidden = true;
    error.hidden = false;
  });

  function isBackdrop(event) {
    if (event.target !== viewer) return false;
    const { left, right, top, bottom } = viewer.getBoundingClientRect();
    return event.clientX < left || event.clientX > right
      || event.clientY < top || event.clientY > bottom;
  }

  viewer.addEventListener("pointerdown", event => {
    pressedBackdrop = event.button === 0 && isBackdrop(event);
  });
  viewer.addEventListener("pointercancel", () => {
    pressedBackdrop = false;
    touchStart = undefined;
  });
  viewer.addEventListener("click", event => {
    if (pressedBackdrop && isBackdrop(event)) requestClose();
    pressedBackdrop = false;
  });

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href);
    if (!/\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname)) return;

    event.preventDefault();
    opener = link.hasAttribute("data-image-copy") ? link.parentElement : link;
    const gallery = link.closest("[data-image-gallery]");
    originGallery = gallery;
    slides = [...(gallery?.querySelectorAll("a[data-image-item]") || [])];
    currentIndex = slides.findIndex(slide => slide.href === link.href);
    if (currentIndex < 0) {
      slides = [link];
      currentIndex = 0;
    }
    showImage();
    viewer.showModal();
    originSource = sourceFor(link);
    openFrom(originSource);
  });

  viewer.querySelector("form").addEventListener("submit", event => { event.preventDefault(); requestClose(); });
  viewer.addEventListener("cancel", event => { event.preventDefault(); requestClose(); });
  addEventListener("resize", () => { if (closing) viewer.close(); else cancelMorph(); });
  reduceMotion.addEventListener("change", () => { if (reduceMotion.matches) { if (closing) viewer.close(); else cancelMorph(); } });

  viewer.addEventListener("close", () => {
    cancelMorph();
    closing = false;
    pressedBackdrop = false;
    touchStart = undefined;
    image.removeAttribute("src");
    opener?.focus({ preventScroll: true });
    opener = undefined;
    slides = [];
    originGallery = originSource = undefined;
  });
})();

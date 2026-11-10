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

  function setZoom(zoomed) {
    viewer.classList.toggle("image-viewer-zoomed", zoomed);
    zoomButton.setAttribute("aria-label", zoomed ? "恢复全图" : "放大图片");
    hint.textContent = zoomed ? "点按图片恢复全图" : "点按图片放大";
    content.scrollTo(0, 0);
  }

  function showImage() {
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
    image.hidden = false;
    zoomButton.disabled = false;
    hint.hidden = false;
  }

  function stepBy(amount) {
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
    if (pressedBackdrop && isBackdrop(event)) viewer.close();
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
    slides = [...(gallery?.querySelectorAll("a[data-image-item]") || [])];
    currentIndex = slides.findIndex(slide => slide.href === link.href);
    if (currentIndex < 0) {
      slides = [link];
      currentIndex = 0;
    }
    showImage();
    viewer.showModal();
  });

  viewer.addEventListener("close", () => {
    pressedBackdrop = false;
    touchStart = undefined;
    image.removeAttribute("src");
    opener?.focus({ preventScroll: true });
    opener = undefined;
    slides = [];
  });
})();

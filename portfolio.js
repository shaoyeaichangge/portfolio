(() => {
  const works = (window.PORTFOLIO_WORKS || []).filter(
    work => work && typeof work.title === "string" && work.title.trim()
  );
  const pageSize = 12;
  const grid = document.getElementById("works-grid");
  const simulationGrid = document.getElementById("simulation-grid");
  const search = document.getElementById("search");
  const category = document.getElementById("category");
  const moreButton = document.getElementById("load-more");
  const emptyState = document.getElementById("empty-state");
  const resultCount = document.getElementById("result-count");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollTrack = new WeakMap();
  const allTracks = new Set();
  const visibleTracks = new Set();
  let trackFrame = 0;
  let wakeTimer = 0;
  let previousFrame = 0;
  let pageActive = true;
  let viewerOpen = false;
  const trackObserver = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && target.isConnected && scrollTrack.has(target)) visibleTracks.add(target);
      else visibleTracks.delete(target);
    }
    syncTrackMotion();
  });
  let matchingWorks = works;
  let visibleCount = 0;

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      const isLocalFile = location.protocol === "file:" && url.protocol === "file:";
      return isLocalFile || ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function createCard(work) {
    const card = document.createElement("article");
    card.className = "project";
    const images = (work.images || []).flatMap(image => {
      const url = safeUrl(image?.url);
      return url ? [{ title: image.title || work.title, url, thumbnail: safeUrl(image.thumbnail) }] : [];
    });
    if (images.length) {
      card.classList.add("project-gallery");
      card.dataset.imageGallery = "";
      const body = createCardBody(work, images[0].url);
      body.querySelector(".project-gallery-entry").setAttribute("aria-label", `查看「${work.title}」图集，共 ${images.length} 张图`);
      const footer = document.createElement("div");
      footer.className = "project-gallery-footer";
      footer.setAttribute("aria-hidden", "true");
      const count = document.createElement("span");
      count.className = "project-gallery-count";
      const number = document.createElement("strong");
      number.textContent = String(images.length).padStart(2, "0");
      count.append(number, "张图");
      const action = document.createElement("span");
      action.className = "project-gallery-open";
      action.innerHTML = '查看图集 <span class="project-gallery-arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></span>';
      footer.append(count, action);
      body.append(footer);
      card.append(body, createCarousel(images));
      return card;
    }

    const url = safeUrl(work.url);
    const content = document.createElement(url ? "a" : "div");
    if (url) {
      content.className = "project-link";
      content.href = url;
    }

    const placeholder = document.createElement("div");
    placeholder.className = "cover cover-placeholder";
    placeholder.textContent = work.category || "作品";
    placeholder.setAttribute("aria-hidden", "true");
    const coverUrl = safeUrl(work.cover);
    if (coverUrl) {
      const image = document.createElement("img");
      image.className = "cover";
      if (work.coverFit === "contain") image.classList.add("cover-contain");
      image.src = coverUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => image.replaceWith(placeholder), { once: true });
      content.append(image);
    } else {
      content.append(placeholder);
    }

    const body = createCardBody(work);
    if (url && work.linkLabel) {
      const linkLabel = document.createElement("p");
      linkLabel.className = "project-action";
      linkLabel.textContent = work.linkLabel;
      body.append(linkLabel);
    }
    content.append(body);
    card.append(content);
    return card;
  }

  function createCardBody(work, firstImageUrl) {
    const body = document.createElement("div");
    body.className = "project-body";
    const label = document.createElement("p");
    label.className = "project-category";
    label.textContent = work.category || "未分类";
    const title = document.createElement("h3");
    if (firstImageUrl) {
      const entry = document.createElement("a");
      entry.className = "project-gallery-entry";
      entry.href = firstImageUrl;
      entry.textContent = work.title;
      entry.setAttribute("aria-label", "查看「" + work.title + "」图片");
      title.append(entry);
    } else {
      title.textContent = work.title;
    }
    title.tabIndex = -1;
    body.append(label, title);
    if (work.summary) {
      const summary = document.createElement("p");
      summary.className = "project-summary";
      summary.textContent = work.summary;
      body.append(summary);
    }
    return body;
  }

  function createCarousel(images) {
    const carousel = document.createElement("div");
    carousel.className = "project-carousel";
    const thumbnails = document.createElement("div");
    thumbnails.className = "project-thumbnails";
    thumbnails.setAttribute("aria-label", "作品图片");
    thumbnails.setAttribute("role", "group");
    const links = images.map(item => {
      const link = document.createElement("a");
      link.href = item.url;
      link.dataset.imageItem = "";
      link.dataset.imageTitle = item.title;
      link.className = "project-thumbnail";
      const image = document.createElement("img");
      image.src = item.thumbnail || item.url;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      const caption = document.createElement("span");
      caption.textContent = item.title;
      link.append(image, caption);
      return link;
    });
    thumbnails.append(...links);
    carousel.append(thumbnails);
    if (links.length < 2) {
      carousel.classList.add("project-carousel-single");
      return carousel;
    }

    const copies = links.map(link => {
      const copy = link.cloneNode(true);
      delete copy.dataset.imageItem;
      copy.dataset.imageCopy = "";
      copy.tabIndex = -1;
      copy.setAttribute("aria-hidden", "true");
      return copy;
    });
    thumbnails.append(...copies);
    thumbnails.tabIndex = 0;

    let offset = 0;
    let lastPosition = 0;
    let manualUntil = 0;
    let hovered = false;
    let surface = carousel;
    const touches = new Set();
    const events = new AbortController();
    const passive = { passive: true, signal: events.signal };
    const delayAutoScroll = () => {
      manualUntil = performance.now() + 1200;
      syncTrackMotion();
    };
    const releaseTouch = event => {
      let released = false;
      for (const touch of event.changedTouches) released = touches.delete(touch.identifier) || released;
      if (released) delayAutoScroll();
    };
    const track = {
      readyAt() {
        if (hovered || touches.size || surface.matches(":focus-visible, :has(:focus-visible)")) return Infinity;
        return manualUntil;
      },
      advance(elapsed) {
        const position = thumbnails.scrollLeft;
        if (position !== lastPosition) offset = position;
        const loopWidth = copies[0].offsetLeft - links[0].offsetLeft;
        if (!loopWidth) return;
        offset = (offset + elapsed * 52 / 1000) % loopWidth;
        thumbnails.scrollLeft = offset;
        lastPosition = thumbnails.scrollLeft;
      },
      resetInput() {
        hovered = matchMedia("(hover: hover) and (pointer: fine)").matches && surface.matches(":hover");
        touches.clear();
      },
      destroy() {
        events.abort();
        allTracks.delete(thumbnails);
        scrollTrack.delete(thumbnails);
      }
    };
    scrollTrack.set(thumbnails, track);
    allTracks.add(thumbnails);
    // The card is attached after createCarousel returns. Bind to its full surface.
    queueMicrotask(() => {
      if (events.signal.aborted) return;
      surface = thumbnails.closest(".project-gallery") || carousel;
      surface.addEventListener("pointerenter", event => {
        if (event.pointerType !== "mouse") return;
        hovered = true;
        syncTrackMotion();
      }, passive);
      surface.addEventListener("pointerleave", () => {
        hovered = false;
        syncTrackMotion();
      }, passive);
      surface.addEventListener("focusin", syncTrackMotion, passive);
      surface.addEventListener("focusout", () => queueMicrotask(syncTrackMotion), passive);
      surface.addEventListener("wheel", delayAutoScroll, passive);
      surface.addEventListener("touchstart", event => {
        for (const touch of event.changedTouches) touches.add(touch.identifier);
        syncTrackMotion();
      }, passive);
      // Touch events keep the gesture paused even after native scrolling cancels pointers.
      surface.addEventListener("touchmove", delayAutoScroll, passive);
      window.addEventListener("touchend", releaseTouch, passive);
      window.addEventListener("touchcancel", releaseTouch, passive);
    });
    trackObserver.observe(thumbnails);
    return carousel;
  }

  function showNextPage() {
    const nextPage = matchingWorks.slice(visibleCount, visibleCount + pageSize);
    grid.append(...nextPage.map(createCard));
    visibleCount += nextPage.length;
    moreButton.hidden = visibleCount >= matchingWorks.length;
  }

  function updateResults() {
    const query = search.value.trim().toLocaleLowerCase();
    matchingWorks = works.filter(work => {
      const imageTitles = (work.images || []).map(image => image?.title);
      const text = [work.title, work.summary, work.category, ...imageTitles].join(" ").toLocaleLowerCase();
      return (!category.value || (work.category || "未分类") === category.value)
        && text.includes(query);
    });
    for (const track of grid.querySelectorAll(".project-thumbnails")) {
      trackObserver.unobserve(track);
      visibleTracks.delete(track);
      scrollTrack.get(track)?.destroy();
    }
    grid.replaceChildren();
    visibleCount = 0;
    const allGalleries = matchingWorks.length > 0 && matchingWorks.every(work => work.images?.length);
    const imageCount = matchingWorks.reduce((total, work) => total + (work.images || []).filter(image => safeUrl(image?.url)).length, 0);
    resultCount.textContent = allGalleries
      ? `${matchingWorks.length} 组作品 · ${imageCount} 张图`
      : `${matchingWorks.length} 件作品`;
    grid.hidden = matchingWorks.length === 0;
    emptyState.hidden = matchingWorks.length > 0;
    document.getElementById("empty-title").textContent = works.length
      ? "没有找到相关作品" : "作品整理中";
    document.getElementById("empty-description").textContent = works.length
      ? "试试其他关键词或分类。" : "后续作品将在这里陆续展示。";
    showNextPage();
    syncTrackMotion();
  }

  const categories = [...new Set(works.map(work => work.category || "未分类"))];
  for (const name of categories) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    category.append(option);
  }
  document.getElementById("toolbar").hidden = works.length < 6;
  category.closest("label").hidden = categories.length < 2;
  search.addEventListener("input", updateResults);
  category.addEventListener("change", updateResults);
  moreButton.addEventListener("click", () => {
    const firstNewIndex = visibleCount;
    showNextPage();
    const firstNewCard = grid.children[firstNewIndex];
    firstNewCard?.querySelector("a, h3").focus();
  });
  updateResults();

  for (const simulation of window.PORTFOLIO_SIMULATIONS || []) {
    if (simulation.images?.length) {
      simulationGrid.append(createCard({ ...simulation, category: "仿真作品" }));
      continue;
    }

    const placeholder = document.createElement("article");
    placeholder.className = "project simulation-placeholder";
    placeholder.append(createCardBody({ title: simulation.title, category: "结果待更新" }));
    simulationGrid.append(placeholder);
  }

  const backToTop = document.getElementById("back-to-top");
  backToTop.addEventListener("click", event => {
    if (event.detail === 0) document.querySelector(".brand").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "instant" : "smooth" });
  });
  new IntersectionObserver(([hero]) => {
    backToTop.hidden = hero.isIntersecting || hero.boundingClientRect.top >= 0;
  }).observe(document.querySelector(".hero"));

  function canAnimateTracks() {
    return pageActive && !document.hidden && !reduceMotion.matches && !viewerOpen;
  }

  function stopTrackMotion() {
    cancelAnimationFrame(trackFrame);
    clearTimeout(wakeTimer);
    trackFrame = 0;
    wakeTimer = 0;
    previousFrame = 0;
  }

  function syncTrackMotion() {
    clearTimeout(wakeTimer);
    wakeTimer = 0;
    if (!canAnimateTracks()) {
      stopTrackMotion();
      return;
    }
    const now = performance.now();
    let ready = false;
    let nextWake = Infinity;
    for (const element of visibleTracks) {
      const track = scrollTrack.get(element);
      if (!element.isConnected || !track) {
        visibleTracks.delete(element);
        continue;
      }
      const when = track.readyAt();
      if (when <= now) ready = true;
      else nextWake = Math.min(nextWake, when);
    }
    if (ready) {
      if (!trackFrame) trackFrame = requestAnimationFrame(animateTracks);
    } else {
      stopTrackMotion();
      if (Number.isFinite(nextWake)) {
        wakeTimer = setTimeout(syncTrackMotion, Math.max(1, nextWake - now));
      }
    }
  }

  function animateTracks(now) {
    trackFrame = 0;
    if (!canAnimateTracks()) {
      stopTrackMotion();
      return;
    }
    const elapsed = Math.min(now - (previousFrame || now), 50);
    previousFrame = now;
    for (const element of visibleTracks) {
      const track = scrollTrack.get(element);
      if (element.isConnected && track && track.readyAt() <= now) track.advance(elapsed);
    }
    syncTrackMotion();
  }

  function resetTrackInput() {
    for (const element of allTracks) scrollTrack.get(element)?.resetInput();
  }
  function observeViewer() {
    const viewer = document.querySelector(".image-viewer");
    if (!viewer) return;
    const syncViewer = () => {
      viewerOpen = viewer.open;
      syncTrackMotion();
    };
    new MutationObserver(syncViewer).observe(viewer, { attributes: true, attributeFilter: ["open"] });
    syncViewer();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeViewer, { once: true });
  } else {
    observeViewer();
  }
  reduceMotion.addEventListener("change", syncTrackMotion);
  document.addEventListener("visibilitychange", () => {
    resetTrackInput();
    syncTrackMotion();
  });
  window.addEventListener("blur", () => { resetTrackInput(); syncTrackMotion(); });
  window.addEventListener("focus", () => { resetTrackInput(); syncTrackMotion(); });
  window.addEventListener("pagehide", () => {
    pageActive = false;
    resetTrackInput();
    stopTrackMotion();
  });
  window.addEventListener("pageshow", () => { pageActive = true; syncTrackMotion(); });
})();

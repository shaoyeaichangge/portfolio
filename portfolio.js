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
  const visibleTracks = new Set();
  const trackObserver = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && target.isConnected) visibleTracks.add(target);
      else visibleTracks.delete(target);
    }
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
    const delayAutoScroll = () => { manualUntil = performance.now() + 1200; };
    thumbnails.addEventListener("pointerenter", event => { hovered = event.pointerType === "mouse"; });
    thumbnails.addEventListener("pointerleave", () => { hovered = false; });
    thumbnails.addEventListener("wheel", delayAutoScroll, { passive: true });
    thumbnails.addEventListener("touchend", delayAutoScroll, { passive: true });
    thumbnails.addEventListener("touchmove", delayAutoScroll, { passive: true });
    scrollTrack.set(thumbnails, (elapsed, now) => {
      const position = thumbnails.scrollLeft;
      if (position !== lastPosition) offset = position;
      lastPosition = position;
      if (hovered || now < manualUntil || thumbnails.matches(":has(:focus-visible), :focus-visible")) return;
      const loopWidth = copies[0].offsetLeft - links[0].offsetLeft;
      if (!loopWidth) return;
      offset = (offset + elapsed * 52 / 1000) % loopWidth;
      thumbnails.scrollLeft = offset;
      lastPosition = thumbnails.scrollLeft;
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
    }
    grid.replaceChildren();
    visibleCount = 0;
    resultCount.textContent = matchingWorks.length === works.length
      ? works.length + " 件作品"
      : matchingWorks.length + " / " + works.length + " 件作品";
    grid.hidden = matchingWorks.length === 0;
    emptyState.hidden = matchingWorks.length > 0;
    document.getElementById("empty-title").textContent = works.length
      ? "没有找到相关作品" : "作品整理中";
    document.getElementById("empty-description").textContent = works.length
      ? "试试其他关键词或分类。" : "后续作品将在这里陆续展示。";
    showNextPage();
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
  new IntersectionObserver(([hero]) => {
    backToTop.hidden = hero.isIntersecting || hero.boundingClientRect.top >= 0;
  }).observe(document.querySelector(".hero"));

  let previousFrame = 0;
  function animateTracks(now) {
    const elapsed = Math.min(now - (previousFrame || now), 50);
    previousFrame = now;
    if (!reduceMotion.matches && visibleTracks.size && !document.hidden && !document.querySelector(".image-viewer[open]")) {
      for (const track of visibleTracks) scrollTrack.get(track)(elapsed, now);
    }
    window.requestAnimationFrame(animateTracks);
  }
  window.requestAnimationFrame(animateTracks);
})();

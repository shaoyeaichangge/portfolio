(() => {
  const clock = document.querySelector(".site-clock");
  if (!clock) return;
  const time = clock.querySelector("time");
  const main = clock.querySelector(".clock-main");
  const seconds = clock.querySelector(".clock-seconds");
  const date = clock.querySelector(".clock-date");
  const slot = clock.closest(".clock-slot");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const timeFormat = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  let timer;
  let floating = false;
  let pinned = false;
  let hovered = false;
  let dockingAnimation;
  let scrollFrame = 0;
  const digitAnimations = new WeakMap();

  function animateDigits(element) {
    if (reduceMotion.matches || !element.animate) return;
    digitAnimations.get(element)?.cancel();
    digitAnimations.set(element, element.animate([{ opacity: .35, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }));
  }
  function updateLabel() {
    if (!floating) {
      clock.setAttribute("aria-label", "设备本地时间");
      return;
    }
    const expanded = clock.classList.contains("is-expanded");
    const value = main.textContent + (expanded ? "，" + date.textContent : "");
    clock.setAttribute("aria-label", "本地时间 " + value + (expanded ? "，点按收起" : "，点按展开日期和秒数"));
  }
  function updateExpansion() {
    if (dockingAnimation) return;
    const expanded = floating && (pinned || hovered);
    clock.classList.toggle("is-expanded", expanded);
    if (floating) clock.setAttribute("aria-expanded", String(expanded));
    else clock.removeAttribute("aria-expanded");
    date.setAttribute("aria-hidden", String(floating && !expanded));
    seconds.setAttribute("aria-hidden", String(floating && !expanded));
    updateLabel();
  }
  function stopDocking() {
    dockingAnimation?.cancel();
    dockingAnimation = null;
    clock.classList.remove("is-docking");
    updateExpansion();
  }
  function setFloating(next) {
    if (!slot || next === floating) return;
    const before = clock.getBoundingClientRect();
    const radius = getComputedStyle(clock).borderRadius;
    stopDocking();
    clock.classList.add("is-docking");
    floating = next;
    pinned = hovered = false;
    clock.classList.toggle("is-floating", floating);
    clock.setAttribute("role", floating ? "button" : "timer");
    if (floating) clock.tabIndex = 0;
    else clock.removeAttribute("tabindex");
    // Header backdrop-filter establishes a fixed-position containing block.
    // Reparent this single clock; the slot keeps the header's layout stable.
    (floating ? document.body : slot).append(clock);
    updateExpansion();
    const after = clock.getBoundingClientRect();
    if (!reduceMotion.matches && clock.animate) {
      const animation = clock.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)`, width: before.width + "px", height: before.height + "px", borderRadius: radius },
        { transform: "translate(0,0)", width: after.width + "px", height: after.height + "px", borderRadius: getComputedStyle(clock).borderRadius }
      ], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
      dockingAnimation = animation;
      animation.addEventListener("finish", () => {
        if (dockingAnimation !== animation) return;
        dockingAnimation = null;
        clock.classList.remove("is-docking");
        updateExpansion();
      }, { once: true });
    } else clock.classList.remove("is-docking");
  }
  function syncPosition() {
    scrollFrame = 0;
    // Separate thresholds prevent oscillation around the docking boundary.
    if (!floating && scrollY > 24) setFloating(true);
    else if (floating && scrollY <= 8) setFloating(false);
  }
  function schedulePosition() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(syncPosition);
  }

  function update() {
    clearTimeout(timer);
    if (document.hidden) return;
    const now = new Date();
    const parts = Object.fromEntries(timeFormat.formatToParts(now).map(part => [part.type, part.value]));
    const mainText = `${parts.hour}:${parts.minute}`;
    const dateText = dateFormat.format(now);
    const minuteChanged = main.textContent !== "--:--" && main.textContent !== mainText;
    const secondChanged = seconds.textContent !== "--" && seconds.textContent !== parts.second;
    if (main.textContent !== mainText) main.textContent = mainText;
    if (date.textContent !== dateText) date.textContent = dateText;
    seconds.textContent = parts.second;
    time.dateTime = now.toISOString();
    clock.hidden = false;
    if (slot) slot.hidden = false;
    if (minuteChanged) animateDigits(main);
    if (secondChanged && (!floating || clock.classList.contains("is-expanded"))) animateDigits(seconds);
    updateLabel();
    timer = setTimeout(update, 1000 - Date.now() % 1000 + 10);
  }
  document.addEventListener("visibilitychange", update);
  addEventListener("pageshow", () => { update(); schedulePosition(); });
  reduceMotion.addEventListener("change", () => {
    if (!reduceMotion.matches) return;
    stopDocking();
    [main, seconds].forEach(element => element.getAnimations().forEach(animation => animation.cancel()));
  });
  clock.addEventListener("pointerenter", event => {
    if (!floating || event.pointerType !== "mouse") return;
    hovered = true;
    updateExpansion();
  });
  clock.addEventListener("pointerleave", () => { hovered = false; updateExpansion(); });
  clock.addEventListener("click", () => {
    if (!floating) return;
    pinned = !pinned;
    if (!pinned) hovered = false;
    updateExpansion();
  });
  clock.addEventListener("keydown", event => {
    if (!floating || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) clock.click();
  });
  function collapse() { pinned = hovered = false; updateExpansion(); }
  clock.addEventListener("blur", collapse);
  document.addEventListener("pointerdown", event => { if (!clock.contains(event.target)) collapse(); }, { passive: true });
  document.addEventListener("keydown", event => { if (event.key === "Escape") collapse(); });
  addEventListener("scroll", schedulePosition, { passive: true });
  addEventListener("resize", () => { stopDocking(); schedulePosition(); });
  update();
  syncPosition();
})();

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
  const digitAnimations = new Map();
  const secondDigits = Array.from({ length: 2 }, () => {
    const digit = document.createElement("span");
    digit.className = "clock-digit";
    const current = document.createElement("span");
    current.className = "clock-digit-current";
    current.textContent = "-";
    digit.append(current);
    return { digit, current };
  });
  seconds.replaceChildren(...secondDigits.map(({ digit }) => digit));

  function stopDigitMotion(digit) {
    const motion = digitAnimations.get(digit);
    if (!motion) return;
    motion.incoming.cancel();
    motion.outgoing.cancel();
    motion.previous.remove();
    digitAnimations.delete(digit);
  }
  function updateSeconds(value) {
    seconds.dataset.value = value;
    secondDigits.forEach(({ digit, current }, index) => {
      const next = value[index];
      const old = current.textContent;
      if (next === old) return;
      stopDigitMotion(digit);
      current.textContent = next;
      if (old === "-" || reduceMotion.matches || !current.animate) return;
      // Only changed digits roll. Outgoing copies are visual, never read aloud.
      const previous = document.createElement("span");
      previous.className = "clock-digit-previous";
      previous.textContent = old;
      previous.setAttribute("aria-hidden", "true");
      digit.append(previous);
      const options = { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" };
      const incoming = current.animate([{ transform: "translateY(100%)", opacity: .3 }, { transform: "translateY(0)", opacity: 1 }], options);
      const outgoing = previous.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-100%)", opacity: 0 }], options);
      const motion = { incoming, outgoing, previous };
      digitAnimations.set(digit, motion);
      incoming.addEventListener("finish", () => {
        if (digitAnimations.get(digit) === motion) stopDigitMotion(digit);
      }, { once: true });
    });
  }
  function updateLabel() {
    if (!floating) {
      clock.setAttribute("aria-label", "设备本地时间");
      return;
    }
    const expanded = clock.classList.contains("is-expanded");
    const value = main.textContent + (expanded ? "，" + date.textContent : "");
    clock.setAttribute("aria-label", "本地时间 " + value + (expanded ? "，点按收起日期" : "，点按展开日期"));
  }
  function updateExpansion() {
    if (dockingAnimation) return;
    const expanded = floating && (pinned || hovered);
    clock.classList.toggle("is-expanded", expanded);
    if (floating) clock.setAttribute("aria-expanded", String(expanded));
    else clock.removeAttribute("aria-expanded");
    date.setAttribute("aria-hidden", String(floating && !expanded));
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
    if (document.hidden) {
      secondDigits.forEach(({ digit }) => stopDigitMotion(digit));
      return;
    }
    const now = new Date();
    const parts = Object.fromEntries(timeFormat.formatToParts(now).map(part => [part.type, part.value]));
    const mainText = `${parts.hour}:${parts.minute}`;
    const dateText = dateFormat.format(now);
    if (main.textContent !== mainText) main.textContent = mainText;
    if (date.textContent !== dateText) date.textContent = dateText;
    updateSeconds(parts.second);
    time.dateTime = now.toISOString();
    clock.hidden = false;
    if (slot) slot.hidden = false;
    updateLabel();
    timer = setTimeout(update, 1000 - Date.now() % 1000 + 10);
  }
  document.addEventListener("visibilitychange", update);
  addEventListener("pageshow", () => { update(); schedulePosition(); });
  reduceMotion.addEventListener("change", () => {
    if (!reduceMotion.matches) return;
    stopDocking();
    secondDigits.forEach(({ digit }) => stopDigitMotion(digit));
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

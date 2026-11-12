(() => {
  const clock = document.querySelector(".site-clock");
  if (!clock) return;
  const time = clock.querySelector("time");
  const main = clock.querySelector(".clock-main");
  const seconds = clock.querySelector(".clock-seconds");
  const date = clock.querySelector(".clock-date");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const timeFormat = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  let timer;

  function update() {
    clearTimeout(timer);
    if (document.hidden) return;
    const now = new Date();
    const parts = Object.fromEntries(timeFormat.formatToParts(now).map(part => [part.type, part.value]));
    const mainText = `${parts.hour}:${parts.minute}`;
    const dateText = dateFormat.format(now);
    const animate = seconds.textContent !== "--" && seconds.textContent !== parts.second && !reduceMotion.matches;
    if (main.textContent !== mainText) main.textContent = mainText;
    if (date.textContent !== dateText) date.textContent = dateText;
    seconds.textContent = parts.second;
    time.dateTime = now.toISOString();
    clock.hidden = false;
    if (animate && seconds.animate) {
      seconds.getAnimations().forEach(animation => animation.cancel());
      seconds.animate([{ opacity: .35, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    timer = setTimeout(update, 1000 - Date.now() % 1000 + 10);
  }
  document.addEventListener("visibilitychange", update);
  addEventListener("pageshow", update);
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) seconds.getAnimations().forEach(animation => animation.cancel());
  });
  update();
})();

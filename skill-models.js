(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const models = {
    analysis: '<span class="model-platform"></span><span class="model-scene model-cube"><span class="model-face model-front"></span><span class="model-face model-right"></span><span class="model-face model-top"></span><span class="model-flow-plane"><svg viewBox="0 0 64 40"><path d="M1 9c17 0 16-8 31-8s17 8 31 8M1 20c18 0 16-7 31-7s16 7 31 7M1 31c18 0 17-5 31-5s16 5 31 5"/></svg></span></span>',
    visualization: '<span class="model-platform"></span><span class="model-scene model-sheets"><span class="model-sheet sheet-bottom"></span><span class="model-sheet sheet-middle"></span><span class="model-sheet sheet-top"><svg viewBox="0 0 48 36"><rect x="5" y="5" width="13" height="8" rx="1"/><rect x="29" y="22" width="13" height="8" rx="1"/><path d="M18 9h17v13M11 13v13h18M8 18h12"/></svg></span></span>',
    support: '<span class="model-platform"></span><span class="model-scene model-computer"><span class="model-monitor"><span class="model-screen"><svg viewBox="0 0 36 24"><path d="M3 16h5l4-8 5 11 4-7h12"/><path class="model-grid" d="M1 6h34M1 12h34M1 18h34M9 1v22M18 1v22M27 1v22"/></svg></span></span><span class="model-stand"></span><span class="model-foot"></span><span class="model-chip"><span></span></span></span>'
  };
  const timers = new Map();
  for (const [id, markup] of Object.entries(models)) {
    const row = document.getElementById(id);
    const icon = row?.querySelector(".skill-icon");
    if (!icon) continue;
    icon.classList.add("skill-model");
    icon.innerHTML = markup;
    let start;
    row.addEventListener("pointerdown", event => {
      start = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
    }, { passive: true });
    row.addEventListener("pointerup", event => {
      const tap = start;
      start = null;
      if (!tap || tap.id !== event.pointerId || reduced.matches || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10) return;
      clearTimeout(timers.get(row));
      row.dataset.modelActive = "";
      timers.set(row, setTimeout(() => { delete row.dataset.modelActive; timers.delete(row); }, 1500));
    });
    row.addEventListener("pointercancel", () => { start = null; });
  }
  function reset() {
    for (const [row, timer] of timers) { clearTimeout(timer); delete row.dataset.modelActive; }
    timers.clear();
  }
  reduced.addEventListener("change", () => { if (reduced.matches) reset(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });
})();

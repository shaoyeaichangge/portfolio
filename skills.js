(() => {
  const sheet = document.querySelector(".skill-sheet");
  if (!sheet) return;
  const rows = [...sheet.querySelectorAll(".skill-row")];
  let active = rows[0];
  let pending = 0;
  function measure() {
    pending = 0;
    if (!active) return;
    sheet.style.setProperty("--skill-y", `${active.offsetTop}px`);
    sheet.style.setProperty("--skill-height", `${active.offsetHeight}px`);
  }
  function schedule() { if (!pending) pending = requestAnimationFrame(measure); }
  function select(row) { if (row && active !== row) { active = row; schedule(); } }
  for (const row of rows) {
    row.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") select(row); }, { passive: true });
    row.addEventListener("pointerdown", event => { if (event.pointerType === "touch") select(row); }, { passive: true });
    row.addEventListener("focusin", () => select(row));
  }
  const observer = new ResizeObserver(schedule);
  observer.observe(sheet);
  rows.forEach(row => observer.observe(row));
  document.fonts?.ready.then(schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("pagehide", () => { cancelAnimationFrame(pending); pending = 0; });
  measure();
})();

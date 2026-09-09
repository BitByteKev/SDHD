/* Bounded, event-driven depth for the homepage fleet photograph. */
(() => {
  const scene = document.querySelector('.hero-visual');
  if (!scene) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
  let frame = 0;
  let x = 0;
  let y = 0;
  const enabled = () => !reduced.matches && desktop.matches;
  function render() {
    frame = 0;
    if (!enabled()) {
      scene.removeAttribute('style');
      return;
    }
    const scroll = Math.min(28, Math.max(0, window.scrollY * .055));
    scene.style.setProperty('--depth-x', `${-y * 4}deg`);
    scene.style.setProperty('--depth-y', `${x * 5}deg`);
    scene.style.setProperty('--depth-scroll', `${scroll}px`);
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  scene.parentElement.addEventListener('pointermove', event => {
    if (!enabled()) return;
    const bounds = scene.parentElement.getBoundingClientRect();
    x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    schedule();
  });
  scene.parentElement.addEventListener('pointerleave', () => { x = y = 0; schedule(); });
  window.addEventListener('scroll', () => {
    if (enabled() && window.scrollY < scene.closest('.hero').offsetHeight + 100) schedule();
  }, { passive: true });
  [reduced, desktop].forEach(query => query.addEventListener('change', () => { x = y = 0; schedule(); }));
  schedule();
})();

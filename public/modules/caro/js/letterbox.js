window.Caro = window.Caro || {};

Caro.createLetterbox = function createLetterbox(app, stageRoot, baseW, baseH) {
  let raf = 0;
  let last = { vw: 0, vh: 0 };
  let destroyed = false;

  function apply() {
    if (destroyed) return;
    const vw = Math.max(1, window.innerWidth || baseW);
    const vh = Math.max(1, window.innerHeight || baseH);
    if (vw === last.vw && vh === last.vh) return;
    last = { vw, vh };
    app.renderer.resize(vw, vh);
    const scale = Math.min(vw / baseW, vh / baseH);
    stageRoot.scale.set(scale);
    stageRoot.x = (vw - baseW * scale) / 2;
    stageRoot.y = (vh - baseH * scale) / 2;
  }

  function onResize() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      apply();
    });
  }

  window.addEventListener('resize', onResize);
  apply();

  return {
    apply,
    destroy() {
      destroyed = true;
      window.removeEventListener('resize', onResize);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
  };
};

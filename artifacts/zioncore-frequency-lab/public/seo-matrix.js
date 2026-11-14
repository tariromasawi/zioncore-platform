(() => {
  const canvas = document.querySelector('.seo-matrix');
  const context = canvas && canvas.getContext('2d');
  if (!canvas || !context) return;

  const glyphs = '0123456789∿∴⌁∆·';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let streams = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let lastFrame = 0;
  let visible = document.visibilityState !== 'hidden';
  let ratio = 1;

  function createStream(x, initial = false) {
    const length = 3 + Math.floor(Math.random() * 6);
    return {
      x,
      y: initial ? Math.random() * height : -Math.random() * height,
      speed: 0.38 + Math.random() * 0.28,
      glyphs: Array.from({ length }, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
    };
  }

  function drawGlyph(glyph, x, y, alpha, accent) {
    context.fillStyle = accent
      ? `rgba(166, 127, 65, ${alpha})`
      : `rgba(35, 77, 77, ${alpha})`;
    context.fillText(glyph, x, y);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width || window.innerWidth);
    height = Math.max(1, bounds.height || window.innerHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gap = width < 600 ? 42 : 48;
    streams = Array.from({ length: Math.ceil(width / gap) }, (_, index) =>
      createStream(index * gap + gap / 2, true),
    );
    drawStill();
  }

  function drawStill() {
    context.clearRect(0, 0, width, height);
    context.font = '11px "DM Mono", ui-monospace, monospace';
    context.textAlign = 'center';
    streams.forEach((stream, index) => {
      drawGlyph(stream.glyphs[0], stream.x, (index * 71 + 43) % Math.max(height, 1), 0.12, index % 7 === 0);
    });
  }

  function render(timestamp) {
    if (!visible || reducedMotion.matches) return;
    frame = window.requestAnimationFrame(render);
    if (timestamp - lastFrame < 1000 / 24) return;
    lastFrame = timestamp;
    context.clearRect(0, 0, width, height);
    context.font = '11px "DM Mono", ui-monospace, monospace';
    context.textAlign = 'center';

    streams.forEach((stream, index) => {
      stream.y += stream.speed;
      if (stream.y - stream.glyphs.length * 19 > height) {
        Object.assign(stream, createStream(stream.x));
        return;
      }
      stream.glyphs.forEach((glyph, glyphIndex) => {
        const y = stream.y - glyphIndex * 19;
        if (y < -18 || y > height + 18) return;
        if (Math.random() < 0.018) {
          stream.glyphs[glyphIndex] = glyphs[Math.floor(Math.random() * glyphs.length)];
        }
        const fade = 1 - glyphIndex / stream.glyphs.length;
        drawGlyph(stream.glyphs[glyphIndex], stream.x, y, 0.07 + fade * 0.17, index % 7 === 0 && glyphIndex === 0);
      });
    });
  }

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function syncMotion() {
    stop();
    if (reducedMotion.matches) drawStill();
    else if (visible) frame = window.requestAnimationFrame(render);
  }

  function syncVisibility() {
    visible = document.visibilityState !== 'hidden';
    stop();
    if (visible && !reducedMotion.matches) frame = window.requestAnimationFrame(render);
  }

  resize();
  if (visible && !reducedMotion.matches) frame = window.requestAnimationFrame(render);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', syncVisibility);
  reducedMotion.addEventListener('change', syncMotion);

  window.addEventListener('pagehide', () => {
    stop();
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', syncVisibility);
    reducedMotion.removeEventListener('change', syncMotion);
  }, { once: true });
})();

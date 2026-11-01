// Scrolling with some give: past an end, the wheel or a finger pulls the list a little further (less the
// further it goes) and it springs back when let go; a fling that runs into an end bounces off it. And a
// slim scrollbar drawn over the list in place of the browser's: it shows while the pointer is over the
// list or it scrolls, and under the pointer (or held) it widens and takes the accent colour; past an end
// it shrinks against that end. (Chromium bounces only on macOS, and its scrollbars can't animate.)
// The same file is in the extension (lib/) for the toolbar popup.
//
// scrollFeel(el, { inner, bar }):
//   inner: the list's own box stays put and what's in it moves (for a box with a border or a background
//          of its own, e.g. a dialog); otherwise the box moves and is clipped to where it was
//   bar:   draw the scrollbar (it goes in el's parent, which it positions if need be; for the page itself
//          (document.documentElement) or a fixed overlay, fixed on the page above everything)

const MAX = 80;           // a pull never goes further than this (px)
const K = 230, C = 17;    // the spring back: stiffness and damping (a little overshoot)

const CSS = `
.sf-nobar { scrollbar-width: none; }
.sf-nobar::-webkit-scrollbar { display: none; }
.sf-pulling > * { translate: 0 var(--sf-pull); }
.sf-thumb { position: absolute; z-index: 6; display: flex; box-sizing: border-box; opacity: 0; pointer-events: none; touch-action: none; transition: opacity .3s ease; }
.sf-thumb[hidden] { display: none; }
.sf-thumb.fixed { position: fixed; z-index: 2147483000; }
.sf-thumb.y { width: 12px; padding: 0 3px; justify-content: flex-end; }
.sf-thumb.x { height: 12px; padding: 3px 0; align-items: flex-end; }
.sf-thumb::before {
  content: ''; flex: none; border-radius: 99px; background: color-mix(in srgb, var(--muted) 40%, transparent);
  transition: width .22s cubic-bezier(.22, 1, .36, 1), height .22s cubic-bezier(.22, 1, .36, 1), background-color .22s ease;
}
.sf-thumb.y::before { width: 4px; height: 100%; }
.sf-thumb.x::before { height: 4px; width: 100%; }
.sf-thumb.show { opacity: 1; pointer-events: auto; transition-duration: .15s; }
.sf-thumb:hover::before, .sf-thumb.held::before { background: color-mix(in srgb, var(--accent) 50%, transparent); }
.sf-thumb.y:hover::before, .sf-thumb.y.held::before { width: 6px; }
.sf-thumb.x:hover::before, .sf-thumb.x.held::before { height: 6px; }
`;
let styled = false;

export function scrollFeel(el, { inner = false, bar = true } = {}) {
  if (!el || el.sfReady) return;
  el.sfReady = true;
  if (!styled) { styled = true; document.head.append(Object.assign(document.createElement('style'), { textContent: CSS })); }

  const root = el === document.documentElement;
  let pull = 0, vel = 0, raf = 0, releaseTimer = 0, touching = false, held = false, pad0 = null;
  const room = () => el.scrollHeight - el.clientHeight;
  const atTop = () => el.scrollTop <= 0;
  const atEnd = () => el.scrollTop >= room() - 1;
  // how far it has been pulled (raw) and how far that takes it: the further, the less it gives
  let raw = 0;
  const rub = (r) => Math.sign(r) * MAX * (1 - Math.exp(-Math.abs(r) * 0.42 / MAX));
  const unrub = (p) => Math.sign(p) * -Math.log(1 - Math.min(0.99, Math.abs(p) / MAX)) * MAX / 0.42;

  function show(p) {
    pull = p;
    const r = Math.round(p * 10) / 10;
    if (inner) {
      if (pad0 == null) pad0 = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      el.classList.toggle('sf-pulling', r !== 0);
      el.style.setProperty('--sf-pull', `${r}px`);
      // (pulled up at the end, room below so the browser doesn't take the scroll position back)
      el.style.paddingBottom = r < 0 ? `${pad0 - r}px` : '';
    } else {
      el.style.translate = r ? `0 ${r}px` : '';
      el.style.clipPath = r > 0 ? `inset(0 0 ${r}px 0)` : r < 0 ? `inset(${-r}px 0 0 0)` : '';
    }
    paint();
  }
  // the spring back to rest, from where it is at the speed it has
  function spring() {
    cancelAnimationFrame(raf);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      vel += (-K * pull - C * vel) * dt;
      const x = pull + vel * dt;
      if (Math.abs(x) < 0.3 && Math.abs(vel) < 10) { vel = 0; raf = 0; show(0); return; }
      show(x);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const stop = () => { cancelAnimationFrame(raf); raf = 0; vel = 0; };
  // a pull by d (content moving down when positive); toward rest it takes back the pull, and stops there
  function pullBy(d) {
    raw = unrub(pull);
    const r = raw + d;
    show(raw && Math.sign(r) !== Math.sign(raw) ? 0 : rub(r));
  }
  // a bounce off an end at speed v (px/s, positive: content moving down)
  // scroll to `end` at a steady speed, then bounce at speed v
  let aim = null, aimTimer = 0, gliding = 0, wheelAt = 0, wheelAd = 0, fade = 0, run_ = 0, wv = 0, after = null;
  function glide(end, v, ad) {
    cancelAnimationFrame(gliding);
    const from = el.scrollTop, dur = Math.max(70, Math.min(200, Math.abs(end - from) / 1.8)), t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      el.scrollTo({ top: from + (end - from) * (t * (1.6 - 0.6 * t)), behavior: 'instant' }); // (quick, still moving at the end)
      if (t < 1) gliding = requestAnimationFrame(step);
      else { gliding = 0; kick(v, ad); }
    };
    gliding = requestAnimationFrame(step);
  }
  // (ad: the size of the wheel event that made it, if one did; what follows it no stronger is let go by)
  const kick = (v, ad = null) => {
    if (pull || raf || touching || held) return;
    vel = Math.max(-1100, Math.min(1100, v));
    after = { sign: -Math.sign(v), ad: ad ?? Infinity };
    spring();
  };
  // something inside that still scrolls that way takes the scroll
  function innerScrolls(target, dy) {
    for (let n = target; n && n !== el && n instanceof Element; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(n).overflowY)) continue;
      if (dy < 0 ? n.scrollTop > 0 : n.scrollTop < n.scrollHeight - n.clientHeight - 1) return true;
    }
    return false;
  }

  el.addEventListener('wheel', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
    if (!dy || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (innerScrolls(e.target, dy)) return;
    const now = performance.now(), dt = now - wheelAt, ad = Math.abs(dy);
    fade = dt < 50 && ad <= wheelAd ? fade + 1 : 0; // (a trackpad's momentum: events ever weaker)
    wheelAt = now; wheelAd = ad;
    // a run of events close together is one gesture (a trackpad's swipe, and its momentum after it): its speed
    run_ = dt < 50 ? run_ + 1 : 0;
    wv = run_ ? wv * 0.5 + (dy / Math.max(dt, 4)) * 0.5 : 0;
    // after a bounce, the rest of the gesture that made it (the momentum keeps coming, fading) is let go by,
    // rather than pulling against the bounce; a new push (stronger, or after a pause) pulls again
    if (after) {
      if (dt < 140 && Math.sign(dy) === after.sign && ad <= after.ad * 1.25 + 2) { e.preventDefault(); after.ad = ad; return; }
      after = null;
    }
    // A trackpad swipe (or its momentum) that reaches the end at speed bounces off it at that speed
    const edge0 = (dy < 0 && atTop()) || (dy > 0 && atEnd());
    if (!pull && run_ >= 3 && Math.abs(wv) > 0.4 && room() > 1) {
      if (edge0 || (dy > 0 ? el.scrollTop + dy >= room() : el.scrollTop + dy <= 0)) {
        e.preventDefault();
        el.scrollTo({ top: dy > 0 ? room() : 0, behavior: 'instant' });
        kick(-Math.sign(dy) * Math.min(1100, 300 + Math.abs(wv) * 450), ad);
        return;
      }
    }
    // A turn of the wheel that runs past the end bounces off it as it gets there. The browser animates
    // each turn, so where the scrolling so far is headed (aim), not where it is now, tells whether this
    // one runs past: if so, this page glides to the end at speed and bounces at once (left to the browser,
    // it would ease to a stop at the end first and only the next turn would bounce).
    const edge = (dy < 0 && atTop()) || (dy > 0 && atEnd());
    if (!pull && !edge && room() > 1) {
      const to = (aim ?? el.scrollTop) + dy, over = dy > 0 ? to - room() : -to;
      if (over > 8) {
        e.preventDefault();
        aim = null;
        glide(dy > 0 ? room() : 0, -Math.sign(dy) * Math.min(1100, 320 + over * 4), ad);
        return;
      }
      if (!gliding) {
        aim = to;
        clearTimeout(aimTimer);
        aimTimer = setTimeout(() => { aim = null; }, 260);
        return;
      }
    }
    if (!pull && !((dy < 0 && atTop()) || (dy > 0 && atEnd()))) return;
    e.preventDefault();
    // momentum (no finger on the pad) pulling against the end: let it go and spring back now
    if (pull && fade >= 4 && Math.sign(-dy) === Math.sign(pull)) {
      clearTimeout(releaseTimer);
      after = { sign: Math.sign(dy), ad };
      if (!raf) spring();
      return;
    }
    stop();
    pullBy(-dy);
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(spring, 110);
  }, { passive: false });

  let ty = null;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    ty = e.touches[0].clientY;
    touching = true;
    if (raf) stop();
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (ty == null || e.touches.length !== 1) return;
    const y = e.touches[0].clientY, dy = y - ty;
    ty = y;
    if (!e.cancelable || document.body.classList.contains('selecting')) return;
    if (!pull && !((dy > 0 && atTop()) || (dy < 0 && atEnd()))) return;
    if (innerScrolls(e.target, -dy)) return;
    e.preventDefault();
    pullBy(dy);
  }, { passive: false });
  const lift = () => { ty = null; touching = false; if (pull) spring(); };
  el.addEventListener('touchend', lift);
  el.addEventListener('touchcancel', lift);

  // a fling (a run of scroll events close together) that reaches an end bounces off it
  let lastTop = el.scrollTop, lastAt = 0, run = 0, v = 0;
  (root ? window : el).addEventListener('scroll', () => {
    const now = performance.now(), top = el.scrollTop, dt = now - lastAt;
    if (dt > 60) { run = 0; v = 0; } else if (dt > 0) { run++; v = (top - lastTop) / dt; }
    lastTop = top; lastAt = now;
    if (!gliding && run >= 2 && Math.abs(v) > 0.5 && ((v < 0 && top <= 0) || (v > 0 && top >= room() - 1))) kick(-v * 380, now - wheelAt < 100 ? wheelAd : null);
    wake();
    paint();
  }, { passive: true });

  // the scrollbar
  let ty_ = null, tx_ = null, hover = false, awake = false, sleepTimer = 0;
  const fixed = root || getComputedStyle(el).position === 'fixed';
  function paint() {
    if (!ty_) return;
    const ch = el.clientHeight, sh = el.scrollHeight, cw = el.clientWidth, sw = el.scrollWidth;
    const box = fixed ? (root ? { left: 0, top: 0 } : el.getBoundingClientRect()) : { left: el.offsetLeft, top: el.offsetTop };
    const left = box.left + el.clientLeft, top = box.top + el.clientTop, gap = 2;
    const range = sh - ch - (inner && pull < 0 ? -pull : 0);
    ty_.hidden = range <= 1;
    if (!ty_.hidden) {
      let th = Math.max(32, ch * ch / (range + ch)), y = Math.min(1, el.scrollTop / range) * (ch - th);
      if (pull > 0) { th = Math.max(14, th - pull); y = 0; } else if (pull < 0) { th = Math.max(14, th + pull); y = ch - th; }
      Object.assign(ty_.style, { left: `${left + cw - 12}px`, top: `${top + y + gap}px`, height: `${th - 2 * gap}px` });
    }
    tx_.hidden = sw - cw <= 1;
    if (!tx_.hidden) {
      const tw = Math.max(32, cw * cw / sw), x = el.scrollLeft / (sw - cw) * (cw - tw);
      Object.assign(tx_.style, { left: `${left + x + gap}px`, top: `${top + ch - 12}px`, width: `${tw - 2 * gap - (ty_.hidden ? 0 : 10)}px` });
    }
  }
  const showBar = () => { const on = hover || awake || held; ty_.classList.toggle('show', on); tx_.classList.toggle('show', on); };
  function wake() {
    if (!ty_) return;
    awake = true; showBar();
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => { awake = false; showBar(); }, 900);
  }
  function grab(thumb, vertical) {
    thumb.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      held = true; thumb.classList.add('held'); showBar();
      const p0 = vertical ? e.clientY : e.clientX, s0 = vertical ? el.scrollTop : el.scrollLeft;
      const per = vertical ? (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - thumb.offsetHeight)
        : (el.scrollWidth - el.clientWidth) / Math.max(1, el.clientWidth - thumb.offsetWidth);
      const move = (ev) => {
        const to = s0 + ((vertical ? ev.clientY : ev.clientX) - p0) * per;
        el.scrollTo(vertical ? { top: to, behavior: 'instant' } : { left: to, behavior: 'instant' });
      };
      const up = () => {
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', up);
        thumb.removeEventListener('pointercancel', up);
        held = false; thumb.classList.remove('held'); wake();
      };
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', up);
      thumb.addEventListener('pointercancel', up);
    });
  }
  if (bar) {
    el.classList.add('sf-nobar');
    const host = fixed ? document.body : el.parentElement;
    if (!fixed && getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const kind = fixed ? ' fixed' : '';
    ty_ = Object.assign(document.createElement('div'), { className: 'sf-thumb y' + kind, hidden: true });
    tx_ = Object.assign(document.createElement('div'), { className: 'sf-thumb x' + kind, hidden: true });
    host.append(ty_, tx_);
    grab(ty_, true);
    grab(tx_, false);
    for (const n of [el, ty_, tx_]) {
      n.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { hover = true; paint(); showBar(); } });
      n.addEventListener('pointerleave', () => { hover = false; showBar(); });
    }
    let queued = false;
    const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; paint(); }); } };
    new ResizeObserver(later).observe(el);
    new MutationObserver(later).observe(el, { childList: true, subtree: true, characterData: true });
    paint();
  }
  return { paint };
}

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
//   x:     the same give at the left and right ends too (a wheel turned sideways, or with Shift; a finger),
//          and no sideways scrollbar drawn
//   pan:   a finger moves it any way at all, diagonally too (not held to one direction at a time, as the
//          browser does), and flung, it glides on and bounces off the ends

const MAX = 110;          // a pull never goes further than this (px)
const GIVE = 0.55;        // how readily it gives when pulled (of each px pulled, at first)
const K = 160, C = 14;    // the spring back: stiffness and damping (soft, a little overshoot)
const SOFT = 1.35;        // how hard a scroll that runs into an end throws it past (x its speed's share)
const VMAX = 1500;        // ...at most (px/s)

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

export function scrollFeel(el, { inner = false, bar = true, x: sideways = false, pan = false } = {}) {
  if (!el || el.sfReady) return;
  el.sfReady = true;
  if (!styled) { styled = true; document.head.append(Object.assign(document.createElement('style'), { textContent: CSS })); }

  const root = el === document.documentElement;
  let pull = 0, vel = 0, raf = 0, releaseTimer = 0, touching = false, held = false, pad0 = null;
  let pullX = 0, velX = 0, rafX = 0, releaseX = 0, afterX = null;
  const room = () => el.scrollHeight - el.clientHeight;
  const atTop = () => el.scrollTop <= 0;
  const atEnd = () => el.scrollTop >= room() - 1;
  // how far it has been pulled (raw) and how far that takes it: the further, the less it gives
  let raw = 0;
  const rub = (r) => Math.sign(r) * MAX * (1 - Math.exp(-Math.abs(r) * GIVE / MAX));
  const unrub = (p) => Math.sign(p) * -Math.log(1 - Math.min(0.99, Math.abs(p) / MAX)) * MAX / GIVE;

  function show(p) {
    pull = p;
    const r = Math.round(p * 10) / 10;
    if (inner) {
      if (pad0 == null) pad0 = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      el.classList.toggle('sf-pulling', r !== 0);
      el.style.setProperty('--sf-pull', `${r}px`);
      // (pulled up at the end, room below so the browser doesn't take the scroll position back: only when it
      // scrolls, its box held at its size by then; one whose content fits would grow by it instead)
      const scrolls = el.style.paddingBottom !== '' || room() > 1;
      el.style.paddingBottom = r < 0 && scrolls ? `${pad0 - r}px` : '';
    } else place();
    paint();
  }
  // the box moved by both pulls, and clipped to where it was
  function place() {
    const y = Math.round(pull * 10) / 10, x = Math.round(pullX * 10) / 10;
    el.style.translate = x || y ? `${x}px ${y}px` : '';
    el.style.clipPath = x || y ? `inset(${Math.max(0, -y)}px ${Math.max(0, x)}px ${Math.max(0, y)}px ${Math.max(0, -x)}px)` : '';
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
  let glideSign = 0;
  function glide(end, v) {
    cancelAnimationFrame(gliding);
    glideSign = -Math.sign(v);
    const from = el.scrollTop, dur = Math.max(40, Math.min(120, Math.abs(end - from) / 3)), t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      el.scrollTo({ top: from + (end - from) * (t * (1.6 - 0.6 * t)), behavior: 'instant' }); // (quick, still moving at the end)
      if (t < 1) gliding = requestAnimationFrame(step);
      else { gliding = 0; kick(v); }
    };
    gliding = requestAnimationFrame(step);
  }
  const kick = (v) => {
    if (pull || raf || touching || held) return;
    vel = Math.max(-VMAX, Math.min(VMAX, v * SOFT));
    after = { sign: -Math.sign(v) };
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

  // Sideways (x): the same give at the left and right ends, simpler: pulled while pushed past an end, springing
  // back when let go; a fling or a wheel's turn into an end bounces off it.
  const roomX = () => el.scrollWidth - el.clientWidth;
  const atLeft = () => el.scrollLeft <= 0, atRight = () => el.scrollLeft >= roomX() - 1;
  const showX = (p) => { pullX = p; place(); };
  function springX() {
    cancelAnimationFrame(rafX);
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      velX += (-K * pullX - C * velX) * dt;
      const nx = pullX + velX * dt;
      if (Math.abs(nx) < 0.3 && Math.abs(velX) < 10) { velX = 0; rafX = 0; showX(0); return; }
      showX(nx);
      rafX = requestAnimationFrame(step);
    };
    rafX = requestAnimationFrame(step);
  }
  const stopX = () => { cancelAnimationFrame(rafX); rafX = 0; velX = 0; };
  function pullByX(d) {
    const r0 = unrub(pullX), r = r0 + d;
    showX(r0 && Math.sign(r) !== Math.sign(r0) ? 0 : rub(r));
  }
  const kickX = (v) => {
    if (pullX || rafX || touching) return;
    velX = Math.max(-VMAX, Math.min(VMAX, v * SOFT));
    afterX = { sign: -Math.sign(v), at: performance.now() };
    springX();
  };
  if (sideways) el.addEventListener('wheel', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
    const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
    if (!dx || (!e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) || roomX() <= 1) return;
    const now = performance.now();
    // (the rest of a gesture that bounced: let go by, as up and down)
    if (afterX && now - afterX.at < 300 && Math.sign(dx) === afterX.sign) { afterX.at = now; e.preventDefault(); return; }
    afterX = null;
    const edge = (dx < 0 && atLeft()) || (dx > 0 && atRight());
    if (!pullX && !edge) return; // (the browser scrolls it)
    if (pullX && Math.sign(-dx) !== Math.sign(pullX)) { clearTimeout(releaseX); if (!rafX) springX(); return; } // (back the other way)
    e.preventDefault();
    if (!pullX && Math.abs(dx) >= 50) { if (!rafX) kickX(-Math.sign(dx) * Math.min(VMAX, 400 + Math.abs(dx) * 4)); return; } // (a mouse wheel's turn)
    stopX();
    pullByX(-dx);
    clearTimeout(releaseX);
    releaseX = setTimeout(springX, 70);
  }, { passive: false });

  el.addEventListener('wheel', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
    if (!dy || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (innerScrolls(e.target, dy)) return;
    const now = performance.now(), dt = now - wheelAt, ad = Math.abs(dy);
    fade = dt < 80 && ad < wheelAd ? fade + 1 : 0; // (a trackpad's momentum: events ever weaker)
    wheelAt = now; wheelAd = ad;
    // a run of events close together is one gesture (a trackpad's swipe, and its momentum after it): its speed
    run_ = dt < 50 ? run_ + 1 : 0;
    wv = run_ ? wv * 0.5 + (dy / Math.max(dt, 4)) * 0.5 : 0;
    // after a bounce, the rest of the gesture that made it is let go by, rather than pulling against the
    // bounce or bouncing again: a trackpad's momentum keeps coming (and can start, stronger, a moment after
    // the finger lifts). Scrolling the same way pulls again only after a quiet moment.
    if (after) {
      if (dt < 300 && Math.sign(dy) === after.sign) { e.preventDefault(); return; }
      after = null;
    }
    // A trackpad swipe (or its momentum) that reaches the end at speed bounces off it at that speed
    // while it glides to the end to bounce, more of the same scroll is part of that, not a pull
    if (gliding && Math.sign(dy) === glideSign) { e.preventDefault(); return; }
    const edge0 = (dy < 0 && atTop()) || (dy > 0 && atEnd());
    if (!pull && run_ >= 3 && Math.abs(wv) > 0.4 && room() > 1) {
      if (edge0 || (dy > 0 ? el.scrollTop + dy >= room() : el.scrollTop + dy <= 0)) {
        e.preventDefault();
        el.scrollTo({ top: dy > 0 ? room() : 0, behavior: 'instant' });
        kick(-Math.sign(dy) * Math.min(VMAX, 300 + Math.abs(wv) * 600));
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
        glide(dy > 0 ? room() : 0, -Math.sign(dy) * Math.min(VMAX, 320 + over * 4));
        return;
      }
      if (!gliding) {
        aim = to;
        clearTimeout(aimTimer);
        aimTimer = setTimeout(() => { aim = null; }, 260);
        return;
      }
    }
    // scrolling away from the end it's at scrolls as usual, at once, while the bounce settles on its own
    // (not taken for a pull: springing back overshoots a little, which would read as pulling the other way)
    if (pull && room() > 1 && (el.scrollTop > room() / 2 ? dy < 0 : dy > 0)) {
      clearTimeout(releaseTimer);
      if (!raf) spring();
      return;
    }
    if (!pull && !((dy < 0 && atTop()) || (dy > 0 && atEnd()))) return;
    // a turn of a mouse wheel at the end (a big step, not a trackpad's stream) bounces off it at once,
    // rather than pulling and waiting to see whether more comes
    if (!pull && ad >= 50) {
      e.preventDefault();
      if (!raf) kick(-Math.sign(dy) * Math.min(VMAX, 400 + ad * 4));
      return;
    }
    e.preventDefault();
    // momentum (no finger on the pad) pulling against the end: let it go and spring back now
    if (pull && fade >= 4 && Math.sign(-dy) === Math.sign(pull)) {
      clearTimeout(releaseTimer);
      after = { sign: Math.sign(dy) };
      if (!raf) spring();
      return;
    }
    stop();
    pullBy(-dy);
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(spring, 70);
  }, { passive: false });

  // Touch. A finger that moves away from the end scrolls as usual, at once (a bounce still settling goes
  // on by itself: the browser's scrolling is never held back for it). One that pushes out past the end
  // pulls, and that touch is this page's from then on: drawn back, it follows the finger to rest, and
  // beyond that scrolls the list itself (the browser won't scroll a touch whose start it was refused).
  let ty = null, owned = false;
  if (!pan) el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    ty = e.touches[0].clientY;
    touching = true;
    owned = false;
  }, { passive: true });
  if (!pan) el.addEventListener('touchmove', (e) => {
    if (ty == null || e.touches.length !== 1) return;
    const y = e.touches[0].clientY, dy = y - ty;
    ty = y;
    if (document.body.classList.contains('selecting')) return;
    if (owned) {
      if (e.cancelable) e.preventDefault();
      if (pull && Math.sign(dy) !== Math.sign(pull)) {
        const r = unrub(pull) + dy;
        if (Math.sign(r) === Math.sign(pull)) show(rub(r));
        else { show(0); el.scrollTop -= r; }
      } else if ((dy > 0 && atTop()) || (dy < 0 && atEnd())) pullBy(dy);
      else el.scrollTop -= dy;
      return;
    }
    if (!e.cancelable || !((dy > 0 && atTop()) || (dy < 0 && atEnd()))) return;
    if (innerScrolls(e.target, -dy)) return;
    e.preventDefault();
    owned = true;
    if (raf) stop();
    pullBy(dy);
  }, { passive: false });
  const lift = () => { ty = null; touching = false; owned = false; if (pull && !raf) spring(); };
  if (!pan) { el.addEventListener('touchend', lift); el.addEventListener('touchcancel', lift); }

  // A finger moving it any way at all (pan): the touch is this page's from its first move, so it goes
  // diagonally too, where the browser would hold it to one direction. Past an end it pulls (each way on its
  // own); let go, it glides on at the finger's speed, slowing, and bounces off an end it runs into.
  if (pan) {
    let last = null, vx = 0, vy = 0, coast = 0;
    const halt = () => { cancelAnimationFrame(coast); coast = 0; };
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { last = null; return; }
      halt();
      const t = e.touches[0];
      last = { x: t.clientX, y: t.clientY, at: performance.now() };
      vx = vy = 0;
      touching = true;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!last || e.touches.length !== 1 || document.body.classList.contains('selecting')) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const t = e.touches[0], now = performance.now(), dx = t.clientX - last.x, dy = t.clientY - last.y, dt = Math.max(1, now - last.at);
      last = { x: t.clientX, y: t.clientY, at: now };
      if (e.cancelable) e.preventDefault();
      vx = vx * 0.4 + (dx / dt) * 0.6; vy = vy * 0.4 + (dy / dt) * 0.6;
      // each way: drawn back toward rest, the pull gives way first, then it scrolls; out past an end, it pulls.
      // (a bounce still settling, moved away from its end: it scrolls with the finger at once, the bounce going on
      // by itself; pushed out again, the finger has it)
      const move = (d, p, atLow, atHigh, pullIt, set, scroll, springing, halt_) => {
        if (!d) return;
        if (springing && Math.sign(d) !== Math.sign(p)) { scroll(-d); return; }
        if (springing) halt_();
        if (p && Math.sign(d) !== Math.sign(p)) {
          const r = unrub(p) + d;
          if (Math.sign(r) === Math.sign(p)) set(rub(r)); else { set(0); scroll(-r); }
        } else if ((d > 0 && atLow()) || (d < 0 && atHigh())) pullIt(d);
        else scroll(-d);
      };
      move(dy, pull, atTop, atEnd, pullBy, show, (d) => { el.scrollTop += d; }, !!raf, stop);
      if (sideways) move(dx, pullX, atLeft, atRight, pullByX, showX, (d) => { el.scrollLeft += d; }, !!rafX, stopX);
      else el.scrollLeft -= dx;
    }, { passive: false });
    const release = () => {
      if (!last) return;
      const stale = performance.now() - last.at > 80; // (held still before lifting: no fling)
      last = null; touching = false;
      if (pull && !raf) spring();
      if (pullX && !rafX) springX();
      if (stale || pull || pullX) return;
      let px = -vx * 16, py = -vy * 16, prev = performance.now(); // (px a frame, the way it scrolls)
      const step = (now) => {
        const f = Math.min(3, (now - prev) / 16);
        prev = now;
        const t0 = el.scrollTop, l0 = el.scrollLeft;
        el.scrollTop += py * f; el.scrollLeft += px * f;
        // (run into an end, still moving: bounces off it)
        if (py && el.scrollTop === t0 && ((py < 0 && atTop()) || (py > 0 && atEnd()))) { kick(-py * 60); py = 0; }
        if (px && el.scrollLeft === l0 && ((px < 0 && atLeft()) || (px > 0 && atRight()))) { if (sideways) kickX(-px * 60); px = 0; }
        px *= Math.pow(0.95, f); py *= Math.pow(0.95, f);
        if (Math.abs(px) < 0.2 && Math.abs(py) < 0.2) { coast = 0; return; }
        coast = requestAnimationFrame(step);
      };
      if (Math.abs(px) > 1 || Math.abs(py) > 1) coast = requestAnimationFrame(step);
    };
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
  }

  // a fling (a run of scroll events close together) that reaches an end bounces off it
  let lastTop = el.scrollTop, lastAt = 0, run = 0, v = 0, lastLeft = el.scrollLeft, hv = 0;
  (root ? window : el).addEventListener('scroll', () => {
    const now = performance.now(), top = el.scrollTop, dt = now - lastAt;
    if (dt > 60) { run = 0; v = 0; hv = 0; } else if (dt > 0) { run++; v = (top - lastTop) / dt; hv = (el.scrollLeft - lastLeft) / dt; }
    if (sideways && !touching && run >= 2 && Math.abs(hv) > 0.5 && ((hv < 0 && el.scrollLeft <= 0) || (hv > 0 && el.scrollLeft >= roomX() - 1))) kickX(-hv * 380);
    lastTop = top; lastAt = now; lastLeft = el.scrollLeft;
    if (!gliding && run >= 2 && Math.abs(v) > 0.5 && ((v < 0 && top <= 0) || (v > 0 && top >= room() - 1))) kick(-v * 380);
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
      // pulled past an end, it shrinks against that end (by which end the list is at, not which way the pull
      // points: springing back overshoots a little the other way, and the thumb mustn't leap across)
      const bottom = el.scrollTop > range / 2;
      if (bottom && pull < 0) { th = Math.max(14, th + pull); y = ch - th; } else if (!bottom && pull > 0) { th = Math.max(14, th - pull); y = 0; }
      Object.assign(ty_.style, { left: `${left + cw - 12}px`, top: `${top + y + gap}px`, height: `${th - 2 * gap}px` });
    }
    tx_.hidden = sideways || sw - cw <= 1; // (sideways with give: no bar, as asked of the board)
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

// Your account: who you are, your password, signing out (here or on your other devices)
import { $, api, date, flip, fold, h, modal, reveal, say, t, toast } from './pages.js';

const me = await api('me');
$('#who').textContent = t('signedInAs', { name: me.username });
// The name to go by, as the page's heading (none: the username, greyed): clicked, it becomes a field in its
// place; Enter or leaving it saves, Esc puts it back
let current = me;
function showName(animate = false) {
  const v = $('#name-view');
  v.textContent = current.name || current.username;
  v.classList.toggle('unnamed', !current.name);
  if (animate) v.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' });
}
showName();
function editName() {
  const v = $('#name-view'), input = $('#name-input');
  input.value = current.name || '';
  input.placeholder = current.username;
  v.hidden = true; input.hidden = false;
  input.focus(); input.select();
  input.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 160 });
}
let saving = false;
async function doneName(save) {
  const v = $('#name-view'), input = $('#name-input');
  if (input.hidden || saving) return;
  if (save && input.value.trim() !== (current.name || '')) {
    saving = true;
    try { current = await api('me/name', { method: 'PUT', body: { name: input.value } }); toast(t('nameSaved')); }
    catch (err) { toast(err.message); }
    saving = false;
  }
  input.hidden = true; v.hidden = false;
  showName(true);
}
$('#name-view').addEventListener('click', editName);
$('#name-view').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editName(); } });
$('#name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); doneName(true); }
  if (e.key === 'Escape') { e.preventDefault(); doneName(false); }
});
$('#name-input').addEventListener('blur', () => doneName(true));
$('#pw-user').value = me.username; // (for password managers: whose password changes)
$('#admin-link').hidden = !me.admin;

// ---------- the profile photo ----------
// shown: the photo, or the name's first letter; a new one springs in
function showAvatar(user, animate = false) {
  const el = $('#avatar');
  el.replaceChildren(user.avatar ? Object.assign(document.createElement('img'), { src: user.avatar, alt: '' }) : [...user.username][0].toUpperCase());
  el.classList.toggle('has-photo', !!user.avatar);
  // (the remove button: there only with a photo, popping in and out)
  const rm = $('#photo-remove'), show = !!user.avatar;
  if (!animate || rm.hidden === !show) rm.hidden = !show;
  else if (show) { rm.hidden = false; rm.animate([{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }); }
  else rm.animate([{ transform: 'none' }, { transform: 'scale(0)' }], { duration: 180, easing: 'ease-in' }).finished.then(() => { rm.hidden = true; });
  if (animate) el.animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.34, 1.4, .64, 1)' });
}
showAvatar(me);
// Picked in the system's open-file dialog: cut to its middle square, made 256 px, as WebP small enough to send
async function squareImage(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height), size = Math.min(256, side);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  for (const q of [.86, .7, .5]) {
    const url = canvas.toDataURL('image/webp', q);
    if (url.length < 58000) return url.startsWith('data:image/webp') ? url : canvas.toDataURL('image/jpeg', q);
  }
  throw new Error(t('errPhoto'));
}
$('#photo-change').addEventListener('click', () => $('#photo-file').click());
$('#photo-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const image = await squareImage(file).catch(() => { throw new Error(t('errPhoto')); });
    showAvatar(await api('me/avatar', { method: 'PUT', body: { image } }), true);
    toast(t('photoSaved'));
  } catch (err) { toast(err.message); }
});
$('#photo-remove').addEventListener('click', async () => {
  try { showAvatar(await api('me/avatar', { method: 'DELETE' }), true); toast(t('photoRemoved')); }
  catch (err) { toast(err.message); }
});
$('#logout').addEventListener('click', async () => { await api('logout', { method: 'POST' }); location.replace('/login'); });
// ---------- two-step sign-in (optional) ----------
// Off: what it is, and Turn on (the QR code and its secret unfold, with a field for the first code). On: so it
// says, a new set of recovery codes, Turn off (both with the password). Recovery codes show once, to copy.
let twofaOn = !!me.twofa;
function twofaView() {
  const box = $('#twofa');
  if (!twofaOn) {
    const setup = h('div', { class: 'twofa-setup', hidden: true });
    box.replaceChildren(
      h('p', { class: 'muted small' }, t('twofaText')),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: (e) => startTwofa(setup, e.currentTarget) }, t('twofaOn'))),
      setup);
  } else {
    box.replaceChildren(
      h('p', { class: 'twofa-state' }, h('span', { class: 'tag accent' }, t('twofaIsOn')), ' ', h('span', { class: 'muted small' }, t('twofaOnText'))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: newCodes }, t('twofaNewCodes')),
        h('button', { type: 'button', class: 'btn danger', onclick: twofaOffNow }, t('twofaOff'))));
  }
}
async function startTwofa(setup, button) {
  button.disabled = true;
  try {
    const s = await api('me/2fa/start', { method: 'POST' });
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '123456', class: 'code-input' });
    const msg = h('p', { class: 'msg' });
    const qr = h('div', { class: 'qr' }); qr.innerHTML = s.qr;
    setup.replaceChildren(
      h('p', { class: 'small' }, t('twofaSteps')),
      h('div', { class: 'twofa-qr' }, qr, h('div', {}, h('div', { class: 'muted small' }, t('twofaKey')), h('code', { class: 'secret' }, s.secret.replace(/(.{4})/g, '$1 ').trim()))),
      h('form', { class: 'row', onsubmit: async (e) => {
        e.preventDefault();
        try {
          const { recovery } = await api('me/2fa/confirm', { method: 'POST', body: { code: code.value } });
          twofaOn = true;
          await fold(setup, false);
          twofaView();
          showCodes(recovery);
          toast(t('twofaTurnedOn'));
        } catch (err) { say(msg, err.message, 'error'); }
      } }, code, h('button', { type: 'submit', class: 'btn primary' }, t('twofaConfirm')),
        // (not now: it folds away again, Turn on back)
        h('button', { type: 'button', class: 'btn', onclick: async () => { await fold(setup, false); button.disabled = false; button.focus(); } }, t('cancel'))),
      msg);
    code.addEventListener('input', () => say(msg, ''));
    await fold(setup, true);
    code.focus();
  } catch (err) { toast(err.message); button.disabled = false; }
}
// recovery codes, once: to keep somewhere safe (copy all)
function showCodes(codes) {
  const box = h('div', { class: 'codes', hidden: true },
    h('p', { class: 'small' }, t('twofaCodesText')),
    h('div', { class: 'code-grid' }, ...codes.map((c) => h('code', {}, c))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', onclick: async () => { await navigator.clipboard?.writeText(codes.join('\n')); toast(t('twofaCodesCopied')); } }, t('twofaCopyCodes')),
      h('button', { type: 'button', class: 'btn small', onclick: () => fold(box, false).then(() => box.remove()) }, t('twofaCodesDone'))));
  $('#twofa').append(box);
  fold(box, true);
}
async function newCodes() {
  const password = await modal({ title: t('twofaNewCodes'), text: t('twofaNewCodesText'), ok: t('twofaNewCodes'), password: true });
  if (password == null) return;
  try {
    const { recovery } = await api('me/2fa/recovery', { method: 'POST', body: { password } });
    $('#twofa .codes')?.remove();
    showCodes(recovery);
  } catch (err) { toast(err.message); }
}
async function twofaOffNow() {
  // (as deleting the account: the phrase typed out, and the password)
  const phrase = t('twofaOffPhrase');
  const password = await modal({ title: t('twofaOff'), text: t('twofaOffText', { phrase }), ok: t('twofaOff'), danger: true, input: phrase, password: true });
  if (password == null) return;
  try {
    await api('me/2fa/off', { method: 'POST', body: { password } });
    twofaOn = false;
    const box = $('#twofa'), from = box.offsetHeight;
    twofaView();
    box.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${box.offsetHeight}px`, overflow: 'hidden' }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    toast(t('twofaTurnedOff'));
  } catch (err) { toast(err.message); }
}
twofaView();

// ---------- signed-in devices ----------
// The device, read from the browser's own description of itself: "Chrome on Windows"
function deviceName(agent) {
  const browser = /Edg\//.test(agent) ? 'Edge' : /Whale\//.test(agent) ? 'Whale' : /OPR\//.test(agent) ? 'Opera' : /SamsungBrowser/.test(agent) ? 'Samsung Internet'
    : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
  const os = /Windows/.test(agent) ? 'Windows' : /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android'
    : /Mac OS X|Macintosh/.test(agent) ? 'macOS' : /CrOS/.test(agent) ? 'ChromeOS' : /Linux/.test(agent) ? 'Linux' : '';
  return browser && os ? t('deviceOn', { browser, os }) : browser || os || t('unknownDevice');
}
// signing out of one: two clicks, the first opening it into a red "Sign out" in place (as the dashboard's accounts)
function outButton(onOut) {
  const b = h('button', { type: 'button', class: 'btn small device-out' }, t('chooseSignOut'));
  let timer = 0;
  const disarm = () => { clearTimeout(timer); b.classList.remove('armed'); };
  b.addEventListener('click', () => {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.animate([{ scale: .94 }, { scale: 1 }], { duration: 220, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }); timer = setTimeout(disarm, 3000); return; }
    disarm();
    onOut();
  });
  b.addEventListener('pointerleave', disarm);
  return b;
}
// A row going: it fades aside, then folds shut, what's below gliding up with it (not the box jumping after)
async function collapse(row) {
  await row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(14px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished;
  const cs = getComputedStyle(row);
  row.style.overflow = 'hidden';
  await row.animate([{ height: `${row.offsetHeight}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderBottomWidth: cs.borderBottomWidth },
    { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderBottomWidth: '0px' }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' }).finished;
  row.remove();
}
// (more than five: five a page, ‹ › below; a page slides in from the side it's on)
const PER_PAGE = 5;
let page = 0, all = [];
async function devices() {
  all = (await api('me/sessions')).sort((a, b) => b.current - a.current); // (this one first, the rest by last use)
  page = Math.min(page, Math.max(0, Math.ceil(all.length / PER_PAGE) - 1));
  drawDevices();
}
function turnPage(dir) {
  const pages = Math.ceil(all.length / PER_PAGE);
  if (page + dir < 0 || page + dir >= pages) return;
  page += dir;
  drawDevices(dir);
}
$('#page-prev').addEventListener('click', () => turnPage(-1));
$('#page-next').addEventListener('click', () => turnPage(1));
async function drawDevices(dir = 0) {
  const list = all.slice(page * PER_PAGE, (page + 1) * PER_PAGE), pages = Math.ceil(all.length / PER_PAGE);
  $('#pager').hidden = pages < 2;
  $('#page-at').textContent = `${page + 1} / ${pages}`;
  $('#page-prev').disabled = page === 0;
  $('#page-next').disabled = page >= pages - 1;
  const box = $('#devices'), from = box.offsetHeight;
  const draw = () => box.replaceChildren(...list.map((d) => {
    const row = h('div', { class: 'device', 'data-key': d.id },
      h('div', { class: 'device-text' },
        h('div', { class: 'device-name' }, deviceName(d.agent), d.current ? h('span', { class: 'tag accent' }, t('thisDevice')) : null),
        h('div', { class: 'muted small' }, [d.ip, t('firstSignIn', { date: date(d.created_at) }), t('lastSeenAt', { date: date(d.last_seen) })].filter(Boolean).join(' · '))),
      d.current ? null : outButton(async () => {
        await api(`me/sessions/${d.id}`, { method: 'DELETE' });
        // (one from the next page will take its place: it only fades, the rest gliding up as it's drawn again,
        // the list's height the same; none will: it folds shut)
        if (all.length > (page + 1) * PER_PAGE) await row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(14px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished;
        else await collapse(row);
        toast(t('deviceSignedOut', { device: deviceName(d.agent) }));
        devices();
      }));
    return row;
  }));
  if (!dir) await flip(box, draw);
  else {
    draw();
    // (the new page slides in from its side; the list's height glides to fit)
    box.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    box.animate([{ height: `${from}px` }, { height: `${box.offsetHeight}px` }], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
  $('#others').disabled = all.length < 2;
}
await devices();
$('#others').addEventListener('click', async () => {
  await api('me/logout-others', { method: 'POST' });
  toast(t('othersOut'));
  await Promise.all([...$('#devices').children].filter((r) => r.querySelector('.device-out')).map(collapse));
  devices();
});
$('#pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('#new').value !== $('#again').value) return say($('#pw-msg'), t('mismatch'), 'error');
  try {
    await api('me/password', { method: 'POST', body: { current: $('#current').value, new: $('#new').value } });
    e.target.reset();
    say($('#pw-msg'), t('changed'), 'ok');
  } catch (err) { say($('#pw-msg'), err.message, 'error'); }
});
// deleting this account: typed out first, as the dialog says (the last admin can't: the server says so)
$('#delete-me').addEventListener('click', async () => {
  const phrase = t('deletePhrase', { name: me.username });
  if (!(await modal({ title: t('deleteAccount'), text: t('deleteAccountText', { phrase }), input: phrase, ok: t('deleteAccount'), danger: true }))) return;
  try {
    await api('me', { method: 'DELETE', body: { confirm: true } });
    location.replace('/login');
  } catch (err) { say($('#delete-msg'), err.message, 'error'); }
});
reveal(); // (shown now its name's in: see reveal)

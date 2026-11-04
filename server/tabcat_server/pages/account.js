// Your account: who you are, your password, signing out (here or on your other devices)
import { turnRows, $, api, appear, tint, date, deviceName, eventBad, eventDetail, eventLabel, eventMark, eventTime, eventWords, groupEvents, withDays, flip, fold, h, live, modal, reveal, say, t, toast } from './pages.js';

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
  // (in the heading's own place and height: nothing below moves; its outline and ground fade in)
  input.style.height = `${v.offsetHeight}px`;
  v.hidden = true; input.hidden = false;
  input.focus(); input.select();
  input.animate([{ borderColor: 'transparent', backgroundColor: 'transparent' }, { borderColor: getComputedStyle(input).borderColor, backgroundColor: getComputedStyle(input).backgroundColor }], { duration: 220, easing: 'ease-out' });
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
  v.animate([{ backgroundColor: getComputedStyle(input).backgroundColor }, { backgroundColor: 'transparent' }], { duration: 220, easing: 'ease-out' });
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
  current = { ...current, avatar: user.avatar, accent: user.accent }; // (what's shown: see refreshMe)
  const el = $('#avatar');
  el.replaceChildren(user.avatar ? Object.assign(document.createElement('img'), { src: user.avatar, alt: '' }) : [...user.username][0].toUpperCase());
  el.classList.toggle('has-photo', !!user.avatar);
  tint(el, user.accent);
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
  // (the password first: a session left open somewhere can't turn it on with a phone of its own)
  const password = await modal({ title: t('twofaOn'), text: t('twofaPwText'), ok: t('twofaPwOk'), password: true });
  if (!password) return;
  button.disabled = true;
  try {
    const s = await api('me/2fa/start', { method: 'POST', body: { password } });
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '123456', class: 'code-input' });
    const msg = h('p', { class: 'msg' });
    const qr = h('div', { class: 'qr' }); qr.innerHTML = s.qr;
    setup.replaceChildren(
      h('ol', { class: 'steps twofa-steps' }, h('li', {}, t('twofaStep1')), h('li', {}, t('twofaStep2'))),
      h('div', { class: 'twofa-qr' }, qr, h('div', {}, h('div', { class: 'muted small' }, t('twofaKey')), h('code', { class: 'secret' }, s.secret.replace(/(.{4})/g, '$1 ').trim()))),
      h('form', { class: 'row', onsubmit: async (e) => {
        e.preventDefault();
        try {
          const { recovery } = await api('me/2fa/confirm', { method: 'POST', body: { code: code.value } });
          twofaOn = true;
          // (from the setup straight to on, its recovery codes below: the box goes from one size to the other at once)
          const box = $('#twofa'), from = box.offsetHeight;
          twofaView();
          showCodes(recovery, false);
          box.style.overflow = 'hidden';
          box.animate([{ height: `${from}px` }, { height: `${box.offsetHeight}px` }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' }).finished.finally(() => { box.style.overflow = ''; });
          for (const el of box.children) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 60, fill: 'backwards' });
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
function showCodes(codes, unfold = true) {
  const box = h('div', { class: 'codes', hidden: unfold },
    h('h3', {}, t('twofaCodesTitle')),
    h('p', { class: 'small' }, t('twofaCodesText')),
    h('div', { class: 'code-grid' }, ...codes.map((c) => h('code', {}, c))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', onclick: async () => { await navigator.clipboard?.writeText(codes.join('\n')); toast(t('twofaCodesCopied')); } }, t('twofaCopyCodes')),
      h('button', { type: 'button', class: 'btn small', onclick: () => fold(box, false).then(() => box.remove()) }, t('twofaCodesDone'))));
  $('#twofa').append(box);
  if (unfold) fold(box, true);
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
let shownDevices = '';
async function devices(onlyChanged = false) {
  const now = (await api('me/sessions')).sort((a, b) => b.current - a.current); // (this one first, the rest by last use)
  if (onlyChanged && JSON.stringify(now) === shownDevices) return;
  shownDevices = JSON.stringify(now);
  all = now;
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

// ---------- recent security activity: this account's own record, five a page (‹ › or a page's number typed) ----------
const MY_PER_PAGE = 5;
let shownEvents = '', myPage = 1;
// `to`: another page (its rows slide in from the side it's on); none: this one again, as it now is
async function myEvents(to = null) {
  const page = Math.max(1, to ?? myPage);
  const r = await api(`me/events?limit=${MY_PER_PAGE}&offset=${(page - 1) * MY_PER_PAGE}`).catch(() => null);
  if (!r) return;
  const pages = Math.max(1, Math.ceil(r.total / MY_PER_PAGE));
  if (page > pages && r.total) return myEvents(pages); // (fewer now: the last there is)
  const dir = Math.sign(page - myPage);
  myPage = page;
  pagerShows(page, pages);
  const seen = JSON.stringify([page, r.events]);
  if (seen === shownEvents) return;
  const first = !shownEvents;
  shownEvents = seen;
  const box = $('#my-events');
  // (the days apart; each: what (marked if it went wrong; by whom, an admin's doing), when, and from where, "This
  // browser" for this one; the same again and again as one)
  const row = (g) => h('div', { class: `event mine${eventBad(g) ? ' bad' : ''}`, 'data-key': g.ids.join('-') },
    h('span', { class: 'ev-what' }, eventMark(g), ...eventWords(g)),
    h('span', { class: 'ev-when muted small' }, eventTime(g)),
    h('span', { class: 'ev-where muted small' }, [(g.agent && deviceName(g.agent)) || '', g.ip].filter(Boolean).join(' · '), g.here ? h('span', { class: 'tag ev-here' }, t('evHere')) : null));
  const rows = r.events.length ? withDays(groupEvents(r.events), row) : [h('p', { class: 'muted small', 'data-key': 'none' }, t('eventsNone'))];
  $('#ev-act').hidden = !r.events.length;
  if (first) box.replaceChildren(...rows);
  else if (!dir) await flip(box, () => box.replaceChildren(...rows));
  else {
    // (another page: each row's place turns over, the old going up and out as the new comes in from below; going
    // back, the other way. The box glides to its height.)
    turnRows(box, rows, dir);
  }
}
// the pages: shown once there are more than five
function pagerShows(page, pages) {
  const input = $('#my-ev-page');
  if (document.activeElement !== input) input.value = page;
  input.max = pages;
  if ($('#my-ev-pages').textContent !== String(pages)) {
    $('#my-ev-pages').textContent = pages;
    if (!$('#my-ev-pager').hidden) $('#my-ev-pages').animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
  input.style.width = `${String(pages).length + 3.2}ch`;
  $('#my-ev-prev').disabled = page <= 1;
  $('#my-ev-next').disabled = page >= pages;
  if ($('#my-ev-pager').hidden !== (pages <= 1)) appear($('#my-ev-pager'), pages > 1); // (beside the heading: it grows in sideways)
}
$('#my-ev-prev').addEventListener('click', () => myEvents(myPage - 1));
$('#my-ev-next').addEventListener('click', () => myEvents(myPage + 1));
// (a page's number: gone to on Enter, or leaving the field; past the last, the last)
const goMyPage = () => {
  const input = $('#my-ev-page'), n = Math.round(+input.value);
  if (!input.value || !Number.isFinite(n)) { input.value = myPage; return; }
  const to = Math.min(Math.max(1, n), +input.max || 1);
  input.value = to;
  if (to !== myPage) myEvents(to);
};
$('#my-ev-page').addEventListener('change', goMyPage);
$('#my-ev-page').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goMyPage(); e.target.select(); } });
$('#my-ev-page').addEventListener('focus', (e) => e.target.select());
await myEvents();
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
// (the server's only admin: no Delete button, a red word why in its place; made so, or no longer, elsewhere: the
// one fades out as the other comes)
function onlyAdmin(only, animate = false) {
  const [show, hide] = only ? [$('#only-admin'), $('#delete-row')] : [$('#delete-row'), $('#only-admin')];
  if (!show.hidden) return;
  const swap = () => { hide.hidden = true; show.hidden = false; if (animate) show.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' }); };
  if (animate && !hide.hidden) hide.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in' }).finished.then(swap, swap);
  else swap();
}
onlyAdmin(!!me.only_admin);
$('#delete-me').addEventListener('click', async () => {
  const phrase = t('deletePhrase', { name: me.username });
  // (the phrase typed out, and the password: a session left open somewhere can't end the account)
  const password = await modal({ title: t('deleteAccount'), text: t('deleteAccountText', { phrase }), input: phrase, password: true, ok: t('deleteAccount'), danger: true });
  if (!password) return;
  try {
    await api('me', { method: 'DELETE', body: { confirm: true, password } });
    location.replace('/login');
  } catch (err) { say($('#delete-msg'), err.message, 'error'); }
});
// ---------- live: changed elsewhere (another browser, an admin), shown here at once ----------
async function refreshMe() {
  const now = await api('me');
  onlyAdmin(!!now.only_admin, true);
  if (now.name !== current.name && $('#name-input').hidden && !saving) { current = { ...current, name: now.name }; showName(true); }
  if ((now.avatar || null) !== (current.avatar || null) || now.accent !== current.accent) showAvatar(now, true);
  appear($('#admin-link'), !!now.admin); // (made an admin, or no longer: the button comes, or goes)
  // (2FA turned on or off elsewhere: not while it's being set up here, or its codes are showing)
  if (!!now.twofa !== twofaOn && !$('.twofa-setup:not([hidden])') && !$('#twofa .codes')) {
    twofaOn = !!now.twofa;
    const box = $('#twofa'), from = box.offsetHeight;
    twofaView();
    box.style.overflow = 'hidden';
    box.animate([{ height: `${from}px` }, { height: `${box.offsetHeight}px` }], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' }).finished.finally(() => { box.style.overflow = ''; });
    for (const el of box.children) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 60, fill: 'backwards' });
  }
  await Promise.all([devices(true), myEvents()]);
}
live({ me: refreshMe });
reveal(); // (shown now its name's in: see reveal)

// Something in the record that wasn't you: straight to what to do about it. The password: its form, the current one
// to type (the form glides into view, lit a moment); other devices: signed out as from their own button (asked first)
$('#ev-pw').addEventListener('click', () => {
  const form = $('#pw-form');
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    $('#current').focus({ preventScroll: true });
    form.animate([{ boxShadow: '0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent)' }, { boxShadow: '0 0 0 8px transparent' }], { duration: 700, easing: 'ease-out' });
  }, 350);
});
$('#ev-others').addEventListener('click', () => $('#others').click());

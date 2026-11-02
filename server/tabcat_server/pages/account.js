// Your account: who you are, your password, signing out (here or on your other devices)
import { $, api, date, flip, h, modal, reveal, say, t, toast } from './pages.js';

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
async function devices() {
  const list = await api('me/sessions');
  await flip($('#devices'), () => $('#devices').replaceChildren(...list.map((d) => {
    const row = h('div', { class: 'device', 'data-key': d.id },
      h('div', { class: 'device-text' },
        h('div', { class: 'device-name' }, deviceName(d.agent), d.current ? h('span', { class: 'tag accent' }, t('thisDevice')) : null),
        h('div', { class: 'muted small' }, [d.ip, t('firstSignIn', { date: date(d.created_at) }), t('lastSeenAt', { date: date(d.last_seen) })].filter(Boolean).join(' · '))),
      d.current ? null : outButton(async () => {
        await api(`me/sessions/${d.id}`, { method: 'DELETE' });
        await collapse(row);
        toast(t('deviceSignedOut'));
        devices();
      }));
    return row;
  })));
  $('#others').disabled = list.length < 2;
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

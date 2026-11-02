// Your account: who you are, your password, signing out (here or on your other devices)
import { $, api, modal, reveal, say, t, toast } from './pages.js';

const me = await api('me');
$('#who').textContent = t('signedInAs', { name: me.username });
$('#pw-user').value = me.username; // (for password managers: whose password changes)
$('#admin-link').hidden = !me.admin;

// ---------- the profile photo ----------
// shown: the photo, or the name's first letter; a new one springs in
function showAvatar(user, animate = false) {
  const el = $('#avatar');
  el.replaceChildren(user.avatar ? Object.assign(document.createElement('img'), { src: user.avatar, alt: '' }) : [...user.username][0].toUpperCase());
  el.classList.toggle('has-photo', !!user.avatar);
  $('#photo-remove').hidden = !user.avatar;
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
$('#others').addEventListener('click', async () => {
  await api('me/logout-others', { method: 'POST' });
  say($('#others-msg'), t('othersOut'), 'ok');
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

// Your account: who you are, your password, signing out (here or on your other devices)
import { $, api, say, t } from './pages.js';

const me = await api('me');
$('#who').textContent = t('signedInAs', { name: me.username });
$('#pw-user').value = me.username; // (for password managers: whose password changes)
$('#admin-link').hidden = !me.admin;
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

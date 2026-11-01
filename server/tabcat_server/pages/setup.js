// The first account (an admin), on a server with none yet
import { $, api, say, t } from './pages.js';

$('#username').focus();
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#username').value.trim(), password = $('#password').value;
  if (password !== $('#again').value) return say($('#msg'), t('mismatch'), 'error');
  $('#go').disabled = true;
  try {
    await api('setup', { method: 'POST', body: { username, password } });
    location.replace('/admin');
  } catch (err) {
    say($('#msg'), err.message, 'error');
    $('#go').disabled = false;
  }
});

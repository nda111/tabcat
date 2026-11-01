// The first account (an admin), on a server with none yet
import { $, api, connected, say, showNotConnected, t } from './pages.js';

// only with the extension connected to this server: else, how to connect
const linked = await connected(() => location.reload());
$('#form').removeAttribute('data-checking'); // (shown once it's known which)
if (linked) await main();
else showNotConnected($('#form'));

async function main() {
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
}

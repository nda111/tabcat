// Sign in, or (when the server lets anyone, or this link has an invitation in it) make an account
import { $, api, connected, say, showNotConnected, t } from './pages.js';

// only with the extension connected to this server: else, how to connect
const linked = await connected(() => location.reload());
// (the page shows once it's known which, in its fonts if they come soon: nothing shifts after)
await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 300))]);
document.body.removeAttribute('data-checking');
if (linked) await main();
else showNotConnected($('#form'));

async function main() {
  const params = new URLSearchParams(location.search);
  const next = /^\/(?!\/)/.test(params.get('next') || '') ? params.get('next') : '/';
  const info = await api('server');
  // signing up: when anyone may, or by invitation (its code from the link, or typed); closed: never, links too
  const invite = info.signup === 'invite' ? params.get('invite') || '' : '';
  const canSignUp = info.signup === 'open' || info.signup === 'invite';
  let signingUp = !!invite;
  $('#invite').value = invite;

  function mode() {
    $('#title').textContent = t(signingUp ? 'signUpTitle' : 'signInTitle');
    $('#go').textContent = t(signingUp ? 'signUp' : 'signIn');
    // (the other way, beside it: sign up from signing in, or back)
    $('#other').hidden = !canSignUp;
    $('#other').textContent = t(signingUp ? 'signIn' : 'signUp');
    $('#again-row').hidden = !signingUp;
    $('#invite-row').hidden = !signingUp || info.signup !== 'invite';
    $('#password').autocomplete = signingUp ? 'new-password' : 'current-password';
    $('#check-name').hidden = !signingUp;
    nameMsg('');
    say($('#msg'), signingUp ? `${t('username')}: ${t('userHint')} · ${t('password')}: ${t('pwHint')}` : '');
  }
  // signing up: is the username free? (asked on the button; typing again clears the answer)
  function nameMsg(text, kind = '') { $('#name-msg').textContent = text; $('#name-msg').className = `field-msg ${kind}`; }
  $('#check-name').addEventListener('click', async () => {
    const name = $('#username').value.trim();
    const r = await api(`username?name=${encodeURIComponent(name)}`).catch((e) => ({ error: e.message }));
    if (r.error) return nameMsg(r.error, 'error');
    nameMsg(t(!r.valid ? 'usernameBad' : r.free ? 'usernameFree' : 'errTaken'), r.free ? 'ok' : 'error');
  });
  $('#username').addEventListener('input', () => nameMsg(''));
  mode();
  $('#other').addEventListener('click', () => { signingUp = !signingUp; mode(); $('#username').focus(); });
  $('#username').focus();

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#username').value.trim(), password = $('#password').value;
    if (signingUp && password !== $('#again').value) return say($('#msg'), t('mismatch'), 'error');
    $('#go').disabled = true;
    say($('#msg'), t('working'));
    try {
      if (signingUp) await api('signup', { method: 'POST', body: { username, password, invite: $('#invite').value.trim() } });
      else await api('login', { method: 'POST', body: { username, password } });
      location.replace(next);
    } catch (err) {
      say($('#msg'), err.message, 'error');
      $('#go').disabled = false;
    }
  });
}

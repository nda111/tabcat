// Sign in, or (when the server lets anyone, or this link has an invitation in it) make an account
import { $, api, say, t } from './pages.js';

const params = new URLSearchParams(location.search);
const next = /^\/(?!\/)/.test(params.get('next') || '') ? params.get('next') : '/';
const info = await api('server');
const invite = params.get('invite') || '';
let signingUp = !!invite;
const canSignUp = info.signup === 'open' || info.signup === 'invite' || !!invite;
$('#invite').value = invite;

function mode() {
  $('#title').textContent = t(signingUp ? 'signUpTitle' : 'signInTitle');
  $('#go').textContent = t(signingUp ? 'signUp' : 'signIn');
  $('#again-row').hidden = !signingUp;
  $('#invite-row').hidden = !signingUp || !(info.signup === 'invite' || invite);
  $('#password').autocomplete = signingUp ? 'new-password' : 'current-password';
  $('#switch-row').hidden = !canSignUp;
  $('#switch').textContent = t(signingUp ? 'haveAccount' : 'noAccount');
  say($('#msg'), signingUp ? `${t('username')}: ${t('userHint')} · ${t('password')}: ${t('pwHint')}` : '');
}
mode();
$('#switch').addEventListener('click', (e) => { e.preventDefault(); signingUp = !signingUp; mode(); });
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

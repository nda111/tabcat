// Sign in, or (when the server lets anyone, or this link has an invitation in it) make an account
import { $, api, connected, morph, say, showNotConnected, t } from './pages.js';

const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';

// only with the extension connected to this server: else, how to connect
const linked = await connected(() => location.reload());
// (the page shows once it's known which, in its fonts if they come soon: nothing shifts after; the box comes up)
await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 300))]);
if (!linked) showNotConnected($('#form'));
else await main();
document.body.removeAttribute('data-checking');
if (linked) $('#username').focus(); // (once shown: a hidden field can't take focus)

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
    $('#forgot').hidden = signingUp;
    checked('', false);
    // (the message line keeps the room the hints take: a message in their place doesn't change the box's size)
    $('#msg').style.minHeight = '';
    say($('#msg'), signingUp ? `${t('username')}: ${t('userHint')} · ${t('password')}: ${t('pwHint')}` : '');
    if (signingUp) $('#msg').style.minHeight = `${$('#msg').offsetHeight}px`;
  }

  // Signing up: is the username free? The button asks, then turns into a circle with the answer (green, a tick:
  // free; red, a cross: taken, or not a username: its tooltip says which). Clicked, the circle asks again;
  // typing turns it back into the button.
  const check = $('#check-name');
  let answer = '';
  function checked(state, animate = true, why = '') {
    const draw = () => {
      check.classList.remove('done', 'ok', 'bad', 'busy');
      check.style.width = '';
      if (state) { check.classList.add('done', state); check.style.width = `${check.offsetHeight}px`; }
    };
    if (animate && !check.hidden && state !== answer) morph(check, draw);
    else if (state && state === answer) { // (the same answer again: the mark draws again)
      check.classList.remove(state);
      void check.offsetWidth;
      check.classList.add(state);
    } else draw();
    answer = state;
    check.title = why;
    check.setAttribute('aria-label', why || t('checkUsername'));
  }
  check.addEventListener('click', async () => {
    const name = $('#username').value.trim();
    check.classList.add('busy');
    if (answer) check.animate([{ transform: 'scale(.86)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
    const r = await api(`username?name=${encodeURIComponent(name)}`).catch((e) => ({ error: e.message }));
    check.classList.remove('busy');
    if (r.error) return checked('bad', true, `${r.error} · ${t('checkAgain')}`);
    const why = t(!r.valid ? 'usernameBad' : r.free ? 'usernameFree' : 'errTaken');
    checked(r.free ? 'ok' : 'bad', true, `${why} · ${t('checkAgain')}`);
  });
  $('#username').addEventListener('input', () => { if (answer) checked(''); });
  mode();

  // From signing in to signing up, or back: the box grows or shrinks to fit, what comes fades in
  $('#other').addEventListener('click', () => {
    const card = $('#form'), from = card.offsetHeight;
    const rows = [...card.querySelectorAll('label, .msg, .forgot')];
    const hiddenBefore = new Set(rows.filter((el) => el.hidden));
    signingUp = !signingUp;
    mode();
    const to = card.offsetHeight;
    card.style.overflow = 'clip';
    card.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 340, easing: GLIDE }).finished
      .then(() => { card.style.overflow = ''; }, () => {});
    for (const el of rows) if (hiddenBefore.has(el) && !el.hidden) el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 60, easing: GLIDE, fill: 'backwards' });
    for (const el of [$('#title'), $('#go'), $('#other')]) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    $('#username').focus();
  });

  // Sending: the fields and buttons go still (fading) until the answer; nothing to read meanwhile
  const still = (on) => { for (const el of $('#form').querySelectorAll('input, button')) el.disabled = on; };
  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#username').value.trim(), password = $('#password').value;
    if (signingUp && password !== $('#again').value) return say($('#msg'), t('mismatch'), 'error');
    still(true);
    try {
      if (signingUp) await api('signup', { method: 'POST', body: { username, password, invite: $('#invite').value.trim() } });
      else await api('login', { method: 'POST', body: { username, password } });
      location.replace(next);
    } catch (err) {
      still(false);
      say($('#msg'), err.message, 'error');
    }
  });
}

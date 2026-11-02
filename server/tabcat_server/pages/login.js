// Sign in, or (when the server lets anyone, or this link has an invitation in it) make an account
import { $, api, connected, fold, go, h, morph, say, showNotConnected, t, toast, reveal } from './pages.js';

const GLIDE = 'cubic-bezier(.22, 1, .36, 1)';

// only with the extension connected to this server: else, how to connect
const linked = await connected(() => location.reload());
// (the page shows once it's known which, in its fonts if they come soon: nothing shifts after; the box comes up)
if (!linked) showNotConnected($('#form'));
else await main();
await reveal();
if (linked) ($('#username').value && !$('#username').closest('label').hidden ? $('#password') : $('#username')).focus(); // (once shown: a hidden field can't take focus; a remembered username: the password next)

async function main() {
  const params = new URLSearchParams(location.search);
  const next = /^\/(?!\/)/.test(params.get('next') || '') ? params.get('next') : '/';
  const info = await api('server');
  // signing up: when anyone may, or by invitation (its code from the link, or typed); closed: never, links too
  const invite = info.signup === 'invite' ? params.get('invite') || '' : '';
  const canSignUp = info.signup === 'open' || info.signup === 'invite';
  let signingUp = !!invite;
  // the username remembered from last time (this browser, this server): filled in, the password next
  const REMEMBER = 'tabcat:rememberId';
  const store = { get: () => { try { return localStorage.getItem(REMEMBER); } catch { return null; } },
    set: (v) => { try { if (v) localStorage.setItem(REMEMBER, v); else localStorage.removeItem(REMEMBER); } catch { /* storage unavailable */ } } };
  const remembered = store.get();
  if (remembered && !signingUp) { $('#username').value = remembered; $('#remember-id').checked = true; }
  $('#keep-row').hidden = !info.keep; // (the server keeps no one signed in: nothing to offer)
  // (adding another account, from the dashboard's Account: Back beside Sign in, to it; not signing up from here.
  // Only with an account signed in here already: the address alone, signed out, is the plain sign-in page)
  const signedInHere = (await api('accounts/here').catch(() => null))?.accounts?.length > 0;
  const adding = !!params.get('add') && signedInHere;
  $('#back-btn').hidden = !adding;
  $('#back-btn').addEventListener('click', () => go('/'));
  $('#invite').value = invite;

  function mode() {
    $('#title').textContent = t(signingUp ? 'signUpTitle' : 'signInTitle');
    $('#go').textContent = t(signingUp ? 'signUp' : 'signIn');
    // (the other way, beside it: sign up from signing in, or back)
    $('#other').hidden = !canSignUp || adding;
    $('#other').textContent = t(signingUp ? 'signIn' : 'signUp');
    $('#again-row').hidden = !signingUp;
    $('#name-row').hidden = !signingUp;
    $('#invite-row').hidden = !signingUp || info.signup !== 'invite';
    $('#password').autocomplete = signingUp ? 'new-password' : 'current-password';
    $('#check-name').hidden = !signingUp;
    $('#forgot').hidden = signingUp;
    $('#login-opts').hidden = signingUp;
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
  $('#other').addEventListener('click', () => { switchTo(!signingUp); $('#username').focus(); });
  function switchTo(up) {
    const card = $('#form'), from = card.offsetHeight;
    const rows = [...card.querySelectorAll('label, .msg, .forgot')];
    const hiddenBefore = new Set(rows.filter((el) => el.hidden));
    signingUp = up;
    mode();
    const to = card.offsetHeight;
    card.style.overflow = 'clip';
    card.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 340, easing: GLIDE }).finished
      .then(() => { card.style.overflow = ''; }, () => {});
    for (const el of rows) if (hiddenBefore.has(el) && !el.hidden) el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 60, easing: GLIDE, fill: 'backwards' });
    for (const el of [$('#title'), $('#go'), $('#other')]) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }

  // As many accounts signed in here as there may be: which one to sign out of first (else the oldest would go
  // without a word). Until one's picked, the form waits.
  const fields = () => $('#form').querySelectorAll('input, #go, #other, #check-name, .pw-eye');
  const here = await api('accounts/here').catch(() => null);
  if (here && here.accounts.length >= here.max) {
    for (const el of fields()) el.disabled = true;
    $('#choose-text').textContent = t('chooseText', { n: here.max });
    const photo = (a) => h('span', { class: 'avatar' }, a.avatar ? h('img', { src: a.avatar, alt: '' }) : [...a.username][0].toUpperCase());
    $('#choose-list').replaceChildren(...here.accounts.map((a) => h('button', { type: 'button', class: 'choose-row', onclick: async (e) => {
      const row = e.currentTarget;
      for (const b of $('#choose-list').children) b.disabled = true;
      try { await api('accounts/logout', { method: 'POST', body: { id: a.id } }); } catch (err) { toast(err.message); for (const b of $('#choose-list').children) b.disabled = false; return; }
      row.classList.add('out');
      toast(t('signedOutOf', { name: a.username }));
      await fold($('#choose'), false);
      for (const el of fields()) el.disabled = false;
      $('#username').focus();
    } }, photo(a), h('span', { class: 'choose-name' }, a.name || a.username), h('span', { class: 'choose-out' }, t('chooseSignOut')))));
    $('#choose').hidden = false;
  }

  // Sending: the fields and buttons go still (fading) until the answer; nothing to read meanwhile
  const still = (on) => { for (const el of $('#form').querySelectorAll('input, button')) el.disabled = on; };
  // Two-step sign-in on for the account: the password right, the box turns to asking for the code (the app's,
  // or a recovery code); Start again goes back to the password
  let ticket = null, recovery = false;
  function codeStep(on) {
    const card = $('#form'), from = card.offsetHeight;
    for (const el of [$('#username').closest('label'), $('#password').closest('label'), $('#forgot'), $('#login-opts')]) el.hidden = on;
    $('#other').hidden = on || !canSignUp || adding;
    $('#code-step').hidden = !on;
    $('#title').textContent = t(on ? 'codeTitle' : 'signInTitle');
    $('#go').textContent = t(on ? 'codeGo' : 'signIn');
    say($('#msg'), '');
    if (!on) { ticket = null; setRecovery(false); }
    const to = card.offsetHeight;
    card.style.overflow = 'clip';
    card.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 340, easing: GLIDE }).finished.then(() => { card.style.overflow = ''; }, () => {});
    for (const el of [$('#title'), on ? $('#code-step') : $('#username').closest('label')]) el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: GLIDE });
    (on ? $('#code') : $('#password')).focus();
  }
  function setRecovery(on) {
    recovery = on;
    $('#code').value = '';
    $('#code').inputMode = on ? 'text' : 'numeric';
    $('#code').placeholder = on ? 'xxxx-xxxx-xxxx' : '123456';
    $('#code-text').textContent = t(on ? 'recoveryText' : 'codeText');
    $('#code-label').textContent = t(on ? 'recoveryLabel' : 'codeLabel');
    $('#use-recovery').textContent = t(on ? 'useApp' : 'useRecovery');
    $('#code-text').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  }
  $('#use-recovery').addEventListener('click', () => { setRecovery(!recovery); $('#code').focus(); });
  $('#code-back').addEventListener('click', () => { $('#password').value = ''; codeStep(false); });
  $('#code').addEventListener('input', () => say($('#msg'), ''));

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#username').value.trim(), password = $('#password').value;
    if (signingUp && password !== $('#again').value) return say($('#msg'), t('mismatch'), 'error');
    still(true);
    try {
      if (signingUp) {
        // made: not signed in yet. Signing in follows here, the new username in place, the password to type
        await api('signup', { method: 'POST', body: { username, password, name: $('#name').value, invite: $('#invite').value.trim() } });
        still(false);
        for (const id of ['#password', '#again', '#invite', '#name']) $(id).value = '';
        switchTo(false);
        say($('#msg'), t('accountMade'), 'ok');
        $('#password').focus();
        return;
      }
      if (ticket) { // (the second step)
        await api('login/code', { method: 'POST', body: { ticket, code: $('#code').value } });
        return go(next, true);
      }
      store.set($('#remember-id').checked ? username : null);
      const r = await api('login', { method: 'POST', body: { username, password, keep: info.keep && $('#keep').checked } });
      if (r?.need === 'code') { still(false); ticket = r.ticket; return codeStep(true); }
      go(next, true);
    } catch (err) {
      still(false);
      say($('#msg'), err.message, 'error');
    }
  });
}

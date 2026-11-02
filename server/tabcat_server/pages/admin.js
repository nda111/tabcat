// The admin page: users, sign-up and invitations, security, the server and its dashboard
import { $, api, bytes, date, flip, fold, h, modal, randomPassword, reveal as showPage, say, stepper, t, toast } from './pages.js';

const me = await api('me');
const newPasswords = new Map(); // (a user's new password, shown in place of its button until the page loads again)
const SPRING = 'cubic-bezier(.34, 1.4, .64, 1)', GLIDE = 'cubic-bezier(.22, 1, .36, 1)';

// Something leaves: it fades and slides aside, then the list is drawn again (the rest glide up: see flip)
const leave = (el) => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(14px)' }],
  { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished;

// ---------- users ----------
// Each row is drawn anew when anything changes; what changed in it (the role, suspended, a new password) moves
// from how it was, kept here by user
const was = new Map();
async function users() {
  const list = await api('admin/users');
  await flip($('#users'), () => $('#users').replaceChildren(...list.map(row)));
  for (const u of list) {
    const tr = $(`#users tr[data-key="${u.id}"]`), before = was.get(u.id);
    const now = { admin: u.admin, disabled: u.disabled, pw: newPasswords.has(u.id) };
    was.set(u.id, now);
    if (!before || !tr) continue;
    if (before.admin !== now.admin) slidePill(tr.parts.pill, now.admin);
    if (before.disabled !== now.disabled) { chip(tr.parts.chip, now.disabled); swap(tr.parts.suspend, now.disabled); }
    if (before.pw !== now.pw && now.pw) reveal(tr.parts.newpw);
  }
}
// the role's filled part slides to the other side
function slidePill(pill, admin) {
  pill.animate([{ transform: admin ? 'translateX(100%)' : 'none' }, { transform: admin ? 'none' : 'translateX(100%)' }], { duration: 320, easing: GLIDE });
}
// "Suspended" pops in beside the name, or shrinks away (its room stays: nothing beside it moves)
function chip(el, on) {
  el.animate(on ? [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }]
    : [{ opacity: 1, transform: 'none', visibility: 'visible' }, { opacity: 0, transform: 'scale(.6)', visibility: 'visible' }],
  { duration: on ? 300 : 200, easing: on ? SPRING : 'ease-in' });
}
// a button with two labels in one place (as wide as the wider): the new one rises in, the old one out
function swap(button, second) {
  if (!button) return;
  const [a, b] = button.children, [inn, out] = second ? [b, a] : [a, b];
  inn.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: GLIDE });
  out.animate([{ opacity: 1, transform: 'none', visibility: 'visible' }, { opacity: 0, transform: 'translateY(-6px)', visibility: 'visible' }], { duration: 180, easing: 'ease-in' });
}
// a new password unrolls in place of the button that made it
function reveal(el) {
  el.animate([{ clipPath: 'inset(0 100% 0 0 round 6px)', opacity: .4 }, { clipPath: 'inset(0 0 0 0 round 6px)', opacity: 1 }], { duration: 380, easing: GLIDE });
}

function row(u) {
  const self = u.id === me.id;
  const fail = (e) => say($('#users-msg'), e.message, 'error');
  const edit = (patch) => api(`admin/users/${u.id}`, { method: 'PATCH', body: patch }).then(() => { say($('#users-msg'), ''); return users(); }, fail);
  const role = (admin, label) => h('button', { type: 'button', class: u.admin === admin ? 'on' : '', 'aria-pressed': String(u.admin === admin),
    onclick: () => { if (u.admin !== admin) edit({ admin }); } }, t(label));
  const pill = h('span', { class: `seg-pill${u.admin ? '' : ' second'}`, 'aria-hidden': 'true' });
  // (always there, hidden unless suspended: the columns beside it don't move as it comes and goes)
  const chipEl = h('span', { class: `tag off${u.disabled ? '' : ' ghost'}`, 'aria-hidden': String(!u.disabled) }, t('off'));
  const suspend = self ? null : h('button', { type: 'button', class: `btn small swap${u.disabled ? ' second' : ''}`, onclick: () => edit({ disabled: !u.disabled }) },
    h('span', {}, t('turnOff')), h('span', {}, t('turnOn')));
  // reset: a new random password, set at once, shown in place of the button (click: copied). Both in one
  // place, as wide as a password: the row doesn't change width as it comes
  const pw = newPasswords.get(u.id);
  const newpw = h('button', { type: 'button', class: 'newpw', title: t('copy'), onclick: async () => {
    await navigator.clipboard?.writeText(pw);
    newpw.animate([{ transform: 'scale(.92)' }, { transform: 'none' }], { duration: 260, easing: SPRING });
    toast(t('copiedPassword'));
  } }, pw || 'x'.repeat(14));
  // (not your own: that's changed on your account page, with the current one; here it would sign you out)
  const reset = h('button', { type: 'button', class: 'btn small', onclick: async () => {
    if (!(await modal({ title: t('resetTitle', { name: u.username }), text: t('resetText'), ok: t('resetOk') }))) return;
    const fresh = randomPassword();
    const ok = await api(`admin/users/${u.id}`, { method: 'PATCH', body: { password: fresh } }).then(() => true, (e) => { fail(e); return false; });
    if (!ok) return;
    newPasswords.set(u.id, fresh);
    users();
  } }, t('resetPassword'));
  // each kind of button in a column of its own (the same ones under each other, whoever's row): suspend, the
  // role, reset, delete; your own row leaves out what you can't do to yourself
  const tr = h('tr', { 'data-key': u.id },
    // (the name to go by, if any, then the username, smaller)
    h('td', {}, h('span', { class: 'who' }, h('b', {}, u.name || u.username), u.name ? h('span', { class: 'muted small' }, ` ${u.username}`) : null,
      self ? h('span', { class: 'muted small' }, ` (${t('you')})`) : null), chipEl,
      // (two-step sign-in on: so marked; an admin can turn it off for someone locked out of it, not their own)
      u.twofa ? h('button', { type: 'button', class: 'tag twofa', disabled: self, onclick: async () => {
        if (!(await modal({ title: t('twofaReset', { name: u.name || u.username }), text: t('twofaResetText'), ok: t('twofaOff'), danger: true }))) return;
        edit({ twofa: false });
      } }, t('twofaTag')) : null),
    h('td', { class: 'hide-narrow muted small' }, date(u.last_seen)),
    h('td', { class: 'act' }, suspend),
    h('td', { class: 'act' }, h('span', { class: 'seg', role: 'group' }, pill, role(true, 'admin'), role(false, 'member'))),
    h('td', { class: 'act' }, self ? null : h('span', { class: `pw-slot${pw ? ' second' : ''}` }, reset, newpw)),
    h('td', { class: 'act' }, self ? null : h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
      if (!(await modal({ title: t('confirmDeleteTitle', { name: u.username }), text: t('confirmDelete', { name: u.username }), ok: t('remove'), danger: true }))) return;
      await api(`admin/users/${u.id}`, { method: 'DELETE' }).then(async () => { await leave(tr); was.delete(u.id); return users(); }, fail);
    } }, t('remove'))));
  tr.parts = { pill, chip: chipEl, suspend, newpw };
  return tr;
}
$('#add-form').addEventListener('input', () => say($('#add-msg'), '')); // (typed again: the error goes)
$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('admin/users', { method: 'POST', body: { username: $('#add-name').value.trim(), name: $('#add-display').value, password: $('#add-pw').value, admin: $('#add-admin').checked } });
    e.target.reset();
    say($('#add-msg'), '');
    await users();
  } catch (err) { say($('#add-msg'), err.message, 'error'); } // (under the fields it's about)
});

// ---------- settings: sign-up, security ----------
const NUMBERS = { session_days: '#session-days', login_tries: '#login-tries', login_lock_minutes: '#login-lock' };
const steppers = {
  session_days: stepper($('#session-days'), { zero: t('sessionOff') }),
  login_tries: stepper($('#login-tries')),
  login_lock_minutes: stepper($('#login-lock')),
};
async function settings() {
  const s = await api('admin/settings');
  for (const r of document.querySelectorAll('input[name=signup]')) r.checked = r.value === s.signup;
  for (const [k, sel] of Object.entries(NUMBERS)) { $(sel).value = s[k]; steppers[k].sync(); }
}
// (saved: said a while where it's kept room for, then it fades)
const fades = new Map();
async function save(patch, msg) {
  clearTimeout(fades.get(msg));
  // (said at once, with the click: should the server refuse, the error takes its place)
  say(msg, t('saved'), 'ok');
  fades.set(msg, setTimeout(() => msg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => say(msg, '')), 2500));
  try { await api('admin/settings', { method: 'PUT', body: patch }); }
  catch (err) { clearTimeout(fades.get(msg)); say(msg, err.message, 'error'); await settings(); }
}
$('#signup').addEventListener('change', (e) => save({ signup: e.target.value }, $('#settings-msg')));
for (const [k, sel] of Object.entries(NUMBERS)) $(sel).addEventListener('change', (e) => save({ [k]: +e.target.value }, $('#security-msg')));
$('#logout-all').addEventListener('click', async () => {
  if (!(await modal({ title: t('logoutAllTitle'), text: t('logoutAllText'), ok: t('logoutAllOk'), danger: true }))) return;
  try { await api('admin/logout-all', { method: 'POST' }); toast(t('loggedOutAll')); await info(); }
  catch (err) { say($('#security-msg'), err.message, 'error'); }
});

// ---------- invitations ----------
stepper($('#invite-days'));
const inviteLink = (code) => `${location.origin}/login?invite=${encodeURIComponent(code)}`;
async function invites() {
  const list = await api('admin/invites');
  await flip($('#invites'), () => {
    if (!list.length) return $('#invites').replaceChildren(h('tr', { 'data-key': 'none' }, h('td', { class: 'muted small' }, t('noInvites'))));
    $('#invites').replaceChildren(...list.map((i) => {
      const tr = h('tr', { 'data-key': i.code },
        h('td', {}, h('code', {}, i.code)),
        h('td', { class: 'muted small' }, i.used_by ? t('usedBy', { name: i.used_by }) : i.expires_at ? t('expires', { date: date(i.expires_at) }) : t('noExpiry')),
        h('td', {}, h('div', { class: 'row' },
          i.used_by ? null : h('button', { type: 'button', class: 'btn small', onclick: async () => { await navigator.clipboard?.writeText(inviteLink(i.code)); toast(t('copiedLink')); } }, t('copy')),
          h('button', { type: 'button', class: 'btn small danger', onclick: () => api(`admin/invites/${encodeURIComponent(i.code)}`, { method: 'DELETE' }).then(() => leave(tr)).then(invites) }, t('remove')))));
      return tr;
    }));
  });
}
$('#invite-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = $('#invite-days').value ? +$('#invite-days').value : null;
  await api('admin/invites', { method: 'POST', body: { days: d } });
  await invites();
});

// ---------- the server ----------
const ANYWHERE = ['0.0.0.0/0', '::/0'];
const addresses = (list) => list.every((x) => ANYWHERE.includes(x)) ? t('anywhere') : h('code', {}, list.join(', '));
async function info() {
  const i = await api('admin/info');
  const d = i.dashboard;
  const rows = [
    ['version', i.version], ['database', bytes(i.db_bytes)],
    // (where the database is; changed only on the server's own computer)
    // (a backup: a copy of it, downloaded, from anywhere; moving it: on the server's computer only)
    ['dbLocation', h('span', { class: 'db-where' }, h('code', { id: 'db-where' }, i.db_path),
      i.here ? h('button', { type: 'button', class: 'btn small', id: 'db-change', onclick: openMove }, t('dbChange')) : null,
      h('a', { class: 'btn small', href: '/api/admin/backup', download: '', title: t('backup') }, t('backupShort')),
      i.here ? null : h('span', { class: 'muted small' }, t('dbOnlyHere')))],
    // (where it comes from says itself: GitHub's address, or the folder's; a version only from GitHub)
    ['dashboardSrc', d.source === 'github'
      ? h('a', { href: 'https://github.com/nda111/tabcat/tree/pages', target: '_blank', rel: 'noopener' }, h('code', {}, 'github.com/nda111/tabcat (pages)'))
      : h('code', {}, d.folder)],
    d.version && ['dashVersion', `${(d.version.commit || '').slice(0, 7)} · ${date(d.version.updated_at)}`],
  ].filter(Boolean);
  const dl = (el, rows) => el.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, t(k)), h('dd', {}, v)]));
  dl($('#info'), rows);
  dl($('#sessions'), [['activeSessions', t('sessionsCount', { n: i.sessions })]]);
  dl($('#startup'), [['setupFrom', addresses(i.setup_from)], ['adminFrom', addresses(i.admin_from)], ['trustedProxies', addresses(i.trusted_proxies)]]);
  $('#update').hidden = d.source !== 'github';
}
// ---------- moving the database ----------
// "Change…": the operating system's Save dialog, on the server's computer (where this page is: see the server);
// chosen, the database moves there. No dialog there (a server with no screen): a field to type the path in.
async function openMove() {
  const button = $('#db-change');
  button.disabled = true;
  button.classList.add('busy');
  try {
    const { path } = await api('admin/database/pick', { method: 'POST', body: { title: t('dbLocation') } });
    if (path) await moveTo(path);
  } catch (err) {
    if (err.status !== 501) { toast(err.message); return; }
    $('#db-path').value = $('#db-where').textContent;
    say($('#db-msg'), '');
    fold($('#db-move'), true).then(() => { $('#db-path').focus(); $('#db-path').select(); });
  } finally {
    const b = $('#db-change'); // (drawn again if it moved)
    if (b) { b.disabled = false; b.classList.remove('busy'); }
  }
}
async function moveTo(path) {
  await api('admin/database', { method: 'POST', body: { path } });
  await info();
  // (the new place fades in where the old one was)
  $('#db-where').animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  toast(t('dbMoved'));
}
$('#db-cancel').addEventListener('click', () => fold($('#db-move'), false));
$('#db-path').addEventListener('input', () => say($('#db-msg'), ''));
$('#db-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const still = (on) => { for (const el of $('#db-form').querySelectorAll('input, button')) el.disabled = on; };
  still(true);
  try {
    await api('admin/database', { method: 'POST', body: { path: $('#db-path').value } }); // (checked first: errors stay by the field)
    await fold($('#db-move'), false);
    await info();
    $('#db-where').animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    toast(t('dbMoved'));
  } catch (err) { say($('#db-msg'), err.message, 'error'); }
  still(false);
});

$('#update').addEventListener('click', async (e) => {
  e.target.disabled = true;
  say($('#info-msg'), t('working'));
  try { await api('admin/dashboard/update', { method: 'POST' }); say($('#info-msg'), t('updated'), 'ok'); await info(); }
  catch (err) { say($('#info-msg'), err.message, 'error'); }
  e.target.disabled = false;
});

// (shown once all of it's here: see reveal in pages.js)
try { await Promise.all([users(), settings(), invites(), info()]); } finally { await showPage(); }

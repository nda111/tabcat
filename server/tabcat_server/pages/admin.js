// The admin page: users, sign-up and invitations, security, the server and its dashboard
import { turnRows, appear, freshen, live, tint, $, api, bytes, date, deviceName, eventBad, eventDetail, eventLabel, flip, fold, h, modal, randomPassword, reveal as showPage, say, stepper, t, toast } from './pages.js';

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
let adminCount = 0;
let shownUsers = '';
async function users() {
  // (you first, then the other admins, then everyone else, each as they were made)
  const rank = (u) => (u.id === me.id ? 0 : u.admin ? 1 : 2);
  const list = (await api('admin/users')).sort((a, b) => rank(a) - rank(b));
  adminCount = list.filter((u) => u.admin).length;
  // (the same as shown: nothing redrawn. Told twice of one change, a redraw would cut short what's moving)
  const seen = JSON.stringify([list, [...newPasswords]]);
  if (seen === shownUsers) return;
  shownUsers = seen;
  // (gone since, another admin's doing say: they fade aside first, the rest gliding up after)
  const ids = new Set(list.map((u) => String(u.id)));
  await Promise.all([...$('#users').children].filter((tr) => !ids.has(tr.dataset.key)).map((tr) => leave(tr)));
  // (each row's cells as they read before: what reads otherwise now comes in, see below; and where each part of
  // them stood, from the row's top, and as left as it was: a name longer or shorter moves what's after it, which
  // slides there rather than jumping)
  const read = (tr) => [...tr.cells].map((td) => td.textContent + '|' + td.querySelectorAll('button, .tag').length + '|' + [...td.querySelectorAll('img, [data-tint]')].map((x) => x.src || x.style.cssText + x.dataset.tint).join());
  const spot = (tr) => { const top = tr.getBoundingClientRect().top;
    return new Map([...tr.querySelectorAll('[data-f]')].map((el) => { const r = el.getBoundingClientRect(); return [el.dataset.f, { el, left: r.left, top: r.top - top }]; })); };
  // (the column heads too: a column wider or narrower, the heads after it slide with it)
  const heads = [...$('#users').closest('table').tHead.querySelectorAll('th > span')], headsAt = heads.map((el) => el.getBoundingClientRect().left);
  const olds = [...$('#users').children];
  const before = new Map(olds.map((tr) => [tr.dataset.key, read(tr)]));
  const spots = new Map(olds.map((tr) => [tr.dataset.key, spot(tr)]));
  await flip($('#users'), () => $('#users').replaceChildren(...list.map(row)));
  heads.forEach((el, i) => {
    const dx = headsAt[i] - el.getBoundingClientRect().left;
    if (Math.abs(dx) > .5) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 300, easing: GLIDE });
  });
  for (const tr of $('#users').children) {
    const old = before.get(tr.dataset.key), now = read(tr), was = spots.get(tr.dataset.key);
    if (!old) continue;
    const top = tr.getBoundingClientRect().top;
    for (const el of tr.querySelectorAll('[data-f]')) {
      const w = was.get(el.dataset.f);
      if (!w) { if (el.matches('.tag')) el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: SPRING }); continue; } // (a chip new: it pops in)
      const dx = w.left - el.getBoundingClientRect().left;
      if (Math.abs(dx) > .5) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 300, easing: GLIDE });
      // (the name itself changed, or when last seen: the old fades out where it was as the new fades in; the username
      // beside it only slides)
      if (['name', 'seen'].includes(el.dataset.f) && w.el.textContent !== el.textContent) { ghost(w, el, top); el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-in-out' }); }
    }
    for (const [f, w] of was) if (!tr.querySelector(`[data-f="${f}"]`) && w.el.matches('.tag:not(.ghost)')) ghost(w, tr.cells[1], top); // (a chip gone: it fades where it was)
    // (a button come or gone, a new photo: not the name, the chips, last seen, done above, nor the role, suspending, a
    // new password, done below)
    now.forEach((x, i) => {
      if (x === old[i] || [1, 2, 3, 4, 5].includes(i)) return;
      if (i === 0) tr.cells[0].firstChild?.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: SPRING }); // (a new photo, or colour: it springs in)
      else [...tr.cells[i].children].forEach(freshen);
    });
  }
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
// What was there, fading where it stood, over the row now (in the cell given, from the row's top as it was)
function ghost(w, el, top) {
  const td = el.closest('td'), r = td.getBoundingClientRect(), g = w.el.cloneNode(true);
  g.removeAttribute('data-f');
  Object.assign(g.style, { position: 'absolute', margin: '0', pointerEvents: 'none', whiteSpace: 'nowrap', left: `${w.left - r.left}px`, top: `${w.top - (r.top - top)}px` });
  td.append(g);
  g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-in-out', fill: 'forwards' }).finished.then(() => g.remove(), () => g.remove());
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
    onclick: async () => {
      if (u.admin === admin) return;
      if (!(self && !admin)) return edit({ admin });
      // (the only admin: it can't be done, said at once, not asked first and refused after)
      if (adminCount <= 1) return fail(new Error(t('errLastAdmin')));
      // (yourself to a user: the username typed out first; then this page isn't yours any more, so your account's)
      if (!(await modal({ title: t('selfDemoteTitle'), text: t('selfDemoteText', { name: u.username }), input: u.username, ok: t('selfDemoteOk'), danger: true }))) return;
      try { await api(`admin/users/${u.id}`, { method: 'PATCH', body: { admin: false } }); location.assign('/account'); }
      catch (e) { fail(e); }
    } }, t(label));
  const pill = h('span', { class: `seg-pill${u.admin ? '' : ' second'}`, 'aria-hidden': 'true' });
  // (always there, hidden unless suspended: the columns beside it don't move as it comes and goes)
  const chipEl = h('span', { class: `tag off${u.disabled ? '' : ' ghost'}`, 'aria-hidden': String(!u.disabled), 'data-f': 'off' }, t('off'));
  const suspend = self ? null : h('button', { type: 'button', class: `btn small swap${u.disabled ? ' second' : ''}`, 'data-f': 'suspend', onclick: () => edit({ disabled: !u.disabled }) },
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
    // (the profile photo, or the name's first letter in the account's own colour)
    h('td', { class: 'pic' }, tint(h('span', { class: 'avatar', 'aria-hidden': 'true' }, u.avatar ? h('img', { src: u.avatar, alt: '' }) : [...u.username][0].toUpperCase()), u.accent)),
    // (the name to go by, if any, then the username, smaller)
    h('td', { class: 'user' }, h('span', { class: 'who' }, h('b', { 'data-f': 'name' }, u.name || u.username), u.name ? h('span', { class: 'muted small', 'data-f': 'uname' }, ` ${u.username}`) : null,
      self ? h('span', { class: 'muted small', 'data-f': 'you' }, ` (${t('you')})`) : null), chipEl,
      // (two-step sign-in on: a blue chip by the name)
      u.twofa ? h('span', { class: 'tag twofa', 'data-f': 'twofa' }, t('twofaTag')) : null),
    h('td', { class: 'hide-narrow muted small' }, h('span', { 'data-f': 'seen' }, date(u.last_seen))),
    h('td', { class: 'act' }, suspend),
    h('td', { class: 'act' }, h('span', { class: 'seg', role: 'group', 'data-f': 'role' }, pill, role(true, 'admin'), role(false, 'member'))),
    h('td', { class: 'act' }, self ? null : h('span', { class: `pw-slot${pw ? ' second' : ''}`, 'data-f': 'pw' }, reset, newpw)),
    // (turning someone's 2FA off, locked out of it: a plain warning first; not your own, that's on your account page)
    h('td', { class: 'act' }, u.twofa && !self ? h('button', { type: 'button', class: 'btn small', 'data-f': 'twofaReset', onclick: async () => {
      if (!(await modal({ title: t('twofaReset', { name: u.name || u.username }), text: t('twofaResetText'), ok: t('twofaResetOk'), danger: true }))) return;
      edit({ twofa: false });
    } }, t('twofaResetOk')) : null),
    h('td', { class: 'act' }, self ? null : h('button', { type: 'button', class: 'btn small danger', 'data-f': 'del', onclick: async () => {
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
const NUMBERS = { session_days: '#session-days', login_tries: '#login-tries', login_lock_minutes: '#login-lock', log_days: '#log-days' };
const steppers = {
  session_days: stepper($('#session-days'), { zero: t('sessionOff') }),
  login_tries: stepper($('#login-tries')),
  login_lock_minutes: stepper($('#login-lock')),
  log_days: stepper($('#log-days')),
};
// (changed elsewhere, by another admin: the new choice springs in, a number rises in; not one being typed in)
let settingsShown = false;
async function settings() {
  const s = await api('admin/settings');
  const shown = settingsShown;
  settingsShown = true;
  dashAuto = s.dashboard_auto;
  if ($('#dash-auto')) $('#dash-auto').checked = dashAuto;
  for (const r of document.querySelectorAll('input[name=signup]')) {
    const on = r.value === s.signup;
    if (r.checked === on) continue;
    r.checked = on;
    if (shown && on) {
      r.animate([{ transform: 'scale(.6)' }, { transform: 'none' }], { duration: 340, easing: SPRING });
      freshen(r.nextElementSibling);
    }
  }
  for (const [k, sel] of Object.entries(NUMBERS)) {
    const input = $(sel);
    if (input.value === String(s[k]) || document.activeElement === input) continue;
    input.value = s[k];
    steppers[k].sync();
    if (shown) freshen(input.parentElement.classList.contains('zero') ? input.parentElement.querySelector('.step-zero') : input);
  }
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
    // (a newer release out: so marked; installed with pip, and here, it updates and starts again from here)
    ['version', h('span', { class: 'db-where' }, i.version, ...(i.release?.newer ? [
      h('span', { class: 'tag accent' }, t('newVersion', { version: i.release.latest })),
      i.release.install === 'pip' && i.here ? h('button', { type: 'button', class: 'btn small', id: 'server-update', onclick: updateServer }, t('updateRestart'))
        : h('span', { class: 'muted small' }, t(i.release.install === 'docker' ? 'updateDocker' : i.release.install === 'pip' ? 'dbOnlyHere' : 'updateCheckout')),
    ] : []))],
    ['database', bytes(i.db_bytes)],
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
    // (from GitHub: it can update by itself, once a day)
    d.source === 'github' && ['dashAuto', h('label', { class: 'check', style: 'margin:0' }, h('input', { type: 'checkbox', id: 'dash-auto', checked: dashAuto,
      onchange: (e) => { dashAuto = e.target.checked; save({ dashboard_auto: dashAuto }, $('#info-msg')); } }), h('span', {}, t('dashAutoText')))],
  ].filter(Boolean);
  const dl = (el, rows) => el.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, t(k)), h('dd', {}, v)]));
  dl($('#info'), rows);
  dl($('#sessions'), [['activeSessions', t('sessionsCount', { n: i.sessions })]]);
  dl($('#startup'), [['setupFrom', addresses(i.setup_from)], ['adminFrom', addresses(i.admin_from)], ['trustedProxies', addresses(i.trusted_proxies)]]);
  $('#update').hidden = d.source !== 'github';
}
// ---------- updating the server ----------
let dashAuto = true;
async function updateServer() {
  if (!(await modal({ title: t('updateRestart'), text: t('updateRestartText'), ok: t('updateRestart') }))) return;
  const b = $('#server-update');
  b.disabled = true; b.classList.add('busy');
  try {
    const { version } = await api('admin/server/update', { method: 'POST' });
    toast(t('restarting', { version }));
    // (it starts again: once it answers with the new version, this page loads again)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const v = await fetch('/api/server', { cache: 'no-store' }).then((r) => r.json(), () => null);
      if (v?.version && `v${v.version}` === version) return location.reload();
    }
    location.reload();
  } catch (err) { toast(err.message); b.disabled = false; b.classList.remove('busy'); }
}

// ---------- the security record ----------
// Newest first: when, what (a failure in red), whose, from where (and the admin who did it); one account's, or
// everyone's; a page of them at a time (‹ › or a page's number typed). Failures in the last day, by address, over it.
const PER_PAGE = 15;
let evPage = 1;
function eventRow(e) {
  // (no account: a sign-in tried with a username that's no one's, a dash; an account gone since: its username, no
  // type nor name)
  const none = () => h('span', { class: 'muted no-account' }, t('evNoAccount'));
  return h('div', { class: `event${eventBad(e) ? ' bad' : ''}`, 'data-key': e.id },
    h('span', { class: 'ev-when muted small' }, date(e.at)),
    h('span', { class: 'ev-what' }, eventLabel(e), eventDetail(e) ? h('span', { class: 'muted small' }, ` · ${eventDetail(e)}`) : null, e.actor ? h('span', { class: 'muted small' }, ` · ${t('byAdmin', { name: e.actor })}`) : null),
    h('span', { class: 'ev-id' }, e.username || none()),
    h('span', { class: 'ev-role muted small' }, e.admin == null ? '' : t(e.admin ? 'admin' : 'member')),
    h('span', { class: 'ev-name' }, e.name || ''),
    h('span', { class: 'ev-ip muted small' }, e.ip || ''),
    h('span', { class: 'ev-browser muted small' }, (e.agent && deviceName(e.agent)) || ''));
}
// `to`: another page (its rows slide in from the side it's on); none: this one again, as it now is
async function events(to = null) {
  const page = Math.max(1, to ?? evPage);
  const q = new URLSearchParams({ limit: String(PER_PAGE), offset: String((page - 1) * PER_PAGE) });
  if ($('#ev-user').value) q.set('user', $('#ev-user').value);
  const r = await api(`admin/events?${q}`);
  const pages = Math.max(1, Math.ceil(r.total / PER_PAGE));
  if (page > pages && r.total) return events(pages); // (fewer now: the last there is)
  const dir = Math.sign(page - evPage);
  evPage = page;
  const list = $('#events');
  const rows = r.events.length ? r.events.map(eventRow) : [h('p', { class: 'muted small', 'data-key': 'none' }, t('eventsNone'))];
  if (!dir) await flip(list, () => list.replaceChildren(...rows));
  else {
    // (another page: each row's place turns over, the old going up and out as the new comes in from below; going
    // back, the other way. The box glides to its height.)
    turnRows(list, rows, dir);
  }
  $('#ev-fails').replaceChildren(...(r.failures_24h.length ? [h('p', { class: 'small ev-fails' }, h('b', {}, t('fails24h')), ' ',
    ...r.failures_24h.map((f) => h('span', { class: 'tag off' }, t('failsAt', { ip: f.ip || '?', n: f.count }))))] : []));
  // (nothing kept for the account chosen, or anyone: nothing to export; the button fades still, and back)
  if (!$('#ev-export').classList.contains('busy')) $('#ev-export').disabled = !r.total;
  $('#ev-cols').hidden = !r.events.length; // (the column heads: over rows only)
  // the pages: shown once there's more than one
  const input = $('#ev-page');
  if (document.activeElement !== input) input.value = page;
  input.max = pages;
  if ($('#ev-pages').textContent !== String(pages)) {
    $('#ev-pages').textContent = pages;
    if (!$('#ev-pager').hidden) $('#ev-pages').animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: GLIDE });
  }
  input.style.width = `${String(pages).length + 3.2}ch`;
  $('#ev-prev').disabled = page <= 1;
  $('#ev-next').disabled = page >= pages;
  const pager = $('#ev-pager');
  if (pager.hidden !== (pages <= 1)) appear(pager, pages > 1); // (beside the failures: it grows in sideways)
}
$('#ev-prev').addEventListener('click', () => events(evPage - 1));
$('#ev-next').addEventListener('click', () => events(evPage + 1));
// (a page's number: gone to on Enter, or leaving the field; past the last, the last)
const goPage = () => {
  const input = $('#ev-page'), n = Math.round(+input.value);
  if (!input.value || !Number.isFinite(n)) { input.value = evPage; return; }
  const to = Math.min(Math.max(1, n), +input.max || 1);
  input.value = to;
  if (to !== evPage) events(to);
};
$('#ev-page').addEventListener('change', goPage);
$('#ev-page').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goPage(); e.target.select(); } });
$('#ev-page').addEventListener('focus', (e) => e.target.select());
$('#ev-user').addEventListener('change', (e) => {
  // (the chosen one fades in over the field, as the record below changes to it)
  e.target.animate([{ color: 'transparent' }, { color: getComputedStyle(e.target).color }], { duration: 220, easing: 'ease-out' });
  evPage = 1; events();
});
// Export: the record kept (for the account chosen, or everyone), as a CSV file in the page's language. Excel
// reads it as UTF-8 (the byte-order mark); a cell starting like a formula is kept as text (it may hold what a
// stranger typed, as a username)
async function exportEvents() {
  const b = $('#ev-export');
  b.disabled = true; b.classList.add('busy');
  try {
    const all = [];
    for (let before = null; ;) {
      const q = new URLSearchParams({ limit: '200' });
      if ($('#ev-user').value) q.set('user', $('#ev-user').value);
      if (before) q.set('before', before);
      const { events: page } = await api(`admin/events?${q}`);
      all.push(...page);
      if (page.length < 200) break;
      before = page[page.length - 1].id;
    }
    const cell = (v) => {
      let x = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(x)) x = `'${x}`;
      return /[",\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
    };
    // (beside what happened in words, its code and the detail as kept: the same in any language; see the server's README)
    const head = ['csvWhen', 'csvAccount', 'csvTried', 'csvWhat', 'csvCode', 'csvDetail', 'csvDetailCode', 'csvIp', 'csvDevice', 'csvAgent', 'csvAdmin'].map((k) => t(k));
    const iso = (s) => { const d = new Date(s * 1000), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
    const rows = all.map((e) => [iso(e.at), e.username || t('evNoAccount'), e.tried || '', eventLabel(e), e.kind, eventDetail(e), e.detail, e.ip, e.agent && deviceName(e.agent), e.agent, e.actor].map(cell).join(','));
    const blob = new Blob(['\ufeff' + [head.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const day = new Date().toISOString().slice(0, 10);
    const a = h('a', { href: URL.createObjectURL(blob), download: `tabcat-security-${day}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(t('eventsExported', { n: all.length }));
  } catch (err) { toast(err.message); }
  b.classList.remove('busy'); b.disabled = !$('#events .event');
}
$('#ev-export').addEventListener('click', exportEvents);

async function eventAccounts() {
  const list = await api('admin/users');
  const keep = $('#ev-user').value;
  // (the same as shown: left as it is; a name changed, an account added or gone: the list as it now is)
  const shown = [...$('#ev-user').options].slice(1).map((o) => `${o.value}|${o.textContent}`).join();
  if (shown && shown === list.map((u) => `${u.id}|${u.name ? `${u.name} (${u.username})` : u.username}`).join()) return;
  $('#ev-user').replaceChildren(h('option', { value: '' }, t('eventsAll')), ...list.map((u) => h('option', { value: u.id }, u.name ? `${u.name} (${u.username})` : u.username)));
  $('#ev-user').value = keep;
}

// ---------- Tailscale ----------
// On the server's computer: there or not, signed in or not; its name and addresses; serving this server at its
// HTTPS address (a switch, on that computer only)
$('#ts-info').replaceChildren(h('b', {}, t('tsInfoTitle')), h('ul', {}, ...['tsInfo1', 'tsInfo2', 'tsInfo3'].map((k) => h('li', {}, t(k)))));
async function tailscaleView(ts, fade = false) {
  ts ||= await api('admin/tailscale').catch(() => null);
  const box = $('#tailscale');
  // (Refresh: still, breathing, until the computer answers; then the box is drawn again, Refresh back)
  const again = () => h('button', { type: 'button', class: 'btn small', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; b.classList.add('busy'); await tailscaleView(null, true); } }, t('tsRefresh'));
  const linked = (key, url, label) => { const [before, after] = t(key, { link: '{link}' }).split('{link}'); return [before, h('a', { href: url, target: '_blank', rel: 'noopener' }, label), after]; };
  // what it shows, each part keyed: a change animates only the parts that come or go (see below)
  let parts;
  if (!ts?.installed) {
    parts = [h('div', { class: 'ts-state', 'data-k': 'none' }, h('p', { class: 'muted small' }, t('tsNone'), ' ', ...linked('tsDownload', 'https://tailscale.com/download', t('tsOfficial'))), again())];
  } else if (ts.state !== 'Running') {
    parts = [h('div', { class: 'ts-state', 'data-k': 'state' }, h('p', { class: 'muted small' }, t(ts.state === 'NeedsLogin' ? 'tsSignedOut' : 'tsStopped')), again())];
  } else {
    // (HTTPS off for the tailnet: no address to give, nothing to switch; only how to turn it on)
    const httpsOk = ts.https || ts.serving;
    const https = h('dd', { class: 'crossfade', 'data-k': 'https' });
    const showHttps = (serving, url, cross = false) => {
      const next = serving ? h('a', { href: url, target: '_blank', rel: 'noopener' }, h('code', {}, url)) : h('span', { class: 'muted' }, t('tsOff'));
      const old = https.firstElementChild;
      https.append(next);
      if (!cross || !old) { old?.remove(); return; }
      const ease = { duration: 240, easing: 'ease-in-out' };
      next.animate([{ opacity: 0 }, { opacity: 1 }], ease);
      old.animate([{ opacity: 1 }, { opacity: 0 }], { ...ease, fill: 'forwards' }).finished.then(() => old.remove());
    };
    showHttps(ts.serving, ts.url);
    const sw = h('input', { type: 'checkbox', class: 'switch', id: 'ts-serve', checked: ts.serving, disabled: !ts.here });
    sw.addEventListener('change', async () => {
      sw.classList.add('waiting');
      try {
        const next = await api('admin/tailscale/serve', { method: 'POST', body: { on: sw.checked } });
        sw.checked = next.serving;
        showHttps(next.serving, next.url || ts.url, true);
        toast(t(next.serving ? 'tsServing' : 'tsNotServing'));
      } catch (err) {
        sw.checked = !sw.checked;
        // (not allowed by the tailnet after all, its HTTPS off: the address and the switch go, how to turn it on comes)
        if (err.data?.enable?.includes('/admin/dns')) return tailscaleView({ ...ts, https: false, serving: false }, true);
        if (err.data?.enable) toast(t('tsEnableHow', { link: err.data.enable }));
        else toast(err.message);
      }
      sw.classList.remove('waiting');
    });
    parts = [
      h('dl', { 'data-k': 'dl' },
        h('dt', {}, t('tsDevice')), h('dd', {}, h('code', {}, ts.name || '—')),
        h('dt', {}, t('tsAddress')), h('dd', {}, h('code', {}, (ts.ips || []).join(', ') || '—')),
        ...(httpsOk ? [h('dt', { 'data-k': 'https-label' }, t('tsHttps')), https] : [])),
      ...(httpsOk ? [h('label', { class: 'check', 'data-k': 'switch' }, sw, h('span', {}, t('tsServe')))]
        : [h('div', { class: 'ts-state ts-note', 'data-k': 'note' }, h('p', { class: 'small' }, h('b', {}, t('tsHttpsOff')), ' ',
          ...linked('tsHttpsHow', 'https://login.tailscale.com/admin/dns', t('tsAdminDns'))), again())]),
      ...(ts.here ? [] : [h('p', { class: 'muted small', 'data-k': 'here' }, t('dbOnlyHere'))]),
    ];
  }
  // Only what comes or goes moves: the parts going fade out where they are, the box glides to its new height,
  // the parts coming fade in; the rest stays as it was (drawn again the same)
  const keys = (els) => new Set(els.flatMap((el) => [el, ...el.querySelectorAll('[data-k]')]).map((el) => el.dataset?.k).filter(Boolean));
  const before = keys([...box.children]), after = keys(parts);
  if (fade) await Promise.all([...box.querySelectorAll('[data-k]')].filter((el) => !after.has(el.dataset.k))
    .map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished));
  const from = box.offsetHeight;
  box.replaceChildren(...parts);
  if (!fade) return;
  if (Math.abs(box.offsetHeight - from) > .5) box.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${box.offsetHeight}px`, overflow: 'hidden' }], { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  for (const el of box.querySelectorAll('[data-k]')) {
    if (!before.has(el.dataset.k)) el.animate([{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 80, easing: 'ease-out', fill: 'backwards' });
  }
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
try { await Promise.all([users(), settings(), invites(), info(), eventAccounts().then(() => events())]); } finally { await showPage(); }
// Kept up to date while it's looked at: every few seconds, and on coming back to it; not while a dialog's open
// or something's being typed (what changed moves as it does when done here)
// (live: told at once by the server, see live in pages.js; held off meanwhile: once that's over)
let refreshing = false, missed = null;
async function refresh() {
  if (document.hidden) return; // (on coming back: see below)
  if (refreshing || document.querySelector('dialog.modal') || document.activeElement?.matches('input:not([type=radio], [type=checkbox]), textarea')) {
    clearTimeout(missed); missed = setTimeout(refresh, 1000); return;
  }
  clearTimeout(missed);
  refreshing = true;
  // (the record: the page open, as it now is)
  try { await Promise.all([users(), settings(), invites(), info(), eventAccounts().then(() => events())]); } catch { /* (the server away for a moment: next time) */ }
  refreshing = false;
}
setInterval(refresh, 60000); // (and now and then anyway)
// (this admin no longer one, or signed out, meanwhile: their own page, or signing in)
live({ admin: refresh, me: async () => { if (!(await api('me')).admin) location.replace('/account'); } });
addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
tailscaleView(); // (after: asking the computer takes a moment)

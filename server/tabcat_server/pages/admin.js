// The admin page: users, sign-up and invitations, the server and its dashboard
import { $, api, bytes, date, flip, h, modal, randomPassword, say, stepper, t } from './pages.js';

const me = await api('me');
const newPasswords = new Map(); // (a user's new password, shown in place of its button until the page loads again)

// ---------- users ----------
async function users() {
  const list = await api('admin/users');
  await flip($('#users'), () => $('#users').replaceChildren(...list.map(row)));
}
function row(u) {
  const self = u.id === me.id;
  const fail = (e) => say($('#users-msg'), e.message, 'error');
  const edit = (patch) => api(`admin/users/${u.id}`, { method: 'PATCH', body: patch }).then(() => { say($('#users-msg'), ''); return users(); }, fail);
  const role = (admin, label) => h('button', { type: 'button', class: u.admin === admin ? 'on' : '', 'aria-pressed': String(u.admin === admin),
    onclick: () => { if (u.admin !== admin) edit({ admin }); } }, t(label));
  // reset: a new random password, set at once, shown in place of the button (click: copied)
  const pw = newPasswords.get(u.id);
  const reset = pw
    ? h('button', { type: 'button', class: 'newpw', title: t('copy'), onclick: async (e) => { await navigator.clipboard?.writeText(pw); e.currentTarget.title = t('copied'); say($('#users-msg'), t('copied'), 'ok'); } }, pw)
    : h('button', { type: 'button', class: 'btn small', onclick: async () => {
      const fresh = randomPassword();
      const ok = await api(`admin/users/${u.id}`, { method: 'PATCH', body: { password: fresh } }).then(() => true, (e) => { fail(e); return false; });
      if (!ok) return;
      newPasswords.set(u.id, fresh);
      users();
    } }, t('resetPassword'));
  return h('tr', { 'data-key': u.id },
    h('td', {}, h('b', {}, u.username), self ? h('span', { class: 'muted small' }, ` (${t('you')})`) : null, ' ',
      u.disabled ? h('span', { class: 'tag off' }, t('off')) : null),
    h('td', { class: 'hide-narrow muted small' }, date(u.last_seen)),
    h('td', {}, h('div', { class: 'row' },
      h('span', { class: 'seg', role: 'group' }, role(true, 'admin'), role(false, 'member')),
      self ? null : h('button', { type: 'button', class: 'btn small', onclick: () => edit({ disabled: !u.disabled }) }, t(u.disabled ? 'turnOn' : 'turnOff')),
      reset,
      self ? null : h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
        if (!(await modal({ title: t('confirmDeleteTitle', { name: u.username }), text: t('confirmDelete', { name: u.username }), ok: t('remove'), danger: true }))) return;
        await api(`admin/users/${u.id}`, { method: 'DELETE' }).then(users, fail);
      } }, t('remove')))));
}
$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('admin/users', { method: 'POST', body: { username: $('#add-name').value.trim(), password: $('#add-pw').value, admin: $('#add-admin').checked } });
    e.target.reset();
    say($('#users-msg'), '');
    await users();
  } catch (err) { say($('#users-msg'), err.message, 'error'); }
});

// ---------- sign-up ----------
const days = stepper($('#session-days'));
async function settings() {
  const s = await api('admin/settings');
  for (const r of document.querySelectorAll('input[name=signup]')) r.checked = r.value === s.signup;
  $('#session-days').value = s.session_days;
  days.sync();
}
async function save(patch) {
  try {
    await api('admin/settings', { method: 'PUT', body: patch });
    say($('#settings-msg'), t('saved'), 'ok');
  } catch (err) { say($('#settings-msg'), err.message, 'error'); await settings(); }
}
$('#signup').addEventListener('change', (e) => save({ signup: e.target.value }));
$('#session-days').addEventListener('change', (e) => save({ session_days: +e.target.value }));

// ---------- invitations ----------
stepper($('#invite-days'));
const inviteLink = (code) => `${location.origin}/login?invite=${encodeURIComponent(code)}`;
async function invites() {
  const list = await api('admin/invites');
  await flip($('#invites'), () => {
    if (!list.length) return $('#invites').replaceChildren(h('tr', { 'data-key': 'none' }, h('td', { class: 'muted small' }, t('noInvites'))));
    $('#invites').replaceChildren(...list.map((i) => h('tr', { 'data-key': i.code },
      h('td', {}, h('code', {}, i.code)),
      h('td', { class: 'muted small' }, i.used_by ? t('usedBy', { name: i.used_by }) : i.expires_at ? t('expires', { date: date(i.expires_at) }) : t('noExpiry')),
      h('td', {}, h('div', { class: 'row' },
        i.used_by ? null : h('button', { type: 'button', class: 'btn small', onclick: async (e) => { await navigator.clipboard?.writeText(inviteLink(i.code)); e.currentTarget.textContent = t('copied'); } }, t('copy')),
        h('button', { type: 'button', class: 'btn small danger', onclick: () => api(`admin/invites/${encodeURIComponent(i.code)}`, { method: 'DELETE' }).then(invites) }, t('remove')))))));
  });
}
$('#invite-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = $('#invite-days').value ? +$('#invite-days').value : null;
  await api('admin/invites', { method: 'POST', body: { days: d } });
  await invites();
});

// ---------- the server ----------
async function info() {
  const i = await api('admin/info');
  const d = i.dashboard;
  const rows = [
    ['version', i.version], ['dataFolder', h('code', {}, i.data_dir)], ['database', bytes(i.db_bytes)],
    ['dashboardSrc', d.source === 'github' ? t('fromGitHub') : t('fromFolder', { folder: d.folder })],
    ['dashVersion', d.version ? `${(d.version.commit || '').slice(0, 7)} · ${date(d.version.updated_at)}` : '—'],
  ];
  $('#info').replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, t(k)), h('dd', {}, v)]));
  $('#update').hidden = d.source !== 'github';
}
$('#update').addEventListener('click', async (e) => {
  e.target.disabled = true;
  say($('#info-msg'), t('working'));
  try { await api('admin/dashboard/update', { method: 'POST' }); say($('#info-msg'), t('updated'), 'ok'); await info(); }
  catch (err) { say($('#info-msg'), err.message, 'error'); }
  e.target.disabled = false;
});

await Promise.all([users(), settings(), invites(), info()]);

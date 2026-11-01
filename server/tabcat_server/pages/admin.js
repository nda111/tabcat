// The admin page: users, sign-up and invitations, the server and its dashboard
import { $, api, bytes, date, h, say, t } from './pages.js';

const me = await api('me');

// ---------- users ----------
async function users() {
  const list = await api('admin/users');
  $('#users').replaceChildren(...list.map((u) => {
    const act = (label, fn, cls = '') => h('button', { type: 'button', class: `btn small ${cls}`, onclick: () => fn().catch((e) => say($('#users-msg'), e.message, 'error')) }, t(label));
    const edit = (patch) => api(`admin/users/${u.id}`, { method: 'PATCH', body: patch }).then(users);
    const self = u.id === me.id;
    return h('tr', {},
      h('td', {}, h('b', {}, u.username), self ? h('span', { class: 'muted small' }, ` (${t('you')})`) : null),
      h('td', {}, h('span', { class: `tag ${u.admin ? 'accent' : ''}` }, t(u.admin ? 'admin' : 'member')), ' ', u.disabled ? h('span', { class: 'tag off' }, t('off')) : null),
      h('td', { class: 'hide-narrow muted small' }, date(u.last_seen)),
      h('td', {}, h('div', { class: 'row' },
        act(u.admin ? 'removeAdmin' : 'makeAdmin', () => edit({ admin: !u.admin })),
        self ? null : act(u.disabled ? 'turnOn' : 'turnOff', () => edit({ disabled: !u.disabled })),
        act('resetPassword', async () => {
          const pw = prompt(t('newPasswordFor', { name: u.username }));
          if (pw) await edit({ password: pw });
        }),
        self ? null : act('remove', async () => {
          if (confirm(t('confirmDelete', { name: u.username }))) await api(`admin/users/${u.id}`, { method: 'DELETE' }).then(users);
        }, 'danger'))));
  }));
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
async function settings() {
  const s = await api('admin/settings');
  for (const r of document.querySelectorAll('input[name=signup]')) r.checked = r.value === s.signup;
  $('#session-days').value = s.session_days;
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
const inviteLink = (code) => `${location.origin}/login?invite=${encodeURIComponent(code)}`;
async function invites() {
  const list = await api('admin/invites');
  if (!list.length) return $('#invites').replaceChildren(h('tr', {}, h('td', { class: 'muted small' }, t('noInvites'))));
  $('#invites').replaceChildren(...list.map((i) => h('tr', {},
    h('td', {}, h('code', {}, i.code)),
    h('td', { class: 'muted small' }, i.used_by ? t('usedBy', { name: i.used_by }) : i.expires_at ? t('expires', { date: date(i.expires_at) }) : t('noExpiry')),
    h('td', {}, h('div', { class: 'row' },
      i.used_by ? null : h('button', { type: 'button', class: 'btn small', onclick: async (e) => { await navigator.clipboard.writeText(inviteLink(i.code)); e.target.textContent = t('copied'); } }, t('copy')),
      h('button', { type: 'button', class: 'btn small danger', onclick: () => api(`admin/invites/${encodeURIComponent(i.code)}`, { method: 'DELETE' }).then(invites) }, t('remove')))))));
}
$('#invite-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const days = $('#invite-days').value ? +$('#invite-days').value : null;
  await api('admin/invites', { method: 'POST', body: { days } });
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

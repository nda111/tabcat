# tabcat server API

The HTTP API of the tabcat server (`server/tabcat_server/`), for people writing their own client or scripts
against it. The extension (sync, open tabs) and the dashboard (accounts, shares, mail) are its main clients,
along with the server's own sign-in, account and admin pages. Everything here is read from
`server/tabcat_server/app.py`; `server/tests/test_api.py` exercises most of it.

## Basics

- **Base path**: `/api`. Requests and answers are JSON (`Content-Type: application/json` on any request with a
  body, else `415 JSON expected`). An unknown path, or a method a path doesn't take, answers
  `404 {"detail": "no such API"}`.
- **Answers** are gzipped when over 1 KB and the client accepts gzip. Every answer carries
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: same-origin`.
- **Errors**: `{"detail": "<what went wrong>"}` with the status code. Common ones:

  | Status | When |
  |---|---|
  | 400 | bad input (`bad JSON`, `bad gzip`, `bad content-length`, a field out of range) |
  | 401 | `not signed in` (or a wrong password / code when signing in) |
  | 403 | not allowed: `admins only`, not from an allowed address, wrong current password, `not from another site` |
  | 404 | no such thing (or not one you can see) |
  | 409 | conflicts with the current state (taken, last admin, already done...) |
  | 413 | `too large` |
  | 415 | `JSON expected` |
  | 429 | rate limit or sign-in throttle, `too many ...` |
  | 500 | `something went wrong on the server` (details only in the server's log) |
  | 501, 502 | the server computer has no file dialog; GitHub, pip or Tailscale failed |

### Signing in and the cookies

Auth is by session cookie, set by the sign-in calls (`/api/setup`, `/api/login`, `/api/login/code`); a script
needs a cookie jar. All cookies are `HttpOnly`, `SameSite=Lax`, path `/`, `Secure` when the request came over
HTTPS (or `X-Forwarded-Proto: https`).

| Cookie | Holds |
|---|---|
| `tabcat_session` | the session token of the account **in use** |
| `tabcat_more` | the tokens of the browser's **other** signed-in accounts, comma-separated |
| `tabcat_keep` | `1` / `0`: "stay signed in" as last asked. With `0`, or the server's `session_days` 0, cookies last until the browser closes |

- A browser holds up to **5 accounts** at once (`max` in `/api/accounts`). Signing in again adds an account (the
  one in use joins the others; past the limit the oldest is signed out); `/api/accounts/switch` swaps one in;
  signing out ends the one in use and the next takes over.
- "Signed in" below means a valid `tabcat_session` for an account that isn't suspended. If that session has
  ended but another account in `tabcat_more` is still signed in, `GET /api/me` (and the pages) switches to it.
- The server stores only a SHA-256 of each token. Sessions last `session_days` (admin setting), or one day when
  "stay signed in" was off.
- **`X-Tabcat-Account`** (the sync calls marked so below): the account's `space` (its data key, from
  `GET /api/me`). If sent and it doesn't match the signed-in account: `409 another account is signed in`, so one
  account's data never goes into another's. Left out, no check is made.

### Guards

- **Cross-site changes refused**: any non-`GET`/`HEAD`/`OPTIONS` request to `/api/` whose `Sec-Fetch-Site` is
  `cross-site` or `same-site` gets `403 not from another site`, unless its `Origin` starts with
  `chrome-extension://` or `moz-extension://`. Requests without `Sec-Fetch-Site` (scripts, curl) aren't affected.
- **Rate limit**: 240 `/api/` requests a minute per client address (all methods). Past it:
  `429 too many requests: wait a minute` with `Retry-After: 60` (logged as `rate_limited`). The client address is
  the connection's, or `X-Forwarded-For` from a trusted proxy (`--trusted-proxies`).
- **Sign-in throttle**: wrong passwords and codes from one address (sign-in, two-step code, current password on
  the account calls) count together; after `login_tries` of them within `login_lock_minutes` (admin settings),
  those calls answer `429 too many tries: wait a few minutes`.
- **Body size**: 64 KB, or 8 MB under `/api/sync/`. Checked against `Content-Length` (`413`) and again while
  reading. A body may be sent gzipped (`Content-Encoding: gzip`); the limit applies to the unpacked size.
- **Admins only**: `/api/admin/*` needs an admin account **and** a client address within `admin_from`
  (`--admin-from`, default anywhere): else `403 admins only` / `403 the admin page is not open to this address`.
- **Server computer only**: a few calls also need the address to be within `setup_from` (`--setup-from`,
  default this computer only): `/api/setup`, and the admin calls that change the computer (moving the database,
  its file dialog, updating the server, Tailscale serve). Else `403`.

### Shapes used below

**Account** (`public`, as the account itself and admins see it):

| Field | |
|---|---|
| `id` | number |
| `space` | the account's data key (see `X-Tabcat-Account`) |
| `username`, `name` | `name`: the name to go by, `""` if none |
| `admin`, `disabled`, `twofa` | booleans (`twofa`: two-step sign-in on) |
| `avatar` | `/api/users/<id>/avatar?v=<time>` or `null` |
| `accent` | the account's colour (from its synced look; `purple` by default) |
| `created_at`, `last_seen` | Unix seconds |

**Person** (an account as other accounts see it): `id`, `username`, `name`, `twofa`, `accent`, `avatar`.

**Security record entry**: `id`, `at`, `user_id`, `username`, `kind` (the event code), `ip`, `agent`, `actor`
(the admin's username, or `null`), `detail`, `tried` (the username tried on a failed sign-in), `category`
(`signin`, `account` or `admin`) and `result` (`ok`, `warn` or `bad`). Event and detail codes are listed in
[server/README.md, Security record codes](../server/README.md#security-record-codes).

Usernames: 2 to 14 letters, digits, `.`, `_`, `-`. Passwords: 8 to 256 characters. Names: up to 24 characters
(`400 the name is too long`), whitespace tidied.

## Server and setup

### `GET /api/server`
Anyone. What this server is: `{tabcat: true, version, signup, setup, keep}`. `signup` is `closed`, `invite` or
`open`; `setup` is true while there are no accounts yet; `keep` is true when "stay signed in" is possible
(`session_days` > 0).

### `GET /api/username?name=`
Anyone. `{valid, free}`: whether the username is well formed and not taken.

### `POST /api/setup`
Anyone, **server computer only**, and only while there are no accounts. Makes the first account, an admin,
and signs it in.

- Body: `{username, password, name?}`
- Answer: `{ok: true}` plus the session cookies
- Errors: `409 there are accounts already`, `403` not from `setup_from`, `400 bad username or password`

## Signing in, out, and the browser's accounts

### `POST /api/login`
Anyone (throttled).

- Body: `{username, password, keep?}`; `keep` ("stay signed in") is true unless `false`
- Answer: `{ok: true}` plus cookies; or, when the account has two-step sign-in on, `{need: "code", ticket}`
  (no cookies yet; go on with `/api/login/code` within 5 minutes)
- Errors: `401 wrong username or password`, `403 this account is turned off`, `429`

### `POST /api/login/code`
Anyone (throttled). The second step.

- Body: `{ticket, code}`: `code` is the authenticator app's 6 digits or one of the recovery codes (each works
  once)
- Answer: `{ok: true}` plus cookies
- Errors: `401 wrong code`; `401 start again: the sign-in took too long` (ticket unknown or expired, or after 5
  wrong codes on one ticket); `429`

### `POST /api/signup`
Anyone, when sign-up is `open`, or `invite` with a valid invitation code. Doesn't sign in.

- Body: `{username, password, name?, invite?}`
- Answer: `{ok: true, username}`
- Errors: `403 sign-up is closed`, `403 this invitation is not valid`, `400 bad username or password`,
  `409 that username is taken`

### `POST /api/logout`
Anyone (no body). Ends the session in use; the next account signed in here, if any, takes over.
Answer: `{ok: true, next}`: `next` is the username now in use, or `null`. The browser's open tabs drop out of
that account's list.

### `GET /api/accounts`
Signed in. `{max, accounts: [Account + {current}]}`: the accounts signed in in this browser, the one in use
first (`current: true`).

### `GET /api/accounts/here`
Anyone. `{max, accounts: [Account]}`: the same list without needing an account in use (the sign-in page uses it
to ask which one to sign out of at the limit).

### `POST /api/accounts/logout`
Anyone. Signs out of one of the accounts in this browser (by id), the one in use staying.
Body: `{id}`. Answer: `{ok: true}`. Error: `404 that account is not signed in here`.

### `POST /api/accounts/switch`
Signed in. Puts another of the browser's accounts in use. Body: `{id}`. Answer: `{ok: true}`.
Error: `404 that account is not signed in here` (including the one already in use).

## Your account (`/api/me`)

### `GET /api/me`
Signed in. `Account + {only_admin}` (`only_admin`: the server's only active admin, whose account can't be
deleted). If the session in use has ended but another account here is signed in, it is switched to and the
answer is `Account + {switched: true}` (no `only_admin`) with new cookies.

### `DELETE /api/me`
Signed in (throttled). Deletes your account; another account signed in here takes over.

- Body: `{password, confirm: true}`
- Answer: `{ok: true, next}` (as `/api/logout`)
- Errors: `403 the current password is wrong`, `400 not confirmed`, `409 the last admin stays`
- Its shares: where it was the owner, the next member (by role, managers first, then the longest there) becomes
  owner; a share with no one left is deleted.

### `POST /api/me/password`
Signed in (throttled). Body: `{current, new}`. Answer: `{ok: true}`; every other session of the account ends.
Errors: `403 the current password is wrong`, `400 the new password is too short`.

### `PUT /api/me/name`
Signed in. Body: `{name}` (empty: none). Answer: Account.

### `PUT /api/me/avatar` / `DELETE /api/me/avatar`
Signed in. `PUT` body: `{image}`, a `data:image/(png|jpeg|webp);base64,...` URL of at most 60000 characters
(else `400 not an image`). Both answer the Account.

### `GET /api/users/{uid}/avatar`
Any account signed in in this browser (in use or not; else `401`). The image itself, with its own content type,
cached for a year (its URL changes with it). `404` with no photo.

### Sessions

| | |
|---|---|
| `GET /api/me/sessions` | Signed in. A list (newest use first) of `{id, current, agent, ip, created_at, last_seen}`; `id` is 16 hex characters |
| `DELETE /api/me/sessions/{sid}` | Signed in. Ends another of your sessions. `{ok: true}` (also when there was none). `400 not that one` for your own or a malformed id |
| `POST /api/me/logout-others` | Signed in. Ends all your other sessions. `{ok: true}` |

### `GET /api/me/events?limit=20&offset=0`
Signed in. Your own security record, newest first: `{events: [entry + {here}], total}`. `limit` 1 to 100;
`here`: same address and browser as this request.

## Two-step sign-in

| | Body | Answer | Errors |
|---|---|---|---|
| `POST /api/me/2fa/start` | `{password}` | `{secret, uri, qr}`: the base32 secret, its `otpauth://` link, and a QR code as SVG text | `403` wrong password, `429` |
| `POST /api/me/2fa/confirm` | `{code}` | `{recovery: [10 codes]}`: 2FA is now on; codes shown only this once | `400 wrong code` (or no `start` before) |
| `POST /api/me/2fa/off` | `{password}` | `{ok: true}` | `403`, `429` |
| `POST /api/me/2fa/recovery` | `{password}` | `{recovery: [10 codes]}`: new ones, the old ones void | `403`, `429`, `409 two-step sign-in is off` |

All signed in. Codes are TOTP (30 s, 6 digits; the previous and next step accepted; each step used once).

## Sync

Each account's tabcat data, kept on the server and passed between its browsers. The server stores changes
("ops") in the order they arrive, numbered (`seq`), and does not read them; each browser applies them in that
order. A change is identified by its `id`: sent twice, it is kept once. Now and then a browser sends a whole copy
(a snapshot) as of some `seq`; changes more than 5000 before the latest snapshot are deleted. `head` is the latest
number (the larger of the last change and the snapshot). See also the overview in
[server/README.md, How sync works](../server/README.md#how-sync-works).

All signed in; those marked **(X)** check `X-Tabcat-Account`. Bodies up to 8 MB.

### `GET /api/sync/state` (X)
Everything to start from: `{snapshot, ops, head}`. `snapshot` is `{seq, at, body}` or `null`; `ops` are the
changes after it (up to 100000), each `{seq, id, device, body}`.

### `GET /api/sync/ops?after=N` (X)
The changes after `N`, up to 1000: `{ops, head, more}` (`more`: there may be more; ask again from the last
`seq`). If `N` is before the snapshot and the changes after `N` are no longer all kept: `{reload: true, head}`,
start again from `/api/sync/state`.

### `POST /api/sync/ops` (X)
Body: `{device, ops: [{id, body}]}` (up to 2000 ops; `id` up to 64 characters; entries without `id` or `body`
skipped). Answer: `{acked: [{id, seq}], head}`, each op's number (an op already kept: its earlier number).
Tells the account's live streams `head`.

### `PUT /api/sync/snapshot` (X)
Body: `{seq, body, first?}`: `body` an object, the whole data as of `seq`. `first: true` is a browser's own data
to start a new account from (`seq` 0), accepted only while the account has nothing.

- Answer: `{ok: true, seq}`
- Errors: `400 bad snapshot` (`seq` not an integer, negative, or past `head`; `body` not an object),
  `409 an older copy than kept`, `409 there is data here already` (with `first`)

### Open tabs of the account's browsers

Each browser sends its open windows and tabs (the latest only); the account's other browsers show them.
Browsers not heard from in 30 days are deleted. Changes are told to live streams as `tabs`.

| | Who | Body | Answer |
|---|---|---|---|
| `PUT /api/sync/tabs` | (X) | `{device, name?, windows}` | `{ok: true}`; `400 which browser?` without `device` |
| `GET /api/sync/tabs` | signed in | | `{devices: [...]}` (below) |
| `PUT /api/sync/tabs/order` | signed in | `{devices: [device ids]}` (up to 200) | `{ok: true}` |
| `PUT /api/sync/tabs/{device}/name` | signed in | `{name}` (up to 30 characters; empty: its own name again) | `{ok: true}` |
| `PUT /api/sync/tabs/{device}/hidden` | signed in | `{hidden: true\|false}` | `{ok: true}` |

- `windows`: up to 50 of `{focused, tabs, groups}`; `tabs` up to 500 of `{url, title, icon, pinned, active,
  group}` (`icon` kept only if `http(s)://`; `group` a tab group id or `-1`); `groups` up to 100 of
  `{id, title, color}`. Windows with no tabs are dropped.
- `GET` lists only browsers whose session is still signed in to the account, in the order set (the rest after):
  each `{device, name, own, at, hidden, session, windows}` (`name`: the name given, else `own`, the browser's own;
  `session`: the first 16 characters of its session id, as in `/api/me/sessions`).
- The same browser signing in to another account blanks its tabs in the account it came from. A hidden browser is
  shown again when it signs in again.

### Shared workspaces: the browsers' side

A shared workspace is data of its own, synced like an account's, with its own numbering.

| | Who | Body / query | Answer |
|---|---|---|---|
| `GET /api/sync/shares` | (X) | | `{shares: [{id, root, role, head}]}` |
| `POST /api/sync/shares` | (X) | `{root, body: {workspaces: [the workspace]}}` | `{id, created}` |
| `GET /api/sync/shares/{sid}/state` | (X), member | | `{snapshot, ops, head}` (as `/api/sync/state`; ops also have `user`) |
| `GET /api/sync/shares/{sid}/ops?after=N` | (X), member | | as `/api/sync/ops` (ops have `user`) |
| `POST /api/sync/shares/{sid}/ops` | (X), owner, manager or editor | `{device, ops}` | `{acked, head}` |
| `PUT /api/sync/shares/{sid}/snapshot` | (X), owner, manager or editor | `{seq, body}` | `{ok: true, seq}` |
| `DELETE /api/sync/shares/{sid}` | (X), member | | `{ok: true}` |

- `POST /api/sync/shares` shares one of the account's workspaces: `root` is its id and must equal
  `body.workspaces[0].id` (else `400 bad workspace`). The account becomes owner. Asked again for the same `root`:
  the same share, `created: false`. At most 200 owned shares (`429 too many shared workspaces`).
- A share's snapshot must hold exactly its one workspace (`400 bad snapshot` otherwise); `409 an older copy than
  kept` as for the account.
- `DELETE`: the owner deletes the share for everyone (the others get `removed` mail, unanswered invites go);
  anyone else leaves it (the owner gets `left` mail).
- Not a member: `404 no such shared workspace`; a viewer writing: `403 not allowed for viewers`.

## Shares: members and invites

The dashboard's side of shared workspaces. Roles: `owner` (one), `manager`, `editor`, `viewer`. All signed in
and a member of the share (else `404 no such shared workspace`); wrong role: `403`.

**Share info** (the answer of most calls below): `{id, root, role, members, invites}`. `role` is yours;
`members`: `[Person + {role, me}]`, owner first; `invites`: unanswered ones, `[{mail, role, at, user: Person}]`.

### `GET /api/shares`
`{shares: [{id, root, role, members, invited, owner}]}`: `members` and `invited` are counts; `owner` is
`{name, username}` or `null`.

### `GET /api/shares/{sid}`
Any member. Share info.

### `POST /api/shares/{sid}/invites`
Owner. Invites someone by mail.

- Body: `{username, role, name?, symbol?}`: `role` is `manager`, `editor` or `viewer`. `name`/`symbol` are used
  only if the share has no name of its own yet.
- Answer: share info
- Errors: `400 as what?`, `404 no such account`, `409 that is you` / `already in it` / `already asked`,
  `429 too many invites waiting` (50 unanswered invites per account)

### `DELETE /api/shares/{sid}/invites/{mid}`
Owner. Takes an unanswered invite back (it leaves their mailbox). Answer: share info. `404 no such invite`.

### `PUT /api/shares/{sid}/members/{uid}`
Owner or manager. Body: `{role}`, any of the four.

- The owner may change anyone else's role; giving `owner` hands ownership on (the old owner becomes manager).
- A manager may change anyone's but the owner's, never to `owner` (`403 owners only`).
- Answer: share info. Errors: `400 as what?`, `404 not in it`, `409 hand it on to someone else` (the owner
  changing their own role)

### `DELETE /api/shares/{sid}/members/{uid}`
The owner removes someone (they get `removed` mail; answer: share info), or any non-owner removes themselves,
i.e. leaves (the owner gets `left` mail; answer: `{ok: true}`). Errors: `403 owners only`, `409 hand it on
first` (the owner leaving), `404 not in it`.

### `POST /api/shares/{sid}/end`
Owner. Stops sharing: everyone else removed (each told by mail), invites withdrawn; the owner keeps the share
alone. Answer: share info.

## Mail

Each account's mailbox: share invites and news about shares. All signed in; only your own mail.

**Mail item**: `{id, kind, from, share, workspace: {name, symbol}, role, answer, at, answered_at, seen}`.
`kind`: `invite`, `reply` (an answer to your invite), `removed` (you were removed or the share ended or was
deleted), `left` (someone left your share). `from` is a Person (for a deleted account: its username only, `id`
null). `answer`: `accepted`, `declined` or `null`. `seen`: when read, or `null`.

| | Body | Answer |
|---|---|---|
| `GET /api/mail` | | `{mail: [item], asking}`: newest first, up to 500; `asking` counts unread mail and unanswered invites |
| `POST /api/mail/seen` | `{ids}` | `{ok: true}` |
| `POST /api/mail/{mid}/answer` | `{accept: true\|false}` | the mail item |
| `POST /api/mail/delete` | `{ids}` | `{ids}`: those deleted (an invite only once answered) |
| `POST /api/mail/restore` | `{ids}` | `{ids}`: those restored |

- `ids`: integer mail ids, up to 500.
- Answering an invite joins the share when accepted (as the invited role) and mails a `reply` to the sender.
  Errors: `404 no such invite`, `409 answered already`, `410 the shared workspace is gone` (accepting).
- Deleted mail is kept 30 days for undoing, then removed.

## User search

### `GET /api/users/search?q=`
Signed in. Accounts to invite: active accounts other than yours whose username or name matches `q` (substring,
letters in order, Korean by jamo and initials), closest first, up to 30. `{users: [Person]}`, with `twofa`
always `false`. Empty `q`: `{users: []}`.

## Live events

### `GET /api/live` (also `GET /api/sync/events`)
Signed in. A server-sent event stream (`text/event-stream`). It starts with `retry: 3000` and a `head` event,
sends a comment (`: still here`) after 20 quiet seconds, and closes after 5 minutes (clients reconnect). At most
20 streams per account, 40 per address and 150 in all (`429 too many listening`).

| Event | Data | Means |
|---|---|---|
| `head` | `{head}` | the account's sync `head` (sent at once, then when it moves on) |
| `me` | `{}` | the account changed (name, photo, 2FA, sessions, record...) |
| `accounts` | `{}` | another account signed in in this browser changed |
| `admin` | `{}` | admins only: accounts, invites, settings or the record changed |
| `tabs` | `{}` | the account's browsers' open tabs changed |
| `shares` | `{}` | one of its shares (members, invites, data) changed |
| `mail` | `{}` | its mailbox changed |
| `gone` | `{}` | this session ended; the stream closes |

Several events at once are sent once each. After any non-sync `POST`/`PUT`/`PATCH`/`DELETE` under `/api/`, the
accounts it touched get `me` and admins get `admin`.

## Admin

All need an admin account from an `admin_from` address. Changes are logged to the security record.

### Users

| | Body | Answer | Errors |
|---|---|---|---|
| `GET /api/admin/users` | | list of Account, oldest first | |
| `POST /api/admin/users` | `{username, password, name?, admin?}` | Account | `400`, `409 that username is taken` |
| `PATCH /api/admin/users/{uid}` | any of `{admin, disabled, twofa: false, password}` | Account | `404`, `409`, `400` |
| `DELETE /api/admin/users/{uid}` | | `{ok: true}` | `404`, `409 you can't delete yourself or the last admin` |

`PATCH`:
- `admin`: role. `409 the last admin stays an admin`.
- `disabled`: suspend (ends its sessions) or unsuspend. `409 you can't turn off yourself or the last admin`.
- `twofa: false`: turns its two-step sign-in off.
- `password`: resets it and ends its sessions. `409 change your own password on your account page` for yourself;
  `400 the password is too short`.

Deleting an account hands its shares on as for `DELETE /api/me`.

### Settings

`GET /api/admin/settings` and `PUT /api/admin/settings` (any subset of the fields) both answer:

| Field | Values |
|---|---|
| `signup` | `closed`, `invite`, `open` |
| `dashboard_auto` | boolean: update the dashboard from GitHub by itself (daily) |
| `session_days` | 0 to 365 (0: sign-ins last until the browser closes) |
| `login_tries` | 3 to 50 |
| `login_lock_minutes` | 1 to 1440 |
| `log_days` | 7 to 365: how long the security record is kept |

Errors: `400 signup: closed, invite or open`, `400 <key>: a number`, `400 <key>: <lo> to <hi>`.

### `POST /api/admin/logout-all`
Ends every session but yours; every live stream hears `me`. `{ok: true}`.

### Invitations

| | Body | Answer |
|---|---|---|
| `GET /api/admin/invites` | | list of `{code, created_at, expires_at, used_by, used_at}`, newest first (`used_by`: a username) |
| `POST /api/admin/invites` | `{days?}` | `{code, expires_at}` (`null`: never expires) |
| `DELETE /api/admin/invites/{code}` | | `{ok: true}` |

### `GET /api/admin/info`
The server's state:
`{version, data_dir, db_bytes, db_path, here, release, dashboard, users, setup_from, admin_from, trusted_proxies, sessions}`.

- `here`: the request comes from a `setup_from` address (the server computer).
- `release`: `{latest, newer, install}`: the newest server release on GitHub as last looked up (`v1.2.0`, or
  `null`), whether it's newer than this one, and how this server was installed (`pip`, `docker`, `checkout`).
- `dashboard`: `{source, folder, present, version}`: `source` is `github` or `folder`; `version` is
  `{commit, updated_at}` or `null`.
- `users`, `sessions`: counts.

### Security record

`GET /api/admin/events?user=&before=&limit=50&offset=0&show=`: newest first.

- `user`: one account's entries; `show`: `signin`, `account`, `admin`, or `bad` (failures and holds);
  `limit` 1 to 200; `offset` for pages, or `before` (an entry id) to go on from one.
- Answer: `{events, total, failures_24h}`. Each event is an entry plus `name`, `admin` (the account as it is
  now; `null` if gone), `who` and `by` (Person or `null`: whom it's about and the admin who did it).
  `failures_24h`: the 5 addresses with most failed sign-ins, wrong passwords and rate limits in the last day,
  `[{ip, count}]`. Codes: see [server/README.md](../server/README.md#security-record-codes).

### Database

| | Who | Body | Answer |
|---|---|---|---|
| `POST /api/admin/database` | server computer only | `{path}` | `{db_path}` |
| `POST /api/admin/database/pick` | server computer only | `{title?}` | `{path}` (`null`: cancelled) |
| `GET /api/admin/backup` | admin | | a copy of the database, `tabcat-YYYYMMDD-HHMMSS.db` (`application/octet-stream`) |

- `database` moves the database file. `path` must be absolute; a folder (or a path without a suffix) means
  `tabcat.db` in it. Saved to `config.toml`. Errors: `400 not a usable path`, `400 that is where it is`,
  `409 there is a file there already`.
- `database/pick` shows the operating system's Save dialog on the server computer and returns the chosen path.
  `501 no file dialog on the server computer`.

### Updates

| | Who | Answer | Errors |
|---|---|---|---|
| `POST /api/admin/dashboard/update` | admin | `{commit, updated_at}` | `409` dashboard from a folder, `502 could not get the dashboard` |
| `POST /api/admin/server/update` | server computer only | `{ok: true, version}`, then the server restarts | `409 this is the newest already`, `409 update it as it was installed` (not pip), `502 could not update` |

The dashboard update downloads the `pages` branch from GitHub. The server update installs the newest
`server-v*` release with pip.

### Tailscale

| | Who | Body | Answer |
|---|---|---|---|
| `GET /api/admin/tailscale` | admin | | status + `here` |
| `POST /api/admin/tailscale/serve` | server computer only | `{on}` | status |

Status: `{installed}`, and when installed also `{state, name, ips, url, serving, https}` (`state`: Tailscale's
backend state such as `Running` or `NeedsLogin`; `url`: the computer's HTTPS address on the tailnet; `serving`:
this server's port is served there; `https`: HTTPS certificates allowed for the tailnet). `serve` turns
`tailscale serve` on or off. Errors: `409 {"detail": "turn on HTTPS for the tailnet", "enable": "<url>"}` when
the tailnet doesn't allow it yet; `502 tailscale: ...`.

## Pages and the dashboard (not API)

| Path | |
|---|---|
| `/login` | sign-in page (redirects to `/setup` with no accounts) |
| `/setup` | first-account page (redirects to `/login` once there are accounts; from outside `setup_from`, a page saying to set up from the server computer) |
| `/account` | account page (signed in, else `/login`) |
| `/admin` | admin page (admins; others to `/`, signed out to `/login?next=/admin`; outside `admin_from`, a page saying so) |
| `/_server/{name}` | the server pages' scripts and styles (not `.html`) |
| `/` | the dashboard (signed in, else `/login`; `/setup` with no accounts; a notice if its files are missing) |
| `/{path}` | the dashboard's files (`Cache-Control: no-cache`; dot-files refused; `/privacy` serves `privacy.html`) |

Server pages carry a strict `Content-Security-Policy` and `Cache-Control: no-store`. An error on a request that
accepts `text/html` outside `/api/` gets an HTML error page instead of JSON.

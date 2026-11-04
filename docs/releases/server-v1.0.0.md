The first release of tabcat server: the tabcat dashboard at an address of your own, behind sign-in, with your tabs in step across browsers, shared workspaces, and accounts for everyone you invite.

It works with the tabcat extension 1.1.0 or later.

## Install

With Python 3.10 or later:

```
pip install https://github.com/nda111/tabcat/releases/download/server-v1.0.0/tabcat_server-1.0.0-py3-none-any.whl
tabcat-server
```

Then open the address it prints, on the same computer, to make the first account (the admin), and choose **Connect to a server** from the tabcat extension's toolbar menu. Docker and running it as a service: see the [README](https://github.com/nda111/tabcat/tree/main/server).

## What it does

- **Sync**: each account's groups, Recently deleted, look and settings (the default group, the text size) are kept the same in every browser signed in to it, live: a change made in one shows in the others at once. Changes made offline are kept and sent once the server is back. Which cards are open stays each browser's own.
- **Your other browsers' tabs**: the tabs open in your account's other browsers, in the order you put them, each one hidden or shown as you like.
- **Shared workspaces**: invite others to a workspace as a viewer, editor or manager; it stays in step for everyone in it. Invites, removals and leaving come as mail, in a Mailbox with a badge for what's unread.
- **Accounts**: the first visit makes the admin. Sign-up closed, by invitation or open. A name to go by beside the username, a profile photo, several accounts in one browser (up to 5) to switch between.
- **Security**: two-step sign-in (2FA) with recovery codes; the devices you're signed in on, any signed out of in two clicks; waits after wrong passwords; a security record of sign-ins and account changes, for you and for the admin (export as CSV).
- **Admin page**: users (roles, suspend, reset a password), security settings, the database file's place, Tailscale HTTPS, and a newer server release said and installed from there.
- **Pages of its own** in tabcat's look and your language, with error pages that say what went wrong.
- **Safe by default**: the server is set up only from its own computer; changes from other sites are refused; a page on this computer (localhost) links up with the extension only once you allow it, in a window of the extension's own.

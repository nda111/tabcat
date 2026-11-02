"""What the server needs before it starts: where its data lives, where it listens, where the dashboard comes
from. Read from config.toml in the data folder (all optional), then the command line and the environment
(TABCAT_DATA, TABCAT_HOST, TABCAT_PORT, TABCAT_DASHBOARD) over it. Everything else is set on the admin page."""
import os
import tomllib
from dataclasses import dataclass
from pathlib import Path


def default_data_dir() -> Path:
    if os.name == 'nt':
        return Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData' / 'Local')) / 'tabcat-server'
    return Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local' / 'share')) / 'tabcat-server'


@dataclass
class Config:
    data_dir: Path
    host: str = '127.0.0.1'
    port: int = 8080
    # 'auto': the latest from GitHub (the pages branch, as tabcat.ghyeok.com), kept in the data folder;
    # else a folder with the dashboard's files (e.g. a checkout of the pages branch, while working on it)
    dashboard: str = 'auto'
    # who may make the first account (the admin), and who may use the admin page: lists of addresses or
    # networks (CIDR). By default the first account only from this computer, the admin page from anywhere.
    setup_from: tuple = ('127.0.0.1/32', '::1/128')
    admin_from: tuple = ('0.0.0.0/0', '::/0')
    # proxies in front of it whose X-Forwarded-For is believed (Caddy, nginx, Tailscale's serve on this
    # computer); from anyone else, the header counts for nothing
    trusted_proxies: tuple = ('127.0.0.1', '::1')

    # the database file: in the data folder, unless moved (the admin page can, on the server's own computer:
    # it's kept in config.toml as `database`)
    database: str = ''

    @property
    def db_path(self) -> Path:
        return Path(self.database).expanduser() if self.database else self.data_dir / 'tabcat.db'

    @property
    def dashboard_dir(self) -> Path:
        return self.data_dir / 'dashboard' if self.dashboard == 'auto' else Path(self.dashboard).expanduser().resolve()


def _list(v):
    return tuple(x.strip() for x in (v.split(',') if isinstance(v, str) else v) if str(x).strip())


def load(data_dir=None, host=None, port=None, dashboard=None, setup_from=None, admin_from=None, trusted_proxies=None) -> Config:
    data = Path(data_dir or os.environ.get('TABCAT_DATA') or default_data_dir()).expanduser().resolve()
    file = {}
    if (data / 'config.toml').exists():
        with open(data / 'config.toml', 'rb') as f:
            file = tomllib.load(f)
    pick = lambda arg, env, key, default: arg if arg is not None else os.environ.get(env) or file.get(key, default)
    return Config(
        data_dir=data,
        host=pick(host, 'TABCAT_HOST', 'host', '127.0.0.1'),
        port=int(pick(port, 'TABCAT_PORT', 'port', 8080)),
        dashboard=str(pick(dashboard, 'TABCAT_DASHBOARD', 'dashboard', 'auto')),
        setup_from=_list(pick(setup_from, 'TABCAT_SETUP_FROM', 'setup_from', Config.setup_from)),
        admin_from=_list(pick(admin_from, 'TABCAT_ADMIN_FROM', 'admin_from', Config.admin_from)),
        trusted_proxies=_list(pick(trusted_proxies, 'TABCAT_TRUSTED_PROXIES', 'trusted_proxies', Config.trusted_proxies)),
        database=str(os.environ.get('TABCAT_DATABASE') or file.get('database', '')),
    )


def save_setting(data_dir: Path, key: str, value: str):
    """Set one string setting in the data folder's config.toml, the rest of it as it was."""
    import json
    path = data_dir / 'config.toml'
    lines = path.read_text(encoding='utf-8').splitlines() if path.exists() else []
    line = f'{key} = {json.dumps(value)}'  # (a JSON string is a TOML basic string: backslashes and all)
    for i, l in enumerate(lines):
        if l.split('=')[0].strip() == key:
            lines[i] = line
            break
    else:
        lines.append(line)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')

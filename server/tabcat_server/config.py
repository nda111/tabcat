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

    @property
    def db_path(self) -> Path:
        return self.data_dir / 'tabcat.db'

    @property
    def dashboard_dir(self) -> Path:
        return self.data_dir / 'dashboard' if self.dashboard == 'auto' else Path(self.dashboard).expanduser().resolve()


def load(data_dir=None, host=None, port=None, dashboard=None) -> Config:
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
    )

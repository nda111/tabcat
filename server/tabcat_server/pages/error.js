// A page that couldn't be shown (see error_page in app.py): its number, what it means in words, and where to go from
// here: the dashboard, back where you were (or the dashboard, if there's nowhere back), or, for what may pass (too
// many requests, a server starting up), the same again.
import { $, t } from './pages.js';

const code = document.documentElement.dataset.code;
$('#err-code').setAttribute('aria-label', t('errCode', { code }));
document.title = `${code} · tabcat`;
$('#err-back').addEventListener('click', () => (history.length > 1 ? history.back() : location.assign('/')));

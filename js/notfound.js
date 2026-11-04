// The page GitHub Pages shows for an address that isn't there (404.html): in the dashboard's language (as set there,
// else the browser's), and the way back to it.
import { setLang, translateDom } from './i18n.js';

let setting = 'auto';
try { setting = localStorage.getItem('tabcat:lang') || 'auto'; } catch { /* storage unavailable */ }
document.documentElement.lang = await setLang(setting);
translateDom();
document.documentElement.classList.remove('booting');

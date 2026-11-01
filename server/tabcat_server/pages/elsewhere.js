// A server page this address may not use (setting the server up, or its admin page): why, and how to allow it
import { $, t } from './pages.js';

const local = `${location.protocol}//localhost${location.port ? `:${location.port}` : ''}`;
$('#text').textContent = t($('#text').dataset.text, { local });

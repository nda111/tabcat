// Full emoji picker (emoji-picker-element: search, categories, skin tones, recents),
// loaded from the CDN the first time it is opened.

const PICKER_URL = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/index.js';
const DATA_URL = 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1.8.0/en/emojibase/data.json';
let loading = null;

function load() {
  if (!loading) loading = import(PICKER_URL).catch((err) => { loading = null; throw err; });
  return loading;
}

export async function createEmojiPicker(onPick) {
  const { Picker } = await load();
  const picker = new Picker({ dataSource: DATA_URL });
  const theme = document.documentElement.dataset.theme; // follows the system theme when unset
  if (theme) picker.classList.add(theme);
  picker.addEventListener('emoji-click', (e) => onPick(e.detail.unicode));
  return picker;
}

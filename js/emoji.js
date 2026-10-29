// Emoji search backed by emoji-picker-element's database (emojibase data, cached in IndexedDB),
// loaded from the CDN on first use.

const DB_URL = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/database.js';
const DATA_URL = 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1.8.0/en/emojibase/data.json';
let loading = null;

function db() {
  if (!loading) {
    loading = import(DB_URL)
      .then(({ default: Database }) => new Database({ dataSource: DATA_URL }))
      .catch((err) => { loading = null; throw err; });
  }
  return loading;
}

const pick = (e) => ({ unicode: e.unicode, name: e.annotation || e.name || '' });

export async function searchEmoji(query, limit = 80) {
  const found = await (await db()).getEmojiBySearchQuery(query);
  return found.filter((e) => e.unicode).slice(0, limit).map(pick);
}

export async function favoriteEmoji(limit) {
  return (await (await db()).getTopFavoriteEmoji(limit)).filter((e) => e.unicode).map(pick);
}

export async function recordEmoji(unicode) {
  try { await (await db()).incrementFavoriteEmojiCount(unicode); } catch { /* best effort */ }
}

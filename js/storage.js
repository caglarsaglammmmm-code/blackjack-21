// Cihazdaki kayıt. localStorage engellenmişse oyun yine çalışır, yalnızca kalıcı olmaz.
const KEY = 'tam-tokatlik-21';
const DEFAULTS = {
  name: '',
  best: 500,
  pending: [500],
  settings: { sound: true, vibrate: true, fast: false },
  game: null,
};

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved) return { ...DEFAULTS, ...saved, settings: { ...DEFAULTS.settings, ...saved.settings } };
  } catch { /* kayıt yoksa varsayılan */ }
  return structuredClone(DEFAULTS);
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* depolama kapalı */ }
}

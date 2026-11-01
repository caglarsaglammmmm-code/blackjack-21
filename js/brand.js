// Oyunun adı ve sloganı yalnızca burada tanımlıdır.
// Değiştirince `npm run brand` manifest, sayfa başlığı ve Android adını günceller.
export const BRAND = {
  name: 'Tam Tokatlık 21',
  tagline: 'Masa senin, tokat onun.',
  shortName: 'Tokatlık 21',
};

export const REPO = {
  owner: 'caglarsaglammmmm-code',
  name: 'blackjack-21',
};

export const APK_NAME = 'Blackjack21.apk';
export const APK_URL = `https://github.com/${REPO.owner}/${REPO.name}/releases/latest/download/${APK_NAME}`;
export const PAGE_URL = `https://${REPO.owner}.github.io/${REPO.name}/`;

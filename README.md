# Tam Tokatlık 21

Arkadaşlarla yarışılan, sanal paralı Blackjack. Saf HTML, CSS ve JavaScript; kartlar SVG ile çizilir, sesler WebAudio ile üretilir. Sanal para, gerçek para değildir.

**Oyna:** https://caglarsaglammmmm-code.github.io/blackjack-21/

**Android APK (hep en güncel):** https://github.com/caglarsaglammmmm-code/blackjack-21/releases/latest/download/Blackjack21.apk

## Kurallar

6 deste, %25 kalınca karıştırma. Krupiye tüm 17'lerde durur, As veya 10 açıkken blackjack'e bakar. Blackjack 3:2, sigorta 2:1. Bir kez bölünür, bölünen Aslara tek kart verilir, bölünen elde 21 blackjack sayılmaz. Bölünen ellerde (As hariç) ikiye katlanabilir. Başlangıç 500, en düşük bahis 10.

## Ad ve slogan

`js/brand.js` dosyasını değiştirip `npm run brand` ve `npm run stamp` çalıştırın. Android simgesindeki yazılar için `npm run icons`.

## Komutlar

| Komut | İş |
|---|---|
| `npm test` | Birim testleri |
| `npm run serve` | Yerel sunucu (`PORT` ile port) |
| `npm run e2e` | Sunucu açıkken Edge'de uçtan uca deneme |
| `npm run test:score` | Firebase emülatöründe kural ve çok oyunculu deneme (sunucu açık, `E2E_URL`) |
| `npm run stamp` | `sw.js` önbellek listesi ve sürümü; dosya değişince şart |
| `npm run vendor` | Firebase SDK paketini yeniden üretir |
| `npm run android:build` | `dist/Blackjack21.apk` |

## Yeni sürüm

`package.json` sürümünü artırın, `npm run brand`, `npm run stamp`, `npm run android:build`, sonra:

```
gh release create vX.Y.Z dist/Blackjack21.apk --title "vX.Y.Z"
```

Dosya adı sabit kaldığı için indirme düğmesi kendiliğinden en güncel sürüme gider. APK debug imzalıdır: telefona kurulur, Google Play'e yüklenemez.

## Skor tablosu

Firebase Firestore ve anonim giriş kullanır. `js/firebase-config.js` içindeki web yapılandırması gizli değildir, erişimi `firebase/firestore.rules` belirler. Kurallar her oyuncunun yalnızca kendi kaydını yazmasına izin verir, silmeyi yasaklar, tek yazımda 2,5 kattan fazla artışı ve saniyede birden sık yazmayı reddeder. Bu temel hile önlemedir: hesaplama istemcide yapıldığı için kararlı biri adım adım sahte skor yazabilir.

## Yapı

```
js/engine.js      oyun mantığı (arayüzsüz)     js/table.js       masa ve animasyonlar
js/score-core.js  ad filtresi, rekor basamağı  js/art.js         kart ve fiş SVG
js/leaderboard.js Firebase bağlantısı          js/audio.js       WebAudio sesleri
js/main.js        akış ve ekranlar             js/fx.js          parçacık, sayaç, doku
```

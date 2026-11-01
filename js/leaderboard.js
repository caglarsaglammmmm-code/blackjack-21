// Çevrimiçi skor tablosu. SDK yalnızca gerektiğinde yüklenir; hata oyunu asla durdurmaz.
import { firebaseConfig } from './firebase-config.js';
import { RULES } from './engine.js';
import { nextStep } from './score-core.js';

const WRITE_GAP = 1200; // Kuraldaki 1 saniyelik yazma aralığına uyar.
const RETRY = 5000;
const emulatorMode = new URLSearchParams(location.search).has('emu');

export class Leaderboard {
  constructor({ getLocal, onPrune, onChange }) {
    this.getLocal = getLocal;
    this.onPrune = onPrune;
    this.onChange = onChange;
    this.status = 'connecting';
    this.top = [];
    this.uid = null;
    this.server = undefined; // undefined: bilinmiyor, null: kayıt yok
    this.rank = null;
    this.flushing = false;
    this.fb = null;
    this.startPromise = null;
    addEventListener('online', () => this.connect());
    addEventListener('offline', () => this.setStatus('offline'));
  }

  get configured() {
    return Boolean(firebaseConfig) || emulatorMode;
  }

  setStatus(status) {
    this.status = status;
    this.emit();
  }

  emit() {
    this.onChange({ status: this.status, top: this.top, uid: this.uid, rank: this.rank });
  }

  connect() {
    if (!this.configured) {
      this.setStatus('off');
      return;
    }
    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }
    if (this.fb) {
      this.flush();
      return;
    }
    this.startPromise ??= this.boot().catch(() => {
      this.startPromise = null;
      this.fb = null;
      this.setStatus('offline');
      setTimeout(() => this.connect(), RETRY);
    });
  }

  async boot() {
    const fb = await import('./vendor/firebase.js');
    fb.setLogLevel('silent');
    const app = fb.initializeApp(firebaseConfig ?? { apiKey: 'demo', projectId: 'demo-tokatlik', appId: 'demo' });
    const auth = fb.initializeAuth(app, {
      persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence, fb.inMemoryPersistence],
    });
    const db = fb.getFirestore(app);
    if (emulatorMode) {
      fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fb.connectFirestoreEmulator(db, '127.0.0.1', 8180);
    }
    await auth.authStateReady();
    const user = auth.currentUser ?? (await fb.signInAnonymously(auth)).user;
    this.uid = user.uid;
    this.fb = fb;
    this.db = db;
    this.scores = fb.collection(db, 'scores');
    this.mine = fb.doc(this.scores, user.uid);
    this.watch();
    await this.flush();
  }

  watch() {
    const { fb } = this;
    const top = fb.query(this.scores, fb.orderBy('best', 'desc'), fb.limit(10));
    fb.onSnapshot(top, { includeMetadataChanges: true }, (snapshot) => {
      const fromCache = snapshot.metadata.fromCache;
      if (fromCache && !navigator.onLine) {
        this.setStatus('offline');
        return;
      }
      if (fromCache) return;
      this.top = snapshot.docs.map((item) => ({ uid: item.id, name: item.data().name, best: item.data().best }));
      this.status = 'online';
      this.emit();
      this.refreshRank();
      this.flush();
    }, () => this.setStatus('offline'));
    fb.onSnapshot(this.mine, (snapshot) => {
      this.server = snapshot.exists() ? snapshot.data() : null;
      this.refreshRank();
      this.flush();
    }, () => {});
  }

  // Oyuncu ilk 10'da değilse sırasını ayrıca sayar.
  async refreshRank() {
    const best = this.server?.best;
    if (!best || this.top.some((row) => row.uid === this.uid)) {
      this.rank = null;
      this.emit();
      return;
    }
    try {
      const { fb } = this;
      const above = await fb.getCountFromServer(fb.query(this.scores, fb.where('best', '>', best)));
      this.rank = { position: above.data().count + 1, best };
      this.emit();
    } catch { /* sonraki güncellemede yeniden denenir */ }
  }

  // Bekleyen rekorları ve ad değişikliğini kuralların izin verdiği adımlarla yazar.
  async flush() {
    if (!this.fb || this.flushing || this.server === undefined || !navigator.onLine) return;
    this.flushing = true;
    try {
      for (;;) {
        const { name, pending } = this.getLocal();
        if (!name || !navigator.onLine) break;
        const write = this.nextWrite(name, pending);
        if (!write) break;
        await this.fb.setDoc(this.mine, { ...write, updatedAt: this.fb.serverTimestamp() });
        this.server = { ...this.server, ...write };
        this.onPrune(write.best);
        await new Promise((resolve) => { setTimeout(resolve, WRITE_GAP); });
      }
    } catch {
      setTimeout(() => this.flush(), RETRY);
    } finally {
      this.flushing = false;
    }
  }

  nextWrite(name, pending) {
    if (this.server === null) {
      return { name, best: nextStep(RULES.startMoney, pending) ?? RULES.startMoney };
    }
    const step = nextStep(this.server.best, pending);
    if (step !== null) return { name, best: step };
    if (this.server.name !== name) return { name, best: this.server.best };
    return null;
  }
}

// js/vendor/firebase.js için giriş noktası: yalnızca kullanılan parçalar paketlenir.
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence,
  signInAnonymously, connectAuthEmulator,
} from 'firebase/auth';
export {
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, setDoc, onSnapshot,
  query, orderBy, limit, where, getCountFromServer, serverTimestamp, setLogLevel,
} from 'firebase/firestore';

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

const cfg = {
  apiKey: 'AIzaSyDkOssauXNwf6N6CJqf9ICbyvUAaHEoRQ4',
  authDomain: 'busd-6a8ab.firebaseapp.com',
  databaseURL: 'https://busd-6a8ab-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'busd-6a8ab',
  storageBucket: 'busd-6a8ab.firebasestorage.app',
  messagingSenderId: '852892913090',
  appId: '1:852892913090:web:4c2139f3bb2f4de2915a5b',
  measurementId: 'G-WPE2WDZ59T',
};

(async () => {
  const localPath = path.join(process.cwd(), 'src', 'assets', 'mem_lvl2.json');
  const localRaw = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  const localEntries = Object.entries(localRaw);

  let localValid = 0;
  for (const [k, v] of localEntries) {
    const d = typeof v === 'number' ? v : (v && v.distance ? v.distance : null);
    if (d && d > 0) localValid++;
  }

  console.log('LOCAL_TOTAL_KEYS=' + localEntries.length);
  console.log('LOCAL_VALID_ROUTES=' + localValid);

  const app = initializeApp(cfg);
  const db = getDatabase(app);

  const t0 = Date.now();
  const snap = await get(ref(db, 'Dist Data'));
  const ms = Date.now() - t0;

  if (!snap.exists()) {
    console.log('FIREBASE_EXISTS=false');
    return;
  }

  const data = snap.val();
  const entries = Object.entries(data);

  let fbValid = 0;
  for (const [k, v] of entries) {
    const d = typeof v === 'number' ? v : (v && v.distance ? v.distance : null);
    if (d && d > 0) fbValid++;
  }

  console.log('FIREBASE_EXISTS=true');
  console.log('FIREBASE_FETCH_MS=' + ms);
  console.log('FIREBASE_TOTAL_KEYS=' + entries.length);
  console.log('FIREBASE_VALID_ROUTES=' + fbValid);

  const merged = new Map();
  for (const [k, v] of localEntries) {
    const d = typeof v === 'number' ? v : (v && v.distance ? v.distance : null);
    if (d && d > 0) merged.set(k, d);
  }
  for (const [k, v] of entries) {
    const d = typeof v === 'number' ? v : (v && v.distance ? v.distance : null);
    if (d && d > 0) merged.set(k, d);
  }

  console.log('MERGED_UNIQUE_ROUTES=' + merged.size);

  const sample = entries.slice(0, 5).map(([k, v]) => ({
    k,
    d: typeof v === 'number' ? v : (v && v.distance ? v.distance : null),
  }));
  console.log('FIREBASE_SAMPLE=' + JSON.stringify(sample));

  const key = entries.find(([k, v]) => {
    const d = typeof v === 'number' ? v : (v && v.distance ? v.distance : null);
    return !!(d && d > 0 && k.includes('-'));
  });

  if (key) {
    const [route] = key;
    const idx = route.indexOf('-');
    const a = route.slice(0, idx).trim();
    const b = route.slice(idx + 1).trim();

    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');

    const keys = [
      `${a}-${b}`,
      `${b}-${a}`,
      `${norm(a)}-${norm(b)}`,
      `${norm(b)}-${norm(a)}`,
    ];

    let found = 0;
    let hit = '';
    for (const k of keys) {
      if (merged.has(k)) {
        found = merged.get(k);
        hit = k;
        break;
      }
    }

    console.log('RETRIEVE_TEST_FROM=' + a);
    console.log('RETRIEVE_TEST_TO=' + b);
    console.log('RETRIEVE_TEST_FOUND=' + found);
    console.log('RETRIEVE_TEST_HIT_KEY=' + hit);
  }
})();

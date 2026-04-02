const { initializeApp, getApps, getApp } = require('firebase/app');
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
  const app = getApps().length ? getApp() : initializeApp(cfg);
  const db = getDatabase(app);
  const paths = ['Dist Data', 'distances', 'Distance Data'];

  for (const p of paths) {
    const t0 = Date.now();
    const snap = await get(ref(db, p));
    const ms = Date.now() - t0;
    if (!snap.exists()) {
      console.log(`PATH=${p} EXISTS=false FETCH_MS=${ms}`);
      continue;
    }

    const data = snap.val();
    const entries = Object.entries(data);
    let numeric = 0;
    let objectDistance = 0;
    let invalid = 0;

    for (const [k, v] of entries) {
      if (typeof v === 'number' && v > 0) numeric++;
      else if (v && typeof v === 'object' && typeof v.distance === 'number' && v.distance > 0) objectDistance++;
      else invalid++;
    }

    console.log(`PATH=${p} EXISTS=true FETCH_MS=${ms} TOTAL=${entries.length} NUMERIC=${numeric} OBJECT_DISTANCE=${objectDistance} INVALID=${invalid}`);
    console.log('SAMPLE_KEYS=' + entries.slice(0, 15).map(([k]) => k).join(' | '));
  }
})();

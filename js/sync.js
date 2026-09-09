import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Configurazione del progetto Firebase (Console Firebase → Impostazioni progetto
// → Le tue app → Configurazione SDK). Finché resta ai valori "YOUR_..." la
// sincronizzazione è disattivata e l'app funziona solo in locale come prima.
const firebaseConfig = {
  apiKey: "AIzaSyAt5UamVjQ_Bz54XyCjnOds1gFucAb4wh0",
  authDomain: "schedine-tracker.firebaseapp.com",
  projectId: "schedine-tracker",
  storageBucket: "schedine-tracker.firebasestorage.app",
  messagingSenderId: "931597084905",
  appId: "1:931597084905:web:742e6f483c9328c02b6878"
};
var PROFILE_HASH_KEY = "schedine_profile_hash_v1";
var COLLECTION = "schedine_profiles";
var SCHEMA = 2;

var configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("YOUR_") !== 0;
var db = null;
if(configured){
  try{
    db = getFirestore(initializeApp(firebaseConfig));
  }catch(e){ configured = false; }
}

async function sha256Hex(text){
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.prototype.map.call(new Uint8Array(buf), function(b){
    return b.toString(16).padStart(2, "0");
  }).join("");
}

function getProfileHash(){
  return localStorage.getItem(PROFILE_HASH_KEY);
}

// ---------- riconciliazione stato ----------
// Lo stato sincronizzato è { entries: [...], deleted: { id: timestamp } }.
// Le schedine sono immutabili (si aggiungono o si eliminano, non si modificano),
// quindi il merge è l'unione per `id`; `deleted` sono tombstone che impediscono
// a una schedina cancellata su un dispositivo di riapparire da un altro.

function cleanEntry(e){
  if(!e || typeof e !== "object") return null;
  if(typeof e.id !== "string" || !e.id) return null;
  if(typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  var pts = typeof e.points === "number" ? e.points : parseFloat(e.points);
  if(!isFinite(pts)) return null;
  return Object.assign({}, e, { points: pts });
}

function normalizeState(s){
  s = (s && typeof s === "object") ? s : {};
  var entries = [];
  if(Array.isArray(s.entries)){
    s.entries.forEach(function(e){ var c = cleanEntry(e); if(c) entries.push(c); });
  }
  var deleted = {};
  if(s.deleted && typeof s.deleted === "object"){
    Object.keys(s.deleted).forEach(function(id){
      var n = Number(s.deleted[id]);
      if(isFinite(n) && n > 0) deleted[id] = n;
    });
  }
  return { entries: entries, deleted: deleted };
}

var TOMBSTONE_TTL = 365 * 24 * 60 * 60 * 1000; // i tombstone più vecchi di 1 anno
                                               // vengono potati: mantiene il doc
                                               // limitato, al costo teorico di far
                                               // riapparire una schedina cancellata
                                               // da un dispositivo offline da oltre
                                               // un anno (caso irrilevante qui).

function mergeState(a, b){
  a = normalizeState(a);
  b = normalizeState(b);
  var cutoff = Date.now() - TOMBSTONE_TTL;
  var deleted = {};
  [a.deleted, b.deleted].forEach(function(map){
    Object.keys(map).forEach(function(id){
      var ts = Math.max(deleted[id] || 0, map[id]);
      if(ts >= cutoff) deleted[id] = ts;
    });
  });
  var byId = {};
  a.entries.concat(b.entries).forEach(function(e){
    if(!deleted[e.id]) byId[e.id] = e;
  });
  return {
    entries: Object.keys(byId).map(function(k){ return byId[k]; }),
    deleted: deleted
  };
}

window.SchedineSync = {
  isConfigured: function(){ return configured; },
  isConnected: function(){ return !!getProfileHash(); },
  merge: mergeState,
  // Collega questo dispositivo a un profilo cloud identificato dalla passphrase
  // (hashata, mai inviata in chiaro) e restituisce lo stato già presente sul
  // cloud per quel profilo (null se il profilo è nuovo). Se il profilo non è
  // raggiungibile/verificabile l'hash NON resta salvato, così il dispositivo non
  // finisce "connesso" a un profilo mai confermato.
  connect: async function(passphrase){
    if(!configured) throw new Error("Sync non configurata");
    var hash = await sha256Hex(String(passphrase).trim());
    var prev = getProfileHash();
    localStorage.setItem(PROFILE_HASH_KEY, hash);
    try{
      return await this.pull();
    }catch(e){
      if(prev) localStorage.setItem(PROFILE_HASH_KEY, prev);
      else localStorage.removeItem(PROFILE_HASH_KEY);
      throw e;
    }
  },
  disconnect: function(){
    localStorage.removeItem(PROFILE_HASH_KEY);
  },
  pull: async function(){
    var hash = getProfileHash();
    if(!hash || !configured) return null;
    var snap = await getDoc(doc(db, COLLECTION, hash));
    if(!snap.exists()) return null;
    return normalizeState(snap.data());
  },
  // Scrive lo stato locale sul cloud come read-merge-write atomico: legge la
  // copia remota, la fonde con quella passata e riscrive il risultato in una
  // transazione. Non sovrascrive mai i dati di un altro dispositivo e non perde
  // aggiunte concorrenti. Restituisce lo stato consolidato, o null se offline
  // (in quel caso i dati restano in locale e si ripropagano al salvataggio
  // successivo andato a buon fine).
  push: async function(state){
    var hash = getProfileHash();
    if(!hash || !configured) return null;
    var ref = doc(db, COLLECTION, hash);
    try{
      return await runTransaction(db, async function(tx){
        var snap = await tx.get(ref);
        var merged = mergeState(snap.exists() ? snap.data() : null, state);
        tx.set(ref, {
          entries: merged.entries,
          deleted: merged.deleted,
          updatedAt: Date.now(),
          schema: SCHEMA
        });
        return merged;
      });
    }catch(e){
      return null;
    }
  }
};

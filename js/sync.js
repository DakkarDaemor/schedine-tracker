import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

window.SchedineSync = {
  isConfigured: function(){ return configured; },
  isConnected: function(){ return !!getProfileHash(); },
  // Collega questo dispositivo a un profilo cloud identificato dalla passphrase
  // (hashata, mai inviata in chiaro) e restituisce i dati già presenti sul cloud
  // per quel profilo (null se il profilo è nuovo).
  connect: async function(passphrase){
    if(!configured) throw new Error("Sync non configurata");
    localStorage.setItem(PROFILE_HASH_KEY, await sha256Hex(passphrase));
    return this.pull();
  },
  disconnect: function(){
    localStorage.removeItem(PROFILE_HASH_KEY);
  },
  pull: async function(){
    var hash = getProfileHash();
    if(!hash || !configured) return null;
    var snap = await getDoc(doc(db, COLLECTION, hash));
    if(!snap.exists()) return null;
    var data = snap.data();
    return Array.isArray(data.entries) ? data.entries : [];
  },
  push: async function(entries){
    var hash = getProfileHash();
    if(!hash || !configured) return;
    try{
      await setDoc(doc(db, COLLECTION, hash), { entries: entries, updatedAt: Date.now() });
    }catch(e){
      // offline o errore di rete: i dati restano comunque salvati in locale
      // e verranno ripropagati al prossimo salvataggio andato a buon fine
    }
  }
};

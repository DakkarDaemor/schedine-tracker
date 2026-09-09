# Schedine Tracker

App locale per registrare schedine/punti giorno per giorno, con statistiche
settimanali e mensili e import/export CSV compatibile Excel.

I dati vivono di base solo sul tuo dispositivo (`localStorage` del browser).
Opzionalmente si può attivare una sincronizzazione cloud primitiva (nessun
account, nessuna email): basta una passphrase a piacere, usata solo per
identificare dove sono salvati i tuoi dati — vedi "Sincronizzare i dati tra
più dispositivi" più sotto. Senza configurare la sincronizzazione, l'app resta
100% locale come prima e nessun dato viene inviato altrove.

## Pubblicare su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `schedine-tracker`), pubblico.
2. Carica tutti i file e le cartelle di questo progetto nella root del repo:
   `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`,
   `css/style.css`, `js/app.js`, `js/sync.js`, `js/register-sw.js`.
3. Vai su **Settings → Pages**.
4. In **Source** scegli `Deploy from a branch`, branch `main`, cartella `/ (root)`.
5. Salva. Dopo circa un minuto l'app sarà su:
   `https://<tuo-utente>.github.io/<nome-repo>/`

## Aggiungerla alla schermata Home del telefono

Apri l'URL sopra dal browser del telefono, poi:

- **Android (Chrome)**: menu ⋮ → "Aggiungi a schermata Home" / "Installa app".
- **iOS (Safari)**: icona Condividi → "Aggiungi a Home".

Una volta aggiunta si apre a schermo intero, senza barra del browser, con icona
propria — si comporta come un'app installata (PWA).

## Struttura del progetto

- `index.html` — solo markup.
- `css/style.css` — stili.
- `js/app.js` — logica dell'app (storico, statistiche, CSV, storage locale).
- `js/sync.js` — sincronizzazione cloud opzionale (vedi sotto).
- `js/register-sw.js` — registrazione del service worker.
- `sw.js` — cache offline (PWA).

## Aggiornare l'app in futuro

Modifica il file interessato (`index.html` per il markup, `css/style.css` per lo
stile, `js/app.js` per la logica) e ricarica i file sul repo (o fai push). Se
cambi qualsiasi file elencato in `ASSETS` dentro `sw.js` (incluso il contenuto di
`index.html`, `css/style.css` o dei file in `js/`), aumenta il numero in
`CACHE_NAME` dentro `sw.js` (es. da `schedine-cache-v3` a `v4`), altrimenti il
service worker potrebbe continuare a servire la versione vecchia dalla cache.

Lo stesso numero è mostrato nell'app (menu `⋮` in basso) come promemoria di quale
versione hai davanti: quando bumpi `CACHE_NAME`, aggiorna allo stesso valore anche
la riga `<div class="hint" ...>v9</div>` dentro il blocco `menuOverlay` in
`index.html`.

## Backup dei dati

Da dentro l'app: tab "Aggiungi" → "Esporta CSV". Tienilo come backup, specialmente
prima di cancellare i dati del browser o cambiare telefono — l'import (stesso tab)
li reimporta senza perdite (data, categoria, punti, nota).

## Sincronizzare i dati tra più dispositivi

La sincronizzazione è primitiva e volutamente senza vero login: la passphrase che
scegli viene trasformata in un codice (hash SHA-256) e usata come "etichetta" del
tuo storico su un database cloud gratuito (Firestore). Chi conosce la passphrase
vede quello storico; non c'è verifica di identità né recupero password — se la
perdi, ne scegli un'altra e riparti da zero dati su quel profilo (i CSV esportati
restano comunque il backup di riferimento). Adatta a dati non sensibili come questo
tracker, non a informazioni riservate.

### 1. Crea il progetto Firebase (una volta sola)

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) →
   "Aggiungi progetto" (gratuito, non serve carta di credito per questo utilizzo).
2. Nel progetto, vai su **Build → Firestore Database** → "Crea database" →
   scegli una region vicina a te → modalità **produzione**.
3. In Firestore, tab **Regole**, incolla queste regole e pubblica:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /schedine_profiles/{profileId} {
         allow get, write: if true;
         allow list: if false;
       }
     }
   }
   ```

   (Permettono di leggere/scrivere solo conoscendo l'esatto ID del profilo — cioè
   la passphrase giusta — ma non di elencare tutti i profili esistenti.)

4. Vai su **Impostazioni progetto** (icona ingranaggio) → scorri fino a "Le tue
   app" → aggiungi una **app Web** (icona `</>`) → copia l'oggetto di
   configurazione mostrato (`apiKey`, `authDomain`, `projectId`, ecc.).

### 2. Collega l'app a quel progetto

Apri `index.html`, cerca `FIREBASE_CONFIG` (vicino al fondo del file) e sostituisci
i valori segnaposto `YOUR_...` con quelli copiati al punto precedente. Ricarica i
file sul repo GitHub (o fai push).

### 3. Attiva la sincronizzazione nell'app

Nell'app, tocca il menu `⋮` in alto → "🔗 Sincronizza tra dispositivi" → inserisci
una passphrase a piacere → "Sincronizza". Ripeti la stessa passphrase sugli altri
dispositivi: al primo collegamento, se il profilo cloud è vuoto l'app carica i
dati locali su Firestore; se il profilo esiste già, scarica quei dati sostituendo
quelli locali del dispositivo. Da quel momento ogni modifica viene salvata anche
sul cloud automaticamente (in locale funziona comunque offline).

Per tornare a un uso solo locale su un dispositivo, riapri lo stesso menu →
"Disconnetti (solo locale)": i dati sul cloud restano intatti.

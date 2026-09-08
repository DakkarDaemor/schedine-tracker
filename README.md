# Schedine Tracker

App locale (nessun server, nessun account) per registrare schedine/punti giorno per
giorno, con statistiche settimanali e mensili e import/export CSV compatibile Excel.

I dati restano solo sul tuo dispositivo (`localStorage` del browser). Non c'è alcun
backend: nessun dato viene inviato altrove.

## Pubblicare su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `schedine-tracker`), pubblico.
2. Carica tutti i file di questa cartella nella root del repo:
   `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`.
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

## Aggiornare l'app in futuro

Basta modificare `index.html` e ricaricare i file sul repo (o fare push). Se cambi
la logica offline, aumenta il numero in `CACHE_NAME` dentro `sw.js` (es. da
`schedine-cache-v1` a `v2`), altrimenti il service worker potrebbe continuare a
servire la versione vecchia dalla cache.

## Backup dei dati

Da dentro l'app: tab "Aggiungi" → "Esporta CSV". Tienilo come backup, specialmente
prima di cancellare i dati del browser o cambiare telefono — l'import (stesso tab)
li reimporta senza perdite (data, categoria, punti, nota).

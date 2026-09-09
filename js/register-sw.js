if("serviceWorker" in navigator){
  // se c'è già un service worker che controlla la pagina, un cambio di
  // controller significa che è entrata una versione aggiornata dell'app:
  // ricarico una volta sola per servire subito i file nuovi.
  var hadController = !!navigator.serviceWorker.controller;
  var refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", function(){
    if(!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").catch(function(){ /* offline non disponibile, l'app funziona comunque online */ });
  });
}

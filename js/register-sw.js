if("serviceWorker" in navigator){
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js").catch(function(){ /* offline non disponibile, l'app funziona comunque online */ });
  });
}

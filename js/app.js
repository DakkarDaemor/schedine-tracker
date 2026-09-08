(function(){
  "use strict";
  var STORAGE_KEY = "schedine_entries_v1";
  var entries = [];

  // ---------- storage ----------
  function load(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      entries = raw ? JSON.parse(raw) : [];
    }catch(e){ entries = []; }
    // migrazione: le schedine salvate prima dell'introduzione della categoria
    // vengono uniformate al default "Schedina"
    var migrated = false;
    entries.forEach(function(e){
      if(!e.category){ e.category = "Schedina"; migrated = true; }
    });
    if(migrated) save();
  }
  function save(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }catch(e){
      showToast("Errore nel salvataggio dati");
    }
    if(window.SchedineSync && window.SchedineSync.isConnected()){
      window.SchedineSync.push(entries);
    }
  }

  // ---------- utils ----------
  function todayStr(){
    var d = new Date();
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  }
  function pad(n){ return n<10 ? "0"+n : ""+n; }
  function fmtDateIt(iso){
    var p = iso.split("-");
    return p[2]+"/"+p[1]+"/"+p[0];
  }
  function fmtPoints(n){
    var s = (Math.round(n*100)/100).toString();
    return s;
  }
  function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  function getISOWeek(dateObj){
    var d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    var dayNum = (d.getUTCDay() + 6) % 7; // Monday=0
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    var firstThursday = new Date(Date.UTC(d.getUTCFullYear(),0,4));
    var week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay()+6)%7)) / 7);
    return { year: d.getUTCFullYear(), week: week };
  }

  var MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

  var CATEGORY_STYLES = {
    "Schedina": {bg:"#C9A227", fg:"#20241f"},
    "PR Check": {bg:"#3B7A8C", fg:"#ffffff"},
    "Meeting":  {bg:"#7A5C9E", fg:"#ffffff"},
    "Rebase":   {bg:"#C97A2A", fg:"#20241f"},
    "Rework":   {bg:"#B23A32", fg:"#ffffff"}
  };
  function categoryStyle(cat){
    return CATEGORY_STYLES[cat] || {bg:"#8a8574", fg:"#ffffff"}; // fallback per categorie custom da CSV
  }

  function weekKey(iso){
    var d = new Date(iso+"T00:00:00");
    var w = getISOWeek(d);
    return w.year+"-W"+pad(w.week);
  }
  function monthKey(iso){
    return iso.slice(0,7); // YYYY-MM
  }
  function weekLabel(key){
    var parts = key.split("-W");
    return "Sett. "+parseInt(parts[1],10)+" · "+parts[0];
  }
  function monthLabel(key){
    var parts = key.split("-");
    return MONTHS_IT[parseInt(parts[1],10)-1]+" "+parts[0];
  }

  // ---------- grouping ----------
  function groupBy(keyFn, labelFn){
    var map = {};
    entries.forEach(function(e){
      var k = keyFn(e.date);
      if(!map[k]) map[k] = { key:k, label:labelFn(k), count:0, points:0 };
      map[k].count += 1;
      map[k].points += e.points;
    });
    var arr = Object.keys(map).map(function(k){ return map[k]; });
    arr.sort(function(a,b){ return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
    return arr;
  }

  // ---------- rendering: header ----------
  function renderHeader(){
    document.getElementById("headerSub").textContent =
      entries.length + (entries.length===1 ? " registrata" : " registrate");
  }

  // ---------- rendering: history ----------
  function renderHistory(){
    var list = document.getElementById("historyList");
    var empty = document.getElementById("historyEmpty");
    var sorted = entries.slice().sort(function(a,b){
      if(a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.id < a.id ? -1 : 1;
    });
    if(sorted.length===0){
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = sorted.map(function(e){
      var d = new Date(e.date+"T00:00:00");
      var cls = e.points > 0 ? "pos" : (e.points < 0 ? "neg" : "");
      return '<div class="ticket" data-id="'+e.id+'">'+
        '<div class="stub"><div class="d">'+pad(d.getDate())+'</div><div class="m">'+MONTHS_IT[d.getMonth()]+'</div></div>'+
        '<div class="perf"></div>'+
        '<div class="body">'+
          '<div><div class="points '+cls+'">'+fmtPoints(e.points)+'</div>'+
          (e.category ? '<div class="badge" style="background:'+categoryStyle(e.category).bg+';color:'+categoryStyle(e.category).fg+'">'+escapeHtml(e.category)+'</div>' : '')+
          (e.note ? '<div class="note">'+escapeHtml(e.note)+'</div>' : '')+
          '</div>'+
          '<button class="del" data-del="'+e.id+'">✕</button>'+
        '</div>'+
      '</div>';
    }).join("");
  }
  function escapeHtml(s){
    return s.replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  // ---------- rendering: stats ----------
  var statsMode = "week"; // or "month"

  function periodBounds(mode, offset){
    // returns {key, label} for current period minus offset periods
    var now = new Date();
    if(mode === "week"){
      var d = new Date(now); d.setDate(d.getDate() - offset*7);
      return weekKey(d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()));
    } else {
      var d2 = new Date(now.getFullYear(), now.getMonth()-offset, 1);
      return d2.getFullYear()+"-"+pad(d2.getMonth()+1);
    }
  }

  function renderOverview(){
    var grid = document.getElementById("overviewGrid");
    var wKeyNow = periodBounds("week",0), wKeyPrev = periodBounds("week",1);
    var mKeyNow = periodBounds("month",0), mKeyPrev = periodBounds("month",1);

    var byWeek = groupBy(weekKey, weekLabel);
    var byMonth = groupBy(monthKey, monthLabel);

    var wNow = byWeek.find(function(g){return g.key===wKeyNow;}) || {count:0,points:0};
    var wPrev = byWeek.find(function(g){return g.key===wKeyPrev;}) || {count:0,points:0};
    var mNow = byMonth.find(function(g){return g.key===mKeyNow;}) || {count:0,points:0};
    var mPrev = byMonth.find(function(g){return g.key===mKeyPrev;}) || {count:0,points:0};

    var totalCount = entries.length;
    var totalPoints = entries.reduce(function(s,e){return s+e.points;},0);
    var avg = totalCount ? (totalPoints/totalCount) : 0;

    function deltaHtml(now, prev, unit){
      if(prev===0 && now===0) return '<div class="delta flat">= sett./mese prec.</div>';
      var diff = now - prev;
      var cls = diff>0 ? "up" : (diff<0 ? "down" : "flat");
      var arrow = diff>0 ? "▲" : (diff<0 ? "▼" : "＝");
      return '<div class="delta '+cls+'">'+arrow+' '+(diff>0?"+":"")+fmtPoints(diff)+' '+unit+'</div>';
    }

    grid.innerHTML =
      tile("Schedine totali", totalCount, "") +
      tile("Punti totali", fmtPoints(totalPoints), "") +
      tile("Media punti/schedina", fmtPoints(avg), "") +
      tile("Punti questa settimana", fmtPoints(wNow.points), "", deltaHtml(wNow.points, wPrev.points, "vs sett. sc.")) +
      tile("Schedine questo mese", mNow.count, "", deltaHtml(mNow.count, mPrev.count, "vs mese sc.")) +
      tile("Punti questo mese", fmtPoints(mNow.points), "", deltaHtml(mNow.points, mPrev.points, "vs mese sc."));
  }

  function tile(label, value, unit, deltaHtml){
    return '<div class="stattile"><div class="label">'+label+'</div>'+
      '<div class="value">'+value+(unit||'')+'</div>'+
      (deltaHtml || '') + '</div>';
  }

  function renderStatsBody(){
    var groups = statsMode === "week" ? groupBy(weekKey, weekLabel) : groupBy(monthKey, monthLabel);
    var last = groups.slice(-8);
    document.getElementById("periodsTitle").textContent =
      statsMode === "week" ? "Ultime settimane" : "Ultimi mesi";

    // chart
    var svg = document.getElementById("chart");
    var W=320,H=160,padL=28,padB=18,padT=8,padR=8;
    var innerW = W-padL-padR, innerH = H-padT-padB;
    if(last.length===0){
      svg.innerHTML = '<text x="160" y="80" text-anchor="middle" font-size="11" fill="#8a8574">Nessun dato ancora</text>';
    } else {
      var maxP = Math.max.apply(null, last.map(function(g){return g.points;}).concat([1]));
      var minP = Math.min.apply(null, last.map(function(g){return g.points;}).concat([0]));
      var range = (maxP - minP) || 1;
      var bw = innerW/last.length;
      var zeroY = padT + innerH - ((0-minP)/range)*innerH;
      var bars = last.map(function(g,i){
        var y = g.points>=0 ? zeroY-((g.points-0)/range)*innerH : zeroY;
        var h = (Math.abs(g.points)/range)*innerH;
        var x = padL + i*bw + bw*0.18;
        var w = bw*0.64;
        var color = g.points>=0 ? "#2F7A4D" : "#B23A32";
        var label = g.label.split(" ")[0]==="Sett." ? g.key.split("-W")[1] : g.label.slice(0,3);
        return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+Math.max(h,1)+'" rx="2" fill="'+color+'"></rect>'+
          '<text x="'+(x+w/2)+'" y="'+(H-4)+'" text-anchor="middle" font-size="8" fill="#5b5748">'+label+'</text>';
      }).join("");
      svg.innerHTML =
        '<line x1="'+padL+'" y1="'+zeroY+'" x2="'+(W-padR)+'" y2="'+zeroY+'" stroke="#d8d0ba" stroke-width="1"></line>'+
        bars;
    }

    // table
    var tbl = document.getElementById("periodsTable");
    if(last.length===0){
      tbl.innerHTML = '<tr><td style="color:#8a8574;font-family:inherit;">Nessun dato</td></tr>';
    } else {
      var rows = last.slice().reverse().map(function(g){
        var avg = g.count ? g.points/g.count : 0;
        return '<tr><td>'+g.label+'</td><td>'+g.count+' sched.</td><td>'+fmtPoints(g.points)+' pt</td><td>media '+fmtPoints(avg)+'</td></tr>';
      }).join("");
      tbl.innerHTML = '<thead><tr><th>Periodo</th><th>Chiuse</th><th>Punti</th><th>Media</th></tr></thead><tbody>'+rows+'</tbody>';
    }
  }

  function renderStats(){
    renderOverview();
    renderStatsBody();
  }

  // ---------- CSV export/import ----------
  function exportCsv(){
    var rows = ["Data;Categoria;Punti;Note"];
    entries.slice().sort(function(a,b){return a.date<b.date?-1:1;}).forEach(function(e){
      var pts = fmtPoints(e.points).replace(".",",");
      var category = (e.category || "Schedina").replace(/;/g,",");
      var note = (e.note||"").replace(/;/g,",").replace(/\r?\n/g," ");
      rows.push(fmtDateIt(e.date)+";"+category+";"+pts+";"+note);
    });
    var csv = rows.join("\r\n");
    var blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "schedine_"+todayStr()+".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    showToast("CSV esportato");
  }

  function parseItDate(s){
    // accepts d/m/yyyy, dd/mm/yyyy, with / - or . as separator, or yyyy-mm-dd
    s = s.trim();
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if(m) return m[3]+"-"+pad(parseInt(m[1],10))+"-"+pad(parseInt(m[2],10));
    var m2 = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if(m2) return m2[1]+"-"+pad(parseInt(m2[2],10))+"-"+pad(parseInt(m2[3],10));
    return null;
  }
  function parseNum(s){
    s = s.trim();
    if(s.indexOf(",")>-1 && s.indexOf(".")===-1) s = s.replace(",",".");
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function splitCsvLine(line){
    var delim = line.indexOf(";")>-1 ? ";" : ",";
    return line.split(delim);
  }
  function decodeCsvBuffer(buffer){
    var bytes = new Uint8Array(buffer);
    try{
      return new TextDecoder("utf-8", { fatal:true }).decode(bytes);
    }catch(e){
      // non è UTF-8 valido: probabilmente il file è stato risalvato da Excel in Windows-1252
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }

  function importCsvText(text){
    var lines = text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(function(l){return l.trim()!=="";});
    if(lines.length===0){ showToast("File vuoto"); return; }
    var startIdx = 0;
    var firstCols = splitCsvLine(lines[0]).map(function(c){return c.trim().toLowerCase();});
    var hasHeader = firstCols.indexOf("data") > -1;
    var colIdx = { date:0, category:-1, points:1, note:2 }; // vecchio formato di default
    if(hasHeader){
      startIdx = 1;
      colIdx = {
        date: firstCols.indexOf("data"),
        category: firstCols.indexOf("categoria"),
        points: firstCols.indexOf("punti"),
        note: firstCols.indexOf("note")
      };
    }
    var added = 0, skipped = 0;
    for(var i=startIdx;i<lines.length;i++){
      var cols = splitCsvLine(lines[i]);
      var idx = colIdx;
      if(!hasHeader){
        // senza intestazione, deduco il formato dal numero di colonne della riga
        idx = cols.length>=4 ? {date:0,category:1,points:2,note:3} : {date:0,category:-1,points:1,note:2};
      }
      if(cols.length<2){ skipped++; continue; }
      var date = idx.date>-1 ? parseItDate(cols[idx.date]||"") : null;
      var pts = idx.points>-1 ? parseNum(cols[idx.points]||"") : null;
      var category = (idx.category>-1 && cols[idx.category]) ? cols[idx.category].trim() : "Schedina";
      var note = (idx.note>-1 && cols[idx.note]) ? cols[idx.note].trim() : "";
      if(!date || pts===null){ skipped++; continue; }
      entries.push({ id: uid(), date: date, points: pts, category: category, note: note });
      added++;
    }
    save();
    renderAll();
    showToast(added+" righe importate"+(skipped?", "+skipped+" saltate":""));
  }

  // ---------- events ----------
  function confirmDialog(message){
    return new Promise(function(resolve){
      var overlay = document.getElementById("modalOverlay");
      document.getElementById("modalMsg").textContent = message;
      overlay.classList.remove("hidden");
      function cleanup(result){
        overlay.classList.add("hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        resolve(result);
      }
      var okBtn = document.getElementById("modalOk");
      var cancelBtn = document.getElementById("modalCancel");
      function onOk(){ cleanup(true); }
      function onCancel(){ cleanup(false); }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
    });
  }

  function showToast(msg){
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._h);
    showToast._h = setTimeout(function(){ t.classList.remove("show"); }, 2200);
  }

  function switchTab(name){
    ["add","history","stats"].forEach(function(t){
      document.getElementById("tab-"+t).classList.toggle("hidden", t!==name);
    });
    document.querySelectorAll(".tabbtn").forEach(function(b){
      b.classList.toggle("active", b.getAttribute("data-tab")===name);
    });
    if(name==="stats") renderStats();
    if(name==="history") renderHistory();
  }

  function renderAll(){
    renderHeader();
    renderHistory();
    renderStats();
  }

  function openSyncOverlay(){
    var overlay = document.getElementById("syncOverlay");
    var hint = document.getElementById("syncStatusHint");
    var disconnectBtn = document.getElementById("syncDisconnectBtn");
    if(!window.SchedineSync || !window.SchedineSync.isConfigured()){
      hint.textContent = "Sincronizzazione non configurata in questa installazione.";
    } else if(window.SchedineSync.isConnected()){
      hint.textContent = "Sincronizzazione attiva su questo dispositivo.";
    } else {
      hint.textContent = "Nessuna sincronizzazione attiva: i dati restano solo su questo dispositivo.";
    }
    disconnectBtn.classList.toggle("hidden", !(window.SchedineSync && window.SchedineSync.isConnected()));
    document.getElementById("syncPassInput").value = "";
    overlay.classList.remove("hidden");
  }

  document.addEventListener("DOMContentLoaded", function(){
    load();
    document.getElementById("inDate").value = todayStr();
    renderAll();

    if(window.SchedineSync && window.SchedineSync.isConnected()){
      window.SchedineSync.pull().then(function(cloudEntries){
        if(cloudEntries === null){
          // prima sincronizzazione da questo dispositivo: carico i dati locali sul cloud
          window.SchedineSync.push(entries);
        } else {
          entries = cloudEntries;
          save();
          renderAll();
        }
      }).catch(function(){
        showToast("Sync non riuscita, uso i dati locali");
      });
    }

    document.querySelectorAll(".tabbtn").forEach(function(b){
      b.addEventListener("click", function(){ switchTab(b.getAttribute("data-tab")); });
    });

    document.getElementById("addBtn").addEventListener("click", function(){
      var date = document.getElementById("inDate").value || todayStr();
      var category = document.getElementById("inCategory").value;
      var ptsRaw = document.getElementById("inPoints").value;
      var note = document.getElementById("inNote").value.trim();
      if(ptsRaw === ""){ showToast("Inserisci i punti"); return; }
      var pts = parseFloat(ptsRaw);
      if(isNaN(pts)){ showToast("Punti non validi"); return; }
      entries.push({ id: uid(), date: date, points: pts, category: category, note: note });
      save();
      document.getElementById("inPoints").value = "3";
      document.getElementById("inNote").value = "";
      renderAll();
      var card = document.getElementById("addCard");
      card.classList.remove("stamp"); void card.offsetWidth; card.classList.add("stamp");
      showToast("Schedina registrata");
    });

    document.getElementById("historyList").addEventListener("click", function(ev){
      var id = ev.target.getAttribute("data-del");
      if(!id) return;
      confirmDialog("Eliminare questa schedina?").then(function(ok){
        if(!ok) return;
        entries = entries.filter(function(e){ return e.id !== id; });
        save();
        renderAll();
        showToast("Schedina eliminata");
      });
    });

    document.getElementById("exportBtn").addEventListener("click", exportCsv);
    document.getElementById("importBtn").addEventListener("click", function(){
      document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", function(ev){
      var file = ev.target.files[0];
      if(!file) return;
      confirmDialog("Importare \""+file.name+"\"? Le righe valide verranno aggiunte a quelle già presenti.").then(function(ok){
        if(!ok){ ev.target.value = ""; return; }
        var reader = new FileReader();
        reader.onload = function(){
          var text = decodeCsvBuffer(reader.result);
          importCsvText(text);
        };
        reader.readAsArrayBuffer(file);
        ev.target.value = "";
      });
    });

    document.getElementById("toggleWeek").addEventListener("click", function(){
      statsMode = "week";
      document.getElementById("toggleWeek").classList.add("active");
      document.getElementById("toggleMonth").classList.remove("active");
      renderStatsBody();
    });
    document.getElementById("toggleMonth").addEventListener("click", function(){
      statsMode = "month";
      document.getElementById("toggleMonth").classList.add("active");
      document.getElementById("toggleWeek").classList.remove("active");
      renderStatsBody();
    });

    document.getElementById("menuBtn").addEventListener("click", function(){
      document.getElementById("menuOverlay").classList.remove("hidden");
    });
    document.getElementById("menuCloseBtn").addEventListener("click", function(){
      document.getElementById("menuOverlay").classList.add("hidden");
    });
    document.getElementById("menuDeleteBtn").addEventListener("click", function(){
      document.getElementById("menuOverlay").classList.add("hidden");
      confirmDialog("Cancellare TUTTI i dati salvati su questo dispositivo? L'operazione non è reversibile (esporta prima il CSV se vuoi un backup).").then(function(ok){
        if(!ok) return;
        entries = [];
        save();
        renderAll();
        showToast("Dati cancellati");
      });
    });
    document.getElementById("menuSyncBtn").addEventListener("click", function(){
      document.getElementById("menuOverlay").classList.add("hidden");
      openSyncOverlay();
    });

    document.getElementById("syncCancelBtn").addEventListener("click", function(){
      document.getElementById("syncOverlay").classList.add("hidden");
    });
    document.getElementById("syncDisconnectBtn").addEventListener("click", function(){
      if(window.SchedineSync) window.SchedineSync.disconnect();
      document.getElementById("syncOverlay").classList.add("hidden");
      showToast("Sincronizzazione disattivata, ora solo locale");
    });
    document.getElementById("syncSaveBtn").addEventListener("click", function(){
      var pass = document.getElementById("syncPassInput").value.trim();
      if(!pass){ showToast("Inserisci una passphrase"); return; }
      if(!window.SchedineSync || !window.SchedineSync.isConfigured()){
        showToast("Sincronizzazione non configurata");
        return;
      }
      window.SchedineSync.connect(pass).then(function(cloudEntries){
        if(cloudEntries === null){
          window.SchedineSync.push(entries);
          showToast("Sincronizzazione attivata, dati caricati sul cloud");
        } else {
          entries = cloudEntries;
          save();
          renderAll();
          showToast("Dati sincronizzati da un altro dispositivo");
        }
        document.getElementById("syncOverlay").classList.add("hidden");
      }).catch(function(){
        showToast("Errore di sincronizzazione, riprova");
      });
    });
  });
})();

(function () {
  "use strict";
  var L = window.HPP_LOGIC;
  var DATA = window.HPP_DATA;
  var EXAM = DATA.exams["2026-03"];
  var LABELS = DATA.index.guertel_labels;
  var app = document.getElementById("app");

  var SPEICHER = "hpp_progress";
  function ladeFortschritt() {
    try {
      var roh = JSON.parse(localStorage.getItem(SPEICHER));
      if (roh && typeof roh.hoechsterGuertel === "string") return roh;
    } catch (e) {}
    return { hoechsterGuertel: "gelb", ergebnisse: [] };
  }
  function speichereFortschritt(f) {
    try { localStorage.setItem(SPEICHER, JSON.stringify(f)); } catch (e) {}
  }

  var state = { fortschritt: ladeFortschritt() };

  function leeren() { app.innerHTML = ""; }

  function zeigeGuertelauswahl() {
    leeren();
    var hoechster = state.fortschritt.hoechsterGuertel;
    var html = '<header class="kopf"><h1>HPP-Prüfungstraining</h1>' +
      '<p class="sub">' + EXAM.titel + ' · 28 Fragen</p></header>' +
      '<p class="sub2">Wähle deinen Gürtel</p><div class="guertelliste">';
    L.GUERTEL.forEach(function (g) {
      var frei = L.istFreigeschaltet(g, hoechster);
      html += '<button class="guertel' + (frei ? "" : " locked") + '" ' +
        (frei ? 'data-guertel="' + g + '"' : "disabled") + '>' +
        '<span class="punkt" style="background:var(--g-' + g + ')"></span>' +
        '<span class="gname">' + LABELS[g] + '</span>' +
        (frei ? "" : '<span class="lock">🔒</span>') + '</button>';
    });
    html += "</div>";
    app.innerHTML = html;
    app.querySelectorAll("[data-guertel]").forEach(function (el) {
      el.addEventListener("click", function () {
        starteValidierung(el.getAttribute("data-guertel"));
      });
    });
  }

  function starteValidierung(guertel) {
    state.pruefung = {
      guertel: guertel,
      antworten: {},      // { nr: [Buchstaben] }
      index: 0,           // aktueller Frageindex 0..27
    };
    zeigeFrage();
  }

  function aktuelleStufe() {
    var frage = EXAM.fragen[state.pruefung.index];
    return { frage: frage, stufe: frage.stufen[state.pruefung.guertel] };
  }

  function zeigeFrage() {
    leeren();
    var p = state.pruefung;
    var s = aktuelleStufe();
    var stufe = s.stufe, frage = s.frage;
    var gewaehlt = p.antworten[frage.nr] || [];
    var mehrfach = L.erwarteMehrfach(stufe.loesung);

    var html = '<div class="ex">';
    html += '<div class="ex-top">' +
      '<span class="ex-belt"><span class="punkt-s" style="background:var(--g-' + p.guertel + ')"></span></span>' +
      '<span class="ex-count">' + (p.index + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="ex-timer" id="timer">60:00</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((p.index + 1) / L.ANZAHL_FRAGEN * 100) + '%"></i></div>';
    html += '<div class="ex-body"><div class="ex-scroll">';
    html += '<p class="ex-stamm">' + escape(stufe.stamm) + '</p>';
    if (stufe.aussagen) {
      html += '<ol class="aussagen">';
      Object.keys(stufe.aussagen).forEach(function (k) {
        html += '<li><b>' + k + '.</b> ' + escape(stufe.aussagen[k]) + '</li>';
      });
      html += '</ol>';
    }
    if (mehrfach) html += '<p class="ex-hint">Wählen Sie zwei Antworten!</p>';
    html += '</div>';
    html += '<div class="ex-opts">';
    Object.keys(stufe.optionen).forEach(function (b) {
      var sel = gewaehlt.indexOf(b) >= 0 ? " sel" : "";
      html += '<button class="ex-opt' + sel + '" data-opt="' + b + '">' +
        '<span class="ltr">' + b + '</span><span class="t">' + escape(stufe.optionen[b]) + '</span></button>';
    });
    html += '</div></div>';
    html += '<div class="ex-foot">' +
      '<button class="ex-nav-ov" id="btn-ov">▦ Übersicht</button>' +
      (p.index > 0 ? '<button class="btn" id="btn-prev">‹</button>' : "") +
      '<button class="btn btn-primary ex-next" id="btn-next">' +
      (p.index === L.ANZAHL_FRAGEN - 1 ? "Abgeben" : "Weiter ›") + '</button></div>';
    html += "</div>";
    app.innerHTML = html;

    app.querySelectorAll("[data-opt]").forEach(function (el) {
      el.addEventListener("click", function () {
        waehle(frage.nr, el.getAttribute("data-opt"), mehrfach);
      });
    });
    app.querySelector("#btn-next").addEventListener("click", weiter);
    var prev = app.querySelector("#btn-prev");
    if (prev) prev.addEventListener("click", zurueck);
    app.querySelector("#btn-ov").addEventListener("click", zeigeUebersicht);
  }

  function waehle(nr, buchstabe, mehrfach) {
    var akt = state.pruefung.antworten[nr] || [];
    if (mehrfach) {
      var i = akt.indexOf(buchstabe);
      if (i >= 0) akt = akt.filter(function (x) { return x !== buchstabe; });
      else if (akt.length < 2) akt = akt.concat([buchstabe]); // max zwei
    } else {
      akt = [buchstabe];
    }
    state.pruefung.antworten[nr] = akt;
    zeigeFrage();
  }

  function weiter() {
    if (state.pruefung.index === L.ANZAHL_FRAGEN - 1) { abgeben(); return; }
    state.pruefung.index++;
    zeigeFrage();
  }
  function zurueck() {
    if (state.pruefung.index > 0) state.pruefung.index--;
    zeigeFrage();
  }

  function escape(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  function zaehleRichtige() {
    var p = state.pruefung, richtig = 0;
    EXAM.fragen.forEach(function (frage) {
      var stufe = frage.stufen[p.guertel];
      var gewaehlt = p.antworten[frage.nr] || [];
      if (L.istRichtig(gewaehlt, stufe.loesung)) richtig++;
    });
    return richtig;
  }

  function heute() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function abgeben() {
    var p = state.pruefung;
    var offen = L.ANZAHL_FRAGEN - Object.keys(p.antworten).filter(function (nr) {
      return (p.antworten[nr] || []).length > 0;
    }).length;
    if (offen > 0 && !window.confirm(offen + " Frage(n) noch offen. Wirklich abgeben?")) return;

    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    var richtig = zaehleRichtige();
    var bestanden = L.bestanden(richtig);
    var vorher = state.fortschritt.hoechsterGuertel;
    var neu = L.naechsterHoechster(vorher, p.guertel, richtig);
    var freigeschaltet = neu !== vorher;
    state.fortschritt.hoechsterGuertel = neu;
    state.fortschritt.ergebnisse = (state.fortschritt.ergebnisse || []).concat([
      { guertel: p.guertel, richtig: richtig, datum: heute() }
    ]);
    speichereFortschritt(state.fortschritt);
    zeigeAuswertung(richtig, bestanden, freigeschaltet, neu);
  }

  function zeigeAuswertung(richtig, bestanden, freigeschaltet, neu) {
    leeren();
    var html = '<div class="erg">' +
      '<div class="erg-badge ' + (bestanden ? "ok" : "fail") + '">' +
      '<div class="erg-zahl">' + richtig + ' / ' + L.ANZAHL_FRAGEN + '</div>' +
      '<div class="erg-txt">' + (bestanden ? "Bestanden" : "Nicht bestanden") +
      ' · Grenze ' + L.BESTEHENSGRENZE + '</div></div>';
    if (freigeschaltet) {
      html += '<p class="erg-unlock">🎉 Neuer Gürtel freigeschaltet: <b>' + LABELS[neu] + '</b></p>';
    }
    html += '<div class="erg-foot">' +
      '<button class="btn" id="erg-review">Durchsicht</button>' +
      '<button class="btn btn-primary" id="erg-home">Zur Gürtelauswahl</button></div></div>';
    app.innerHTML = html;
    app.querySelector("#erg-home").addEventListener("click", zeigeGuertelauswahl);
    app.querySelector("#erg-review").addEventListener("click", function () { zeigeDurchsicht(0); });
  }

  function zeigeDurchsicht() { alert("Durchsicht — kommt in Task 9"); }
  function zeigeUebersicht() {
    leeren();
    var p = state.pruefung;
    var beantwortet = Object.keys(p.antworten).filter(function (nr) {
      return (p.antworten[nr] || []).length > 0;
    }).length;
    var html = '<div class="ov">' +
      '<h2 class="ov-title">Übersicht</h2>' +
      '<p class="sub">' + beantwortet + ' von ' + L.ANZAHL_FRAGEN + ' beantwortet · tippen zum Springen</p>' +
      '<div class="ovgrid">';
    EXAM.fragen.forEach(function (frage, i) {
      var done = (p.antworten[frage.nr] || []).length > 0 ? " done" : "";
      var cur = i === p.index ? " cur" : "";
      html += '<button class="ovc' + done + cur + '" data-jump="' + i + '">' + (i + 1) + '</button>';
    });
    html += '</div><div class="ov-foot">' +
      '<button class="btn" id="ov-back">‹ Zurück</button>' +
      '<button class="btn btn-dark" id="ov-submit">Prüfung abgeben</button></div></div>';
    app.innerHTML = html;
    app.querySelectorAll("[data-jump]").forEach(function (el) {
      el.addEventListener("click", function () {
        state.pruefung.index = parseInt(el.getAttribute("data-jump"), 10);
        zeigeFrage();
      });
    });
    app.querySelector("#ov-back").addEventListener("click", zeigeFrage);
    app.querySelector("#ov-submit").addEventListener("click", abgeben);
  }

  // Export fuer spaetere Tasks
  window.HPP_APP = {
    state: state,
    speichereFortschritt: speichereFortschritt,
    zeigeGuertelauswahl: zeigeGuertelauswahl,
    zaehleRichtige: zaehleRichtige,
  };

  zeigeGuertelauswahl();
})();

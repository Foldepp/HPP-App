(function () {
  "use strict";
  var L = window.HPP_LOGIC;
  var DATA = window.HPP_DATA;
  var EXAM = DATA.exams["2026-03"];
  var LABELS = DATA.index.guertel_labels;
  var app = document.getElementById("app");

  var EXAMS = DATA.exams;
  var POOL_IDS = Object.keys(EXAMS);
  var THEMEN = DATA.themenbereiche; // [{id,label}]
  function themaLabel(id) {
    for (var i = 0; i < THEMEN.length; i++) if (THEMEN[i].id === id) return THEMEN[i].label;
    return id;
  }
  function findeFrage(examId, nr) {
    var fragen = EXAMS[examId].fragen;
    for (var i = 0; i < fragen.length; i++) if (fragen[i].nr === nr) return fragen[i];
    return null;
  }
  // alle Karten eines Levels über alle Pool-Prüfungen; nur Fragen mit themenbereich
  function alleKartenDesLevels(level, themaFilter) {
    var out = [];
    POOL_IDS.forEach(function (examId) {
      EXAMS[examId].fragen.forEach(function (f) {
        if (!f.themenbereich) return; // korrupte/unzugeordnete Prüfungen überspringen
        if (themaFilter && f.themenbereich !== themaFilter) return;
        out.push({ examId: examId, nr: f.nr, level: level, thema: f.themenbereich });
      });
    });
    return out;
  }
  var srs = L_srsLade();
  function L_srsLade() { return window.HPP_SRS.lade(window.localStorage); }
  function srsSpeichern() { window.HPP_SRS.speichere(window.localStorage, srs); }

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

  function homeButtonHtml(guertel) {
    return '<button class="home-btn" id="btn-home" aria-label="Zur Levelauswahl"' +
      ' style="box-shadow: inset 0 0 0 2px var(--g-' + guertel + ')">🏠</button>';
  }
  function bindHome() {
    var h = app.querySelector("#btn-home");
    if (h) h.addEventListener("click", homeKlick);
  }
  function homeKlick() {
    if (state.pruefung && !state.pruefung.abgegeben) {
      if (!window.confirm("Prüfung abbrechen? Der aktuelle Versuch geht verloren.")) return;
      if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
      state.pruefung = null;
    }
    state.session = null;
    zeigeGuertelauswahl();
  }

  function zeigeGuertelauswahl() {
    leeren();
    var hoechster = state.fortschritt.hoechsterGuertel;
    var html = '<header class="kopf"><h1>HPP-Prüfungstraining</h1>' +
      '<p class="sub">' + EXAM.titel + ' · 28 Fragen</p></header>' +
      '<p class="sub2">Wähle dein Level</p><div class="guertelliste">';
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
      antworten: {},      // { nr: [Original-Buchstaben] }
      index: 0,           // aktueller Frageindex 0..27
      reihenfolge: baueReihenfolge(guertel), // { nr: [Original-Buchstaben gemischt] }
    };
    state.restSekunden = 60 * 60;
    starteTimer();
    zeigeFrage();
  }

  function baueReihenfolge(guertel) {
    var r = {};
    EXAM.fragen.forEach(function (frage) {
      var stufe = frage.stufen[guertel];
      r[frage.nr] = L.mischen(Object.keys(stufe.optionen));
    });
    return r;
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
      homeButtonHtml(p.guertel) +
      '<span class="ex-count">' + LABELS[p.guertel] + ' · ' + (p.index + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span>' +
      '<span class="ex-timer" id="timer">60:00</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((p.index + 1) / L.ANZAHL_FRAGEN * 100) + '%; background:var(--g-' + p.guertel + ')"></i></div>';
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
    L.anzeigeOptionen(stufe.optionen, p.reihenfolge[frage.nr]).forEach(function (o) {
      var sel = gewaehlt.indexOf(o.original) >= 0 ? " sel" : "";
      html += '<button class="ex-opt' + sel + '" data-opt="' + o.original + '">' +
        '<span class="ltr">' + o.label + '</span><span class="t">' + escape(o.text) + '</span></button>';
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
    bindHome();
    aktualisiereTimerAnzeige();
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
    if (!p || p.abgegeben) return; // schon abgegeben (z. B. Timer-Ablauf) -> kein Doppelschreiben
    var offen = L.ANZAHL_FRAGEN - Object.keys(p.antworten).filter(function (nr) {
      return (p.antworten[nr] || []).length > 0;
    }).length;
    if (offen > 0 && !window.confirm(offen + " Frage(n) noch offen. Wirklich abgeben?")) return;

    p.abgegeben = true;
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
      homeButtonHtml(state.pruefung.guertel) +
      '<div class="erg-badge ' + (bestanden ? "ok" : "fail") + '">' +
      '<div class="erg-zahl">' + richtig + ' / ' + L.ANZAHL_FRAGEN + '</div>' +
      '<div class="erg-txt">' + (bestanden ? "Bestanden" : "Nicht bestanden") +
      ' · Grenze ' + L.BESTEHENSGRENZE + '</div></div>';
    if (freigeschaltet) {
      html += '<p class="erg-unlock">🎉 Freigeschaltet: <b>' + LABELS[neu] + '</b></p>';
    }
    html += '<div class="erg-foot">' +
      '<button class="btn" id="erg-review">Durchsicht</button>' +
      '<button class="btn btn-primary" id="erg-home">Zur Levelauswahl</button></div></div>';
    app.innerHTML = html;
    app.querySelector("#erg-home").addEventListener("click", zeigeGuertelauswahl);
    app.querySelector("#erg-review").addEventListener("click", function () { zeigeDurchsicht(0); });
    bindHome();
  }

  function zeigeDurchsicht(idx) {
    leeren();
    var p = state.pruefung;
    var frage = EXAM.fragen[idx];
    var stufe = frage.stufen[p.guertel];
    var gewaehlt = p.antworten[frage.nr] || [];
    var richtig = L.istRichtig(gewaehlt, stufe.loesung);

    var html = '<div class="rev">' +
      '<div class="rev-top"><div class="rev-top-l">' + homeButtonHtml(p.guertel) +
      '<span class="ex-count">' + (idx + 1) + ' / ' + L.ANZAHL_FRAGEN + '</span></div>' +
      '<span class="rev-mark ' + (richtig ? "ok" : "fail") + '">' + (richtig ? "✓ richtig" : "✗ falsch") + '</span></div>';
    html += '<p class="ex-stamm">' + escape(stufe.stamm) + '</p>';
    if (stufe.aussagen) {
      html += '<ol class="aussagen">';
      Object.keys(stufe.aussagen).forEach(function (k) {
        html += '<li><b>' + k + '.</b> ' + escape(stufe.aussagen[k]) + '</li>';
      });
      html += '</ol>';
    }
    html += '<div class="ex-opts">';
    L.anzeigeOptionen(stufe.optionen, p.reihenfolge[frage.nr]).forEach(function (o) {
      var istLoesung = stufe.loesung.indexOf(o.original) >= 0;
      var warGewaehlt = gewaehlt.indexOf(o.original) >= 0;
      var cls = istLoesung ? " loesung" : (warGewaehlt ? " falschgewaehlt" : "");
      html += '<div class="ex-opt' + cls + '"><span class="ltr">' + o.label + '</span>' +
        '<span class="t">' + escape(o.text) + '</span>' +
        (istLoesung ? '<span class="haken">✓</span>' : (warGewaehlt ? '<span class="haken">✗</span>' : "")) + '</div>';
    });
    html += '</div>';
    if (frage.kern) html += '<div class="rev-kern"><b>Wissenskern:</b> ' + escape(frage.kern) + '</div>';
    html += '<div class="rev-foot">' +
      (idx > 0 ? '<button class="btn" id="rev-prev">‹</button>' : '<span></span>') +
      '<button class="btn" id="rev-home">Fertig</button>' +
      (idx < L.ANZAHL_FRAGEN - 1 ? '<button class="btn btn-primary" id="rev-next">›</button>' : '<span></span>') +
      '</div></div>';
    app.innerHTML = html;
    var prev = app.querySelector("#rev-prev");
    if (prev) prev.addEventListener("click", function () { zeigeDurchsicht(idx - 1); });
    var next = app.querySelector("#rev-next");
    if (next) next.addEventListener("click", function () { zeigeDurchsicht(idx + 1); });
    app.querySelector("#rev-home").addEventListener("click", zeigeGuertelauswahl);
    bindHome();
  }
  function zeigeUebersicht() {
    leeren();
    var p = state.pruefung;
    var beantwortet = Object.keys(p.antworten).filter(function (nr) {
      return (p.antworten[nr] || []).length > 0;
    }).length;
    var html = '<div class="ov">' +
      '<div class="ov-top">' + homeButtonHtml(p.guertel) + '<h2 class="ov-title">Übersicht</h2></div>' +
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
    bindHome();
  }

  function starteTimer() {
    if (state.timerId) clearInterval(state.timerId);
    aktualisiereTimerAnzeige();
    state.timerId = setInterval(function () {
      state.restSekunden--;
      if (state.restSekunden <= 0) {
        state.restSekunden = 0;
        aktualisiereTimerAnzeige();
        clearInterval(state.timerId);
        state.timerId = null;
        abgeben();
        return;
      }
      aktualisiereTimerAnzeige();
    }, 1000);
  }

  function aktualisiereTimerAnzeige() {
    var el = document.getElementById("timer");
    if (!el) return;
    var m = Math.floor(state.restSekunden / 60);
    var s = state.restSekunden % 60;
    el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    if (state.restSekunden <= 5 * 60) el.classList.add("low");
    else el.classList.remove("low");
  }

  function starteSession(karten, level, kontext, zurueck) {
    if (!karten.length) { window.alert("Keine Karten vorhanden."); zurueck(); return; }
    var gemischt = L.mischen(karten);
    state.session = {
      level: level, kontext: kontext, zurueck: zurueck,
      queue: gemischt.slice(), pos: 0, gesamt: gemischt.length,
      reihenfolge: {}, gewertet: {}, pending: {}, reshows: {}, geprueft: false, gewaehlt: [], aktFeedback: null,
    };
    zeigeKarte();
  }

  function sessionKartenId(k) { return window.HPP_SRS.kartenId(k.examId, k.nr, k.level); }

  function zeigeKarte() {
    leeren();
    var se = state.session;
    var k = se.queue[se.pos];
    var frage = findeFrage(k.examId, k.nr);
    var stufe = frage.stufen[k.level];
    var kid = sessionKartenId(k);
    if (!se.reihenfolge[kid]) se.reihenfolge[kid] = L.mischen(Object.keys(stufe.optionen));
    var mehrfach = L.erwarteMehrfach(stufe.loesung);
    se.geprueft = (se.aktFeedback !== null);

    var html = '<div class="ex">';
    html += '<div class="ex-top">' + homeButtonHtml(k.level) +
      '<span class="ex-count">' + (se.pos + 1) + ' / ' + se.gesamt + '</span>' +
      '<span class="th-chip">' + escape(themaLabel(k.thema)) + '</span></div>';
    html += '<div class="ex-bar"><i style="width:' + ((se.pos) / se.gesamt * 100) + '%; background:var(--g-' + k.level + ')"></i></div>';
    html += '<div class="ex-body"><div class="ex-scroll">';
    html += '<p class="ex-stamm">' + escape(stufe.stamm) + '</p>';
    if (stufe.aussagen) {
      html += '<ol class="aussagen">';
      Object.keys(stufe.aussagen).forEach(function (n) {
        html += '<li><b>' + n + '.</b> ' + escape(stufe.aussagen[n]) + '</li>';
      });
      html += '</ol>';
    }
    if (mehrfach && !se.geprueft) html += '<p class="ex-hint">Wählen Sie zwei Antworten!</p>';
    html += '<div class="ex-opts">';
    L.anzeigeOptionen(stufe.optionen, se.reihenfolge[kid]).forEach(function (o) {
      var cls = "";
      if (se.geprueft) {
        if (stufe.loesung.indexOf(o.original) >= 0) cls = " correct";
        else if (se.gewaehlt.indexOf(o.original) >= 0) cls = " wrong";
      } else if (se.gewaehlt.indexOf(o.original) >= 0) cls = " sel";
      var mk = "";
      if (se.geprueft && stufe.loesung.indexOf(o.original) >= 0) mk = '<span class="mk">✓</span>';
      else if (se.geprueft && se.gewaehlt.indexOf(o.original) >= 0) mk = '<span class="mk">✗</span>';
      html += '<div class="ex-opt' + cls + '" data-opt="' + o.original + '">' +
        '<span class="ltr">' + o.label + '</span><span class="t">' + escape(o.text) + '</span>' + mk + '</div>';
    });
    html += '</div>';
    if (se.geprueft) {
      var fb = se.aktFeedback;
      html += '<div class="divider">Auswertung</div>' +
        '<div class="fb ' + (fb.richtig ? "good" : "bad") + '">' +
        '<div class="fb-hd">' + (fb.richtig ? "✓ Richtig" : "✗ Leider falsch") + '</div>' +
        (frage.kern ? '<div class="fb-kern"><b>Wissenskern:</b> ' + escape(frage.kern) + '</div>' : "") +
        '</div>' +
        '<div class="ret">' + escape(fb.hinweis) + '</div>';
    }
    html += '</div>'; // ex-body
    html += '<div class="ex-foot">';
    if (!se.geprueft) html += '<button class="btn btn-primary ex-next" id="btn-pruefen">Prüfen</button>';
    else html += '<button class="btn btn-primary ex-next" id="btn-weiter">' + ((se.pos === se.queue.length - 1 && !se.pending[kid]) ? "Fertig" : "Weiter ›") + '</button>';
    html += '</div></div>';
    app.innerHTML = html;

    if (!se.geprueft) {
      app.querySelectorAll("[data-opt]").forEach(function (el) {
        el.addEventListener("click", function () { waehleKarte(el.getAttribute("data-opt"), mehrfach); });
      });
      app.querySelector("#btn-pruefen").addEventListener("click", pruefeKarte);
    } else {
      app.querySelector("#btn-weiter").addEventListener("click", naechsteKarte);
      var fbEl = app.querySelector(".fb"); if (fbEl) fbEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    bindHome();
  }

  function waehleKarte(buchstabe, mehrfach) {
    var se = state.session, akt = se.gewaehlt;
    if (mehrfach) {
      var i = akt.indexOf(buchstabe);
      if (i >= 0) akt = akt.filter(function (x) { return x !== buchstabe; });
      else if (akt.length < 2) akt = akt.concat([buchstabe]);
    } else { akt = [buchstabe]; }
    se.gewaehlt = akt;
    zeigeKarte();
  }

  function pruefeKarte() {
    var se = state.session;
    if (!se.gewaehlt.length) return;
    var k = se.queue[se.pos];
    var frage = findeFrage(k.examId, k.nr);
    var stufe = frage.stufen[k.level];
    var richtig = L.istRichtig(se.gewaehlt, stufe.loesung);
    var kid = sessionKartenId(k);
    if (se.gewertet[kid] === undefined) {
      var res = window.HPP_SRS.werte(srs, k.examId, k.nr, k.level, k.thema, richtig, L.heuteIso());
      srsSpeichern();
      se.gewertet[kid] = true;
      se.pending[kid] = !richtig;
      se.reshows[kid] = 0;
      se.aktFeedback = { richtig: richtig, hinweis: feedbackHinweis(res) };
    } else {
      if (richtig) se.pending[kid] = false;
      se.aktFeedback = { richtig: richtig, hinweis: richtig ? "Diesmal richtig — gut!" : "Schau dir die Lösung nochmal an." };
    }
    zeigeKarte();
  }

  function feedbackHinweis(res) {
    if (res.gemeistert) return "🎉 Gemeistert!";
    var tage = res.due ? Math.round((new Date(res.due + "T00:00:00Z") - new Date(L.heuteIso() + "T00:00:00Z")) / 86400000) : 0;
    var wann = tage <= 1 ? "morgen" : "in " + tage + " Tagen";
    return "Kommt " + wann + " wieder · Streak " + res.streak + "/" + L.MASTER_STREAK;
  }

  function naechsteKarte() {
    var se = state.session;
    var k = se.queue[se.pos];
    var kid = sessionKartenId(k);
    if (se.pending[kid] && se.reshows[kid] < 3) {
      se.queue.push(k); se.reshows[kid]++;
    }
    se.pos++;
    se.gewaehlt = [];
    se.aktFeedback = null;
    if (se.pos >= se.queue.length) { se.zurueck(); return; }
    zeigeKarte();
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

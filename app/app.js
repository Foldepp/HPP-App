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

  // Platzhalter bis Task 6 — zeigt vorerst nur den gewaehlten Guertel
  function starteValidierung(guertel) {
    alert("Starte Prüfung: " + LABELS[guertel]); // wird in Task 6 ersetzt
  }

  // Export fuer spaetere Tasks
  window.HPP_APP = {
    state: state,
    speichereFortschritt: speichereFortschritt,
    zeigeGuertelauswahl: zeigeGuertelauswahl,
  };

  zeigeGuertelauswahl();
})();

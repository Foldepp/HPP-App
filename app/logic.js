(function (root) {
  "use strict";

  var GUERTEL = ["gelb", "gruen", "blau", "braun", "schwarz"];
  var ANZAHL_FRAGEN = 28;
  var BESTEHENSGRENZE = 21;

  function istRichtig(gewaehlt, loesung) {
    if (gewaehlt.length !== loesung.length) return false;
    var a = gewaehlt.slice().sort().join(",");
    var b = loesung.slice().sort().join(",");
    return a === b;
  }

  function bestanden(richtigeAnzahl) {
    return richtigeAnzahl >= BESTEHENSGRENZE;
  }

  function istFreigeschaltet(guertel, hoechster) {
    return GUERTEL.indexOf(guertel) <= GUERTEL.indexOf(hoechster);
  }

  function naechsterHoechster(hoechster, gespielter, richtigeAnzahl) {
    if (!bestanden(richtigeAnzahl)) return hoechster;
    var neu = GUERTEL.indexOf(gespielter) + 1;
    var kandidat = neu < GUERTEL.length ? GUERTEL[neu] : gespielter;
    return GUERTEL.indexOf(kandidat) > GUERTEL.indexOf(hoechster) ? kandidat : hoechster;
  }

  function erwarteMehrfach(loesung) {
    return loesung.length >= 2;
  }

  function mischen(arr, rnd) {
    var r = rnd || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function anzeigeOptionen(optionen, reihenfolge) {
    var labels = "ABCDEFGHIJ";
    return reihenfolge.map(function (orig, i) {
      return { label: labels.charAt(i), original: orig, text: optionen[orig] };
    });
  }

  var api = {
    GUERTEL: GUERTEL,
    ANZAHL_FRAGEN: ANZAHL_FRAGEN,
    BESTEHENSGRENZE: BESTEHENSGRENZE,
    istRichtig: istRichtig,
    bestanden: bestanden,
    istFreigeschaltet: istFreigeschaltet,
    naechsterHoechster: naechsterHoechster,
    erwarteMehrfach: erwarteMehrfach,
    mischen: mischen,
    anzeigeOptionen: anzeigeOptionen,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.HPP_LOGIC = api;
  }
})(typeof window !== "undefined" ? window : this);

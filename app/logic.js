(function (root) {
  "use strict";

  var GUERTEL = ["gelb", "gruen", "blau", "braun", "schwarz"];
  var ANZAHL_FRAGEN = 28;
  var BESTEHENSGRENZE = 21;
  var GRATIS_GUERTEL = ["gelb", "gruen"];
  var BEZAHL_GUERTEL = GUERTEL.filter(function (g) { return GRATIS_GUERTEL.indexOf(g) < 0; });

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

  function istGratisLevel(guertel) {
    return GRATIS_GUERTEL.indexOf(guertel) >= 0;
  }

  function istBezahlLevel(guertel) {
    return BEZAHL_GUERTEL.indexOf(guertel) >= 0;
  }

  function levelStatus(guertel, hoechster, hatZugang) {
    if (!istFreigeschaltet(guertel, hoechster)) return "guertel-gesperrt";
    if (istBezahlLevel(guertel) && !hatZugang) return "bezahl-gesperrt";
    return "frei";
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

  function baueUebenSession(faellige, alle, ziel, idFn) {
    var ids = {};
    faellige.forEach(function (k) { ids[idFn(k)] = true; });
    var rest = alle.filter(function (k) { return !ids[idFn(k)]; });
    rest = mischen(rest);
    var out = faellige.slice();
    for (var i = 0; i < rest.length && out.length < ziel; i++) out.push(rest[i]);
    return out;
  }

  var MASTER_STREAK = 4;
  var SRS_INTERVALE = { 1: 2, 2: 4, 3: 8 };

  function addTage(iso, n) {
    var d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function istFaellig(dueIso, heuteIso) {
    return dueIso <= heuteIso;
  }

  function werteKarteLogik(streak, richtig, heuteIso) {
    var neu = richtig ? streak + 1 : 0;
    if (richtig && neu >= MASTER_STREAK) {
      return { streak: neu, due: null, gemeistert: true };
    }
    var tage = richtig ? SRS_INTERVALE[neu] : 1;
    return { streak: neu, due: addTage(heuteIso, tage), gemeistert: false };
  }

  function heuteIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function themaAufgeloest(pref, systemDark) {
    if (pref === "hell") return "hell";
    if (pref === "dunkel") return "dunkel";
    return systemDark ? "dunkel" : "hell";
  }

  var THEMA_ZYKLUS = ["auto", "hell", "dunkel"];
  function naechstesThema(aktuell) {
    var i = THEMA_ZYKLUS.indexOf(aktuell);
    return THEMA_ZYKLUS[(i + 1) % THEMA_ZYKLUS.length];
  }

  var api = {
    GUERTEL: GUERTEL,
    ANZAHL_FRAGEN: ANZAHL_FRAGEN,
    BESTEHENSGRENZE: BESTEHENSGRENZE,
    istRichtig: istRichtig,
    bestanden: bestanden,
    istFreigeschaltet: istFreigeschaltet,
    GRATIS_GUERTEL: GRATIS_GUERTEL,
    istGratisLevel: istGratisLevel,
    istBezahlLevel: istBezahlLevel,
    levelStatus: levelStatus,
    naechsterHoechster: naechsterHoechster,
    erwarteMehrfach: erwarteMehrfach,
    mischen: mischen,
    anzeigeOptionen: anzeigeOptionen,
    baueUebenSession: baueUebenSession,
    MASTER_STREAK: MASTER_STREAK,
    SRS_INTERVALE: SRS_INTERVALE,
    addTage: addTage,
    istFaellig: istFaellig,
    werteKarteLogik: werteKarteLogik,
    heuteIso: heuteIso,
    themaAufgeloest: themaAufgeloest,
    naechstesThema: naechstesThema,
    THEMA_ZYKLUS: THEMA_ZYKLUS,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.HPP_LOGIC = api;
  }
})(typeof window !== "undefined" ? window : this);

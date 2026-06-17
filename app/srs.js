(function (root) {
  "use strict";
  var L = (typeof require !== "undefined") ? require("./logic.js")
        : (root.HPP_LOGIC);

  var KEY = "hpp_srs";

  function leererStand() { return { karten: {}, stats: {} }; }
  function kartenId(examId, nr, level) { return examId + "|" + nr + "|" + level; }

  function statsKey(level, thema) { return level + "|" + thema; }

  function werte(srs, examId, nr, level, thema, richtig, heuteIso) {
    var id = kartenId(examId, nr, level);
    var alt = srs.karten[id];
    var streak = alt ? alt.streak : 0;
    var res = L.werteKarteLogik(streak, richtig, heuteIso);
    if (res.gemeistert) { delete srs.karten[id]; }
    else { srs.karten[id] = { streak: res.streak, due: res.due, thema: thema }; }
    var sk = statsKey(level, thema);
    var st = srs.stats[sk] || { gesehen: 0, richtig: 0 };
    st.gesehen += 1;
    if (richtig) st.richtig += 1;
    srs.stats[sk] = st;
    return res;
  }

  function seedFalsch(srs, examId, nr, level, heuteIso) {
    var id = kartenId(examId, nr, level);
    if (srs.karten[id]) return;
    srs.karten[id] = { streak: 0, due: L.addTage(heuteIso, 1), thema: "" };
  }

  function faellige(srs, level, heuteIso, themaFilter) {
    var out = [];
    Object.keys(srs.karten).forEach(function (id) {
      var teile = id.split("|");
      if (teile[2] !== level) return;
      var k = srs.karten[id];
      if (themaFilter && k.thema !== themaFilter) return;
      if (!L.istFaellig(k.due, heuteIso)) return;
      out.push({ examId: teile[0], nr: parseInt(teile[1], 10), level: level, thema: k.thema });
    });
    return out;
  }

  function anzahlFaellig(srs, level, heuteIso, themaFilter) {
    return faellige(srs, level, heuteIso, themaFilter).length;
  }

  function trefferquote(srs, level, thema) {
    var st = srs.stats[statsKey(level, thema)];
    if (!st || st.gesehen === 0) return null;
    return st.richtig / st.gesehen;
  }

  function lade(storage) {
    try {
      var roh = JSON.parse(storage.getItem(KEY));
      if (roh && roh.karten && roh.stats) return roh;
    } catch (e) {}
    return leererStand();
  }
  function speichere(storage, srs) {
    try { storage.setItem(KEY, JSON.stringify(srs)); } catch (e) {}
  }

  var api = {
    leererStand: leererStand, kartenId: kartenId, werte: werte, seedFalsch: seedFalsch,
    faellige: faellige, anzahlFaellig: anzahlFaellig, trefferquote: trefferquote,
    lade: lade, speichere: speichere,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HPP_SRS = api;
})(typeof window !== "undefined" ? window : this);

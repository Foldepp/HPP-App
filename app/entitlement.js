(function (root) {
  "use strict";

  var KEY = "hpp_entitlement";

  function leererStand() { return { aktiv: false }; }
  function hatZugang(ent) { return !!(ent && ent.aktiv); }

  function lade(storage) {
    try {
      var roh = JSON.parse(storage.getItem(KEY));
      if (roh && typeof roh.aktiv === "boolean") return roh;
    } catch (e) {}
    return leererStand();
  }
  // speichere ist bewusst öffentlich (Tests/Dev); Plan 3 ersetzt den Schreibpfad über entsperreStub.
  function speichere(storage, ent) {
    try { storage.setItem(KEY, JSON.stringify(ent)); } catch (e) {}
  }

  // Plan-1-Stub: lokales Freischalten. Plan 3 (Stripe) ersetzt den Schreibpfad,
  // hatZugang/lade bleiben die stabile Schnittstelle.
  function entsperreStub(storage) {
    var ent = { aktiv: true };
    speichere(storage, ent);
    return ent;
  }
  function sperre(storage) {
    var ent = leererStand();
    speichere(storage, ent);
    return ent;
  }

  var api = {
    leererStand: leererStand, hatZugang: hatZugang,
    lade: lade, speichere: speichere,
    entsperreStub: entsperreStub, sperre: sperre,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HPP_ENT = api;
})(typeof window !== "undefined" ? window : this);

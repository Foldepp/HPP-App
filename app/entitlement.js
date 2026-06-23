(function (root) {
  "use strict";

  var SESSION_KEY = "hpp_session";
  var CACHE_KEY = "hpp_entitlement";

  function leererStand() { return { hatZugang: false, kind: null, activeUntil: null }; }
  function hatZugang(ent) { return !!(ent && ent.hatZugang); }

  function ladeSession(storage) {
    try { return storage.getItem(SESSION_KEY) || null; } catch (e) { return null; }
  }

  function lade(storage) {
    try {
      var roh = JSON.parse(storage.getItem(CACHE_KEY));
      if (roh && typeof roh.hatZugang === "boolean") return roh;
    } catch (e) {}
    return leererStand();
  }

  function speichere(storage, ent) {
    try { storage.setItem(CACHE_KEY, JSON.stringify(ent)); } catch (e) {}
  }

  async function refresh(storage, fetchFn) {
    var token = ladeSession(storage);
    if (!token) { var leer = leererStand(); speichere(storage, leer); return leer; }
    try {
      var res = await fetchFn("/api/entitlement", { headers: { Authorization: "Bearer " + token } });
      if (!res || !res.ok) return lade(storage);
      var data = await res.json();
      var stand = {
        hatZugang: !!data.hatZugang,
        kind: data.kind || null,
        activeUntil: data.activeUntil || null,
      };
      speichere(storage, stand);
      return stand;
    } catch (e) {
      return lade(storage); // Netzfehler: zuletzt gecachten Stand behalten
    }
  }

  async function anfordern(email, fetchFn) {
    try {
      var res = await fetchFn("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });
      return !!(res && res.ok);
    } catch (e) {
      return false;
    }
  }

  async function abmelden(storage, fetchFn) {
    var token = ladeSession(storage);
    try {
      if (token) await fetchFn("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + token } });
    } catch (e) {}
    try { storage.removeItem(SESSION_KEY); } catch (e) {}
    var leer = leererStand();
    speichere(storage, leer);
    return leer;
  }

  var api = {
    leererStand: leererStand, hatZugang: hatZugang, ladeSession: ladeSession,
    lade: lade, speichere: speichere, refresh: refresh, anfordern: anfordern, abmelden: abmelden,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HPP_ENT = api;
})(typeof window !== "undefined" ? window : this);

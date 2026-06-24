(function (root) {
  "use strict";
  var KEY = "hpp_theme";
  var META = { hell: "#f7f6f3", dunkel: "#15181c" };
  var L = root.HPP_LOGIC;

  function pref() {
    try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; }
  }
  function systemDunkel() {
    return !!(root.matchMedia && root.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function anwenden() {
    var thema = L.themaAufgeloest(pref(), systemDunkel());
    document.documentElement.setAttribute("data-theme", thema === "dunkel" ? "dark" : "light");
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", META[thema]);
  }
  function umschalten() {
    var neu = L.naechstesThema(pref());
    try { localStorage.setItem(KEY, neu); } catch (e) {}
    anwenden();
    return neu;
  }

  if (root.matchMedia) {
    var mq = root.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () { if (pref() === "auto") anwenden(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  anwenden();
  root.HPP_THEME = { pref: pref, anwenden: anwenden, umschalten: umschalten };
})(window);

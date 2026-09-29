(function () {
  "use strict";

  var CONSENT_VERSION = "2026-09-29";
  var CONSENT_KEY = "sumai-checker:consent";

  function getConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setConsent(agreed) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        agreed: agreed,
        version: CONSENT_VERSION,
        agreedAt: new Date().toISOString()
      }));
    } catch (e) { /* localStorageが使えない環境では毎回同意を求める */ }
  }

  function showConsentGate() {
    document.getElementById("consent-screen").hidden = false;
  }

  function showDeclineScreen() {
    document.getElementById("decline-screen").hidden = false;
  }

  function showApp() {
    document.getElementById("app").hidden = false;
    initApp();
  }

  var consent = getConsent();
  if (consent && consent.agreed && consent.version === CONSENT_VERSION) {
    showApp();
  } else {
    showConsentGate();
    document.getElementById("consent-agree").addEventListener("click", function () {
      setConsent(true);
      document.getElementById("consent-screen").hidden = true;
      showApp();
    });
    document.getElementById("consent-decline").addEventListener("click", function () {
      setConsent(false);
      document.getElementById("consent-screen").hidden = true;
      showDeclineScreen();
    });
  }

  var municipalities = [];

  // 五十音順(あかさたなはまやらわ)での都道府県の並び順
  var PREF_ORDER = ["愛知県", "神奈川県", "岐阜県", "静岡県", "東京都", "長野県", "三重県", "山梨県"];

  function initApp() {
    var prefSelect = document.getElementById("pref-select");
    var muniSelect = document.getElementById("muni-select");

    fetch("data/municipalities.json")
      .then(function (r) { return r.json(); })
      .then(function (list) {
        municipalities = list;

        var prefsPresent = [];
        list.forEach(function (m) {
          if (prefsPresent.indexOf(m.pref) === -1) prefsPresent.push(m.pref);
        });
        var prefs = PREF_ORDER.filter(function (p) { return prefsPresent.indexOf(p) !== -1; });
        prefsPresent.forEach(function (p) {
          if (prefs.indexOf(p) === -1) prefs.push(p); // 並び順定義に無い県は末尾に追加
        });

        prefs.forEach(function (pref) {
          var opt = document.createElement("option");
          opt.value = pref;
          opt.textContent = pref;
          prefSelect.appendChild(opt);
        });

        prefSelect.addEventListener("change", function () {
          populateMuniSelect(prefSelect.value);
          var first = municipalities.filter(function (m) { return m.pref === prefSelect.value; })[0];
          if (first) loadMunicipality(first);
        });

        muniSelect.addEventListener("change", function () {
          var m = municipalities.filter(function (x) { return x.code === muniSelect.value; })[0];
          if (m) loadMunicipality(m);
        });

        if (prefs.length > 0) {
          prefSelect.value = prefs[0];
          populateMuniSelect(prefs[0]);
          var initial = municipalities.filter(function (m) { return m.pref === prefs[0]; })[0];
          if (initial) loadMunicipality(initial);
        }
      });
  }

  function populateMuniSelect(pref) {
    var muniSelect = document.getElementById("muni-select");
    muniSelect.innerHTML = "";
    municipalities
      .filter(function (m) { return m.pref === pref; })
      .sort(function (a, b) {
        // 震災リスク順(地震確率が高い順)。データなしは末尾へ
        var pa = a.top_probability === null || a.top_probability === undefined ? -1 : a.top_probability;
        var pb = b.top_probability === null || b.top_probability === undefined ? -1 : b.top_probability;
        return pb - pa;
      })
      .forEach(function (m) {
        var opt = document.createElement("option");
        opt.value = m.code;
        opt.textContent = m.name;
        muniSelect.appendChild(opt);
      });
  }

  function loadMunicipality(meta) {
    var resultEl = document.getElementById("result");
    var faultsEl = document.getElementById("r-faults");
    var noteEl = document.getElementById("r-note");
    var errorEl = document.getElementById("r-error");

    document.getElementById("r-pref").textContent = meta.pref;
    document.getElementById("r-name").textContent = meta.name;
    faultsEl.innerHTML = "";
    noteEl.hidden = true;
    errorEl.hidden = true;

    fetch("data/earthquake/" + meta.code + ".json")
      .then(function (r) { return r.json(); })
      .then(function (eq) {
        if (eq.error) {
          errorEl.hidden = false;
          resultEl.hidden = false;
          return;
        }
        (eq.top_faults || []).forEach(function (f) {
          var row = document.createElement("div");
          row.className = "fault-row";
          var name = document.createElement("span");
          name.className = "fname";
          name.textContent = f.name;
          var prob = document.createElement("span");
          prob.className = "fprob";
          prob.textContent = (f.probability * 100).toFixed(1) + "%";
          row.appendChild(name);
          row.appendChild(prob);
          faultsEl.appendChild(row);
        });
        if (eq.note) {
          noteEl.textContent = eq.note;
          noteEl.hidden = false;
        }
        resultEl.hidden = false;
      });
  }
})();

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

  function initApp() {
    var select = document.getElementById("muni-select");

    fetch("data/municipalities.json")
      .then(function (r) { return r.json(); })
      .then(function (list) {
        list.forEach(function (m) {
          var opt = document.createElement("option");
          opt.value = m.code;
          opt.textContent = m.pref + " " + m.name;
          select.appendChild(opt);
        });
        if (list.length > 0) {
          select.value = list[0].code;
          loadMunicipality(list[0].code, list[0]);
        }
      });

    select.addEventListener("change", function () {
      fetch("data/municipalities.json")
        .then(function (r) { return r.json(); })
        .then(function (list) {
          var m = list.filter(function (x) { return x.code === select.value; })[0];
          loadMunicipality(select.value, m);
        });
    });
  }

  function loadMunicipality(code, meta) {
    var resultEl = document.getElementById("result");
    var faultsEl = document.getElementById("r-faults");
    var noteEl = document.getElementById("r-note");
    var errorEl = document.getElementById("r-error");

    document.getElementById("r-pref").textContent = meta.pref;
    document.getElementById("r-name").textContent = meta.name;
    faultsEl.innerHTML = "";
    noteEl.hidden = true;
    errorEl.hidden = true;

    fetch("data/earthquake/" + code + ".json")
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

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
  var currentSubsidyData = null;

  // 五十音順(あかさたなはまやらわ)での都道府県の並び順
  var PREF_ORDER = ["愛知県", "神奈川県", "岐阜県", "静岡県", "東京都", "長野県", "三重県", "山梨県"];

  var BUILDING_TYPE_LABEL = {
    wood: "木造",
    light_steel: "軽量鉄骨造",
    heavy_steel: "鉄骨造・鉄筋コンクリート造など"
  };

  var BUILDING_FLOW_STEPS = {
    wood: ["耐震診断(現状の耐震性を確認)", "補強計画の策定(診断結果をもとに工事内容を設計)", "耐震補強工事"],
    light_steel: ["耐震診断(現状の耐震性を確認)", "耐震補強工事"],
    heavy_steel: ["耐震診断(現状の耐震性を確認)", "耐震補強工事"]
  };

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

    var typeSelect = document.getElementById("building-type");
    var yearInput = document.getElementById("building-year");
    typeSelect.addEventListener("change", onBuildingInfoChange);
    yearInput.addEventListener("input", onBuildingInfoChange);
  }

  function onBuildingInfoChange() {
    updateBuildingFlow();
    renderSubsidyList();
  }

  function getBuildingType() {
    return document.getElementById("building-type").value || null;
  }

  function getBuildingYear() {
    var raw = document.getElementById("building-year").value;
    if (!raw) return null;
    var n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }

  function updateBuildingFlow() {
    var type = getBuildingType();
    var flowEl = document.getElementById("building-flow");
    var stepsEl = document.getElementById("building-flow-steps");
    stepsEl.innerHTML = "";
    if (!type) {
      flowEl.hidden = true;
      return;
    }
    (BUILDING_FLOW_STEPS[type] || []).forEach(function (step) {
      var li = document.createElement("li");
      li.textContent = step;
      stepsEl.appendChild(li);
    });
    flowEl.hidden = false;
  }

  function populateMuniSelect(pref) {
    var muniSelect = document.getElementById("muni-select");
    muniSelect.innerHTML = "";
    municipalities
      .filter(function (m) { return m.pref === pref; })
      .sort(function (a, b) {
        // 震災リスク順(地震確率が高い順)。データなしは末尾へ、
        // データなし同士は五十音順
        var pa = a.top_probability === null || a.top_probability === undefined ? -1 : a.top_probability;
        var pb = b.top_probability === null || b.top_probability === undefined ? -1 : b.top_probability;
        var aHas = pa >= 0;
        var bHas = pb >= 0;
        if (aHas && bHas) return pb - pa;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return a.name.localeCompare(b.name, "ja");
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
    document.getElementById("flood-hazard-list").innerHTML = "";
    document.getElementById("flood-hazard-error").hidden = true;

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

    fetch("data/flood/" + meta.code + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(function (fh) {
        renderFloodHazard(fh);
      })
      .catch(function () {
        document.getElementById("flood-hazard-list").innerHTML = "";
        document.getElementById("flood-hazard-error").hidden = false;
      });

    document.getElementById("building-form").hidden = false;
    updateBuildingFlow();

    currentSubsidyData = null;
    document.getElementById("subsidy-section").hidden = false;
    fetch("data/subsidies/" + meta.code + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(function (data) {
        currentSubsidyData = data;
        renderSubsidyList();
      })
      .catch(function () {
        currentSubsidyData = { items: [] };
        renderSubsidyList();
      });
  }

  var HAZARD_LABEL = { flood: "洪水", tsunami: "津波", landslide: "土砂災害" };

  function renderFloodHazard(fh) {
    var listEl = document.getElementById("flood-hazard-list");
    listEl.innerHTML = "";

    ["flood", "tsunami", "landslide"].forEach(function (key) {
      var data = fh[key] || { present: false };
      var row = document.createElement("div");
      row.className = "hazard-row " + (data.present ? "hazard-present" : "hazard-absent");

      var label = document.createElement("span");
      label.className = "hazard-label";
      label.textContent = HAZARD_LABEL[key];
      row.appendChild(label);

      var detail = document.createElement("span");
      detail.className = "hazard-detail";
      if (!data.present) {
        detail.textContent = "該当データなし";
      } else if (key === "flood") {
        detail.textContent = "想定最大浸水深:" + (data.max_rank_label || "不明") +
          (data.rivers && data.rivers.length ? "(" + data.rivers.join("・") + ")" : "");
      } else if (key === "tsunami") {
        detail.textContent = "想定最大浸水深:" + (data.depth_ranks || []).join(" / ");
      } else if (key === "landslide") {
        var zonesText = data.zones && data.zones.length ? data.zones.join(" / ") : "";
        detail.textContent = (data.phenomena || []).join("・") +
          (zonesText ? "(" + zonesText + ")" : "");
      }
      row.appendChild(detail);
      listEl.appendChild(row);
    });

    var note = document.createElement("p");
    note.className = "note";
    note.textContent = "国土数値情報(洪水浸水想定区域・津波浸水想定・土砂災害警戒区域)を行政区域ポリゴンと重ね合わせて機械的に判定した参考値です。最新・詳細な情報は自治体のハザードマップでご確認ください。";
    listEl.appendChild(note);
  }

  // 建物の種類・築年数から、補助金1件ごとの対象可能性を判定する。
  // 判定は目安であり、最終的な対象可否は各制度の公式情報で要確認。
  function judgeEligibility(item, type, year) {
    var elig = item.eligibility || {};
    var types = elig.building_types || [];

    if (!type) return "unknown";
    if (types.length > 0 && types.indexOf(type) === -1) return "unlikely";

    if (year) {
      if (elig.built_before) {
        var beforeYear = parseInt(elig.built_before.slice(0, 4), 10);
        if (year >= beforeYear) return "unlikely";
      }
      if (elig.built_after) {
        var afterYear = parseInt(elig.built_after.slice(0, 4), 10);
        if (year < afterYear) return "unlikely";
      }
    }

    if (!elig.built_before && !elig.built_after) return "check";
    if (!year) return "check";
    return "likely";
  }

  var JUDGE_LABEL = {
    likely: "対象の可能性あり",
    check: "条件を確認",
    unlikely: "対象外の可能性",
    unknown: "建物情報を入力すると判定されます"
  };
  var JUDGE_ORDER = { likely: 0, check: 1, unlikely: 2, unknown: 3 };

  function renderSubsidyList() {
    var listEl = document.getElementById("subsidy-list");
    var emptyEl = document.getElementById("subsidy-empty");
    var hintEl = document.getElementById("subsidy-hint");
    listEl.innerHTML = "";

    if (!currentSubsidyData) return;

    var items = currentSubsidyData.items || [];
    if (items.length === 0) {
      emptyEl.hidden = false;
      hintEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    hintEl.hidden = false;

    var type = getBuildingType();
    var year = getBuildingYear();

    var judged = items.map(function (item) {
      return { item: item, judge: judgeEligibility(item, type, year) };
    });
    judged.sort(function (a, b) { return JUDGE_ORDER[a.judge] - JUDGE_ORDER[b.judge]; });

    judged.forEach(function (row) {
      listEl.appendChild(renderSubsidyCard(row.item, row.judge));
    });
  }

  function renderSubsidyCard(item, judge) {
    var card = document.createElement("div");
    card.className = "subsidy-card judge-" + judge;

    var head = document.createElement("div");
    head.className = "subsidy-card-head";

    var name = document.createElement("span");
    name.className = "subsidy-name";
    name.textContent = item.name;
    head.appendChild(name);

    var badge = document.createElement("span");
    badge.className = "pill pill-judge pill-judge-" + judge;
    badge.textContent = JUDGE_LABEL[judge];
    head.appendChild(badge);

    card.appendChild(head);

    if (item.amount_text) {
      var amount = document.createElement("p");
      amount.className = "subsidy-amount";
      amount.textContent = item.amount_text;
      card.appendChild(amount);
    }

    if (item.condition_text) {
      var cond = document.createElement("p");
      cond.className = "subsidy-condition";
      cond.textContent = item.condition_text;
      card.appendChild(cond);
    }

    var metaRow = document.createElement("p");
    metaRow.className = "note subsidy-meta";
    var metaParts = [];
    if (item.deadline) metaParts.push("申請期限:" + item.deadline);
    if (item.note) metaParts.push(item.note);
    metaRow.textContent = metaParts.join(" / ");
    if (metaParts.length > 0) card.appendChild(metaRow);

    if (item.official_url) {
      var link = document.createElement("a");
      link.href = item.official_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "subsidy-link";
      link.textContent = "公式ページで確認する";
      card.appendChild(link);
    }

    return card;
  }
})();

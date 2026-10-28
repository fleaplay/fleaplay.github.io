"use strict";

function policyDateInSeoul(now) {
  var parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  function part(type) {
    return parts.find(function (value) { return value.type === type; }).value;
  }
  return part("year") + "-" + part("month") + "-" + part("day");
}

function selectPolicyVersions(versions, today) {
  var announced = versions.filter(function (version) {
    return version.announcedOn <= today;
  });
  var active = announced.filter(function (version) {
    return version.effectiveOn <= today;
  }).sort(function (a, b) { return b.effectiveOn.localeCompare(a.effectiveOn); })[0];
  var upcoming = announced.filter(function (version) {
    return version.effectiveOn > today;
  }).sort(function (a, b) { return a.effectiveOn.localeCompare(b.effectiveOn); })[0];
  return { active: active || null, upcoming: upcoming || null };
}

(function () {
  var content = document.querySelector("[data-policy-content]");
  if (!content) return;

  var announcement = document.querySelector("[data-policy-announcement]");
  var heading = announcement.querySelector("h2");
  var message = announcement.querySelector("[data-policy-announcement-text]");
  var summary = announcement.querySelector("[data-policy-change-summary]");
  var preview = announcement.querySelector("[data-policy-preview]");
  var name = content.dataset.policyName;
  var versions = [];
  var previewing = false;
  var activeEffectiveOn;
  var displayed;
  var timer;

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    var parsed = new Date(value + "T00:00:00Z");
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function collect(article) {
    var effectiveOn = article.dataset.policyEffectiveOn;
    var announcedOn = article.dataset.policyAnnouncedOn;
    if (!validDate(effectiveOn) || !validDate(announcedOn) || announcedOn > effectiveOn) return;
    versions.push({
      effectiveOn: effectiveOn,
      announcedOn: announcedOn,
      summary: article.dataset.policyChangeSummary || "",
      article: article
    });
  }

  content.querySelectorAll("article[data-policy-effective-on]").forEach(collect);
  content.querySelectorAll("template[data-policy-scheduled]").forEach(function (template) {
    var article = template.content.querySelector("article[data-policy-effective-on]");
    if (article) collect(article.cloneNode(true));
    template.remove();
  });
  if (!versions.length) return;

  function readableDate(date) {
    var parts = date.split("-");
    return parts[0] + "년 " + Number(parts[1]) + "월 " + Number(parts[2]) + "일";
  }

  function render() {
    var now = new Date();
    var today = policyDateInSeoul(now);
    var state = selectPolicyVersions(versions, today);
    var effectiveOn = state.active ? state.active.effectiveOn : null;
    if (effectiveOn !== activeEffectiveOn) previewing = false;
    activeEffectiveOn = effectiveOn;
    var selected = state.active;
    if (!selected || (previewing && state.upcoming)) selected = state.upcoming;

    if (selected !== displayed) {
      content.replaceChildren();
      if (selected) {
        selected.article.id = "policy-document";
        content.appendChild(selected.article);
      }
      displayed = selected;
    }

    announcement.hidden = !state.upcoming;
    if (state.upcoming) {
      heading.textContent = name + " 시행 예정 안내";
      message.textContent = readableDate(state.upcoming.announcedOn) + " 공고 · " +
        readableDate(state.upcoming.effectiveOn) + " 시행. " +
        (state.active ? "시행일까지는 현행 문서가 적용됩니다." : "아래 문서는 시행 전 사전 안내 중입니다.");
      summary.textContent = state.upcoming.summary ? "주요 내용: " + state.upcoming.summary : "";
      summary.hidden = !state.upcoming.summary;
      preview.hidden = !state.active;
      preview.textContent = selected === state.upcoming ? "현행 문서 보기" : "시행 예정 문서 보기";
      preview.setAttribute("aria-controls", "policy-document");
      preview.setAttribute("aria-pressed", String(selected === state.upcoming));
    } else {
      previewing = false;
    }

    // Once a new version takes effect, keep no earlier version in the page.
    if (state.active) {
      versions = versions.filter(function (version) {
        return version.effectiveOn >= state.active.effectiveOn;
      });
    }

    clearTimeout(timer);
    var nextMidnight = new Date(today + "T00:00:00+09:00").getTime() + 86400000;
    timer = setTimeout(render, nextMidnight - now.getTime() + 100);
  }

  preview.addEventListener("click", function () {
    previewing = !previewing;
    render();
    content.scrollIntoView({ block: "start" });
  });
  window.addEventListener("pageshow", render);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) render();
  });
  render();
}());

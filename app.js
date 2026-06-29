const REPORT_INDEX_URL = "./AI日报/index.json";
const REPORT_MARKDOWN_BASE_URL = "./AI日报/";
const REPORT_DATA_PATTERN = /<!-- report-data\s*([\s\S]*?)\s*-->/;

const reports = {};
let availableDates = [];
let activeDate = "";
let selectedFilter = "all";

const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");
const navLinks = document.querySelectorAll(".primary-nav a");
const backToTopButton = document.querySelector(".back-to-top");
const currentYear = document.querySelector("#current-year");
const dateTrigger = document.querySelector("#date-trigger");
const datePicker = document.querySelector("#date-picker");
const datePickerMonth = document.querySelector("#date-picker-month");
const datePickerGrid = document.querySelector("#date-picker-grid");
const navTrends = document.querySelector("#nav-trends");

const filterLabels = {
  all: "全部",
  capital: "资本与基建",
  enterprise: "企业落地",
  agent: "Agent 动向",
};

function closeMenu() {
  if (!menuToggle || !primaryNav) return;

  primaryNav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPriorityClass(priority) {
  return priority === "high" ? "priority--high" : "priority--medium";
}

function getReportFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const date = params.get("date");
  return date && availableDates.includes(date) ? date : availableDates.at(-1);
}

async function loadReportIndex() {
  const res = await fetch(REPORT_INDEX_URL);
  if (!res.ok) {
    throw new Error(`日期索引加载失败：${res.status}`);
  }

  const dates = await res.json();
  if (!Array.isArray(dates)) {
    throw new Error("日期索引格式错误：需要数组");
  }

  availableDates = dates
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  if (availableDates.length === 0) {
    throw new Error("日期索引为空：没有可展示的日报");
  }
}

async function loadReport(date) {
  if (reports[date]) return reports[date];

  const res = await fetch(`${REPORT_MARKDOWN_BASE_URL}${date}.md`);
  if (!res.ok) {
    throw new Error(`${date}.md 加载失败：${res.status}`);
  }

  const markdown = await res.text();
  const match = markdown.match(REPORT_DATA_PATTERN);
  if (!match) {
    throw new Error(`${date}.md 缺少 report-data 数据块`);
  }

  reports[date] = JSON.parse(match[1]);
  return reports[date];
}

function formatMonthLabel(year, monthIndex) {
  return `${year} 年 ${monthIndex + 1} 月`;
}

function renderDatePicker() {
  if (!datePickerGrid || !datePickerMonth) return;

  const [yearText, monthText] = activeDate.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthKey = `${yearText}-${monthText}`;

  datePickerMonth.textContent = formatMonthLabel(year, monthIndex);
  datePickerGrid.innerHTML = "";

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    datePickerGrid.insertAdjacentHTML("beforeend", '<span class="date-picker__blank"></span>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const report = reports[date];
    const hasReport = availableDates.includes(date);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(day);
    button.className = "date-picker__day";
    button.dataset.date = date;
    button.setAttribute("role", "gridcell");
    button.setAttribute(
      "aria-label",
      hasReport ? `${report?.dateLabel ?? date}，${report?.issue ?? "已有日报"}` : `${date}，暂无日报`,
    );

    if (!hasReport) {
      button.disabled = true;
      button.classList.add("is-disabled");
    }

    if (date === activeDate) {
      button.classList.add("is-selected");
      button.setAttribute("aria-current", "date");
    }

    datePickerGrid.append(button);
  }
}

function setDatePickerOpen(isOpen) {
  if (!dateTrigger || !datePicker) return;

  datePicker.hidden = !isOpen;
  dateTrigger.setAttribute("aria-expanded", String(isOpen));
}

function renderFilterBar(news) {
  const filterBar = document.querySelector("#filter-bar");
  if (!filterBar) return;

  const counts = news.reduce(
    (result, item) => {
      result.all += 1;
      result[item.category] = (result[item.category] ?? 0) + 1;
      return result;
    },
    { all: 0, capital: 0, enterprise: 0, agent: 0 },
  );

  filterBar.innerHTML = Object.entries(filterLabels)
    .map(([filter, label]) => {
      const isSelected = filter === selectedFilter;
      return `
        <button class="filter-button${isSelected ? " is-active" : ""}" type="button" data-filter="${filter}" aria-pressed="${isSelected}">
          ${escapeHtml(label)} <span>${counts[filter] ?? 0}</span>
        </button>
      `;
    })
    .join("");
}

function renderLeadStory(lead) {
  const leadStory = document.querySelector("#lead-story");
  if (!leadStory) return;

  leadStory.dataset.category = lead.category;
  leadStory.innerHTML = `
    <div class="lead-story__visual" aria-hidden="true">
      <div class="orb orb--one"></div>
      <div class="orb orb--two"></div>
      <svg viewBox="0 0 420 320">
        <path d="M42 210C91 127 143 102 208 153s115 27 170-77"></path>
        <circle cx="42" cy="210" r="6"></circle>
        <circle cx="208" cy="153" r="6"></circle>
        <circle cx="378" cy="76" r="6"></circle>
      </svg>
      <span class="visual-label">${escapeHtml(lead.visualLabel)}</span>
    </div>

    <div class="lead-story__content">
      <div class="story-meta">
        <span class="priority ${getPriorityClass(lead.priority)}">${escapeHtml(lead.priorityLabel)}</span>
        ${lead.meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <h3>${escapeHtml(lead.title)}</h3>
      <p class="story-lede">${escapeHtml(lead.lede)}</p>
      <p>${escapeHtml(lead.body)}</p>
      <div class="tag-list" aria-label="文章标签">
        ${lead.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
      <a class="source-link source-link--light" href="${escapeHtml(lead.sourceUrl)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(lead.sourceLabel)}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6"></path>
        </svg>
      </a>
    </div>
  `;
}

function renderNews(news) {
  const newsGrid = document.querySelector("#news-grid");
  if (!newsGrid) return;

  newsGrid.innerHTML = news
    .map((item, index) => {
      const shouldShow = selectedFilter === "all" || item.category === selectedFilter;
      return `
        <article class="news-card${index === 0 ? " news-card--feature" : ""}" data-category="${escapeHtml(item.category)}"${shouldShow ? "" : " hidden"}>
          <div class="card-topline">
            <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="priority ${getPriorityClass(item.priority)}">${escapeHtml(item.priorityLabel)}</span>
          </div>
          <div class="card-category">${escapeHtml(item.categoryLabel)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
          <p class="card-insight">${escapeHtml(item.insight)}</p>
          <div class="tag-list">
            ${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          </div>
          <a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(item.sourceLabel)}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"></path>
            </svg>
          </a>
        </article>
      `;
    })
    .join("");
}

function renderTrends(trends = []) {
  const trendsSection = document.querySelector("#trends");
  const trendGrid = document.querySelector("#trend-grid");
  const trendsSummary = document.querySelector("#trends-summary");
  if (!trendsSection || !trendGrid) return;

  const hasTrends = trends.length > 0;
  trendsSection.hidden = !hasTrends;
  if (navTrends) navTrends.hidden = !hasTrends;

  if (!hasTrends) {
    trendGrid.innerHTML = "";
    return;
  }

  if (trendsSummary) {
    trendsSummary.textContent = `从 GitHub Trending 中筛选 ${trends.length} 个 AI、Agent、LLM 和 developer tools 相关项目。`;
  }

  trendGrid.innerHTML = trends
    .map(
      (item, index) => `
        <article class="trend-card">
          <div class="trend-card__index">${String(index + 1).padStart(2, "0")}</div>
          <div class="trend-card__body">
            <div class="trend-card__meta">
              <span>${escapeHtml(item.language)}</span>
              <span>${escapeHtml(item.starsToday)}</span>
            </div>
            <h3>${escapeHtml(item.repo)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <dl class="trend-stats" aria-label="${escapeHtml(item.repo)} 项目数据">
              <div>
                <dt>Stars</dt>
                <dd>${escapeHtml(item.stars)}</dd>
              </div>
              <div>
                <dt>Forks</dt>
                <dd>${escapeHtml(item.forks)}</dd>
              </div>
            </dl>
            <p class="trend-reason">${escapeHtml(item.reason)}</p>
            <a class="source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
              GitHub
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"></path>
              </svg>
            </a>
          </div>
        </article>
      `,
    )
    .join("");
}

function updateFilterStatus(news) {
  const filterStatus = document.querySelector("#filter-status");
  if (!filterStatus) return;

  const visibleCount = news.filter((item) => selectedFilter === "all" || item.category === selectedFilter).length;
  filterStatus.textContent = `当前显示${filterLabels[selectedFilter]} ${visibleCount} 条行业动态。`;
}

async function renderReport(date, options = {}) {
  const targetDate = availableDates.includes(date) ? date : availableDates.at(-1);
  const report = await loadReport(targetDate);
  activeDate = targetDate;

  if (options.resetFilter !== false) {
    selectedFilter = "all";
  }

  document.title = report.title;
  document.querySelector("#report-date")?.setAttribute("datetime", targetDate);
  document.querySelector("#report-date") && (document.querySelector("#report-date").textContent = report.dateLabel);
  document.querySelector("#report-weekday") && (document.querySelector("#report-weekday").textContent = report.weekday);
  document.querySelector("#report-issue") && (document.querySelector("#report-issue").textContent = report.issue);
  document.querySelector("#report-count") && (document.querySelector("#report-count").textContent = report.kicker);
  document.querySelector(".hero .eyebrow") && (document.querySelector(".hero .eyebrow").textContent = report.themeLabel);
  document.querySelector("#page-title") && (document.querySelector("#page-title").innerHTML = report.headlineHtml);
  document.querySelector("#hero-summary") && (document.querySelector("#hero-summary").textContent = report.summary);
  document.querySelector("#news-summary") && (document.querySelector("#news-summary").textContent = report.newsIntro);
  document.querySelector("#insights-quote") && (document.querySelector("#insights-quote").textContent = report.insights.quote);
  document.querySelector("#insights-text") && (document.querySelector("#insights-text").textContent = report.insights.text);

  const signalList = document.querySelector("#signal-list");
  if (signalList) {
    signalList.innerHTML = report.signals
      .map(
        (signal, index) => `
          <li>
            <span class="signal-number">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>${escapeHtml(signal.title)}</h2>
              <p>${escapeHtml(signal.text)}</p>
            </div>
          </li>
        `,
      )
      .join("");
  }

  renderLeadStory(report.lead);
  renderFilterBar(report.news);
  renderNews(report.news);
  renderTrends(report.trends);
  updateFilterStatus(report.news);

  const watchList = document.querySelector("#watch-list");
  if (watchList) {
    watchList.innerHTML = report.insights.watch
      .map(
        (item, index) => `
          <li>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <p>${escapeHtml(item)}</p>
          </li>
        `,
      )
      .join("");
  }

  const statsGrid = document.querySelector("#stats-grid");
  if (statsGrid) {
    statsGrid.innerHTML = report.stats
      .map(
        ([label, value, unit]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd><strong>${escapeHtml(value)}</strong><span>${escapeHtml(unit)}</span></dd>
          </div>
        `,
      )
      .join("");
  }

  const keywordCloud = document.querySelector("#keyword-cloud");
  if (keywordCloud) {
    keywordCloud.innerHTML = report.keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("");
  }

  renderDatePicker();

  if (options.updateUrl !== false) {
    const url = new URL(window.location.href);
    url.searchParams.set("date", targetDate);
    window.history.replaceState({}, "", url);
  }
}

function showReportError(error) {
  console.error(error);
  document.title = "AI 行业日报｜加载失败";

  const pageTitle = document.querySelector("#page-title");
  const heroSummary = document.querySelector("#hero-summary");
  const signalList = document.querySelector("#signal-list");
  const newsGrid = document.querySelector("#news-grid");
  const filterStatus = document.querySelector("#filter-status");

  if (pageTitle) pageTitle.textContent = "日报加载失败";
  if (heroSummary) heroSummary.textContent = "当前页面无法读取 Markdown 数据。请通过本地静态服务器或 Netlify 访问页面。";
  if (signalList) signalList.innerHTML = "";
  if (newsGrid) newsGrid.innerHTML = "";
  if (filterStatus) filterStatus.textContent = error?.message ?? "未知加载错误";
}

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  primaryNav?.classList.toggle("is-open", !isOpen);
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", closeMenu);
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) closeMenu();
});

document.querySelector("#filter-bar")?.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");
  if (!button) return;

  selectedFilter = button.dataset.filter ?? "all";
  const report = reports[activeDate];
  if (!report) return;

  renderFilterBar(report.news);
  renderNews(report.news);
  updateFilterStatus(report.news);
});

dateTrigger?.addEventListener("click", () => {
  const isOpen = dateTrigger.getAttribute("aria-expanded") === "true";
  setDatePickerOpen(!isOpen);
});

datePickerGrid?.addEventListener("click", (event) => {
  const button = event.target.closest(".date-picker__day");
  if (!button || button.disabled || !button.dataset.date) return;

  renderReport(button.dataset.date).catch(showReportError);
  setDatePickerOpen(false);
});

document.addEventListener("click", (event) => {
  if (!datePicker || datePicker.hidden) return;
  if (event.target.closest(".date-switcher")) return;
  setDatePickerOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setDatePickerOpen(false);
});

function updateBackToTopVisibility() {
  backToTopButton?.classList.toggle("is-visible", window.scrollY > 600);
}

window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();

backToTopButton?.addEventListener("click", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
});

if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}

async function initReports() {
  try {
    await loadReportIndex();
    await renderReport(getReportFromUrl(), { updateUrl: Boolean(window.location.search) });
  } catch (error) {
    showReportError(error);
  }
}

initReports();

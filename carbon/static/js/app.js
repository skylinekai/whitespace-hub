// Shared UI behaviour
document.addEventListener("submit", (e) => {
  const msg = e.target.getAttribute("data-confirm");
  if (msg && !confirm(msg)) e.preventDefault();
});

window.SW = {
  colours: document.querySelector(".report")
    ? { s1: "#24215C", s2: "#3E7CB1", s3: "#7FB685", navy: "#24215C", grid: "#e9eaf0", muted: "#676a80" }   // client reports keep company branding
    : { s1: "#0F6CBD", s2: "#038387", s3: "#6BB700", navy: "#0F6CBD", grid: "#EDEDED", muted: "#616161" },
  fmt(v, dp = 1) {
    return Number(v).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  },
  base() {
    if (!window.Chart) return false;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = this.colours.muted;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.maintainAspectRatio = false;
    return true;
  },
  doughnut(id, labels, values, colours, unit = "t") {
    const el = document.getElementById(id);
    if (!el || !this.base()) return;
    new Chart(el, {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: colours, borderWidth: 2, borderColor: "#fff" }] },
      options: {
        cutout: "68%",
        plugins: { tooltip: { callbacks: { label: (c) => `${c.label}: ${SW.fmt(c.raw, unit === "t" ? 2 : 0)} ${unit}CO₂e` } } },
      },
    });
  },
  hbar(id, labels, values, colours, unit = "t") {
    const el = document.getElementById(id);
    if (!el || !this.base()) return;
    new Chart(el, {
      type: "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: colours, borderRadius: 4, barThickness: 16 }] },
      options: {
        indexAxis: "y",
        scales: {
          x: { grid: { color: this.colours.grid }, ticks: { callback: (v) => SW.fmt(v, 0) }, title: { display: true, text: unit + "CO₂e" } },
          y: { grid: { display: false } },
        },
        plugins: { tooltip: { callbacks: { label: (c) => `${SW.fmt(c.raw, unit === "t" ? 2 : 0)} ${unit}CO₂e` } } },
      },
    });
  },
  columns(id, labels, values) {
    const el = document.getElementById(id);
    if (!el || !this.base()) return;
    new Chart(el, {
      type: "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: this.colours.navy, borderRadius: 4, maxBarThickness: 36 }] },
      options: {
        scales: {
          y: { grid: { color: this.colours.grid }, title: { display: true, text: "tCO₂e" } },
          x: { grid: { display: false } },
        },
        plugins: { tooltip: { callbacks: { label: (c) => `${SW.fmt(c.raw, 2)} tCO₂e` } } },
      },
    });
  },
  trajectory(id, t) {
    const el = document.getElementById(id);
    if (!el || !t || !this.base()) return;
    new Chart(el, {
      type: "line",
      data: {
        labels: t.years,
        datasets: [
          { label: "Target pathway", data: t.path, borderColor: this.colours.s3, borderDash: [6, 4], pointRadius: 0, borderWidth: 2 },
          { label: "Actual", data: t.actual, borderColor: this.colours.navy, backgroundColor: this.colours.navy, spanGaps: true, pointRadius: 4, borderWidth: 2.5 },
        ],
      },
      options: {
        plugins: { legend: { display: true, position: "bottom", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => c.raw == null ? "" : `${c.dataset.label}: ${SW.fmt(c.raw, 1)} tCO₂e` } } },
        scales: { y: { beginAtZero: true, grid: { color: this.colours.grid }, title: { display: true, text: "tCO₂e" } }, x: { grid: { display: false } } },
      },
    });
  },
};

// Show/hide inline edit rows
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-toggle]");
  if (!t) return;
  e.preventDefault();
  const row = document.getElementById(t.getAttribute("data-toggle"));
  if (row) row.hidden = !row.hidden;
});

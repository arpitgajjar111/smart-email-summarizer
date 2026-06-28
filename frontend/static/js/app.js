/**
 * InkBrief — Smart Email Summarizer
 * Frontend application logic
 * Handles: API calls, UI state, history, file upload, PDF export, theme toggle
 */

const API_BASE = ""; // Same origin; change to http://localhost:8000 for dev separation

/* ═══════════════════════════════════
   STATE
═══════════════════════════════════ */
const state = {
  model: "facebook/bart-large-cnn",
  length: "medium",
  lastSummary: null,
  lastOriginal: null,
  historyItems: [],
};

/* ═══════════════════════════════════
   DOM REFS
═══════════════════════════════════ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const inputText     = $("#inputText");
const outputArea    = $("#outputArea");
const summarizeBtn  = $("#summarizeBtn");
const clearBtn      = $("#clearBtn");
const copyBtn       = $("#copyBtn");
const downloadBtn   = $("#downloadBtn");
const exportPdfBtn  = $("#exportPdfBtn");
const uploadBtn     = $("#uploadBtn");
const fileInput     = $("#fileInput");
const wordCountIn   = $("#wordCountIn");
const charCountIn   = $("#charCountIn");
const wordCountOut  = $("#wordCountOut");
const reductionPill = $("#reductionPill");
const processingTime= $("#processingTime");
const statsBar      = $("#statsBar");
const loadingOverlay= $("#loadingOverlay");
const spinnerLabel  = $("#spinnerLabel");
const errorToast    = $("#errorToast");
const successToast  = $("#successToast");
const themeToggle   = $("#themeToggle");
const historyList   = $("#historyList");
const historySearch = $("#historySearch");
const clearHistoryBtn = $("#clearHistoryBtn");

/* ═══════════════════════════════════
   NAVIGATION
═══════════════════════════════════ */
$$(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const panel = btn.dataset.panel;
    $$(".panel").forEach((p) => p.classList.remove("active"));
    $(`#panel-${panel}`).classList.add("active");
    if (panel === "history") loadHistory();
  });
});

/* ═══════════════════════════════════
   SEGMENT CONTROLS
═══════════════════════════════════ */
function bindSegmentControl(containerId, stateKey) {
  const container = $(`#${containerId}`);
  container.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state[stateKey] = btn.dataset.value;
    });
  });
}
bindSegmentControl("modelSelect", "model");
bindSegmentControl("lengthSelect", "length");

/* ═══════════════════════════════════
   INPUT COUNTERS
═══════════════════════════════════ */
inputText.addEventListener("input", updateInputCounters);

function updateInputCounters() {
  const text = inputText.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCountIn.textContent = `${words.toLocaleString()} word${words !== 1 ? "s" : ""}`;
  charCountIn.textContent = `${text.length.toLocaleString()} chars`;
}

/* ═══════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════ */
const html = document.documentElement;
// Persist preference
const savedTheme = localStorage.getItem("inkbrief-theme") || "dark";
html.dataset.theme = savedTheme;

themeToggle.addEventListener("click", () => {
  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("inkbrief-theme", next);
});

/* ═══════════════════════════════════
   FILE UPLOAD
═══════════════════════════════════ */
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  showLoading(`Extracting text from ${file.name}…`);
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "File extraction failed.");

    inputText.value = data.extracted_text;
    updateInputCounters();
    showSuccess(`Extracted ${data.word_count.toLocaleString()} words from ${file.name}`);
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
    fileInput.value = ""; // reset so same file can be re-uploaded
  }
});

/* ═══════════════════════════════════
   SUMMARIZE
═══════════════════════════════════ */
summarizeBtn.addEventListener("click", summarize);

// Allow Ctrl+Enter to trigger summarize
inputText.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") summarize();
});

async function summarize() {
  const text = inputText.value.trim();
  if (!text) { showError("Please enter some text to summarize."); return; }
  if (text.split(/\s+/).length < 20) {
    showError("Text is too short. Please provide at least 20 words.");
    return;
  }

  showLoading("Summarizing… (first run loads the model, may take ~30s)");
  summarizeBtn.disabled = true;
  clearOutput();

  try {
    const res = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model: state.model,
        length: state.length,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Summarization failed.");

    renderSummary(data);
    state.lastSummary = data.summary;
    state.lastOriginal = text;
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
    summarizeBtn.disabled = false;
  }
}

function renderSummary(data) {
  outputArea.innerHTML = `<p class="summary-text">${escapeHtml(data.summary)}</p>`;
  statsBar.style.display = "flex";
  wordCountOut.textContent = `${data.summary_word_count} words`;
  reductionPill.textContent = `${data.reduction_percentage}% shorter`;
  processingTime.textContent = `${(data.processing_time_ms / 1000).toFixed(1)}s`;

  copyBtn.disabled = false;
  downloadBtn.disabled = false;
  exportPdfBtn.disabled = false;
}

function clearOutput() {
  outputArea.innerHTML = `
    <div class="output-placeholder">
      <span class="placeholder-icon">◈</span>
      <p>Your summary will appear here</p>
    </div>`;
  statsBar.style.display = "none";
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  exportPdfBtn.disabled = true;
}

/* ═══════════════════════════════════
   CLEAR BUTTON
═══════════════════════════════════ */
clearBtn.addEventListener("click", () => {
  inputText.value = "";
  updateInputCounters();
  clearOutput();
  state.lastSummary = null;
  state.lastOriginal = null;
});

/* ═══════════════════════════════════
   COPY SUMMARY
═══════════════════════════════════ */
copyBtn.addEventListener("click", async () => {
  if (!state.lastSummary) return;
  try {
    await navigator.clipboard.writeText(state.lastSummary);
    const prev = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = prev; }, 1800);
  } catch {
    // Fallback for non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = state.lastSummary;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1800);
  }
});

/* ═══════════════════════════════════
   DOWNLOAD .TXT
═══════════════════════════════════ */
downloadBtn.addEventListener("click", () => {
  if (!state.lastSummary) return;
  const modelName = state.model.split("/").pop();
  const content = [
    "INKBRIEF — AI SUMMARY",
    "=".repeat(40),
    `Model: ${state.model}`,
    `Length: ${state.length}`,
    `Generated: ${new Date().toLocaleString()}`,
    "=".repeat(40),
    "",
    "SUMMARY",
    "-".repeat(20),
    state.lastSummary,
    "",
    "ORIGINAL TEXT",
    "-".repeat(20),
    state.lastOriginal || "",
  ].join("\n");

  downloadFile(content, `summary-${modelName}-${Date.now()}.txt`, "text/plain");
});

/* ═══════════════════════════════════
   EXPORT PDF (client-side via print)
═══════════════════════════════════ */
exportPdfBtn.addEventListener("click", () => {
  if (!state.lastSummary) return;
  const win = window.open("", "_blank");
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>InkBrief Summary</title>
    <style>
      body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#111;line-height:1.8}
      h1{font-size:1.4rem;margin-bottom:4px}
      .meta{font-family:monospace;font-size:0.75rem;color:#666;margin-bottom:28px}
      h2{font-size:0.85rem;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:24px 0 8px}
      p{font-size:1rem;margin-bottom:12px}
      hr{border:none;border-top:1px solid #ddd;margin:24px 0}
    </style>
    </head><body>
    <h1>◈ InkBrief Summary</h1>
    <p class="meta">Model: ${state.model} · Length: ${state.length} · ${new Date().toLocaleString()}</p>
    <h2>Summary</h2>
    <p>${escapeHtml(state.lastSummary)}</p>
    <hr/>
    <h2>Original Text</h2>
    <p style="font-size:.9rem;color:#444">${escapeHtml(state.lastOriginal || "")}</p>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 400);
});

/* ═══════════════════════════════════
   HISTORY
═══════════════════════════════════ */
async function loadHistory(search = "") {
  try {
    const url = search
      ? `${API_BASE}/api/history?search=${encodeURIComponent(search)}&limit=50`
      : `${API_BASE}/api/history?limit=50`;
    const res = await fetch(url);
    const data = await res.json();
    renderHistory(data.items);
    state.historyItems = data.items;
  } catch {
    historyList.innerHTML = `<div class="empty-state"><p>Could not load history. Is the server running?</p></div>`;
  }
}

function renderHistory(items) {
  if (!items || items.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">◫</span>
        <p>No summaries yet. Create one to see it here.</p>
      </div>`;
    return;
  }

  const template = $("#historyItemTemplate");
  historyList.innerHTML = "";
  items.forEach((item) => {
    const clone = template.content.cloneNode(true);
    const el = clone.querySelector(".history-item");

    el.querySelector(".history-model-badge").textContent =
      item.model_used.split("/").pop().split("-")[0].toUpperCase();
    el.querySelector(".history-length").textContent = item.length_preset;
    el.querySelector(".history-reduction").textContent =
      `${item.reduction_percentage}% shorter`;
    el.querySelector(".history-time").textContent =
      timeAgo(new Date(item.created_at));
    el.querySelector(".history-preview").textContent = item.original_preview;
    el.querySelector(".history-summary").textContent = item.summary;

    // Use this text
    el.querySelector(".use-btn").addEventListener("click", () => {
      inputText.value = item.original_preview.replace(/\.\.\.$/, "");
      updateInputCounters();
      // Switch to summarize panel
      $$(".nav-btn").forEach((b) => b.classList.remove("active"));
      $(".nav-btn[data-panel='summarize']").classList.add("active");
      $$(".panel").forEach((p) => p.classList.remove("active"));
      $("#panel-summarize").classList.add("active");
    });

    // Delete
    el.querySelector(".del-btn").addEventListener("click", async () => {
      await fetch(`${API_BASE}/api/history/${item.id}`, { method: "DELETE" });
      loadHistory(historySearch.value);
    });

    historyList.appendChild(clone);
  });
}

historySearch.addEventListener("input", debounce(() => {
  loadHistory(historySearch.value);
}, 350));

clearHistoryBtn.addEventListener("click", async () => {
  if (!confirm("Clear all summary history?")) return;
  await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
  loadHistory();
});

/* ═══════════════════════════════════
   LOADING HELPERS
═══════════════════════════════════ */
function showLoading(label = "Processing…") {
  spinnerLabel.textContent = label;
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}

/* ═══════════════════════════════════
   TOAST HELPERS
═══════════════════════════════════ */
let toastTimer;
function showError(msg) {
  clearTimeout(toastTimer);
  errorToast.textContent = `⚠ ${msg}`;
  errorToast.style.display = "block";
  toastTimer = setTimeout(() => { errorToast.style.display = "none"; }, 5000);
}
function showSuccess(msg) {
  clearTimeout(toastTimer);
  successToast.textContent = `✓ ${msg}`;
  successToast.style.display = "block";
  toastTimer = setTimeout(() => { successToast.style.display = "none"; }, 3000);
}

/* ═══════════════════════════════════
   UTILITY
═══════════════════════════════════ */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)   return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Init
updateInputCounters();

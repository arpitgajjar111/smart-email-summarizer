/**
 * InkBrief Chrome Extension — Popup Script
 * Reads Gmail email content via content script and sends to backend API
 */

const API_BASE = "http://localhost:8000";

const summarizeBtn = document.getElementById("summarizeBtn");
const modelSel     = document.getElementById("modelSel");
const lengthSel    = document.getElementById("lengthSel");
const statusMsg    = document.getElementById("statusMsg");
const statusText   = document.getElementById("statusText");
const errorMsg     = document.getElementById("errorMsg");
const result       = document.getElementById("result");
const resultText   = document.getElementById("resultText");
const modelBadge   = document.getElementById("modelBadge");
const reductionStat= document.getElementById("reductionStat");
const timeStat     = document.getElementById("timeStat");
const copyBtn      = document.getElementById("copyBtn");
const openAppBtn   = document.getElementById("openAppBtn");
const statusDot    = document.getElementById("statusDot");

let lastSummary = "";

// ── Check backend health on load ──
(async () => {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      statusDot.classList.remove("offline");
      statusDot.title = "Backend online";
    } else {
      throw new Error();
    }
  } catch {
    statusDot.classList.add("offline");
    statusDot.title = "Backend offline – start your FastAPI server";
  }
})();

// ── Restore preferences ──
chrome.storage.sync.get(["model", "length"], (prefs) => {
  if (prefs.model)  modelSel.value  = prefs.model;
  if (prefs.length) lengthSel.value = prefs.length;
});

modelSel.addEventListener("change", () => chrome.storage.sync.set({ model: modelSel.value }));
lengthSel.addEventListener("change", () => chrome.storage.sync.set({ length: lengthSel.value }));

// ── Main: summarize button ──
summarizeBtn.addEventListener("click", async () => {
  hideAll();
  setLoading(true, "Extracting email text…");

  try {
    // Get the active Gmail tab and inject content script to extract email text
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("mail.google.com")) {
      throw new Error("Navigate to Gmail to use InkBrief.");
    }

    // Execute content script to extract email body
    const [{ result: emailText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractGmailText,
    });

    if (!emailText || emailText.trim().length < 50) {
      throw new Error("No email content detected. Open an email in Gmail first.");
    }

    setLoading(true, "Sending to AI model…");

    // Call summarize API
    const res = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: emailText.trim(),
        model: modelSel.value,
        length: lengthSel.value,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Summarization failed.");

    lastSummary = data.summary;
    showResult(data);

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

// ── Copy button ──
copyBtn.addEventListener("click", async () => {
  if (!lastSummary) return;
  await navigator.clipboard.writeText(lastSummary);
  copyBtn.textContent = "Copied!";
  setTimeout(() => { copyBtn.textContent = "Copy"; }, 1600);
});

// ── Open app button ──
openAppBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${API_BASE}/` });
});

/* ── Helpers ── */

function setLoading(active, label = "") {
  summarizeBtn.disabled = active;
  statusMsg.style.display = active ? "flex" : "none";
  if (label) statusText.textContent = label;
}

function showResult(data) {
  result.style.display = "block";
  resultText.textContent = data.summary;
  modelBadge.textContent = data.model_used.split("/").pop().split("-")[0].toUpperCase();
  reductionStat.textContent = `${data.reduction_percentage}% shorter`;
  timeStat.textContent = `${(data.processing_time_ms / 1000).toFixed(1)}s`;
}

function showError(msg) {
  errorMsg.textContent = `⚠ ${msg}`;
  errorMsg.style.display = "block";
}

function hideAll() {
  result.style.display = "none";
  errorMsg.style.display = "none";
  statusMsg.style.display = "none";
}

/**
 * Injected into Gmail tab to extract the email body text.
 * Gmail renders email content in div.a3s or div[data-message-id] elements.
 */
function extractGmailText() {
  // Try multiple Gmail selectors (Gmail DOM changes frequently)
  const selectors = [
    'div.a3s.aiL',          // Primary email body
    'div.a3s',              // Fallback
    'div[data-message-id] .a3s',
    '.ii.gt .a3s',
    'div[role="main"] .nH .ii',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 30) {
      return el.innerText.trim();
    }
  }

  // Last resort: grab all visible text in the email thread
  const thread = document.querySelector('div[role="main"]');
  return thread ? thread.innerText.slice(0, 5000).trim() : "";
}

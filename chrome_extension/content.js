/**
 * InkBrief — Gmail Content Script
 * Injects a "Summarize with InkBrief" button into open Gmail emails.
 * The button triggers popup-like inline summarization.
 */

const API_BASE = "http://localhost:8000";
const BUTTON_ID = "inkbrief-btn";
const PANEL_ID  = "inkbrief-panel";

// Debounced observer to detect when emails are opened
let observerTimer;
const observer = new MutationObserver(() => {
  clearTimeout(observerTimer);
  observerTimer = setTimeout(injectButton, 600);
});

observer.observe(document.body, { childList: true, subtree: true });

function injectButton() {
  // Don't inject twice
  if (document.getElementById(BUTTON_ID)) return;

  // Gmail's email action toolbar (Reply, Forward, More…)
  const toolbar = document.querySelector('.ade') ||
                  document.querySelector('[data-tooltip="More"]')?.closest('.G3') ||
                  document.querySelector('.iN > .bi6');

  if (!toolbar) return;

  const btn = document.createElement("div");
  btn.id = BUTTON_ID;
  btn.title = "Summarize with InkBrief";
  btn.innerHTML = `
    <span style="
      display:inline-flex;align-items:center;gap:5px;
      padding:6px 12px;background:#6b7bff;color:#fff;
      border-radius:6px;font-size:12px;font-weight:600;
      cursor:pointer;user-select:none;letter-spacing:.02em;
      box-shadow:0 2px 8px rgba(107,123,255,.3);
      transition:opacity .15s;
    " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      ◈ Summarize
    </span>`;

  btn.addEventListener("click", () => handleSummarize());
  toolbar.appendChild(btn);
}

async function handleSummarize() {
  // Remove old panel
  const old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  // Extract email text
  const emailText = getEmailText();
  if (!emailText) {
    showInlinePanel("⚠ No email body detected. Open an email first.", true);
    return;
  }

  showInlinePanel("◈ Summarizing… (first run may take ~30s)", false, true);

  try {
    const prefs = await new Promise((res) =>
      chrome.storage.sync.get(["model", "length"], res)
    );
    const model  = prefs.model  || "facebook/bart-large-cnn";
    const length = prefs.length || "medium";

    const response = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: emailText, model, length }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Summarization failed.");

    showInlinePanel(data.summary, false, false, {
      words: `${data.original_word_count} → ${data.summary_word_count} words`,
      reduction: `${data.reduction_percentage}% shorter`,
      time: `${(data.processing_time_ms / 1000).toFixed(1)}s`,
    });
  } catch (err) {
    showInlinePanel(`⚠ ${err.message}`, true);
  }
}

function showInlinePanel(text, isError = false, isLoading = false, meta = null) {
  const old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;

  const metaHtml = meta
    ? `<div style="font-size:11px;color:#888;margin-bottom:8px;font-family:monospace;">
        ${meta.words} · <span style="color:#4ade80">${meta.reduction}</span> · ${meta.time}
       </div>`
    : "";

  const spinnerHtml = isLoading
    ? `<span style="
        display:inline-block;width:12px;height:12px;margin-right:8px;
        border:1.5px solid #444;border-top-color:#6b7bff;
        border-radius:50%;animation:inkbrief-spin .7s linear infinite;vertical-align:middle;
      "></span>`
    : "";

  panel.innerHTML = `
    <style>@keyframes inkbrief-spin{to{transform:rotate(360deg)}}</style>
    <div style="
      background:#0f0f11;border:1px solid #2a2a33;border-radius:10px;
      padding:14px 16px;margin:10px 0;font-family:-apple-system,system-ui,sans-serif;
      color:${isError ? '#ff8a8a' : '#e8e8ef'};font-size:13px;line-height:1.7;
      box-shadow:0 4px 20px rgba(0,0,0,.4);
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${meta ? '10px' : '0'}">
        <span style="color:#6b7bff;font-size:14px">◈</span>
        <span style="font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7bff;">InkBrief</span>
        <button onclick="document.getElementById('${PANEL_ID}').remove()" style="
          margin-left:auto;background:none;border:none;color:#555;cursor:pointer;font-size:16px;line-height:1;
        ">×</button>
      </div>
      ${metaHtml}
      <div>${spinnerHtml}${escapeHtml(text)}</div>
      ${!isLoading && !isError && text ? `
      <button onclick="navigator.clipboard.writeText(\`${text.replace(/`/g, "\\`")}\`);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy summary',1500)" style="
        margin-top:10px;padding:5px 12px;background:#1e1e24;border:1px solid #2a2a33;
        color:#9090a0;border-radius:5px;cursor:pointer;font-size:11px;
      ">Copy summary</button>` : ""}
    </div>`;

  // Insert below the email toolbar
  const emailBody = document.querySelector('.a3s') || document.querySelector('.ii.gt');
  if (emailBody && emailBody.parentNode) {
    emailBody.parentNode.insertBefore(panel, emailBody);
  } else {
    document.querySelector('div[role="main"]')?.prepend(panel);
  }
}

function getEmailText() {
  const selectors = ['div.a3s.aiL', 'div.a3s', '.ii.gt .a3s'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 30) return el.innerText.trim();
  }
  return "";
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * InkBrief — Background Service Worker
 * Handles extension installation events and badge updates
 */

// Show welcome notification on install
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#6b7bff" });

    // Open the app tab after install
    setTimeout(() => {
      chrome.tabs.create({ url: "http://localhost:8000/" });
    }, 1000);
  }
});

// Clear badge when popup is opened
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUMMARIZE_REQUEST") {
    // Forward to popup if needed (future use)
    sendResponse({ received: true });
  }
});

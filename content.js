function getMainContentFromPage() {
  // Attempt to find the main content using various selectors
  const selectors = [
    'main',
    'article',
    'section',
    'div#content',
    'div.main-content',
    'div[role="main"]',
    'div[class*="content"]',
    'div[class*="main"]',
    'div[id*="content"]',
    'div[id*="main"]'
  ];

  // Iterate through selectors and return the inner text of the first matching element
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.innerText; // Return inner text of the found element
    }
  }

  // Fallback to body if no main content found
  return document.body.innerText;
}

// Send extracted text to background script
chrome.runtime.sendMessage(
  { action: "sendText", text: getMainContentFromPage() },
  (response) => {
    if (response && response.status === "success") {
      // Forward the success response back to popup.js
      chrome.runtime.sendMessage({
        action: "webpageAudioGenerated",
        status: "success",
        audioUrl: response.audioUrl,
      });
    } else {
      // Forward error response back to popup.js
      chrome.runtime.sendMessage({
        action: "webpageAudioGenerated",
        status: "error",
        error: response.error,
      });
    }
  }
);

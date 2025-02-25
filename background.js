chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const apiUrl = "http://127.0.0.1:5000/api/tts"; // Flask server URL for TTS

  // Handle "Generate Custom Audio" requests
  if (message.action === "generateCustomAudio") {
    if (!message.text || message.text.trim() === "") {
      console.error("Error: Text is required for custom audio generation.");
      sendResponse({ status: "error", error: "Text is required" });
      return true; // Keep the message channel open
    }

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message.text,
        voice: "en-US-AvaNeural", // Default voice
        rate: 0,
        pitch: 0,
      }),
    })
      .then((response) => {
        if (response.ok) return response.blob(); // Get audio as a Blob
        return response.json().then((data) => {
          throw new Error(data.error || data.warning || "Unknown error");
        });
      })
      .then((blob) => {
        console.log(`Blob created in background.js at ${new Date().toISOString()}:`, blob);

        // Convert Blob to Base64 Data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64DataUrl = reader.result; // Base64 Data URL

          console.log(`Blob successfully converted to Base64 at ${new Date().toISOString()}`);
          sendResponse({ status: "success", audioUrl: base64DataUrl });
        };
        reader.onerror = (error) => {
          console.error("Error converting blob to Data URL:", error);
          sendResponse({ status: "error", error: error.message });
        };
        reader.readAsDataURL(blob); // Read Blob as Base64
      })
      .catch((error) => {
        console.error("Error:", error);
        sendResponse({ status: "error", error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  // Handle "sendText" requests for webpage audio generation
  if (message.action === "sendText") {
    if (!message.text || message.text.trim() === "") {
      console.error("Error: Text is required for webpage audio generation.");
      sendResponse({ status: "error", error: "Text is required" });
      return true; // Keep the message channel open
    }

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message.text,
        voice: "en-US-AvaNeural", // Default voice
        rate: 0,
        pitch: 0,
      }),
    })
      .then((response) => {
        if (response.ok) return response.blob(); // Get audio as a Blob
        return response.json().then((data) => {
          throw new Error(data.error || data.warning || "Unknown error");
        });
      })
      .then((blob) => {
        console.log(`Blob created in background.js at ${new Date().toISOString()}:`, blob);

        // Convert Blob to Base64 Data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64DataUrl = reader.result; // Base64 Data URL

          console.log(`Blob successfully converted to Base64 at ${new Date().toISOString()}`);
          sendResponse({ status: "success", audioUrl: base64DataUrl });
        };
        reader.onerror = (error) => {
          console.error("Error converting blob to Data URL:", error);
          sendResponse({ status: "error", error: error.message });
        };
        reader.readAsDataURL(blob); // Read Blob as Base64
      })
      .catch((error) => {
        console.error("Error:", error);
        sendResponse({ status: "error", error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  // Handle "Query Active Tab" requests
  if (message.action === "queryActiveTab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        sendResponse({ tab: tabs[0] });
      } else {
        sendResponse({ error: "No active tab found" });
      }
    });
    return true; // Keep the message channel open for async response
  }
});

let port;

// Handle persistent connections with content scripts or widgets
chrome.runtime.onConnect.addListener((newPort) => {
  port = newPort;

  port.onDisconnect.addListener(() => {
    port = null; // Clear port when disconnected
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["content.js"], // Dynamically inject content.js
      },
      () => {
        console.log("content.js has been successfully injected.");
      }
    );
  }
});

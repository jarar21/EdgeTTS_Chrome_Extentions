document.addEventListener("DOMContentLoaded", () => {
  try {
    // Get references to UI elements
    const listenTab = document.getElementById("listenTab");
    const generateTab = document.getElementById("generateTab");
    const listenContent = document.getElementById("listenContent");
    const generateContent = document.getElementById("generateContent");
    const widgetContainer = document.getElementById("widgetContainer");
    const dragIcon = document.getElementById("dragIcon");

    const playWebpageAudioButton = document.getElementById("playWebpageAudio");
    const generateAudioButton = document.getElementById("generateAudio");

    const customTextInput = document.getElementById("customText");

    const audioPlayer1 = document.getElementById("audioPlayer1");
    const audioPlayer2 = document.getElementById("audioPlayer2");

    const speedSliderListen = document.getElementById("speedSlider");
    const speedValueListen = document.getElementById("speedValue");

    const speedSliderGenerate = document.getElementById("speedSliderGenerate");
    const speedValueGenerate = document.getElementById("speedValueGenerate");

    const cancelButton = document.getElementById("cancelButton");
    const minimizeButton = document.getElementById("minimizeButton");
    const maximizeButton = document.getElementById("maximizeButton");

    // Tab Switching Logic
    listenTab.addEventListener("click", () => {
      listenTab.classList.add("active");
      generateTab.classList.remove("active");

      listenContent.classList.add("active");
      generateContent.classList.remove("active");
    });

    generateTab.addEventListener("click", () => {
      generateTab.classList.add("active");
      listenTab.classList.remove("active");

      generateContent.classList.add("active");
      listenContent.classList.remove("active");
    });

    // Set initial values for playback speed sliders
    speedSliderListen.value = 1.5;
    speedValueListen.textContent = "1.5x";

    speedSliderGenerate.value = 1.5;
    speedValueGenerate.textContent = "1.5x";

    // Handle playback speed adjustment for Listen tab
    speedSliderListen.addEventListener("input", () => {
      const speed = parseFloat(speedSliderListen.value);
      speedValueListen.textContent = `${speed}x`;
      audioPlayer1.playbackRate = speed;
      audioPlayer2.playbackRate = speed;
    });

    // Handle playback speed adjustment for Generate tab
    speedSliderGenerate.addEventListener("input", () => {
      const speed = parseFloat(speedSliderGenerate.value);
      speedValueGenerate.textContent = `${speed}x`;
      audioPlayer1.playbackRate = speed;
      audioPlayer2.playbackRate = speed;
    });

    // Function to attempt autoplay for an audio player
    function attemptAutoplay(audioPlayer) {
      audioPlayer.muted = true; // Mute initially to allow autoplay
      audioPlayer.play()
        .then(() => {
          console.log("Muted autoplay succeeded.");
          audioPlayer.muted = false; // Unmute after successful muted playback
          audioPlayer.playbackRate = 1.5;
        })
        .catch((error) => {
          console.error("Muted autoplay failed:", error);
          alert("Autoplay blocked. Please click the play button to start playback.");
        });
    }

    // Function to set the audio source dynamically from a Data URL
    function setAudioSourceFromDataUrl(dataUrl) {
      const audioSource1 = document.getElementById("audioSource1");
      const audioSource2 = document.getElementById("audioSource2");

      // Set source attributes dynamically for both players
      [audioSource1, audioSource2].forEach((source) => {
        source.src = dataUrl;
        source.type = "audio/mpeg"; // Ensure correct MIME type
      });

      // Reload both players with the new source and attempt autoplay
      [audioPlayer1, audioPlayer2].forEach((player) => {
        player.load();
        attemptAutoplay(player);
      });

      console.log("Audio sources updated for both players.");
    }

    // Handle "Generate Audio" button click (Custom Text)
    generateAudioButton.addEventListener("click", () => {
      const customText = customTextInput.value.trim();

      if (!customText) {
        alert("Please enter some text.");
        return;
      }

      // Send custom text to background.js
      chrome.runtime.sendMessage(
        { action: "generateCustomAudio", text: customText },
        (response) => {
          if (response && response.status === "success") {
            const dataUrl = response.audioUrl; // Base64 Data URL from background.js
            setAudioSourceFromDataUrl(dataUrl); // Set the audio source dynamically
          } else {
            console.error("Error generating audio:", response.error);
            alert("Error generating audio. Please try again.");
          }
        }
      );
    });

    // Handle "Play Webpage Audio" button click (Main Section)
    playWebpageAudioButton.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTabId = tabs[0].id;

        // Inject content.js into the active tab to extract text
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTabId },
            files: ["content.js"],
          },
          () => {
            console.log("content.js injected successfully.");

            // Listen for a response from content.js via background.js
            chrome.runtime.onMessage.addListener(function listener(response) {
              if (response && response.action === "webpageAudioGenerated") {
                if (response.status === "success") {
                  const dataUrl = response.audioUrl; // Base64 Data URL from background.js
                  setAudioSourceFromDataUrl(dataUrl); // Set the audio source dynamically
                } else {
                  console.error(
                    "Error generating webpage audio:",
                    response.error
                  );
                  alert(
                    "Error generating webpage audio. Please try again."
                  );
                }

                // Remove listener to avoid duplicate responses
                chrome.runtime.onMessage.removeListener(listener);
              }
            });
          }
        );
      });
    });

    // Handle "Cancel" button click (Close Widget)
    cancelButton.addEventListener("click", () => {
      console.log("Widget close requested.");

      // Send a message to the parent page to remove the iframe
      window.parent.postMessage({ action: "removeWidgetIframe" }, "*");
    });

    // Minimize Functionality
    minimizeButton.addEventListener("click", () => {
      widgetContainer.classList.add("minimized");
      maximizeButton.style.display = "block";
      window.parent.postMessage({ action: "minimizeWidget" }, "*");
    });

    // Maximize Functionality
    maximizeButton.addEventListener("click", () => {
      widgetContainer.classList.remove("minimized");
      maximizeButton.style.display = "none";
      window.parent.postMessage({ action: "restoreWidget" }, "*");
    });

  } catch (error) {
    console.error(
      "Extension context invalidated or Chrome APIs unavailable:",
      error.message
    );
  }
});

document.addEventListener("DOMContentLoaded", () => {
  try {
    // Get references to UI elements
    const listenTab = document.getElementById("listenTab");
    const generateTab = document.getElementById("generateTab");
    const listenContent = document.getElementById("listenContent");
    const generateContent = document.getElementById("generateContent");

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

    // Track whether the audio players are playing
    let audioPlayer1IsPlaying = false;
    let audioPlayer2IsPlaying = false;

    // Track which tab is currently active
    let currentTab = 'listen'; // Default to listen tab

    // Track playback position for each audio player
    let audioPlayer1Time = 0;
    let audioPlayer2Time = 0;

    // Tab Switching Logic
    listenTab.addEventListener("click", () => {
      listenTab.classList.add("active");
      generateTab.classList.remove("active");

      listenContent.classList.add("active");
      generateContent.classList.remove("active");

      currentTab = 'listen'; // Update current tab to listen

      // Reset audioPlayer1 when switching to listen tab (if it's stopped)
      if (audioPlayer1.paused) {
        audioPlayer1.currentTime = audioPlayer1Time; // Resume from the stored time
        audioPlayer1IsPlaying = false; // Ensure it's marked as not playing
      }

      // Disable autoplay on switching to listen tab
      audioPlayer1.autoplay = false; // Disable autoplay
    });

    generateTab.addEventListener("click", () => {
      generateTab.classList.add("active");
      listenTab.classList.remove("active");

      generateContent.classList.add("active");
      listenContent.classList.remove("active");

      currentTab = 'generate'; // Update current tab to generate

      // Disable autoplay on switching to generate tab
      audioPlayer2.autoplay = false; // Disable autoplay
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
    });

    // Handle playback speed adjustment for Generate tab
    speedSliderGenerate.addEventListener("input", () => {
      const speed = parseFloat(speedSliderGenerate.value);
      speedValueGenerate.textContent = `${speed}x`;
      audioPlayer2.playbackRate = speed;
    });

    // Function to attempt autoplay for an audio player
    function attemptAutoplay(audioPlayer) {
      audioPlayer.muted = true; // Mute initially to allow autoplay
      audioPlayer.play()
        .then(() => {
          console.log("Muted autoplay succeeded.");
          audioPlayer.muted = false; // Unmute after successful muted playback
        })
        .catch((error) => {
          console.error("Muted autoplay failed:", error);
          alert("Autoplay blocked. Please click the play button to start playback.");
        });
    }

    // Function to set the audio source dynamically from a Data URL
    function setAudioSourceFromDataUrl(dataUrl, playerNumber) {
      const audioSource = document.getElementById(`audioSource${playerNumber}`);

      // Set the source attribute dynamically
      audioSource.src = dataUrl;
      audioSource.type = "audio/mpeg"; // Ensure correct MIME type

      // Reload the player with the new source and attempt autoplay
      const audioPlayer = document.getElementById(`audioPlayer${playerNumber}`);
      audioPlayer.load();
      attemptAutoplay(audioPlayer);

      // Update the playing state
      if (playerNumber === 1) {
        audioPlayer1IsPlaying = true;
      } else if (playerNumber === 2) {
        audioPlayer2IsPlaying = true;
      }

      console.log(`Audio source updated for audioPlayer${playerNumber}.`);
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
            setAudioSourceFromDataUrl(dataUrl, 2); // Set the audio source for player 2 (Generate tab)
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
                  setAudioSourceFromDataUrl(dataUrl, 1); // Set the audio source for player 1 (Listen tab)
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

    // Save current time when audio is paused or stopped
    audioPlayer1.addEventListener("pause", () => {
      audioPlayer1Time = audioPlayer1.currentTime;
    });

    audioPlayer2.addEventListener("pause", () => {
      audioPlayer2Time = audioPlayer2.currentTime;
    });

  } catch (error) {
    console.error(
      "Extension context invalidated or Chrome APIs unavailable:",
      error.message
    );
  }
});

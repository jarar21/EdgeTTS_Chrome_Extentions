document.addEventListener("DOMContentLoaded", () => {
  try {
    let volume1 = 1; // Default volume for player1
    let volume2 = 1; // Default volume for player2
    let associatedTabId = null; // To store the associated tab ID

    // -------------- Associate Widget with Specific Tab --------------
    // Function to get and store the associated tab ID
    function getAssociatedTabId() {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            associatedTabId = tabs[0].id;
            console.log("Associated Tab ID:", associatedTabId);
            resolve(associatedTabId);
          } else {
            reject(new Error("No active tab found."));
          }
        });
      });
    }

    // Initialize and store the associated tab ID
    getAssociatedTabId()
      .then((tabId) => {
        // Successfully associated with a tab
      })
      .catch((error) => {
        console.error(error.message);
        alert("Failed to associate widget with a tab.");
      });

    function initializeAudioPlayer(playerNumber) {
      const playPauseButton = document.getElementById(`playPause${playerNumber}`);
      const speedButton = document.getElementById(`speedButton${playerNumber}`);
      const currentElement = document.getElementById(`current${playerNumber}`);
      const durationElement = document.getElementById(`duration${playerNumber}`);
      const waveElement = document.getElementById(`wave${playerNumber}`);
      const volumeSlider = document.getElementById(`volumeSlider${playerNumber}`);
      const volumeButton = document.getElementById(`volumeButton${playerNumber}`);

      let playbackSpeed = 1.5; // Set initial speed to 1.5x

      const wavesurfer = WaveSurfer.create({
        container: waveElement,
        waveColor: "#8eaecb",
        progressColor: "#1AAFFF",
        height: 40,
        responsive: true,
        backend: 'MediaElement',
      });

      const timeCalculator = (value) => {
        const second = Math.floor(value % 60);
        const minute = Math.floor((value / 60) % 60);
        return `${minute}:${second < 10 ? '0' + second : second}`;
      };

      const updateVolumeIcon = (volume) => {
        if (volume === 0) {
          volumeButton.classList.remove("fi-rr-volume-medium", "fi-rr-volume-high");
          volumeButton.classList.add("fi-rr-volume-mute");
        } else if (volume > 0 && volume <= 0.3) {
          volumeButton.classList.remove("fi-rr-volume-mute", "fi-rr-volume-high");
          volumeButton.classList.add("fi-rr-volume-low");
        } else if (volume > 0.3 && volume <= 0.7) {
          volumeButton.classList.remove("fi-rr-volume-mute", "fi-rr-volume-low");
          volumeButton.classList.add("fi-rr-volume-medium");
        } else {
          volumeButton.classList.remove("fi-rr-volume-mute", "fi-rr-volume-low");
          volumeButton.classList.add("fi-rr-volume-high");
        }
      };

      const updateSpeedIcon = () => {
        speedButton.title = `Speed: ${playbackSpeed}x`;
        speedButton.textContent = `${playbackSpeed.toFixed(1)}x`; // Update button text
      };

      // Set the initial speed icon
      updateSpeedIcon();

      playPauseButton.addEventListener("click", () => {
        wavesurfer.playPause();
      });

      speedButton.addEventListener("click", () => {
        playbackSpeed += 0.5;
        if (playbackSpeed > 2.0) {
          playbackSpeed = 0.5;
        }
        wavesurfer.setPlaybackRate(playbackSpeed);
        updateSpeedIcon();
      });

      volumeSlider.addEventListener("input", (e) => {
        const volume = parseFloat(e.target.value);
        if (playerNumber === 1) {
          volume1 = volume;
          wavesurfer1.setVolume(volume1);
        } else if (playerNumber === 2) {
          volume2 = volume;
          wavesurfer2.setVolume(volume2);
        }
        updateVolumeIcon(volume);
      });

      wavesurfer.on("ready", () => {
        durationElement.textContent = timeCalculator(wavesurfer.getDuration());
        wavesurfer.setPlaybackRate(playbackSpeed); // Ensure playback rate is set when audio is ready
      });

      wavesurfer.on("audioprocess", () => {
        currentElement.textContent = timeCalculator(wavesurfer.getCurrentTime());
      });

      wavesurfer.on("play", () => {
        playPauseButton.classList.remove("fi-rr-play");
        playPauseButton.classList.add("fi-rr-pause");
      });

      wavesurfer.on("pause", () => {
        playPauseButton.classList.add("fi-rr-play");
        playPauseButton.classList.remove("fi-rr-pause");
      });

      wavesurfer.on("seek", () => {
        currentElement.textContent = timeCalculator(wavesurfer.getCurrentTime());
      });

      if (playerNumber === 1) {
        wavesurfer.setVolume(volume1);
      } else if (playerNumber === 2) {
        wavesurfer.setVolume(volume2);
      }

      return wavesurfer;
    }

    const wavesurfer1 = initializeAudioPlayer(1);
    const wavesurfer2 = initializeAudioPlayer(2);

    const generateAudioButton = document.getElementById("generateAudio");
    const customTextInput = document.getElementById("customText");

    generateAudioButton.addEventListener('click', async () => {
      const text = customTextInput.value.trim();

      if (!text) {
        alert("Please enter some text.");
        return;
      }

      try {
        chrome.runtime.sendMessage(
          { action: "generateCustomAudio", text: text },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending message to background script:", chrome.runtime.lastError.message);
              alert("Failed to communicate with the background script.");
              return;
            }

            if (response && response.status === "success") {
              const dataUrl = response.audioUrl; // Base64 Data URL from background.js

              // Convert Base64 Data URL to Blob URL
              let audioBlobUrl;
              if (dataUrl.startsWith("data:audio/")) {
                const base64Data = dataUrl.split(",")[1];
                const mimeType = dataUrl.match(/data:(.*?);base64/)[1];
                const binaryData = atob(base64Data);
                const buffer = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                  buffer[i] = binaryData.charCodeAt(i);
                }
                const blob = new Blob([buffer], { type: mimeType });
                audioBlobUrl = URL.createObjectURL(blob);
              } else {
                audioBlobUrl = dataUrl; // Use as is if not Base64
              }

              // Load and play the audio using wavesurfer2
              wavesurfer2.load(audioBlobUrl);
              wavesurfer2.once('ready', () => {
                wavesurfer2.setPlaybackRate(1.5);
                wavesurfer2.play();
              });
            } else {
              console.error("Error generating custom audio:", response.error);
              alert("Error generating custom audio. Please try again.");
            }
          }
        );
      } catch (error) {
        alert("Error generating audio: " + error.message);
      }
    });

    const playWebpageAudioButton = document.getElementById("playWebpageAudio");

    if (!playWebpageAudioButton) {
      console.error("playWebpageAudioButton element not found in the DOM.");
      return;
    }

    // Handle "Play Webpage Audio" button click
    playWebpageAudioButton.addEventListener("click", () => {
      getAssociatedTabId().then((activeTabId) => {
        // Inject content.js into the associated tab
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTabId },
            files: ["content.js"],
          },
          () => {
            console.log("content.js injected successfully.");

            // Send a message to the content script to initiate audio playback
            chrome.tabs.sendMessage(
              activeTabId,
              { action: "playWebpageAudio" },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Error sending message to content script:", chrome.runtime.lastError.message);
                  alert("Failed to communicate with the webpage. Make sure the extension is properly injected.");
                  return;
                }

                if (response && response.status === "initiated") {
                  console.log("Webpage audio playback initiated.");
                } else {
                  console.error("Failed to initiate webpage audio playback.");
                  alert("Failed to initiate webpage audio playback.");
                }
              }
            );
          }
        );
      }).catch((error) => {
        console.error("Error associating with tab:", error.message);
        alert("Failed to associate widget with a tab.");
      });
    });

    // Listen for the "webpageAudioGenerated" message from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "webpageAudioGenerated") {
        // Ensure the message is from the associated tab
        if (sender.tab && sender.tab.id === associatedTabId) {
          if (request.status === "success") {
            const dataUrl = request.audioUrl; // Base64 Data URL from background.js
            const audioType = request.audioType; // "pageContent" or "copiedText"

            // Convert Base64 Data URL to Blob URL
            let audioBlobUrl;
            if (dataUrl.startsWith("data:audio/")) {
              const base64Data = dataUrl.split(",")[1];
              const mimeTypeMatch = dataUrl.match(/data:(.*?);base64/);
              const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "audio/mpeg";
              const binaryData = atob(base64Data);
              const buffer = new Uint8Array(binaryData.length);
              for (let i = 0; i < binaryData.length; i++) {
                buffer[i] = binaryData.charCodeAt(i);
              }
              const blob = new Blob([buffer], { type: mimeType });
              audioBlobUrl = URL.createObjectURL(blob);
            } else {
              audioBlobUrl = dataUrl; // Use as is if not Base64
            }

            if (audioType === "pageContent") {
              // Load and play the audio using wavesurfer1
              wavesurfer1.load(audioBlobUrl);
              wavesurfer1.once("ready", () => {
                wavesurfer1.setPlaybackRate(1.5);
                wavesurfer1.play();
              });

              // Attach play/pause functionality to playPauseButton1
              const playPauseButton1 = document.getElementById("playPause1");
              if (playPauseButton1) {
                playPauseButton1.addEventListener("click", () => {
                  wavesurfer1.playPause();
                });
              }
            } else if (audioType === "copiedText") {
              // Load and play the audio using wavesurfer2
              wavesurfer2.load(audioBlobUrl);
              wavesurfer2.once("ready", () => {
                wavesurfer2.setPlaybackRate(1.5);
                wavesurfer2.play();
              });

              // Attach play/pause functionality to playPauseButton2
              const playPauseButton2 = document.getElementById("playPause2");
              if (playPauseButton2) {
                playPauseButton2.addEventListener("click", () => {
                  wavesurfer2.playPause();
                });
              }
            }
          } else {
            console.error("Error generating webpage audio:", request.error);
            alert("Error generating webpage audio. Please try again.");
          }
        }
      }
    });

    const cancelButton = document.getElementById("cancelButton");
    cancelButton.addEventListener("click", () => {
      window.parent.postMessage({ action: "removeWidgetIframe" }, "*");
    });

    const minimizeButton = document.getElementById("minimizeButton");
    const maximizeButton = document.getElementById("maximizeButton");
    const widgetContainer = document.getElementById("widgetContainer");

    minimizeButton.addEventListener("click", () => {
      widgetContainer.classList.add("minimized");
      maximizeButton.style.display = "block";
      window.parent.postMessage({ action: "minimizeWidget" }, "*");
    });

    maximizeButton.addEventListener("click", () => {
      widgetContainer.classList.remove("minimized");
      maximizeButton.style.display = "none";
      window.parent.postMessage({ action: "restoreWidget" }, "*");
    });

    const listenTabButton = document.getElementById('listenTab');
    const generateTabButton = document.getElementById('generateTab');
    const listenContent = document.getElementById('listenContent');
    const generateContent = document.getElementById('generateContent');

    listenTabButton.addEventListener('click', () => {
      listenTabButton.classList.add('active');
      generateTabButton.classList.remove('active');
      listenContent.classList.add('active');
      generateContent.classList.remove('active');
    });

    generateTabButton.addEventListener('click', () => {
      generateTabButton.classList.add('active');
      listenTabButton.classList.remove('active');
      generateContent.classList.add('active');
      listenContent.classList.remove('active');
    });

  } catch (error) {
    alert("Error initializing widget: " + error.message);
  }
});

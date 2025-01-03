document.addEventListener("DOMContentLoaded", () => {
  // Get references to UI elements
  const generateAudioButton = document.getElementById("generateAudio");
  const playWebpageAudioButton = document.getElementById("playWebpageAudio");
  const customTextInput = document.getElementById("customText");
  const audioPlayer = document.getElementById("audioPlayer");
  const speedSlider = document.getElementById("speedSlider");
  const speedValue = document.getElementById("speedValue");
  const switchToWidgetButton = document.getElementById("switchToWidget");

  // Check if all elements exist
  if (!generateAudioButton || !playWebpageAudioButton || !customTextInput || !audioPlayer || !speedSlider || !speedValue || !switchToWidgetButton) {
    console.error("One or more elements are missing from the DOM.");
    return;
  }

  // Set initial values
  speedSlider.value = 1.5; // Set slider's initial value
  speedValue.textContent = "1.5x"; // Update the displayed value

  // Handle playback speed adjustment
  speedSlider.addEventListener("input", () => {
    const speed = speedSlider.value;
    audioPlayer.playbackRate = speed;
    speedValue.textContent = `${speed}x`;
  });

  // Function to set the audio source dynamically from a Data URL
  function setAudioSourceFromDataUrl(dataUrl) {
    const audioSource = document.getElementById("audioSource");

    // Set source attributes dynamically
    audioSource.src = dataUrl;
    audioSource.type = "audio/mpeg"; // Ensure correct MIME type
    audioPlayer.load(); // Reload player with new source

    // Attempt muted autoplay (optional)
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

    console.log("Audio ready for user-triggered playback.");
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

      // Inject content.js into the active tab
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTabId },
          files: ["content.js"],
        },
        () => {
          console.log('content.js injected successfully.');

          // Listen for a response from content.js via background.js
          chrome.runtime.onMessage.addListener(function listener(response) {
            if (response && response.action === "webpageAudioGenerated") {
              if (response.status === "success") {
                const dataUrl = response.audioUrl; // Base64 Data URL from background.js
                setAudioSourceFromDataUrl(dataUrl); // Set the audio source dynamically
              } else {
                console.error("Error generating webpage audio:", response.error);
                alert("Error generating webpage audio. Please try again.");
              }

              // Remove listener to avoid duplicate responses
              chrome.runtime.onMessage.removeListener(listener);
            }
          });
        }
      );
    });
  });

  switchToWidgetButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // Check if the draggable container already exists
          if (!document.querySelector('div#draggableIframeContainer')) {
            const container = document.createElement('div');
            container.id = 'draggableIframeContainer';
            container.style.position = 'fixed';
            container.style.bottom = '20px'; // Default position from bottom
            container.style.right = '20px'; // Default position from right
            container.style.width = '310px'; // Default width
            container.style.height = '300px'; // Default height
            container.style.zIndex = '10000'; // Ensure it's above other elements
            container.style.boxShadow = '0px 4px 8px rgba(0,0,0,0.2)'; // Add shadow for visibility
  
            // Create an iframe for the widget
            const iframe = document.createElement('iframe');
            iframe.id = 'draggableIframe';
            iframe.src = chrome.runtime.getURL('widget.html'); // Load widget.html
            iframe.style.width = '100%'; // Full width of the container
            iframe.style.height = '100%'; // Full height of the container
            iframe.style.border = 'none'; // No border
  
            // Append iframe to the container
            container.appendChild(iframe);
            document.body.appendChild(container);
  
            // Drag-and-Drop Functionality for Container
            let isDragging = false;
            let offsetX, offsetY;
  
            // Add a drag icon to drag the entire iframe container
            const dragIcon = document.createElement('div');
            dragIcon.id = 'dragIcon';
            dragIcon.textContent = '☰'; // Drag icon text or symbol
            dragIcon.style.cssText =
              'position: absolute; top: 11px; right: 10px; width: 30px; height: 30px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 30px; cursor: grab; z-index: 10001;';
            
            dragIcon.addEventListener('mousedown', (e) => {
              isDragging = true;
              const rect = container.getBoundingClientRect();
              offsetX = e.clientX - rect.left;
              offsetY = e.clientY - rect.top;
              document.body.style.userSelect = 'none'; // Prevent text selection while dragging
              dragIcon.style.cursor = 'grabbing';
            });
  
            document.addEventListener('mousemove', (e) => {
              if (isDragging) {
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                container.style.left = `${x}px`;
                container.style.top = `${y}px`;
                container.style.bottom = 'unset';
                container.style.right = 'unset';
              }
            });
  
            document.addEventListener('mouseup', () => {
              isDragging = false;
              document.body.style.userSelect = ''; // Re-enable text selection after dragging
              dragIcon.style.cursor = 'grab';
            });
  
            // Append drag icon to the widget's container (above iframe)
            container.appendChild(dragIcon);
  
            // Listen for messages from widget.html (e.g., minimize, maximize, close)
            window.addEventListener('message', (event) => {
              if (event.data.action === 'removeWidgetIframe') {
                container.remove(); // Remove entire draggable container
                console.log('Widget iframe removed.');
              } else if (event.data.action === 'minimizeWidget') {
                // Minimize iframe to a smaller size
                dragIcon.style.cssText =
              'position: absolute; top: 0px; right: 0px; width: 24px; height: 24px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 24px; cursor: grab; z-index: 10001;';
                container.style.width = '50px';
                container.style.height = '50px';
                console.log('Widget minimized.');
              } else if (event.data.action === 'restoreWidget') {
                // Restore iframe to original size
                dragIcon.style.cssText =
              'position: absolute; top: 11px; right: 10px; width: 30px; height: 30px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 30px; cursor: grab; z-index: 10001;';
            
                container.style.width = '310px';
                container.style.height = '300px';
                console.log('Widget restored.');
              }
            });
          }
        },
      });
    });
  });

});
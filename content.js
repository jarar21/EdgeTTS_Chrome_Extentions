// content.js
(function () {
  var myAudioPlayer = null;          // Audio object
  var currentAudioElement = null;    // The DOM element (e.g., <p>) that was clicked
  var wordSpans = [];                // Array of <span> for each word
  var totalWords = 0;                // Number of words in the snippet
  var originalText = "";             // The raw text (for reference if needed)
  var isBlocked = false;            // Block repeated clicks for 3 seconds
  var isCollapsed = true;           // State for collapsible button
  var paragraphQueue = []; // Queue of paragraphs for sequential playback
  var currentParagraphIndex = 0; // Track the current paragraph being played
  var debounceTimer = null;
  var ttsActive = true;

  // -------------- 1) Add click for partial-text TTS -------------- //

  function getMainContentFromPage() {
    const selectors = [
      "main", 
      "article", 
      "section", 
      "div#content", 
      "div.main-content",
      "div[role='main']", 
      "div[class*='content']", 
      "div[class*='main']",
      "div[id*='content']", 
      "div[id*='main']",
      "div.primary-content"
    ];
  
    let mainContent = "";
    let bestElement = null;
    let maxLength = 0;
  
    // Iterate through all selectors to find the most relevant content block
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const textElements = element.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span");
        let combinedText = "";
  
        textElements.forEach(textElement => {
          combinedText += textElement.innerText.trim() + " ";
        });
  
        // Clean up the combined text
        combinedText = combinedText.trim();
  
        // Skip empty or very short content
        if (!combinedText || combinedText.length < 100) return;
  
        // Choose the element with the most text
        if (combinedText.length > maxLength) {
          maxLength = combinedText.length;
          mainContent = combinedText;
          bestElement = element;
        }
      });
    });
  
    if (bestElement) {
      console.log("Best content element found:", bestElement);
      console.log("Text sent to audio generator:", mainContent);
      return mainContent;
    }
  
    // Fallback to body text if no suitable element is found
    console.warn("No specific main content found, falling back to <body> text.");
    const fallbackElements = document.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span");
    let fallbackContent = "";
  
    fallbackElements.forEach(element => {
      fallbackContent += element.innerText.trim() + " ";
    });
  
    fallbackContent = fallbackContent.trim();
    console.log("Text sent to audio generator (fallback):", fallbackContent);
    return fallbackContent;
  }

  function playWebpageAudio() {
    const mainContent = getMainContentFromPage();

    if (!mainContent) {
      console.error("No main content found to generate audio.");
      chrome.runtime.sendMessage({
        action: "webpageAudioGenerated",
        status: "error",
        error: "No main content found.",
        audioType: "pageContent"
      });
      return;
    }

    console.log("Sending main page text to background script:", mainContent);

    chrome.runtime.sendMessage(
      { action: "sendText", text: mainContent },
      (response) => {
        console.log("Response from background script:", response);

        if (response && response.status === "success") {
          chrome.runtime.sendMessage({
            action: "webpageAudioGenerated",
            status: "success",
            audioUrl: response.audioUrl,
            audioType: "pageContent"
          });
        } else {
          console.error("Error generating audio:", response?.error || "Unknown error");
          chrome.runtime.sendMessage({
            action: "webpageAudioGenerated",
            status: "error",
            error: response?.error || "Unknown error during audio generation",
            audioType: "pageContent"
          });
        }
      }
    );
  }
  window.addEventListener('message', (event) => {
    const iframeContainer = document.getElementById('draggableIframeContainer');

    if (event.data && event.data.action) {
        switch (event.data.action) {
            case 'removeWidgetIframe':
                if (iframeContainer) {
                    console.log("Removing widget iframe container.");
                    iframeContainer.remove();
                } else {
                    console.warn("Tried to remove widget, but container not found.");
                }
                break;

            case 'minimizeWidget':
                if (iframeContainer) {
                    console.log("Minimizing widget container.");
                    // Set container size to match internal minimized state
                    iframeContainer.style.width = '50px';
                    iframeContainer.style.height = '50px';
                    iframeContainer.style.overflow = 'hidden';
                    iframeContainer.style.transition = 'all 0.3s ease';
                    // Forward to iframe for internal sync
                    const iframe = iframeContainer.querySelector('#draggableIframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ action: "minimizeWidget" }, "*");
                    }
                }
                break;

            case 'restoreWidget':
                if (iframeContainer) {
                    console.log("Restoring widget container.");
                    // Restore container to original size
                    iframeContainer.style.width = '310px';
                    iframeContainer.style.height = '330px';
                    iframeContainer.style.overflow = 'visible';
                    iframeContainer.style.transition = 'all 0.3s ease';
                    // Forward to iframe for internal sync
                    const iframe = iframeContainer.querySelector('#draggableIframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ action: "restoreWidget" }, "*");
                    }
                }
                break;

            case 'startDrag':
                console.log("Content script: Disabling text selection on body.");
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';
                document.body.style.cursor = 'grabbing';
                break;

            case 'endDrag':
                console.log("Content script: Re-enabling text selection on body.");
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                document.body.style.cursor = '';
                break;

            default:
                break;
        }
    }
});
  // Listen for messages from the widget
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "playWebpageAudio") {
      playWebpageAudio();
      sendResponse({ status: "initiated" });
    }
  });
  // --- Updated setupTextToSpeech Function ---
  
  function setupTextToSpeech() {
    console.log("Setting up TTS click listener using event delegation (v2 - stricter targetting).");

    // Ensure no duplicate listeners if run multiple times
    const listenerMarker = 'ttsListenerAttached_v2';
    if (document.body.dataset[listenerMarker] === 'true') {
       console.log("TTS listener (v2) already attached.");
       return;
    }
    document.body.dataset[listenerMarker] = 'true';

    document.body.addEventListener("click", (event) => {
      // ======================================================
      // <<<--- Check if TTS is globally active FIRST ---<<<
      if (!ttsActive) { // ADDED: Check the global flag
          // console.log("TTS terminated, ignoring click."); // Optional log for debugging
          return; // Don't process the click if TTS has been stopped
      }
      // ======================================================

      // --- Basic Filtering (Now follows the ttsActive check) ---

      // 1. Ignore clicks if blocked (debouncing)
      if (isBlocked) {
        // console.log("Action blocked. Please wait.");
        return;
      }

      // 2. Ignore clicks on the audio controls UI itself
      if (event.target.closest("#audio-controls")) {
        return;
      }

      // 3. Ignore clicks on standard interactive elements
      const interactiveElement = event.target.closest('a, button, input, select, textarea, label, [role="button"], [role="link"], [onclick], summary');
      if (interactiveElement) {
        return;
      }

      // --- Stricter Target Identification ---

      // 4. Ignore clicks directly on major layout containers
      const clickedTagName = event.target.tagName.toUpperCase();
      const layoutContainerTags = ['BODY', 'MAIN', 'ARTICLE', 'SECTION', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'HTML'];
      if (layoutContainerTags.includes(clickedTagName)) {
          // console.log("Clicked directly on a major layout container, ignoring.", event.target); // Reduce noise
          return;
      }
      // More aggressive check for DIVs containing blocks (likely empty space between)
      if (clickedTagName === 'DIV' && event.target.querySelector('p, ul, ol, h1, h2, h3, h4, h5, h6, div, table')) {
          if (event.target === document.elementFromPoint(event.clientX, event.clientY)) {
               // console.log("Clicked directly on a DIV containing block elements, likely empty space. Ignoring.", event.target); // Reduce noise
               return;
          }
      }


      // 5. Find the most specific relevant text block ancestor
      const potentialTargetSelectors = [
        "p", "li", "h1", "h2", "h3", "h4", "h5", "h6",
        "blockquote", "td", "th", "pre", "dt", "dd", "caption"
        // Add specific classes/selectors if needed: e.g., ".comment-text", ".article-para"
      ].join(", ");

      const paragraphElement = event.target.closest(potentialTargetSelectors);

      // 6. If no specific text block ancestor is found, ignore
      if (!paragraphElement) {
        // console.warn("No specific text block element found as ancestor of:", event.target); // Reduce noise
        return;
      }

      // --- Processing the Valid Click ---

      // 7. Get text content
      const clickedText = paragraphElement.innerText?.trim();

      // 8. Ignore elements with negligible text
      if (!clickedText || clickedText.length < 5) { // Minimum length threshold
        // console.warn("Identified element has insufficient text. Ignoring.", paragraphElement); // Reduce noise
        return;
      }

      // 9. Ignore elements identified as entirely math/code
       if (isEntirelyLatexOrKatex(paragraphElement)) {
         console.log("Skipping entirely LaTeX/KaTeX element:", paragraphElement);
         return;
       }

      // --- Initiate Playback ---

      console.log("Valid target found:", paragraphElement);
      // console.log("Text to process:", clickedText); // Can be verbose

      // Prevent default actions & stop bubbling *only* if we're handling the click
      event.preventDefault();
      event.stopPropagation();

      // Block subsequent clicks briefly
      isBlocked = true;
      setTimeout(() => {
        isBlocked = false;
      }, 1000); // 1 second block

      // Cleanup any previous playback state
      cleanupExistingPlayback();

      // Set current element reference
      currentAudioElement = paragraphElement;
      // REMOVED: originalText = currentAudioElement.innerHTML; // No longer needed

      // Apply visual feedback (initial highlight)
      // Ensure smooth transitions are applied if not already present
      // (Consider adding this transition via CSS instead for cleaner JS)
      if (paragraphElement.style.transition.indexOf('background-color') === -1) {
          paragraphElement.style.transition = "background-color 0.3s ease, box-shadow 0.3s ease";
      }
      paragraphElement.style.backgroundColor = "rgba(210, 230, 255, 0.5)"; // Light blue initial feedback

      // Queue this paragraph and subsequent ones for playback
      queueParagraphsForAudio(paragraphElement); // Pass the confirmed target element

      // Start the audio sequence
      playNextParagraphAudio(); // This will fetch/play audio and apply stronger highlighting

    }, { capture: true }); // Using capture phase
  }
  function queueParagraphsForAudio(startElement) {
    paragraphQueue = [];
    currentParagraphIndex = 0;
  
    let element = startElement;
    while (element) {
      const text = element.innerText?.trim();
      if (text && !isEntirelyLatexOrKatex(element)) {
        element.setAttribute("data-original-text", text); // Store original text
        paragraphQueue.push(element); // Add valid element to the queue
      } else if (isEntirelyLatexOrKatex(element)) {
        console.log("Skipping entirely LaTeX/KaTeX paragraph during queueing:", element.innerHTML);
      }
      element = element.nextElementSibling; // Move to the next sibling
    }
  
    if (paragraphQueue.length === 0) {
      console.warn("No valid paragraphs with text found.");
    }
  }
  
  function playNextParagraphAudio() {
    if (currentParagraphIndex >= paragraphQueue.length) {
        console.log("All paragraphs have been played.");
        if (currentAudioElement) {
             resetSectionStyles(currentAudioElement);
             currentAudioElement = null;
             console.log("Cleaned up style for the final element.");
        }
        currentParagraphIndex = 0;
        paragraphQueue = [];
        return;
    }

    const nextElement = paragraphQueue[currentParagraphIndex];
    currentAudioElement = nextElement; // Update global reference

    if (!nextElement || !nextElement.innerText?.trim()) { // Trim check added
        console.warn("Skipping undefined or empty element in queue at index:", currentParagraphIndex);
        currentParagraphIndex++;
        playNextParagraphAudio();
        return;
    }

    if (isEntirelyLatexOrKatex(nextElement)) {
        console.log("Skipping entirely LaTeX/KaTeX paragraph in queue:", nextElement.innerHTML);
        currentParagraphIndex++;
        playNextParagraphAudio();
        return;
    }

    console.log("Preparing paragraph:", currentParagraphIndex, nextElement);
    const textToRead = preprocessTextForTTS(nextElement.innerText.trim()); // Get text to read

    // --- *** Check for Preloaded Audio *** ---
    if (nextElement.preloadedAudioUrl) {
        console.log("Using preloaded audio for paragraph:", currentParagraphIndex);
        const preloadedUrl = nextElement.preloadedAudioUrl;
        // Clear the preloaded URL from the element *immediately* after retrieving it
        // so it's not accidentally reused or revoked prematurely elsewhere.
        nextElement.preloadedAudioUrl = null;
        // Call the handler with the preloaded Blob URL
        handleAudioResponse(nextElement, textToRead, preloadedUrl);
    } else {
        // --- No Preloaded Audio: Request it ---
        console.log("Requesting audio generation for paragraph:", currentParagraphIndex);
        // Clear any potentially stale preloading flags if we reach here without a URL
        nextElement.isPreloadingAudio = false;

        chrome.runtime.sendMessage({ action: "sendText", text: textToRead }, (response) => {
            // Check if the element is still the active one when the response comes back
            if (nextElement !== currentAudioElement) {
                console.log("Audio response received for queued element, but user clicked elsewhere. Discarding.", nextElement);
                // If a data URL was generated, it just gets discarded. No blob URL to revoke yet.
                return;
            }

            if (response && response.status === "success") {
                // Pass the newly generated audio URL (likely data URL)
                handleAudioResponse(nextElement, textToRead, response.audioUrl);
            } else {
                console.error("Error generating audio for queued element:", response?.error || "No response", nextElement);
                // Try the next paragraph if generation fails
                currentParagraphIndex++;
                playNextParagraphAudio();
            }
        });
    }
}
function handleAudioResponse(element, text, audioUrl) {
  // --- Check if element is still the active one ---
  if (element !== currentAudioElement) {
      console.log("Audio response/URL received for an element that is no longer active. Discarding.", element);
      if (audioUrl && audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl);
          console.log("Revoked unused preloaded Blob URL.");
      }
      return; // Don't process this audio
  }
  // --- End of check ---

  if (!audioUrl || !(audioUrl.startsWith('data:') || audioUrl.startsWith('blob:'))) {
      console.error("Invalid audio data/blob URL:", audioUrl);
      if (element === currentAudioElement) {
           resetSectionStyles(element);
           currentParagraphIndex++;
           playNextParagraphAudio();
      }
      return;
  }

  const words = text.split(/\s+/);
  totalWords = words.length; // Update global totalWords for this specific audio segment

  let audioSrcUrl = null;
  let isBlobUrl = false;

  if (audioUrl.startsWith('blob:')) {
      audioSrcUrl = audioUrl;
      isBlobUrl = true;
      console.log("Using preloaded Blob URL for playback:", element);
  } else if (audioUrl.startsWith('data:')) {
      try {
          const mimeType = audioUrl.match(/data:(.*?);base64/)[1];
          const rawStr = atob(audioUrl.split(",")[1]);
          const blob = new Blob([new Uint8Array([...rawStr].map((c) => c.charCodeAt(0)))], { type: mimeType });
          audioSrcUrl = URL.createObjectURL(blob);
          isBlobUrl = true;
          console.log("Created Blob URL from data URL for playback.");
      } catch (e) {
          console.error("Error processing base64 audio data:", e);
          if (element === currentAudioElement) {
              resetSectionStyles(element);
              currentParagraphIndex++;
              playNextParagraphAudio();
          }
          return;
      }
  } else {
      console.error("Unexpected audioUrl format:", audioUrl);
      return;
  }

  if (!audioSrcUrl) {
       console.error("Failed to prepare audio source URL.");
       if (element === currentAudioElement) {
          resetSectionStyles(element);
          currentParagraphIndex++;
          playNextParagraphAudio();
       }
       return;
  }

  myAudioPlayer = new Audio(audioSrcUrl);
  myAudioPlayer.playbackRate = 1.5; // TODO: Make dynamic

  wordSpans = [];
  let currentWordIndex = -1;
  let preloadTriggered = false; // Flag to ensure preload logic runs only once per audio segment

  // --- Time Update Listener (Word Highlighting & EXTENDED Preload Trigger) ---
  myAudioPlayer.addEventListener("timeupdate", () => {
      if (!myAudioPlayer || element !== currentAudioElement || !myAudioPlayer.duration || myAudioPlayer.duration === 0) return;

      const currentTime = myAudioPlayer.currentTime;
      const duration = myAudioPlayer.duration;
      const progress = currentTime / duration;

      // --- Preload Trigger (Extended Chained Logic) ---
      if (!preloadTriggered && progress >= 0.5) {
          preloadTriggered = true; // Mark that preload has been initiated for this segment

          let indexToCheck = currentParagraphIndex + 1; // Start checking from the next paragraph
          const MAX_PRELOAD_AHEAD = 3; // Max number of paragraphs to *initiate* preload for (N+1, N+2, N+3)
          let preloadsInitiatedCount = 0;

          console.log(`[Preload Chain @ 50%] Current index: ${currentParagraphIndex}. Starting check from index: ${indexToCheck}`);

          // Loop to check and potentially preload N+1, N+2, N+3
          while (preloadsInitiatedCount < MAX_PRELOAD_AHEAD && indexToCheck < paragraphQueue.length) {
              console.log(`[Preload Chain] Checking index: ${indexToCheck}`);
              const elementToPreload = paragraphQueue[indexToCheck];
              const elementText = elementToPreload?.innerText?.trim();
              const isValid = elementText && !isEntirelyLatexOrKatex(elementToPreload);

              if (isValid) {
                  const wordCount = elementText.split(/\s+/).length;
                  console.log(`[Preload Chain] Element at index ${indexToCheck} is valid. Words: ${wordCount}. Preloading.`);

                  // --- Preload the valid element ---
                  preloadAudio(elementToPreload, elementText);
                  preloadsInitiatedCount++; // Increment count of initiated preloads

                  // --- Decide if we continue checking the *next* one ---
                  if (wordCount < 15) {
                      console.log(`[Preload Chain] Element at ${indexToCheck} is short (<15 words). Will check next index.`);
                      indexToCheck++; // Move to the next index for the next loop iteration
                  } else {
                      console.log(`[Preload Chain] Element at ${indexToCheck} is NOT short. Stopping chain.`);
                      break; // Stop the loop/chain if the current element wasn't short
                  }
              } else {
                  console.log(`[Preload Chain] Element at index ${indexToCheck} is invalid/empty/latex. Stopping chain.`);
                  break; // Stop the loop/chain if we hit an invalid element
              }
          } // End of while loop

          if (preloadsInitiatedCount > 0) {
              console.log(`[Preload Chain] Finished. Initiated ${preloadsInitiatedCount} preloads.`);
          } else {
               console.log(`[Preload Chain] Finished. No valid elements found to preload starting from index ${currentParagraphIndex + 1}.`);
          }

      }
      // --- End of Preload Trigger ---


      // --- Word Highlighting ---
      const currentSegmentWords = words.length;
      const newWordIndex = Math.min(Math.max(0, Math.floor(progress * currentSegmentWords)), currentSegmentWords - 1);

      if (newWordIndex !== currentWordIndex) {
          highlightWord(element, newWordIndex, words);
          currentWordIndex = newWordIndex;
      }
  });

  // --- Ended Listener ---
  myAudioPlayer.addEventListener("ended", () => {
      console.log("Audio ended for element:", element);
      resetSectionStyles(element);

      if (isBlobUrl && audioSrcUrl) {
          URL.revokeObjectURL(audioSrcUrl);
          console.log("Revoked Blob URL on ended:", audioSrcUrl);
      }

      if (element === currentAudioElement) {
          currentParagraphIndex++;
          playNextParagraphAudio();
      } else {
          console.log("Audio ended for an element that is no longer the active one.");
      }
  });

  // --- Playback ---
  element.style.backgroundColor = "rgba(50, 118, 205, 0.3)";
  element.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
  element.style.borderRadius = "5px";

  myAudioPlayer.play().catch((err) => {
      console.error("Error playing audio:", err, element);
      resetSectionStyles(element);
      if (isBlobUrl && audioSrcUrl) {
          URL.revokeObjectURL(audioSrcUrl);
          console.log("Revoked Blob URL on play error:", audioSrcUrl);
      }

      if (element === currentAudioElement) {
          currentParagraphIndex++;
          playNextParagraphAudio();
      }
  });
}
  function highlightWord(element, currentIndex, words) {
    if (!element || !words.length) return;
  
    const originalText = words.join(" "); // Keep original text intact
    const currentWord = words[currentIndex];
  
    // Use range-based highlighting
    const range = document.createRange();
    const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
  
    let charIndex = 0;
    for (let node of textNodes) {
      const text = node.nodeValue;
      const startIndex = charIndex;
      const endIndex = charIndex + text.length;
  
      if (currentWord && startIndex <= currentWord.start && currentWord.end <= endIndex) {
        const wordStart = currentWord.start - charIndex;
        const wordEnd = currentWord.end - charIndex;
  
        range.setStart(node, wordStart);
        range.setEnd(node, wordEnd);
  
        const highlightSpan = document.createElement("span");
        highlightSpan.style.backgroundColor = "rgba(15, 15, 150, 0.4)";
        highlightSpan.style.borderRadius = "3px";
  
        range.surroundContents(highlightSpan);
        break;
      }
      charIndex = endIndex;
    }
  }
  
  function resetSectionStyles(element) {
    if (!element) return;

    // Remove word highlight spans first (if they exist and are direct children/descendants)
    // Query relative to the element to avoid affecting unrelated parts of the page
    const highlights = element.querySelectorAll("span[style*='background-color']"); // Consider a more specific selector if needed
    highlights.forEach((highlight) => {
        try { // Add try-catch for robustness if DOM manipulation fails
            const parent = highlight.parentNode;
            if (parent) { // Ensure parent exists
                // Unwrap the span carefully
                while (highlight.firstChild) {
                    parent.insertBefore(highlight.firstChild, highlight);
                }
                parent.removeChild(highlight);
            } else {
                 console.warn("Highlight span parent not found during reset.", highlight);
            }
        } catch (e) {
            console.error("Error removing highlight span:", e, highlight);
        }
    });

    // Reset the main element's direct inline styles
    element.style.backgroundColor = ""; // Clear background
    element.style.boxShadow = "";     // Clear shadow
    element.style.borderRadius = ""; // Clear border radius
    // console.log("Section reset to original styles for element:", element); // Reduce noise slightly
}

  function onAudioTimeUpdate() {
    if (!myAudioPlayer || !myAudioPlayer.duration || !wordSpans.length) return;
  
    const currentTime = myAudioPlayer.currentTime;
    const duration = myAudioPlayer.duration;
    const progress = currentTime / duration;
  
    // Trigger preloading at 30% progress
    if (progress >= 0.3 && currentParagraphIndex + 1 < paragraphQueue.length) {
      const nextElement = paragraphQueue[currentParagraphIndex + 1];
  
      if (!nextElement.preloadedAudioUrl && !nextElement.isAudioBeingGenerated) {
        nextElement.isAudioBeingGenerated = true; // Mark as generating
        console.log("Preloading next audio at 30% progress:", nextElement.innerText.trim());
        preloadAudio(nextElement, nextElement.innerText.trim());
      }
    }
  
    let wordIndex = Math.floor(progress * totalWords);
  
    if (wordIndex < 0) wordIndex = 0;
    if (wordIndex >= totalWords) wordIndex = totalWords - 1;
  
    highlightWord(wordIndex);
  }
  
  function preloadAudio(element, textToRead) {
    // Check if already preloaded or currently preloading
    if (element.preloadedAudioUrl || element.isPreloadingAudio) {
        // console.log("Skipping preload: Already preloaded or in progress for:", element);
        return;
    }

    console.log("Starting preload for:", element);
    element.isPreloadingAudio = true; // Set flag: Preloading is in progress

    chrome.runtime.sendMessage({ action: "sendText", text: textToRead }, (response) => {
        // Check if the element we requested preload for is still relevant (might have been skipped/cancelled)
        // This check might be less critical here, but good for safety.
        // A better check might be in cleanupExistingPlayback to clear flags/URLs if cancelled.

        if (response && response.status === "success" && response.audioUrl.startsWith('data:')) {
            try {
                const [meta, base64Data] = response.audioUrl.split(",");
                const mimeMatch = meta.match(/data:(.*?);base64/);
                if (!mimeMatch) throw new Error("Invalid base64 format during preload.");

                const mimeType = mimeMatch[1];
                const rawStr = window.atob(base64Data);
                const blob = new Blob([new Uint8Array([...rawStr].map((c) => c.charCodeAt(0)))], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);

                // --- Store the Blob URL on the element ---
                element.preloadedAudioUrl = blobUrl;
                // --- Mark as preloaded (optional, existence of URL is key) ---
                // element.dataset.audioPreloaded = 'true';
                console.log("Preload successful, Blob URL stored for:", element);

            } catch (e) {
                console.error("Error processing preloaded audio data:", e, element);
                 // Clear any potentially half-stored URL
                 if (element.preloadedAudioUrl) {
                      URL.revokeObjectURL(element.preloadedAudioUrl); // Revoke if created but storing failed
                      element.preloadedAudioUrl = null;
                 }
            }
        } else {
            console.error("Error preloading audio:", response?.error || "Non-data URL received", element);
        }

        // --- Reset preloading flag regardless of success/failure ---
        element.isPreloadingAudio = false;
        // console.log("Finished preload attempt for:", element);
    });
}

function cleanupExistingPlayback() {
  const previousElement = currentAudioElement;
  const previousAudioPlayer = myAudioPlayer;

  console.log("Starting playback cleanup...");

  if (previousAudioPlayer) {
      previousAudioPlayer.pause();
      const currentSrc = previousAudioPlayer.src; // Get src before nulling
      previousAudioPlayer.src = ""; // Detach player internals
      console.log("Paused and detached previous audio player.");
      // Revoke the Blob URL of the *player that was just stopped*, if it was a blob url
      if (currentSrc && currentSrc.startsWith('blob:')) {
          URL.revokeObjectURL(currentSrc);
          console.log("Revoked Blob URL from stopped player:", currentSrc);
      }
  }

  // Nullify global references *before* resetting styles or cleaning queue
  myAudioPlayer = null;
  currentAudioElement = null;

  // Reset styles of the element that *was* playing
  if (previousElement) {
      resetSectionStyles(previousElement);
      console.log("Cleaned up styles for previous element:", previousElement);
  }

  // --- Clean up unused preloaded URLs in the queue ---
  console.log("Checking paragraph queue for unused preloaded URLs...");
  paragraphQueue.forEach((element, index) => {
      if (element && element.preloadedAudioUrl) {
          console.log(`Revoking unused preloaded URL for queued element at index ${index}:`, element);
          URL.revokeObjectURL(element.preloadedAudioUrl);
          element.preloadedAudioUrl = null; // Clear reference
      }
      // Also reset preloading flags
      if (element) {
          element.isPreloadingAudio = false;
      }
  });

  // Reset queue state for the next sequence (important if cleanup is called mid-sequence)
  paragraphQueue = [];
  currentParagraphIndex = 0;

  // Reset word tracking
  wordSpans = [];
  totalWords = 0;

  console.log("Playback cleanup finished.");
}

  function playSelectedTextAudio(event) {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
      console.warn("No text selected for playback.");
      return;
    }
  
    // Preprocess the selected text
    const processedText = preprocessTextForTTS(selectedText);
  
    // Send the processed text for audio generation
    chrome.runtime.sendMessage({ action: "sendText", text: processedText }, (response) => {
      if (response && response.status === "success") {
        handleBase64AudioResponse(event.target, selectedText, response.audioUrl);
      } else {
        console.error("Error generating audio:", response?.error || "No response");
      }
    });
  }
  function preprocessTextForTTS(text) {
    // 1. Normalize all minus signs (mathematical U+2212) and dashes (U+2014, U+2013) to hyphen-minus (U+002D)
    let processedText = text.replace(/[−—–]/g, '-');

    // --- Placeholder Pass ---
    // Use unique placeholders unlikely to appear in normal text.

    // Pass 1: Identify hyphens acting as subtraction when SURROUNDED BY SPACES.
    // Matches one or more spaces, hyphen, one or more spaces.
    processedText = processedText.replace(
        /\s+-\s+/g, // Requires spaces around the hyphen
        '__SUBTRACT__'
    );

    // Pass 2: Identify hyphens acting as a NEGATIVE sign.
    // Matches: Start of string OR preceded by '(', '=', '+', '*', '/', or space,
    //          followed by a digit or letter (or opening parenthesis for nested).
    // Uses lookbehind and lookahead. Allows optional spaces around the hyphen itself.
    processedText = processedText.replace(
        /(?<=[=(+*/\s(]|^)\s*-\s*(?=[a-zA-Z0-9(])/g,
        '__NEGATIVE__'
    );

    // Pass 3: NEW - Identify hyphens acting as subtraction specifically BETWEEN DIGITS (no spaces needed).
    // This catches '5-3' but avoids 'a-b' and 'step-by-step'.
    processedText = processedText.replace(
        /(?<=[0-9])-(?=[0-9])/g, // Lookbehind for digit, hyphen, lookahead for digit
        '__SUBTRACT__'
    );

    // --- Symbol Replacement Pass ---
    // Now replace standard symbols and the placeholders. Add spaces for clarity.

    const symbolMap = {
        // Placeholders first (critical they are replaced before any remaining '-')
        "__SUBTRACT__": " minus ",
        "__NEGATIVE__": " negative ",
        // Standard symbols (ensure no plain '-' key here)
        "+": " plus ",
        "=": " equals ",
        "*": " times ",
        "/": " divided by ",
        // Greek letters, etc.
        "Δ": " Delta ", "α": " alpha ", "β": " beta ", "γ": " gamma ",
        "^": " to the power of ", "√": " square root of ", "π": " pi ",
        "%": " percent ", "∑": " sum of ", "∫": " integral of "
        // Add other symbols as needed
    };

    // Create a regex covering all keys in the map
    const allSymbolsRegexKeys = Object.keys(symbolMap)
        .map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')) // Escape regex metacharacters
        .join('|'); // Join with OR

    const finalSymbolRegex = new RegExp(allSymbolsRegexKeys, 'g');

    processedText = processedText.replace(finalSymbolRegex, (match) => symbolMap[match]);

    // --- Cleanup Pass ---

    // At this point, any remaining '-' should be intra-word hyphens (e.g., "step-by-step")
    // or unspaced variable subtractions like "a-b" which we are now choosing *not*
    // to interpret as "minus" by default. Leave these hyphens for the TTS engine.

    // Collapse multiple spaces resulting from replacements into single spaces
    processedText = processedText.replace(/\s{2,}/g, ' ');

    // Remove spaces around parentheses that might have been added by spaced placeholders/symbols
    // Be careful not to remove intended spaces inside complex expressions if needed.
    processedText = processedText.replace(/\s*\(\s*/g, '(');
    processedText = processedText.replace(/\s*\)\s*/g, ')');


    // Trim leading/trailing whitespace from the final result
    return processedText.trim();
}
  function isEntirelyLatexOrKatex(element) {
    // Define LaTeX/KaTeX-related classes and tags
    const latexClasses = ['katex', 'mathjax', 'math', 'mjx-container'];
    const mathTags = ['math', 'mrow', 'msup', 'mfrac', 'mo', 'mi'];
  
    // Get all child nodes of the element
    const childNodes = Array.from(element.childNodes);
  
    let containsLatexOrKatex = false;
  
    // Check each child node
    for (const node of childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        const hasLatexClass = latexClasses.some((cls) => node.classList.contains(cls));
  
        if (mathTags.includes(tagName) || hasLatexClass) {
          containsLatexOrKatex = true; // Found LaTeX/KaTeX content
        } else {
          return false; // Found a non-LaTeX/KaTeX element
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
        return false; // Found plain text content
      }
    }
  
    // If all nodes are LaTeX/KaTeX or empty, return true
    return containsLatexOrKatex;
  }
  
  // -------------- 5) Create collapsible audio control buttons -------------- //
  function createAudioControlButtons() {
    const existingControls = document.getElementById("audio-controls");
    if (existingControls) {
      existingControls.remove();
    }
  
    // Create the main controls container
    const controlsContainer = document.createElement("div");
    controlsContainer.id = "audio-controls";
    controlsContainer.style.position = "fixed";
    controlsContainer.style.top = "75px";
    controlsContainer.style.right = "20px";
    controlsContainer.style.width = "80px";
    controlsContainer.style.height = "60px";
    controlsContainer.style.borderRadius = "15px";
    controlsContainer.style.boxShadow = "0 6px 12px rgba(0, 0, 0, 0.2)";
    controlsContainer.style.backgroundColor = "rgba(78, 75, 75, 0.9)";
    controlsContainer.style.display = "flex";
    controlsContainer.style.flexDirection = "row";
    controlsContainer.style.alignItems = "center";
    controlsContainer.style.justifyContent = "space-between";
    controlsContainer.style.zIndex = "9999";
    controlsContainer.style.transition = "width 0.3s ease"; // Smooth width transition
  
    // Cancel Button (✖)
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "✖";
    cancelButton.style.position = "absolute";
    cancelButton.style.top = "-28px";
    cancelButton.style.right = "1px";
    cancelButton.style.width = "40px";
    cancelButton.style.height = "40px";
    cancelButton.style.border = "none";
    cancelButton.style.borderRadius = "50%";
    cancelButton.style.backgroundColor = "transparent";
    cancelButton.style.color = "rgba(36, 32, 32, 0.8)";
    cancelButton.style.cursor = "pointer";
    cancelButton.addEventListener("click", terminateTTSProcess);
  
    // Draggable Button (⋮⋮)
    const draggableButton = document.createElement("div");
    draggableButton.textContent = "⋮⋮";
    draggableButton.style.width = "20px";
    draggableButton.style.height = "20px";
    draggableButton.style.backgroundColor = "transparent";
    draggableButton.style.color = "#fff";
    draggableButton.style.cursor = "move";
    draggableButton.style.display = "flex";
    draggableButton.style.alignItems = "center";
    draggableButton.style.justifyContent = "center";
    draggableButton.addEventListener("mousedown", makeDraggable(controlsContainer));
  
    // Play/Pause Button (▶ / ⏸)
    const playPauseButton = document.createElement("button");
    playPauseButton.textContent = "▶";
    playPauseButton.style.width = "40px";
    playPauseButton.style.height = "40px";
    playPauseButton.style.border = "none";
    playPauseButton.style.borderRadius = "50%";
    playPauseButton.style.backgroundColor = "#2196F3";
    playPauseButton.style.color = "#fff";
    playPauseButton.style.cursor = "pointer";
    playPauseButton.addEventListener("click", togglePlayPause);
  
    // Collapsible Menu Button (<)
    const menuButton = document.createElement("button");
    menuButton.textContent = "<";
    menuButton.style.width = "20px";
    menuButton.style.height = "30px";
    menuButton.style.border = "none";
    menuButton.style.borderRadius = "5px";
    menuButton.style.backgroundColor = "transparent";
    menuButton.style.color = "#fff";
    menuButton.style.cursor = "pointer";
    menuButton.style.transform = "scale(1.2)";
    menuButton.style.transformOrigin = "center";
  
    // Collapsible Menu Container
    const collapsibleMenu = document.createElement("div");
    collapsibleMenu.style.position = "absolute";
    collapsibleMenu.style.top = "0";
    collapsibleMenu.style.backgroundColor = "rgba(78, 75, 75, 0.9)";
    collapsibleMenu.style.borderRadius = "15px 0 0 15px";
    collapsibleMenu.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    collapsibleMenu.style.padding = "10px";
    collapsibleMenu.style.display = "none";
    collapsibleMenu.style.flexDirection = "row-reverse";
    collapsibleMenu.style.alignItems = "center";
    collapsibleMenu.style.transition = "opacity 0.3s ease, left 0.3s ease"; // Smooth transition
    collapsibleMenu.style.opacity = "0"; // Initially hidden
  
    // Dynamic Menu Items Configuration
    const menuItems = [
      {
        type: "button",
        iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/literature.png",
        action: switchToWidget,
        tooltip: "Switch to Widget",
        width: "40px",
        height: "40px",
      },
      {
        type: "speed",
        initialText: "1.5x",
        speeds: [0.5, 1.0, 1.5, 2.0],
        action: cyclePlaybackSpeed,
        tooltip: "Change Speed",
        width: "40px",
        height: "40px",
      },
    ];

    // Calculate dynamic width
    const padding = 10; // Left and right padding (10px each side)
    const closeButtonWidth = 40; // Width of the close button
    const itemWidths = menuItems.map(item => parseInt(item.width, 10)); // Extract widths as numbers
    const totalItemWidth = itemWidths.reduce((sum, width) => sum + width, 0); // Sum of all item widths
    const totalMenuWidth = totalItemWidth + closeButtonWidth + (padding * 2); // Total width including padding and close button
    const collapsedOffset = -totalMenuWidth - 20; // Extra offset for smooth collapse

    // Set initial collapsed position
    collapsibleMenu.style.left = `${collapsedOffset}px`;
  
    // Populate Collapsible Menu Dynamically
    menuItems.forEach((item) => {
      const menuItem = document.createElement(item.type === "speed" ? "div" : "button");
      menuItem.style.width = item.width;
      menuItem.style.height = item.height;
      menuItem.style.border = "none";
      menuItem.style.backgroundColor = "transparent";
      menuItem.style.cursor = "pointer";
      menuItem.style.color = "#fff";
      menuItem.style.display = "flex";
      menuItem.style.alignItems = "center";
      menuItem.style.justifyContent = "center";
      menuItem.title = item.tooltip; // Tooltip for accessibility
  
      if (item.type === "button" && item.iconUrl) {
        menuItem.style.backgroundImage = `url('${item.iconUrl}')`;
        menuItem.style.backgroundSize = "contain";
        menuItem.style.backgroundRepeat = "no-repeat";
        menuItem.style.backgroundPosition = "center";
        menuItem.style.transform = "scale(0.6)";
        menuItem.style.transformOrigin = "center";
      } else if (item.type === "speed") {
        menuItem.textContent = item.initialText;
        menuItem.style.fontSize = "16px";
      } else if (item.text) {
        menuItem.textContent = item.text;
      }
  
      menuItem.addEventListener("click", () => item.action(menuItem, item));
      collapsibleMenu.appendChild(menuItem);
    });
  
    // Close Menu Button (>)
    const closeMenuButton = document.createElement("button");
    closeMenuButton.textContent = ">";
    closeMenuButton.style.width = "40px";
    closeMenuButton.style.height = "40px";
    closeMenuButton.style.border = "none";
    closeMenuButton.style.backgroundColor = "transparent";
    closeMenuButton.style.color = "#fff";
    closeMenuButton.style.cursor = "pointer";
    closeMenuButton.style.transform = "scale(1.2)";
    closeMenuButton.style.transformOrigin = "center";
    closeMenuButton.addEventListener("click", () => toggleMenu(false));
  
    collapsibleMenu.appendChild(closeMenuButton);
  
    // Toggle Menu Logic with Dynamic Width
    function toggleMenu(open) {
      const isOpen = collapsibleMenu.style.display !== "none";
      if (open === undefined) open = !isOpen; // Toggle if no explicit state
  
      if (open) {
        collapsibleMenu.style.display = "flex";
        controlsContainer.style.width = "65px";
        controlsContainer.style.borderRadius = "0 15px 15px 0";
        playPauseButton.style.marginLeft = "8px";
        menuButton.style.display = "none";
        setTimeout(() => (collapsibleMenu.style.opacity = "1"), 10); // Fade in
        collapsibleMenu.style.left = `-${totalMenuWidth}px`; // Dynamic expanded position
      } else {
        collapsibleMenu.style.opacity = "0";
        collapsibleMenu.style.left = `${collapsedOffset}px`; // Dynamic collapsed position
        controlsContainer.style.width = "80px";
        controlsContainer.style.borderRadius = "15px";
        playPauseButton.style.marginLeft = "0";
        setTimeout(() => {
          collapsibleMenu.style.display = "none";
          menuButton.style.display = "block";
        }, 300); // Match transition duration
      }
    }
  
    menuButton.addEventListener("click", () => toggleMenu(true));
  
    // Append Elements to Controls Container
    controlsContainer.appendChild(menuButton);
    controlsContainer.appendChild(playPauseButton);
    controlsContainer.appendChild(draggableButton);
    controlsContainer.appendChild(cancelButton);
    controlsContainer.appendChild(collapsibleMenu);
  
    // Append Controls to Document Body
    document.body.appendChild(controlsContainer);
  
    adjustControlsPosition();
    window.addEventListener("resize", adjustControlsPosition);
  
    // Helper Functions
    function makeDraggable(element) {
      return function (event) {
        const offsetX = event.clientX - element.getBoundingClientRect().left;
        const offsetY = event.clientY - element.getBoundingClientRect().top;
  
        function onMouseMove(moveEvent) {
          element.style.top = `${moveEvent.clientY - offsetY}px`;
          element.style.left = `${moveEvent.clientX - offsetX}px`;
          element.style.right = "auto"; // Override right positioning
        }
  
        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }
  
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
    }
  
    function togglePlayPause() {
      if (myAudioPlayer) {
        if (myAudioPlayer.paused) {
          myAudioPlayer.play();
          playPauseButton.textContent = "⏸";
        } else {
          myAudioPlayer.pause();
          playPauseButton.textContent = "▶";
        }
      }
    }
  
    function switchToWidget() {
      if (!document.querySelector("div#draggableIframeContainer")) {
        const container = document.createElement("div");
        container.id = "draggableIframeContainer";
        container.style.position = "fixed";
        container.style.bottom = "20px";
        container.style.right = "20px";
        container.style.width = "310px";
        container.style.height = "330px";
        container.style.zIndex = "10000";
        container.style.backgroundColor = "rgba(78, 75, 75, 0.9)";
        container.style.borderRadius = "15px";
        container.style.boxShadow = "0 6px 12px rgba(0, 0, 0, 0.2)";
  
        const iframe = document.createElement("iframe");
        iframe.id = "draggableIframe";
        iframe.src = chrome.runtime.getURL("widget.html");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "10%";
  
        container.appendChild(iframe);
        document.body.appendChild(container);
  
        const dragIcon = document.createElement("div");
        dragIcon.textContent = "☰";
        dragIcon.style.cssText =
          "position: absolute; top: 11px; right: 10px; width: 30px; height: 30px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 30px; cursor: grab; z-index: 10001;";
        dragIcon.addEventListener("mousedown", makeDraggable(container));
        container.appendChild(dragIcon);
      }
    }
  
    function cyclePlaybackSpeed(element, item) {
      if (myAudioPlayer) {
        const currentSpeed = myAudioPlayer.playbackRate;
        const nextIndex = (item.speeds.indexOf(currentSpeed) + 1) % item.speeds.length;
        const nextSpeed = item.speeds[nextIndex];
        myAudioPlayer.playbackRate = nextSpeed;
        element.textContent = `${nextSpeed}x`;
      }
    }
  }

  function adjustControlsPosition() {
    const controlsContainer = document.getElementById("audio-controls");
    if (!controlsContainer) return;

    controlsContainer.style.left = "";
    controlsContainer.style.right = "";

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerRect = controlsContainer.getBoundingClientRect();

    const marginRight = 20;
    const marginTop = 75;

    if (containerRect.right + marginRight > viewportWidth) {
      controlsContainer.style.right = `${marginRight}px`;
    } else {
      controlsContainer.style.right = `${marginRight}px`;
    }

    if (marginTop + containerRect.height > viewportHeight) {
      controlsContainer.style.top = `${viewportHeight - containerRect.height - marginTop}px`;
    } else {
      controlsContainer.style.top = `${marginTop}px`;
    }

    if (viewportWidth < 600) {
      controlsContainer.style.width = "60px";
      controlsContainer.style.height = "45px";
    } else if (viewportWidth < 900) {
      controlsContainer.style.width = "70px";
      controlsContainer.style.height = "50px";
    } else {
      controlsContainer.style.width = "80px";
      controlsContainer.style.height = "60px";
    }
  }
  function terminateTTSProcess() {
    console.log("Terminating TTS process...");

    // 1. Set the global flag to prevent new TTS clicks
    ttsActive = false; // <<< Stop listener from initiating new TTS

    // 2. Remove listener marker (good practice)
    if (document.body.dataset.ttsListenerAttached_v2) {
        delete document.body.dataset.ttsListenerAttached_v2;
        // console.log("Removed TTS listener marker.");
    }

    // 3. Stop and clean up the current audio player
    const playerToStop = myAudioPlayer;
    if (playerToStop) {
      playerToStop.pause();
      const currentSrc = playerToStop.src;
      playerToStop.src = ""; // Detach source
      playerToStop.removeAttribute('src'); // Ensure detachment
      // Explicitly remove listeners attached in handleAudioResponse
      // (Requires storing listener references or using anonymous functions carefully)
      // playerToStop.removeEventListener('timeupdate', ...);
      // playerToStop.removeEventListener('ended', ...);
      // playerToStop.removeEventListener('error', ...);
      myAudioPlayer = null; // Nullify global reference AFTER cleanup
      console.log("Paused and detached audio player.");

      if (currentSrc && currentSrc.startsWith('blob:')) {
          URL.revokeObjectURL(currentSrc);
          console.log("Revoked Blob URL from stopped player:", currentSrc);
      }
    } else {
       console.log("No active audio player to stop.");
    }

    // 4. Reset styles & cleanup preloads for the active element and queue
    const elementThatWasPlaying = currentAudioElement;
    const queueToClean = [...paragraphQueue]; // Copy queue before clearing

    if (elementThatWasPlaying) {
        resetSectionStyles(elementThatWasPlaying);
        console.log("Cleaned up styles for the last active element:", elementThatWasPlaying);
    }

    console.log("Cleaning up paragraph queue...");
    queueToClean.forEach((element, index) => {
        if (element) {
            if (element.preloadedAudioUrl) {
                // console.log(`Revoking unused preloaded URL for queued element at index ${index}:`, element);
                URL.revokeObjectURL(element.preloadedAudioUrl);
                element.preloadedAudioUrl = null;
            }
            element.isPreloadingAudio = false;
            // Reset styles for queued elements if they weren't the one playing
            if (element !== elementThatWasPlaying) {
                 resetSectionStyles(element);
            }
        }
    });

    // 5. Reset internal state variables
    currentAudioElement = null;
    paragraphQueue = [];
    currentParagraphIndex = 0;
    // wordSpans = []; // Not used anymore
    totalWords = 0;
    // originalText = ""; // Not used anymore
    isBlocked = false; // Allow clicks again (though ttsActive handles TTS blocking)

    console.log("Internal state reset.");

    // 6. Remove the audio controls UI
    const controlsContainer = document.getElementById("audio-controls");
    if (controlsContainer) {
      controlsContainer.remove();
      console.log("Removed audio controls UI.");
    }

    // 7. Remove the resize listener
    window.removeEventListener("resize", adjustControlsPosition);
    console.log("Removed resize listener.");

    // 8. DO NOT CLONE/REPLACE ELEMENTS. ttsActive flag handles stopping new TTS.

    console.log("TTS process terminated cleanly.");
  }


  // -------------- INIT -------------- //
  // Only setup if not already terminated and marker isn't present
  if (ttsActive && !document.body.dataset.ttsListenerAttached_v2) {
      setupTextToSpeech();
      createAudioControlButtons();
  } else if (!ttsActive) {
      console.log("TTS was already terminated, not initializing.");
  } else {
      console.log("TTS listener marker found, assuming already initialized.");
      // Optionally recreate controls if they are missing but listener exists?
       if (!document.getElementById("audio-controls")) {
            console.log("Controls missing, recreating them.");
            createAudioControlButtons();
       }
  }

})();

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

  // Listen for messages from the widget
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "playWebpageAudio") {
      playWebpageAudio();
      sendResponse({ status: "initiated" });
    }
  });

  function setupTextToSpeech() {
    const textElements = document.querySelectorAll("p, div, article, section, li, h1, h2, h3, h4, h5, h6");
  
    textElements.forEach((element) => {
      element.style.transition = "0.3s";
      element.style.cursor = "pointer"; // Indicate that the element is clickable
  
      element.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent the event from bubbling up
  
        const clickedText = window.getSelection().toString().trim() || event.target.innerText.trim();
        if (!clickedText) {
          console.warn("Clicked area contains no text. Ignoring...");
          return;
        }
  
        // Cleanup any ongoing audio playback before generating the next one
        cleanupExistingPlayback();
  
        if (isBlocked) {
          console.log("Action blocked. Please wait before clicking again.");
          return;
        }
  
        isBlocked = true;
        setTimeout(() => {
          isBlocked = false;
        }, 1000);
  
        const paragraph = element.closest("p, div, article, section, li, h1, h2, h3, h4, h5, h6");
        if (!paragraph) {
          console.warn("No parent paragraph-like element found for the clicked element.");
          return;
        }
  
        currentAudioElement = paragraph;
        currentAudioElement.style.backgroundColor = "rgba(50, 118, 205, 0.3)";
        currentAudioElement.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        currentAudioElement.style.borderRadius = "5px";
  
        queueParagraphsForAudio(paragraph);
        playNextParagraphAudio();
      });
    });
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
      return;
    }
  
    const element = paragraphQueue[currentParagraphIndex];
    if (!element || !element.innerText) {
      console.warn("Skipping undefined or invalid element.");
      currentParagraphIndex++;
      playNextParagraphAudio();
      return;
    }
  
    // Skip the paragraph if it is entirely LaTeX/KaTeX
    if (isEntirelyLatexOrKatex(element)) {
      console.log("Skipping entirely LaTeX/KaTeX paragraph:", element.innerHTML);
      currentParagraphIndex++;
      playNextParagraphAudio();
      return;
    }
  
    const rawText = element.innerText.trim();
    const textToRead = preprocessTextForTTS(rawText);
  
    chrome.runtime.sendMessage({ action: "sendText", text: textToRead }, (response) => {
      if (response && response.status === "success") {
        handleBase64AudioResponse(element, textToRead, response.audioUrl);
      } else {
        console.error("Error generating audio:", response?.error || "No response");
        currentParagraphIndex++;
        playNextParagraphAudio();
      }
    });
  }
  
  
  
  
  function handleBase64AudioResponse(element, text, base64Audio) {
    if (!base64Audio || !base64Audio.startsWith("data:")) {
      console.error("Invalid audio data URL:", base64Audio);
      return;
    }
  
    const words = text.split(/\s+/); // Split text into words
    const mimeType = base64Audio.match(/data:(.*?);base64/)[1];
    const rawStr = atob(base64Audio.split(",")[1]);
    const blob = new Blob([new Uint8Array([...rawStr].map((c) => c.charCodeAt(0)))], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
  
    myAudioPlayer = new Audio(blobUrl);
    myAudioPlayer.playbackRate = 1.5;
  
    let currentWordIndex = 0;
  
    myAudioPlayer.addEventListener("timeupdate", () => {
      if (!myAudioPlayer || !myAudioPlayer.duration) return;
  
      const currentTime = myAudioPlayer.currentTime;
      const duration = myAudioPlayer.duration;
      const progress = currentTime / duration;
  
      const newWordIndex = Math.floor(progress * words.length);
      if (newWordIndex !== currentWordIndex) {
        currentWordIndex = newWordIndex;
        highlightWord(element, currentWordIndex, words);
      }
    });
  
    myAudioPlayer.addEventListener("ended", () => {
      resetSectionStyles(element);
      currentParagraphIndex++;
      playNextParagraphAudio();
    });
  
    myAudioPlayer.play().catch((err) => {
      console.error("Error playing audio:", err);
      resetSectionStyles(element);
      currentParagraphIndex++;
      playNextParagraphAudio();
    });
  
    element.style.backgroundColor = "rgba(50, 118, 205, 0.3)"; // Highlight the section
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
  
    const highlights = element.querySelectorAll("span[style*='background-color']");
    highlights.forEach((highlight) => {
      const parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);
    });
  
    element.style.backgroundColor = "";
    element.style.boxShadow = "";
    element.style.borderRadius = "";
    console.log("Section reset to original styles.");
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
    if (element.preloadedAudioUrl || element.isAudioBeingGenerated) {
      return;
    }
  
    element.isAudioBeingGenerated = true;
  
    console.log("Sending request to generate audio for:", textToRead);
  
    chrome.runtime.sendMessage({ action: "sendText", text: textToRead }, (response) => {
      if (response && response.status === "success") {
        const [meta, base64Data] = response.audioUrl.split(",");
        const mimeMatch = meta.match(/data:(.*?);base64/);
        if (!mimeMatch) {
          console.error("Invalid base64 format.");
          element.isAudioBeingGenerated = false;
          return;
        }
        const mimeType = mimeMatch[1];
        const rawStr = window.atob(base64Data);
        const rawLength = rawStr.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; i++) {
          uInt8Array[i] = rawStr.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: mimeType });
        element.preloadedAudioUrl = URL.createObjectURL(blob);
        console.log("Blob preloaded successfully for text:", textToRead);
      } else {
        console.error("Error preloading audio:", response?.error || "No response");
      }
  
      element.isAudioBeingGenerated = false; // Reset flag
      console.log("Reset isAudioBeingGenerated for:", textToRead);
    });
  }

  function cleanupExistingPlayback() {
    if (myAudioPlayer) {
      myAudioPlayer.pause();
      myAudioPlayer.currentTime = 0;
      myAudioPlayer = null;
    }
  
    if (currentAudioElement) {
      resetSectionStyles(currentAudioElement);
      currentAudioElement = null;
    }
  
    console.log("Playback cleaned up.");
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
    // Define a list of symbols to replace
    const symbolMap = {
      "Δ": "Delta",
      "α": "alpha",
      "β": "beta",
      "γ": "gamma",
      "+": "plus",
      "-": "minus",
      "*": "times",
      "/": "divided by",
      "=": "equals",
      "^": "to the power of",
      "√": "square root of",
      "π": "pi",
      "%": "percent",
      "∑": "sum of",
      "∫": "integral of",
    };
    return text
      .replace(/[\Δαβγ\+\-\*\/\=\^√π%∑∫]/g, (match) => symbolMap[match] || match)
      .trim();
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

    cancelButton.addEventListener("click", () => {
      terminateTTSProcess();
    });

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

    draggableButton.addEventListener("mousedown", (event) => {
      const offsetX = event.clientX - controlsContainer.getBoundingClientRect().left;
      const offsetY = event.clientY - controlsContainer.getBoundingClientRect().top;

      function onMouseMove(moveEvent) {
        controlsContainer.style.top = `${moveEvent.clientY - offsetY}px`;
        controlsContainer.style.left = `${moveEvent.clientX - offsetX}px`;
      }

      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    // Play Button (▶)
    const playPauseButton = document.createElement("button");
    playPauseButton.textContent = "▶";
    playPauseButton.style.width = "40px";
    playPauseButton.style.height = "40px";
    playPauseButton.style.border = "none";
    playPauseButton.style.borderRadius = "50%";
    playPauseButton.style.backgroundColor = "#2196F3";
    playPauseButton.style.color = "#fff";
    playPauseButton.style.cursor = "pointer";

    playPauseButton.addEventListener("click", () => {
      if (myAudioPlayer) {
        if (myAudioPlayer.paused) {
          myAudioPlayer.play();
          playPauseButton.textContent = "⏸";
        } else {
          myAudioPlayer.pause();
          playPauseButton.textContent = "▶";
        }
      }
    });

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
    collapsibleMenu.style.flexDirection = "row-reverse";
    collapsibleMenu.style.alignItems = "center";
    collapsibleMenu.style.position = "absolute";
    collapsibleMenu.style.top = "0";
    collapsibleMenu.style.left = "-100px";
    collapsibleMenu.style.backgroundColor = "rgba(78, 75, 75, 0.9)";
    collapsibleMenu.style.borderRadius = "15px 0 0 15px";
    collapsibleMenu.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    collapsibleMenu.style.padding = "10px";
    collapsibleMenu.style.width = "80px";
    collapsibleMenu.style.zIndex = "9998";
    collapsibleMenu.style.display = "none";

    // Collapsible Menu Items
    const bookButton = document.createElement("button");
    bookButton.style.height = "40px";
    bookButton.style.border = "none";
    bookButton.style.backgroundColor = "transparent";
    bookButton.style.cursor = "pointer";
    // Book image as background
    bookButton.style.backgroundImage = "url('https://img.icons8.com/ios-filled/50/ffffff/literature.png')";
bookButton.style.backgroundSize = "contain";
bookButton.style.backgroundRepeat = "no-repeat";
bookButton.style.backgroundPosition = "center";       
    // Scale the image
    bookButton.style.transform = "scale(1.2)";
    bookButton.style.transformOrigin = "center";
    bookButton.style.width = "40px";

    // (NEW) bookButton event -> "Switch to Widget" functionality from popup.js
    bookButton.addEventListener("click", () => {
      // Check if the draggable container (widget) is already in the DOM
      if (!document.querySelector("div#draggableIframeContainer")) {
        const container = document.createElement("div");
        container.id = "draggableIframeContainer";
        container.style.position = "fixed";
        container.style.bottom = "20px";
        container.style.right = "20px";
        container.style.width = "310px";
        container.style.height = "330px";
        container.style.zIndex = "10000";
    
        // Match the audio control styling:
        container.style.backgroundColor = "rgba(78, 75, 75, 0.9)"; 
        container.style.borderRadius = "15px";
        container.style.boxShadow = "0 6px 12px rgba(0, 0, 0, 0.2)";
    
        // Create the iframe
        const iframe = document.createElement("iframe");
        iframe.id = "draggableIframe";
        iframe.src = chrome.runtime.getURL("widget.html"); // Ensure widget.html is in your extension
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "10%";
    
        // Append iframe to container, then to body
        container.appendChild(iframe);
        document.body.appendChild(container);

        // Drag-and-Drop Functionality for Container
        let isDragging = false;
        let offsetX, offsetY;

        // Add a drag icon to drag the entire iframe container
        const dragIcon = document.createElement("div");
        dragIcon.id = "dragIcon";
        dragIcon.textContent = "☰";
        dragIcon.style.cssText =
          "position: absolute; top: 11px; right: 10px; width: 30px; height: 30px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 30px; cursor: grab; z-index: 10001;";

        dragIcon.addEventListener("mousedown", (e) => {
          isDragging = true;
          const rect = container.getBoundingClientRect();
          offsetX = e.clientX - rect.left;
          offsetY = e.clientY - rect.top;
          document.body.style.userSelect = "none"; // Prevent text selection while dragging
          dragIcon.style.cursor = "grabbing";
        });

        document.addEventListener("mousemove", (e) => {
          if (isDragging) {
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            container.style.left = `${x}px`;
            container.style.top = `${y}px`;
            container.style.bottom = "unset";
            container.style.right = "unset";
          }
        });

        document.addEventListener("mouseup", () => {
          isDragging = false;
          document.body.style.userSelect = "";
          dragIcon.style.cursor = "grab";
        });

        // Append drag icon on top of the widget's container
        container.appendChild(dragIcon);

        // Listen for messages from widget.html (iframe) - e.g., minimize, maximize, close
        window.addEventListener("message", (event) => {
          if (event.data.action === "removeWidgetIframe") {
            container.remove(); 
            console.log("Widget iframe removed.");
          } else if (event.data.action === "minimizeWidget") {
            // Minimize the widget
            dragIcon.style.cssText =
              "position: absolute; top: 0px; right: 0px; width: 24px; height: 24px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 24px; cursor: grab; z-index: 10001;";
            container.style.width = "50px";
            container.style.height = "50px";
            console.log("Widget minimized.");
          } else if (event.data.action === "restoreWidget") {
            // Restore widget to original size
            dragIcon.style.cssText =
              "position: absolute; top: 11px; right: 10px; width: 30px; height: 30px; background-color: grey; color: white; opacity: 0.8; text-align: center; line-height: 30px; cursor: grab; z-index: 10001;";
            container.style.width = "310px";
            container.style.height = "300px";
            console.log("Widget restored.");
          }
        });
      }
    });

    const speedIndicator = document.createElement("div");
    speedIndicator.textContent = "1.5x";
    speedIndicator.style.color = "#fff";
    speedIndicator.style.marginRight = "12px";
    speedIndicator.style.fontSize = "16px";

    speedIndicator.addEventListener("click", () => {
      if (myAudioPlayer) {
        const speeds = [0.5, 1.0, 1.5, 2.0];
        let currentSpeed = myAudioPlayer.playbackRate;
        let nextIndex = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
        let nextSpeed = speeds[nextIndex];
        myAudioPlayer.playbackRate = nextSpeed;
        speedIndicator.textContent = `${nextSpeed}x`;
      }
    });

    const menuButton2 = document.createElement("button");
    menuButton2.textContent = ">";
    menuButton2.style.width = "40px";
    menuButton2.style.height = "40px";
    menuButton2.style.border = "none";
    menuButton2.style.marginLeft = "-10px";
    menuButton2.style.backgroundColor = "transparent";
    menuButton2.style.color = "#fff";
    menuButton2.style.cursor = "pointer";
    menuButton2.style.transform = "scale(1.2)";
    menuButton2.style.transformOrigin = "center";

    menuButton2.addEventListener("click", () => {
      collapsibleMenu.style.display = "none"; // Hide the collapsible menu
      controlsContainer.style.width = "80px"; // Restore the original width
      controlsContainer.style.borderRadius = "15px";
      playPauseButton.style.marginLeft = "0";
      menuButton.style.display = "block"; // Show the original menu button
    });

    // Add items to collapsible menu
    collapsibleMenu.appendChild(bookButton);
    collapsibleMenu.appendChild(speedIndicator);
    collapsibleMenu.appendChild(menuButton2);

    // Collapsible Menu Button Logic
    menuButton.addEventListener("click", () => {
      const isCollapsed = collapsibleMenu.style.display === "none";
      collapsibleMenu.style.display = isCollapsed ? "flex" : "none";
      controlsContainer.style.width = "65px";
      controlsContainer.style.borderLeft = isCollapsed ? "none" : "";
      controlsContainer.style.borderRadius = isCollapsed ? "0 15px 15px 0" : "15px";
      playPauseButton.style.marginLeft = isCollapsed ? "8px" : "0";
      menuButton.style.display = isCollapsed ? "none" : "block";
    });

    // Append Elements to Controls Container
    controlsContainer.appendChild(menuButton);
    controlsContainer.appendChild(playPauseButton);
    controlsContainer.appendChild(draggableButton);
    controlsContainer.appendChild(cancelButton);
    controlsContainer.appendChild(collapsibleMenu);

    // Append Controls to Document Body
    document.body.appendChild(controlsContainer);

    adjustControlsPosition();

    // Listen for window resize events to adjust the control position
    window.addEventListener("resize", adjustControlsPosition);
  }
  function adjustControlsPosition() {
    const controlsContainer = document.getElementById("audio-controls");
    if (!controlsContainer) return;

    // Reset left and right positioning
    controlsContainer.style.left = "";
    controlsContainer.style.right = "";

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerRect = controlsContainer.getBoundingClientRect();

    // Desired margins from the edges
    const marginRight = 20; // pixels
    const marginTop = 75; // pixels

    // Ensure the container stays within the viewport horizontally
    if (containerRect.right + marginRight > viewportWidth) {
      controlsContainer.style.right = `${marginRight}px`;
    } else {
      controlsContainer.style.right = `${marginRight}px`;
    }

    // Optionally, adjust the top position if needed
    if (marginTop + containerRect.height > viewportHeight) {
      controlsContainer.style.top = `${viewportHeight - containerRect.height - marginTop}px`;
    } else {
      controlsContainer.style.top = `${marginTop}px`;
    }

    // Optional: Adjust size based on viewport width for better responsiveness
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

    window.removeEventListener("resize", adjustControlsPosition);
    if (myAudioPlayer) {
      myAudioPlayer.pause();
      myAudioPlayer.src = "";
      myAudioPlayer = null;
    }

    if (currentAudioElement) {
      currentAudioElement.innerHTML = originalText;
      currentAudioElement.style.backgroundColor = "";
      currentAudioElement.style.boxShadow = "none";
      currentAudioElement.style.borderRadius = "0";
    }

    const controlsContainer = document.getElementById("audio-controls");
    if (controlsContainer) {
      controlsContainer.remove();
    }

    wordSpans = [];
    totalWords = 0;
    originalText = "";
    currentAudioElement = null;
    isBlocked = false;
    isCollapsed = true;

    const textElements = document.querySelectorAll(
      "p, span, div, article, section, li, h1, h2, h3, h4, h5, h6"
    );

    textElements.forEach((element) => {
      element.replaceWith(element.cloneNode(true));
    });

    console.log("TTS process terminated and cleaned up.");
  }

  // -------------- INIT -------------- //
  setupTextToSpeech();
  createAudioControlButtons();
})();

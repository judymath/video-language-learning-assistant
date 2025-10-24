// Global variables
let currentSubtitles = [];
let subtitleContainer = null;
let subtitleText = null;
let videoPlayer = null;
let videoContainer = null;
let checkInterval = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 10;
let currentUrl = window.location.href;

// Loads stored subtitles for the current video from local storage
function loadStoredSubtitles() {
  const cleanedUrl = cleanYouTubeUrl(window.location.href);

  chrome.storage.local.get([cleanedUrl], (result) => {
    if (result[cleanedUrl]) {
      console.log("Content Script: Found stored subtitles for this video.");
      currentSubtitles = result[cleanedUrl]; // Load stored subtitles
      startSubtitleDisplay(); // Start displaying the subtitles
    } else {
      console.log("Content Script: No stored subtitles found for this video.");
    }
  });
}

// Cleans a YouTube URL to extract only the video ID and essential parameters
function cleanYouTubeUrl(originalUrl) {
  try {
    const url = new URL(originalUrl);
    const videoId = url.searchParams.get("v");
    if (videoId) {
      // Reconstruct a minimal URL
      return `${url.protocol}//${url.hostname}${url.pathname}?v=${videoId}`;
    }
  } catch (e) {
    console.error("Error parsing URL for cleaning:", originalUrl, e);
  }
  // Fallback to original if cleaning fails or no 'v' param found
  return originalUrl;
}

// Monitors URL changes on YouTube (SPA behavior)
function monitorUrlChanges() {
  const observer = new MutationObserver(() => {
    if (currentUrl !== window.location.href) {
      console.log("YouTube Subtitles Generator: URL changed.");
      currentUrl = window.location.href;
      onUrlChange();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Handles actions when the URL changes
function onUrlChange() {
  console.log("YouTube Subtitles Generator: Reinitializing for new video...");
  clearSubtitles(); // Clear current subtitles
  initialize(); // Reinitialize for the new video
}

// Finds video elements on the YouTube page
function findVideoElements() {
  videoPlayer = document.querySelector("video.html5-main-video");
  if (!videoPlayer) return false;

  // Try finding a standard container, fallback to player's parent
  videoContainer =
    document.querySelector("#movie_player") || // Primary target
    document.querySelector(".html5-video-container") || // Fallback 1
    videoPlayer.parentElement; // Fallback 2

  return !!videoContainer; // Return true if both found
}

// Initializes the content script
function initialize() {
  console.log("YouTube Subtitles Generator: Initializing content script...");

  if (!findVideoElements()) {
    initAttempts++;
    if (initAttempts < MAX_INIT_ATTEMPTS) {
      console.log(
        `Video player not found, retrying (${initAttempts}/${MAX_INIT_ATTEMPTS})...`
      );
      setTimeout(initialize, 500); // Retry after 500ms
    } else {
      console.error(
        "YouTube Subtitles Generator: Video player or container not found after multiple attempts."
      );
    }
    return;
  }

  console.log("YouTube Subtitles Generator: Video player found.", videoPlayer);
  console.log(
    "YouTube Subtitles Generator: Video container found.",
    videoContainer
  );

  createSubtitleElements(); // Create subtitle elements
  loadStoredSubtitles(); // Load stored subtitles for the current video

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "generateSubtitles") {
      console.log("Content Script: Received generateSubtitles request");
      const videoUrl = window.location.href;

      console.log("Content Script: Sending URL to background:", videoUrl);

      clearSubtitles(); // Clear previous subtitles

      // Request subtitles from background script
      chrome.runtime.sendMessage(
        {
          action: "fetchSubtitles",
          videoUrl: videoUrl,
          apiKey: message.apiKey,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending message to background:",
              chrome.runtime.lastError
            );
            sendResponse({
              status: "error",
              message: "Could not communicate with background script.",
            });
          } else {
            console.log(
              "Content Script: Message sent to background, response:",
              response
            );
          }
        }
      );

      sendResponse({ status: "started" });
      return true; // Indicate async response possible
    } else if (message.action === "subtitlesGenerated") {
      console.log("Content Script: Received subtitlesGenerated request");
      currentSubtitles = message.subtitles || []; // Ensure it's an array
      console.log(`Received ${currentSubtitles.length} subtitle entries.`);

      if (currentSubtitles.length > 0) {
        startSubtitleDisplay(); // Start displaying subtitles

        // Store the subtitles locally for future use
        const cleanedUrl = cleanYouTubeUrl(window.location.href);
        chrome.storage.local.set({ [cleanedUrl]: currentSubtitles }, () => {
          console.log("Content Script: Subtitles saved to local storage.");
        });

        sendResponse({ status: "success" }); // Confirm success to background
      } else {
        console.warn("Received empty subtitles array.");
        clearSubtitles(); // Ensure display is cleared if no subs found
        sendResponse({ status: "no_subtitles_found" });
      }
      return true; // Indicate response sent
    }
  });

  console.log(
    "YouTube Subtitles Generator: Initialization complete. Listening for messages."
  );
}

// Creates subtitle elements and appends them to the video container
function createSubtitleElements() {
  if (document.getElementById("youtube-gemini-subtitles-container")) return;

  subtitleContainer = document.createElement("div");
  subtitleContainer.id = "youtube-gemini-subtitles-container";
  subtitleContainer.style.position = "absolute";
  subtitleContainer.style.zIndex = "9999";
  subtitleContainer.style.pointerEvents = "none";
  subtitleContainer.style.display = "none";

  subtitleText = document.createElement("div");
  subtitleText.id = "youtube-gemini-subtitles-text";
  subtitleContainer.appendChild(subtitleText);

  if (videoContainer) {
    if (getComputedStyle(videoContainer).position === "static") {
      videoContainer.style.position = "relative";
    }
    videoContainer.appendChild(subtitleContainer);
    console.log("Subtitle container added to video container.");
  } else {
    console.error("Cannot add subtitle container, video container not found.");
  }
}

// Starts displaying subtitles
function startSubtitleDisplay() {
  if (!videoPlayer || !subtitleContainer) {
    console.warn("Cannot start subtitle display: Player or container missing.");
    return;
  }

  stopSubtitleDisplay(); // Clear any existing interval

  console.log("Starting subtitle display interval.");
  checkInterval = setInterval(updateSubtitles, 100); // 100ms interval

  videoPlayer.addEventListener("play", updateSubtitles);
  videoPlayer.addEventListener("seeked", updateSubtitles);
  videoPlayer.addEventListener("pause", hideCurrentSubtitle);
}

// Stops displaying subtitles
function stopSubtitleDisplay() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("Stopped subtitle display interval.");
  }
  if (videoPlayer) {
    videoPlayer.removeEventListener("play", updateSubtitles);
    videoPlayer.removeEventListener("seeked", updateSubtitles);
    videoPlayer.removeEventListener("pause", hideCurrentSubtitle);
  }
}

// Clears subtitles and stops display
function clearSubtitles() {
  currentSubtitles = [];
  stopSubtitleDisplay();
  hideCurrentSubtitle();
  console.log("Subtitles cleared.");
}

// Hides the current subtitle
function hideCurrentSubtitle() {
  if (subtitleContainer) {
    subtitleContainer.style.display = "none";
  }
  if (subtitleText) {
    subtitleText.textContent = "";
  }
}

// Updates subtitles based on the current video time
function updateSubtitles() {
  if (
    !videoPlayer ||
    !subtitleText ||
    !subtitleContainer ||
    videoPlayer.paused
  ) {
    return;
  }

  if (isNaN(videoPlayer.currentTime)) return;

  const currentTime = videoPlayer.currentTime * 1000; // Convert to ms
  let foundSubtitle = null;

  for (const subtitle of currentSubtitles) {
    if (currentTime >= subtitle.startTime && currentTime <= subtitle.endTime) {
      foundSubtitle = subtitle;
      break;
    }
  }

  if (foundSubtitle) {
    if (subtitleText.textContent !== foundSubtitle.text) {
      subtitleText.textContent = foundSubtitle.text;
    }
    subtitleContainer.style.display = "block";
  } else {
    hideCurrentSubtitle();
  }
}

// --- Start Initialization ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initialize();
    monitorUrlChanges();
  });
} else {
  initialize();
  monitorUrlChanges();
}

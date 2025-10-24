document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const apiKeyInput = document.getElementById("apiKey");
  const generateBtn = document.getElementById("generateBtn");
  const statusDiv = document.getElementById("status");

  // Create a div for displaying existing subtitles message
  const existingSubtitlesDiv = document.createElement("div");
  existingSubtitlesDiv.id = "existingSubtitles";
  existingSubtitlesDiv.style.marginTop = "10px";
  existingSubtitlesDiv.style.color = "green";
  generateBtn.parentNode.insertBefore(
    existingSubtitlesDiv,
    generateBtn.nextSibling
  ); // Add it below the button

  // Load saved API key from local storage
  chrome.storage.local.get(["geminiApiKey"], function (result) {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });

  // Check if subtitles already exist for the current video
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Helper function to clean YouTube URLs
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

    const currentTab = tabs[0];
    console.log("URL to check:", cleanYouTubeUrl(currentTab.url));

    if (currentTab && currentTab.url && currentTab.url.includes("youtube")) {
      const videoUrl = new URL(currentTab.url);
      const videoId = videoUrl.searchParams.get("v"); // Extract the video ID
      console.log("Video URL:", videoUrl);
      console.log("Video ID:", videoId);

      if (videoId) {
        chrome.storage.local.get(
          [cleanYouTubeUrl(currentTab.url)],
          function (result) {
            if (result[cleanYouTubeUrl(currentTab.url)]) {
              existingSubtitlesDiv.textContent =
                "Subtitles already exist for this video. 🚀";
            } else {
              existingSubtitlesDiv.textContent = ""; // Clear the message if no subtitles exist
            }
          }
        );
      }
    }
  });

  // Handle the "Generate Subtitles" button click
  generateBtn.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();
    statusDiv.textContent = ""; // Clear previous status

    if (!apiKey) {
      statusDiv.textContent = "Please enter a valid API key";
      return;
    }

    // Save the API key to local storage
    chrome.storage.local.set({ geminiApiKey: apiKey });

    // Show loading status
    statusDiv.textContent = "Requesting subtitles...";
    generateBtn.disabled = true; // Disable button during processing

    // Query the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs[0];
      console.log(
        "Popup: Active tab URL:",
        currentTab ? currentTab.url : "No tab found"
      );

      if (
        currentTab &&
        currentTab.url &&
        currentTab.url.includes("youtube.com/watch")
      ) {
        // Send a message to the content script to generate subtitles
        chrome.tabs.sendMessage(
          currentTab.id,
          { action: "generateSubtitles", apiKey: apiKey },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error("Popup Error:", chrome.runtime.lastError.message);
              statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}. Try reloading the YouTube page.`;
              generateBtn.disabled = false;
            } else if (response && response.status === "started") {
              statusDiv.textContent =
                "Processing video... (This may take a while)";
            } else if (response && response.status === "error") {
              statusDiv.textContent = `Error: ${
                response.message || "Could not start process."
              }`;
              generateBtn.disabled = false;
            } else {
              statusDiv.textContent =
                "Error: Unexpected response from content script.";
              generateBtn.disabled = false;
            }
          }
        );
      } else {
        statusDiv.textContent = "Not a YouTube video page.";
        generateBtn.disabled = false;
      }
    });
  });

  // Listen for status updates from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updatePopupStatus") {
      statusDiv.textContent = message.text;
      if (message.error || message.success) {
        generateBtn.disabled = false; // Re-enable button on completion or error
      }
    }
  });
});

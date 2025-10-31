document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const profilePage = document.getElementById("profilePage");
  const subtitlePage = document.getElementById("subtitlePage");

  const apiKeyInput = document.getElementById("apiKey");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const generateBtn = document.getElementById("generateBtn");
  const statusDiv = document.getElementById("status");
  const existingSubtitlesDiv = document.getElementById("existingSubtitles");

  // init page
  chrome.storage.local.get(["geminiApiKey", "tarlang", "level"], function (result) {
    if (result.geminiApiKey && result.tarlang && result.level) {
      // saved -> show subtitle
      profilePage.classList.add("hidden");
      subtitlePage.classList.remove("hidden");
    } else {
      // not saved -> show setting page
      profilePage.classList.remove("hidden");
      subtitlePage.classList.add("hidden");
    }
  });

  saveProfileBtn.addEventListener("click", () => {
    const tarlang = document.querySelector('input[name="tarlang"]:checked')?.value;
    const level = document.querySelector('input[name="level"]:checked')?.value;
    const apiKey = apiKeyInput.value.trim();

    if (!tarlang || !level || !apiKey) {
      alert("Please fill all the infomation!");
      return;
    }

    chrome.storage.local.set({ geminiApiKey: apiKey, tarlang, level }, () => {
      alert("saved!");
      profilePage.classList.add("hidden");
      subtitlePage.classList.remove("hidden");
    });
  });

  // clean YouTube URL
  function cleanYouTubeUrl(originalUrl) {
    try {
      const url = new URL(originalUrl);
      const videoId = url.searchParams.get("v");
      if (videoId) return `${url.protocol}//${url.hostname}${url.pathname}?v=${videoId}`;
    } catch (e) {
      console.error("Error parsing URL for cleaning:", e);
    }
    return originalUrl;
  }

  // check current and show floating window
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes("youtube.com/watch")) {
      // show floating window when in youtube page
      chrome.tabs.sendMessage(currentTab.id, { action: "showFloatingWindow" });
    }
  });

  // Check if subtitles already exist for the current video
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

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
  
  generateBtn.addEventListener("click", function () {
    chrome.storage.local.get(["geminiApiKey"], function (result) {
      const apiKey = result.geminiApiKey?.trim();
      if (!apiKey) {
        statusDiv.textContent = "Please enter the API Key first.";
        return;
      }

      statusDiv.textContent = "Requesting subtitles...";
      generateBtn.disabled = true;

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        if (currentTab?.url?.includes("youtube.com/watch")) {
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: "generateSubtitles", apiKey },
            function (response) {
              if (chrome.runtime.lastError) {
                statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
              } else if (response?.status === "started") {
                statusDiv.textContent = "Processing video... (This may take a while)";
              } else if (response?.status === "error") {
                statusDiv.textContent = `Error: ${response.message || "Could not start process."}`;
              } else {
                statusDiv.textContent = "Unexpected response from content script.";
              }
              generateBtn.disabled = false;
            }
          );
        } else {
          statusDiv.textContent = "Not a YouTube video page.";
          generateBtn.disabled = false;
        }
      });
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updatePopupStatus") {
      statusDiv.textContent = message.text;
      if (message.error || message.success) generateBtn.disabled = false;
    }
  });
});

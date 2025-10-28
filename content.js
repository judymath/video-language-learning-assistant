let currentSubtitles = [];
let subtitleContainer = null;
let subtitleText = null;
let videoPlayer = null;
let videoContainer = null;
let checkInterval = null;
let currentVideoId = null;
let currentUrl = window.location.href;
let initAttempts = 0;
let vocabPopup = null;
let loopInterval = null;
let isLoop = false;
let isPaused = false;
const MAX_INIT_ATTEMPTS = 10;

// Add storage helper functions
async function addToSavedWords(word, translation) {
  const result = await chrome.storage.local.get(['savedWords']);
  const savedWords = result.savedWords || {};
  savedWords[word.toLowerCase()] = translation;
  await chrome.storage.local.set({ savedWords });
}

async function getSavedWords() {
  const result = await chrome.storage.local.get(['savedWords']);
  return result.savedWords || {};
}

// Helper function to show messages
function showMessage(message) {
  // Remove existing message if any
  const existingMessage = document.getElementById('extension-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement("div");
  messageDiv.id = "extension-message";
  messageDiv.style.position = "fixed";
  messageDiv.style.top = "20px";
  messageDiv.style.left = "50%";
  messageDiv.style.transform = "translateX(-50%)";
  messageDiv.style.background = "rgba(0,0,0,0.8)";
  messageDiv.style.color = "white";
  messageDiv.style.padding = "10px 20px";
  messageDiv.style.borderRadius = "5px";
  messageDiv.style.zIndex = "100001";
  messageDiv.style.fontSize = "14px";
  messageDiv.textContent = message;
  
  document.body.appendChild(messageDiv);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (document.body.contains(messageDiv)) {
      document.body.removeChild(messageDiv);
    }
  }, 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initialize();
    monitorUrlChanges();
  });
} else {
  initialize();
  monitorUrlChanges();
}

function initialize() {
  console.log("YouTube Subtitles Generator: Initializing content script...");

  if (!findVideoElements()) {
    initAttempts++;
    if (initAttempts < MAX_INIT_ATTEMPTS) {
      console.log(`Video player not found, retrying (${initAttempts}/${MAX_INIT_ATTEMPTS})...`);
      setTimeout(initialize, 500);
    } else {
      console.error("Video player not found after multiple attempts.");
    }
    return;
  }

  initAttempts = 0;

  try {
    const url = new URL(window.location.href);
    currentVideoId = url.searchParams.get("v");
    console.log("Detected video ID:", currentVideoId);
  } catch (e) {
    console.warn("Failed to extract video ID:", e);
    currentVideoId = null;
  }

  createSubtitleElements();
  loadStoredSubtitles();

  // Prevent duplicate bindings
  videoPlayer.removeEventListener("pause", handleVideoPause);
  videoPlayer.removeEventListener("play", handleVideoPlay);
  videoPlayer.addEventListener("pause", handleVideoPause);
  videoPlayer.addEventListener("play", handleVideoPlay);

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showFloatingWindow") {
        createFloatingPanel();
      } else if (message.action === "generateSubtitles") {
        handleGenerateSubtitles(message, sendResponse);
        return true;
      } else if (message.action === "subtitlesGenerated") {
        handleSubtitlesGenerated(message, sendResponse);
        return true;
      } else if (message.action === "selectPlaybackSpeed") {
        handleSelectPlaybackSpeed();
        return true;
      } else if (message.action === "goToPreviousSentence") {
        handleGoToPreviousSentence();
        return true;
      } else if (message.action === "translateSentence") {
        handleTranslation();
        return true;
      } else if (message.action === "showWordNotebook") {
        handleShowWordNotebook();
        return true;
      }
    });

  console.log("Initialization complete. Listening for messages.");
}

function createFloatingPanel() {
  const existingPanel = document.getElementById("extension-floating-panel");
  if (existingPanel) {
    existingPanel.style.display = "block";
    return;
  }

  const panel = document.createElement("div");
  panel.id = "extension-floating-panel";
  panel.style.position = "fixed";
  panel.style.top = "80px";
  panel.style.right = "40px";
  panel.style.width = "300px";
  panel.style.background = "rgba(30,30,30,0.85)";
  panel.style.border = "1px solid rgba(255,255,255,0.2)";
  panel.style.borderRadius = "10px";
  panel.style.color = "#fff";
  panel.style.zIndex = "2147483647"; // 使用最大z-index值
  panel.style.padding = "10px";
  panel.style.fontSize = "14px";
  panel.style.fontFamily = "Arial, sans-serif";
  panel.style.backdropFilter = "blur(5px)";
  panel.style.userSelect = "none";
  panel.style.cursor = "move";
  panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="font-weight:bold;">Language Learning Assistant</div>
        <button id="close-panel" style="
            background:transparent; color:#fff; border:none; 
            cursor:pointer; font-size:16px; padding:0; width:20px; height:20px;
            display:flex; align-items:center; justify-content:center;">×</button>
      </div>

      <div style="display:flex; gap:6px; margin-top:6px;">
        <button id="btn-speed" style="
          flex:1; background:#ff5e5e; color:#fff; border:none;
          border-radius:6px; padding:6px 0; font-weight:600; cursor:pointer;
          font-size:13px;">Single Sentence Loop</button>
        <select id="speed-select" style="
          width:80px; border-radius:6px; border:none; padding:4px; background:#444; color:#fff;">
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1" selected>1x</option>
          <option value="1.5">1.5x</option>
          <option value="1.75">1.75x</option>
          <option value="2">2x</option>
        </select>
      </div>

      <div style="
        display:flex; justify-content:space-between; gap:6px; margin-top:8px;">
        
        <button id="btn-prev" style="
          flex:1; background:#0078ff; color:#fff; border:none; border-radius:6px; padding:6px 0;
          font-size:13px; cursor:pointer;">
          Previous
        </button>

        <button id="btn-notebook" style="
          flex:1; background:#ffaa00; color:#fff; border:none; border-radius:6px; padding:6px 0;
          font-size:13px; cursor:pointer;">
          Notebook
        </button>
        
        <button id="btn-trans" style="
          flex:1; background:#00c896; color:#fff; border:none; border-radius:6px; padding:6px 0;
          font-size:13px; cursor:pointer;">
          Translation
        </button>
      </div>

      <div id="notebook-container" style="
        margin-top:10px;
        max-height: 180px;
        overflow-y: auto;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 8px;
        display: none; /* 默认隐藏 */
      "></div>
  `;

  const videoStatus = document.createElement("div");
  videoStatus.id = "videoStatus";
  videoStatus.style.marginTop = "10px";
  videoStatus.style.fontSize = "15px";
  videoStatus.style.fontWeight = "600";
  videoStatus.style.textAlign = "center";
  videoStatus.style.color = "#00e676"; // 初始绿色
  videoStatus.style.textShadow = "0 0 4px rgba(0,0,0,0.6)";
  videoStatus.textContent = "Playing";
  panel.appendChild(videoStatus);

  document.body.appendChild(panel);
  dragFloatingWindow(panel);

  const videoPlayer = document.querySelector("video");
  if (videoPlayer) {
    const statusEl = videoStatus;

    videoPlayer.addEventListener("play", () => {
      isPaused = false;
      statusEl.textContent = "Playing";
      statusEl.style.color = "#00e676";
    });

    videoPlayer.addEventListener("pause", () => {
      isPaused = true;
      statusEl.textContent = "Paused";
      statusEl.style.color = "#ff5252";
    });
  }

  // 关闭按钮事件绑定
  panel.querySelector("#close-panel").addEventListener("click", (e) => {
      e.stopPropagation(); // 防止触发拖拽
      document.body.removeChild(panel);
  });

  // 按钮事件绑定
  panel.querySelector("#btn-speed").addEventListener("click", () => {
      handleSelectPlaybackSpeed();
  });

  panel.querySelector("#btn-prev").addEventListener("click", () => {
      handleGoToPreviousSentence();
  });

  panel.querySelector("#btn-trans").addEventListener("click", () => {
      handleTranslation();
  });

  panel.querySelector("#btn-notebook").addEventListener("click", () => {
      handleShowWordNotebook();
  });
} 

function dragFloatingWindow(panel){
  let isDragging = false, offsetX, offsetY;
  panel.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
  });
  document.addEventListener("mousemove", (e) => {
      if (isDragging) {
          panel.style.left = e.clientX - offsetX + "px";
          panel.style.top = e.clientY - offsetY + "px";
          panel.style.right = "auto";
      }
  });
  document.addEventListener("mouseup", () => (isDragging = false));
}

function findVideoElements() {
  videoPlayer = document.querySelector("video.html5-main-video");
  if (!videoPlayer) return false;

  videoContainer =
    document.querySelector("#movie_player") ||
    document.querySelector(".html5-video-container") ||
    videoPlayer.parentElement;

  return !!videoContainer;
}

// for SPA navigation
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

function onUrlChange() {
  clearSubtitles();
  initialize();
}

function loadStoredSubtitles() {
  const cleanedUrl = cleanYouTubeUrl(window.location.href);
  chrome.storage.local.get([cleanedUrl], (result) => {
    if (result[cleanedUrl]) {
      console.log("Found stored subtitles for this video.");
      currentSubtitles = result[cleanedUrl];
      startSubtitleDisplay();
    } else {
      console.log("No stored subtitles found for this video.");
    }
  });
}

function cleanYouTubeUrl(originalUrl) {
  try {
    const url = new URL(originalUrl);
    const videoId = url.searchParams.get("v");
    if (videoId) return `${url.origin}${url.pathname}?v=${videoId}`;
  } catch (e) {
    console.error("Error parsing URL:", e);
  }
  return originalUrl;
}

function createSubtitleElements() {
  if (document.getElementById("youtube-gemini-subtitles-container")) return;

  subtitleContainer = document.createElement("div");
  subtitleContainer.id = "youtube-gemini-subtitles-container";
  subtitleContainer.style.position = "absolute";
  subtitleContainer.style.zIndex = "9999";
  subtitleContainer.style.pointerEvents = "none";
  subtitleContainer.style.display = "none";
  subtitleContainer.style.width = "100%";
  subtitleContainer.style.bottom = "10%";
  subtitleContainer.style.textAlign = "center";

  // 原文
  subtitleText = document.createElement("div");
  subtitleText.id = "youtube-gemini-subtitles-text";
  subtitleText.style.fontSize = "22px";
  subtitleText.style.color = "white";
  subtitleText.style.textShadow = "2px 2px 6px black";
  subtitleText.style.padding = "6px 12px";
  subtitleText.style.display = "inline-block";
  subtitleText.style.backgroundColor = "rgba(0,0,0,0.4)";
  subtitleText.style.borderRadius = "8px";

  // 翻译
  subtitleTranslation = document.createElement("div");
  subtitleTranslation.className = "subtitle-translation";
  subtitleTranslation.style.fontSize = "22px";
  subtitleTranslation.style.color = "black";
  subtitleTranslation.style.padding = "6px 12px";
  // subtitleTranslation.style.display = "inline-block";
  subtitleTranslation.style.display = "none";
  subtitleTranslation.style.backgroundColor = "white";
  subtitleTranslation.style.borderRadius = "8px";
  subtitleTranslation.style.marginTop = "4px";
  
  subtitleContainer.appendChild(subtitleTranslation);
  subtitleContainer.appendChild(subtitleText);

  if (videoContainer) {
    if (getComputedStyle(videoContainer).position === "static") {
      videoContainer.style.position = "relative";
    }
    videoContainer.appendChild(subtitleContainer);
    console.log("Subtitle container added.");
  }
}

function startSubtitleDisplay() {
  if (!videoPlayer || !subtitleContainer) {
    console.warn("Cannot start subtitle display: missing elements.");
    return;
  }

  stopSubtitleDisplay();

  checkInterval = setInterval(updateSubtitles, 100);
  videoPlayer.addEventListener("play", updateSubtitles);
  videoPlayer.addEventListener("seeked", updateSubtitles);
  videoPlayer.addEventListener("pause", handleShowVocabulary)
}

function stopSubtitleDisplay() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  if (videoPlayer) {
    videoPlayer.removeEventListener("play", updateSubtitles);
    videoPlayer.removeEventListener("seeked", updateSubtitles);
    videoPlayer.removeEventListener("pause", handleShowVocabulary)
  }
}

function updateSubtitles() {
  if (!videoPlayer || !subtitleText || !subtitleContainer || videoPlayer.paused || !subtitleTranslation)
    return;

  const currentTime = videoPlayer.currentTime * 1000;
  const subtitle = currentSubtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (subtitle) {
    subtitleText.textContent = subtitle.text;
    subtitleTranslation.textContent = "";

    // 如果没有翻译，隐藏翻译层
    subtitleTranslation.style.display = "none";
    subtitleContainer.style.display = "block";
  } else {
    hideCurrentSubtitle();
  }
}

function hideCurrentSubtitle() {
  if (subtitleContainer) subtitleContainer.style.display = "none";
  if (subtitleText) subtitleText.textContent = "";
  if (subtitleTranslation) subtitleTranslation.textContent = "";
}

function clearSubtitles() {
  currentSubtitles = [];
  stopSubtitleDisplay();
  hideCurrentSubtitle();
  console.log("Subtitles cleared.");
}

function updateSubtitleText(container, text, append = false) {
  if (!container) return;
  container.style.display = "block";

  const translationEl = container.querySelector(".subtitle-translation");
  if (!translationEl) return;

  // append=true 表示更新翻译层，且有内容需要显示时
  if (append && text) {
    translationEl.textContent = text;
    translationEl.style.display = "inline-block"; // 有内容时显示
  } else {
    translationEl.textContent = "";
    translationEl.style.display = "none"; // 无内容时隐藏
  }
}

// 视频暂停时获当前句子可能的生词
function handleVideoPause() {
  if (!videoPlayer) return;
  const currentTimestamp = videoPlayer.currentTime * 1000;

  const subtitle = currentSubtitles.find(
    (s) => currentTimestamp >= s.startTime && currentTimestamp <= s.endTime
  );

  if (!subtitle) {
    console.log("Paused: no subtitle found at this timestamp.");
    return;
  }

  console.log(`Paused at ${currentTimestamp}ms, get words from:`, subtitle.text);
  handleShowVocabulary()
}

function handleVideoPlay() {
  console.log("Video resumed — restoring original subtitles.");
  if (vocabPopup && document.body.contains(vocabPopup)) {
    vocabPopup.remove(); 
  }
}

function handleGenerateSubtitles(message, sendResponse) {
  console.log("Received generateSubtitles request.");
  clearSubtitles();

  const videoUrl = window.location.href;
  chrome.runtime.sendMessage(
    {
      action: "fetchSubtitles",
      videoUrl,
      apiKey: message.apiKey,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message to background:", chrome.runtime.lastError);
        sendResponse({ status: "error", message: "Background communication failed." });
      } else {
        console.log("fetchSubtitles response:", response);
      }
    }
  );

  sendResponse({ status: "started" });
}

function handleSubtitlesGenerated(message, sendResponse) {
  console.log("Received subtitlesGenerated message.");
  currentSubtitles = message.subtitles || [];

  if (currentSubtitles.length > 0) {
    startSubtitleDisplay();

    const cleanedUrl = cleanYouTubeUrl(window.location.href);
    chrome.storage.local.set({ [cleanedUrl]: currentSubtitles }, () => {
      console.log("Subtitles cached locally.");
    });

    sendResponse({ status: "success" });
  } else {
    clearSubtitles();
    sendResponse({ status: "no_subtitles_found" });
  }
}

// Assistant function implementations
function handleGoToPreviousSentence() {
  console.log("Going to previous sentence");
  if (!videoPlayer || !currentSubtitles.length) {
    console.log("No video player or subtitles available");
    return;
  }

  const currentTime = videoPlayer.currentTime * 1000;
  let previousSubtitle = null;
  
  // Find the previous subtitle
  for (let i = currentSubtitles.length - 1; i >= 0; i--) {
    if (currentSubtitles[i].endTime < currentTime) {
      previousSubtitle = currentSubtitles[i];
      break;
    }
  }
  
  if (previousSubtitle) {
    // Jump to the start of the previous subtitle
    videoPlayer.currentTime = previousSubtitle.startTime / 1000;
    console.log("Jumped to previous sentence:", previousSubtitle.text);
  } else {
    console.log("No previous sentence found");
  }
}


function handleTranslation(){
  console.log("translating subtitle");
  if (!videoPlayer || !currentSubtitles.length) {
    console.log("No video player or subtitles available");
    return;
  }

  const currentTime = videoPlayer.currentTime * 1000;
  const currentSubtitle = currentSubtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  console.log(`try to translate: ${currentSubtitle.text}`);
  
  chrome.storage.local.get(['geminiApiKey'], function(result) {
    if (!result.geminiApiKey) {
      updateSubtitleText(subtitleContainer, "Please set API Key first.");
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "translateWithGemini",
        text: currentSubtitle.text,
        videoId: currentVideoId,
        apiKey: result.geminiApiKey
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Translation request failed:", chrome.runtime.lastError);
          updateSubtitleText(subtitleContainer, "Fail to connect translation.");
          return;
        }

        if (response && response.success) {
          const translatedText = response.translation?.trim() || "Translation parsing failed";
          updateSubtitleText(subtitleContainer, translatedText, true);
          console.log("Translation completed:", translatedText);
        } else {
          const errorMessage = response?.error === "401" ? "API Key invalid" : "Fail to translate";
          console.error("Translation failed:", response?.error);
          updateSubtitleText(subtitleContainer, errorMessage);
        }
      }
    );
  });
}

function handleShowVocabulary() {
    console.log("Showing vocabulary");
    if (!videoPlayer || !currentSubtitles.length) {
      console.log("No video player or subtitles available");
      return;
    }
  
    const currentTime = videoPlayer.currentTime * 1000;
    const currentSubtitle = currentSubtitles.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );
  
    if (currentSubtitle) {
      // First verify API key exists
      chrome.storage.local.get(['geminiApiKey'], function(result) {
        if (!result.geminiApiKey) {
          showMessage("Please set API key first.");
          return;
        }
  
        // Create loading popup
        if (vocabPopup) vocabPopup.remove(); // 如果已存在旧popup先清除
        vocabPopup = document.createElement("div");
        vocabPopup.id = "vocabulary-popup";
        vocabPopup.style.position = "fixed";
        vocabPopup.style.top = "50%";
        vocabPopup.style.left = "50%";
        vocabPopup.style.transform = "translate(-50%, -50%)";
        vocabPopup.style.background = "rgba(0,0,0,0.9)";
        vocabPopup.style.color = "white";
        vocabPopup.style.padding = "10px 14px";
        vocabPopup.style.borderRadius = "10px";
        vocabPopup.style.zIndex = "100000";
        vocabPopup.style.maxWidth = "400px";
        vocabPopup.style.textAlign = "center";
        vocabPopup.style.cursor = "move";
        vocabPopup.style.userSelect = "none";
        vocabPopup.innerHTML = `
          <h3 style="margin: 0 0 15px 0;">Analyzing...</h3>
          <p style="margin: 0 0 15px 0; color: #ccc;">Please wait</p>
        `;
        
        document.body.appendChild(vocabPopup);
        dragFloatingWindow(vocabPopup)
  
        // Request vocabulary extraction
        chrome.runtime.sendMessage(
          {
            action: "extractVocabulary",
            text: currentSubtitle.text
          },
          async function(response) {
            if (chrome.runtime.lastError) {
              vocabPopup.innerHTML = `
                <h3 style="margin: 0 0 15px 0;">Failed to analyze</h3>
                <p style="margin: 0 0 10px 0; color: #ff6b6b;">Please try later</p>
              `;
              return;
            }

            // Add storage helper functions
            async function addToSavedWords(word, translation) {
              const result = await chrome.storage.local.get(['savedWords']);
              const savedWords = result.savedWords || {};
              savedWords[word.toLowerCase()] = translation;
              await chrome.storage.local.set({ savedWords });
            }

            async function getSavedWords() {
              const result = await chrome.storage.local.get(['savedWords']);
              return result.savedWords || {};
            }

            // Update vocabulary display with add buttons and saved status
            if (response?.success) {
              // Get saved words first
              const savedWords = await getSavedWords();

              // Extract words and create highlighted text
              const vocabWords = response.vocabulary
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.split('-')[0].trim());

              // Highlight text with different colors for saved words
              let highlightedText = currentSubtitle.text;
              vocabWords.forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                const isSaved = savedWords[word.toLowerCase()];
                const highlightColor = isSaved ?
                  'rgba(255, 235, 59, 0.3)' : // yellow for saved
                  'rgba(76, 175, 80, 0.3)'; // green for new
                const borderColor = isSaved ? '#FDD835' : '#4CAF50';

                highlightedText = highlightedText.replace(regex, `<span style="
                  background-color: ${highlightColor};
                  border-bottom: 1px solid ${borderColor};
                  padding: 0 2px;
                ">${word}</span>`);
              });

              // Format vocabulary pairs with add buttons
              const vocabLines = response.vocabulary
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                  const [word, translation] = line.split('-').map(s => s.trim());
                  const isSaved = savedWords[word.toLowerCase()];

                  return `
                    <div class="vocab-pair" style="
                      display: grid;
                      grid-template-columns: 1fr auto 1fr auto;
                      gap: 10px;
                      padding: 5px 0;
                      align-items: center;
                    ">
                      <span style="color: #fff;">${word}</span>
                      <span style="color: #666;">-</span>
                      <span style="color: #4CAF50;">${translation}</span>
                      ${isSaved ?
                      `<button
                        style="background: transparent; border: 1px solid #FDD835; color: #FDD835;
                        padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Saved</button>` : 
                      `<button 
                          class="add-word-btn" 
                          style="background: transparent; border: 1px solid #4CAF50; color: #4CAF50;
                          padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                          data-word="${word}"
                          data-translation="${translation}"
                        >Add</button>`}
                    </div>
                  `;
                })
                .join('');

              vocabPopup.innerHTML = `
                <div style="margin: 15px 0;">
                  ${vocabLines}
                </div>
              `;

              // Add click handlers for add buttons
              vocabPopup.querySelectorAll('.add-word-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  e.stopPropagation(); // Prevent popup from closing
                  const word = btn.dataset.word;
                  const translation = btn.dataset.translation;
                  await addToSavedWords(word, translation);
                  btn.outerHTML = 
                  `<button
                    style = "background: transparent; border: 1px solid #FDD835; color: #FDD835;
                    padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    Saved</button>`
                });
              });
            } else {
              vocabPopup.innerHTML = `
                <h3 style="margin: 0 0 15px 0;">Fail to analyze</h3>
                <p style="margin: 0 0 10px 0; color: #ff6b6b;">${response?.error || 'Unkown fault'}</p>
              `;
            }
          }
        );
        
        // Close popup when clicked（拖拽后不关闭）
        vocabPopup.addEventListener("click", (e) => {
          if (!didDrag) {
            document.body.removeChild(vocabPopup);
          }
        });
        
      });
    } else {
      console.log("No current subtitle found");
    }
  }


function handleShowWordNotebook() {
  console.log("showing all saved word");
  const container = document.getElementById("notebook-container");
  if (!container) return;

  if (container.style.display === "none") {
    container.style.display = "block";
  } else {
    container.style.display = "none";
    return;
  }

  chrome.storage.local.get(["savedWords"], (result) => {
    const savedWords = result.savedWords || {};

    // 空的情况
    if (Object.keys(savedWords).length === 0) {
      container.innerHTML = `<div style="text-align:center; color:#bbb;">No saved words yet.</div>`;
      return;
    }

    // 生成 HTML
    container.innerHTML = Object.entries(savedWords)
      .map(
        ([word, meaning]) => `
        <div style="
          background: rgba(255,255,255,0.08); border-radius:6px; padding:6px 8px;
          margin-bottom:6px; text-align:left;">
          <div style="
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            column-gap: 10px;
          ">
            <div style="display: flex; flex-direction: column;">
              <div style="color:#ffcc00; font-weight:bold; font-size:14px;">${word}</div>
              <div style="color:#ddd; font-size:12px; margin-top:4px;">${meaning}</div>
            </div>
            <button 
              class="ai-example-btn"
              data-word="${word}"
              style="
                background:#0078ff; color:#fff; border:none; border-radius:6px; 
                font-size:11px; padding:8px 10px; cursor:pointer; height:100%;
              ">AI Sentence</button>
          </div>
        </div>
      `
      )
      .join("");

      document.querySelectorAll(".ai-example-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const word = e.target.dataset.word;
          console.log(`Generating AI example for: ${word}`);

          // 获取当前单词卡片容器
          const cardEl = e.target.closest("div[style*='background']");

          // 如果已经有旧的例句区域，清除或更新
          let resultEl = cardEl.querySelector(".ai-sentence-result");
          if (!resultEl) {
            resultEl = document.createElement("div");
            resultEl.className = "ai-sentence-result";
            resultEl.style.marginTop = "6px";
            resultEl.style.fontSize = "12px";
            resultEl.style.color = "#ccc";
            resultEl.textContent = "Generating example...";
            cardEl.appendChild(resultEl);
          } else {
            resultEl.textContent = "Generating example...";
          }
  
          chrome.storage.local.get(['geminiApiKey'], function(result) {
            if (!result.geminiApiKey) {
              updateSubtitleText(subtitleContainer, "Please set API Key first.");
              return;
            }

            chrome.runtime.sendMessage(
              {
                action: "generateExampleSentence",
                text: word,
                videoId: currentVideoId,
                apiKey: result.geminiApiKey
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Generating sentense request failed:", chrome.runtime.lastError);
                  resultEl.textContent = "AI sentence request failed. Try again.";
                  return;
                }
                if (response && response.success) {
                  const generatedSentence = response.sentence?.trim() || "Sentence parsing failed";
                  console.log("Generation completed:", generatedSentence);
                  // 更新显示结果
                  resultEl.innerHTML = `<span style="color:#00c896;">Example:</span> ${generatedSentence}`;
          
                } else {
                  const errorMessage = response?.error === "401" ? "API Key invalid" : "Fail to generate";
                  console.error("Generation failed:", response?.error);
                  resultEl.textContent = `${errorMessage}`;
                }
              }
            );
          });  
        });
      });
  });
}


function handleSelectPlaybackSpeed() {
  console.log("Selecting playback speed for current sentence");

  if (!videoPlayer || !currentSubtitles.length) {
    console.log("No video player or subtitles available");
    return;
  }

  const speedSelect = document.querySelector("#speed-select");
  const speed = parseFloat(speedSelect.value);
  const btnLoop = document.querySelector("#btn-speed");

  const currentTime = videoPlayer.currentTime * 1000;
  const currentSubtitle = currentSubtitles.find(
    s => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (!currentSubtitle) {
    alert("Please pause on specific sentence.");
    return;
  }

   // 优先判断是否正在循环中（允许播放状态下停止）
   if (isLoop && loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    isLoop = false;

    videoPlayer.playbackRate = 1.0;
    videoPlayer.play();

    btnLoop.textContent = "Single Sentence Loop";
    console.log("Stopped single sentence loop");
    return;
  }

  if (!isPaused) {
    alert("Please stop the video first to activate this function.");
    return;
  }

  // 开始循环
  videoPlayer.playbackRate = speed;
  videoPlayer.currentTime = currentSubtitle.startTime / 1000;
  videoPlayer.play();

  isLoop = true;

  loopInterval = setInterval(() => {
    if (videoPlayer.currentTime * 1000 >= currentSubtitle.endTime) {
      videoPlayer.currentTime = currentSubtitle.startTime / 1000;
    }
  }, 50);

  btnLoop.textContent = "Continue Playing"; // 更新按钮文字
  console.log(`Started single sentence loop at ${speed}x speed`);
}

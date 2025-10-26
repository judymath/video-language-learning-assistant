let currentSubtitles = [];
let subtitleContainer = null;
let subtitleText = null;
let videoPlayer = null;
let videoContainer = null;
let checkInterval = null;
let currentVideoId = null;
let currentUrl = window.location.href;
let initAttempts = 0;
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
      } else if (message.action === "goToPreviousSentence") {
        handleGoToPreviousSentence();
        return true;
      } else if (message.action === "showVocabulary") {
        handleShowVocabulary();
        return true;
      } else if (message.action === "selectPlaybackSpeed") {
        handleSelectPlaybackSpeed();
        return true;
      }
    });

  console.log("Initialization complete. Listening for messages.");
}

function createFloatingPanel() {
  if (document.getElementById("extension-floating-panel")) return;

  const panel = document.createElement("div");
  panel.id = "extension-floating-panel";
  panel.style.position = "fixed";
  panel.style.top = "80px";
  panel.style.right = "40px";
  panel.style.width = "200px";
  panel.style.background = "rgba(30,30,30,0.85)";
  panel.style.border = "1px solid rgba(255,255,255,0.2)";
  panel.style.borderRadius = "10px";
  panel.style.color = "#fff";
  panel.style.zIndex = "99999";
  panel.style.padding = "10px";
  panel.style.fontSize = "14px";
  panel.style.fontFamily = "Arial, sans-serif";
  panel.style.backdropFilter = "blur(5px)";
  panel.style.userSelect = "none";
  panel.style.cursor = "move";
  panel.innerHTML = `
      <div style="font-weight:bold; margin-bottom:6px; text-align:center;">语言学习助手</div>
      <button id="btn-prev" style="
          background:#0078ff; color:#fff; border:none; border-radius:6px;
          padding:6px 10px; width:100%; cursor:pointer;">回到上一句</button>
      <button id="btn-vocab" style="
          margin-top:6px; background:#00c896; color:#fff; border:none; border-radius:6px;
          padding:6px 10px; width:100%; cursor:pointer;">显示生词</button>
      <button id="btn-speed" style="
          margin-top:6px; background:#ffaa00; color:#fff; border:none; border-radius:6px;
          padding:6px 10px; width:100%; cursor:pointer;">选择倍速</button>
  `;


  document.body.appendChild(panel);

  // 拖拽逻辑
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

  // 按钮事件绑定
  panel.querySelector("#btn-prev").addEventListener("click", () => {
      console.log("1")
      handleGoToPreviousSentence();
  });

  panel.querySelector("#btn-vocab").addEventListener("click", () => {
      console.log("2")
      handleShowVocabulary();
  });

  panel.querySelector("#btn-speed").addEventListener("click", () => {
      console.log("3")
      handleSelectPlaybackSpeed
  });
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

  subtitleText = document.createElement("div");
  subtitleText.id = "youtube-gemini-subtitles-text";
  subtitleText.style.fontSize = "22px";
  subtitleText.style.color = "white";
  subtitleText.style.textShadow = "2px 2px 6px black";
  subtitleText.style.padding = "6px 12px";
  subtitleText.style.display = "inline-block";
  subtitleText.style.backgroundColor = "rgba(0,0,0,0.4)";
  subtitleText.style.borderRadius = "8px";

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
  videoPlayer.addEventListener("pause", hideCurrentSubtitle);
}

function stopSubtitleDisplay() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  if (videoPlayer) {
    videoPlayer.removeEventListener("play", updateSubtitles);
    videoPlayer.removeEventListener("seeked", updateSubtitles);
    videoPlayer.removeEventListener("pause", hideCurrentSubtitle);
  }
}

function updateSubtitles() {
  if (!videoPlayer || !subtitleText || !subtitleContainer || videoPlayer.paused)
    return;

  const currentTime = videoPlayer.currentTime * 1000;
  const subtitle = currentSubtitles.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  if (subtitle) {
    if (subtitleText.textContent !== subtitle.text) {
      subtitleText.textContent = subtitle.text;
    }
    subtitleContainer.style.display = "block";
  } else {
    hideCurrentSubtitle();
  }
}

function hideCurrentSubtitle() {
  if (subtitleContainer) subtitleContainer.style.display = "none";
  if (subtitleText) subtitleText.textContent = "";
}

function clearSubtitles() {
  currentSubtitles = [];
  stopSubtitleDisplay();
  hideCurrentSubtitle();
  console.log("Subtitles cleared.");
}

function updateSubtitleText(container, text) {
  if (!container) return;
  container.style.display = "block";
  const textEl = container.querySelector("#youtube-gemini-subtitles-text");
  if (textEl) textEl.textContent = text;
}

function requestSubtitles(container) {
  if (!currentSubtitles.length) return;
  updateSubtitles();
}

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

  console.log(`Paused at ${currentTimestamp}ms, translating:`, subtitle.text);

  // First verify API key exists
  chrome.storage.local.get(['geminiApiKey'], function(result) {
    if (!result.geminiApiKey) {
      updateSubtitleText(subtitleContainer, "请先设置API密钥");
      return;
    }

    // Send translation request with verified API key
    chrome.runtime.sendMessage(
      {
        action: "translateWithGemini",
        text: subtitle.text,
        videoId: currentVideoId,
        timestamp: currentTimestamp,
        apiKey: result.geminiApiKey
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Translation request failed:", chrome.runtime.lastError);
          updateSubtitleText(subtitleContainer, "翻译连接失败");
          return;
        }

        if (response && response.success) {
          const translatedText = response.translation?.trim() || "翻译解析失败";
          updateSubtitleText(subtitleContainer, translatedText);
          console.log("Translation completed:", translatedText);
        } else {
          const errorMessage = response?.error === "401" ? "API密钥无效" : "翻译失败";
          console.error("Translation failed:", response?.error);
          updateSubtitleText(subtitleContainer, errorMessage);
        }
      }
    );
  });
}

function handleVideoPlay() {
  console.log("Video resumed — restoring original subtitles.");
  requestSubtitles(subtitleContainer);
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
  console.log("回到上一句 - Going to previous sentence");
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

function handleShowVocabulary() {
    console.log("显示生词 - Showing vocabulary");
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
          showMessage("请先设置API密钥");
          return;
        }
  
        // Create loading popup
        const vocabPopup = document.createElement("div");
        vocabPopup.id = "vocabulary-popup";
        vocabPopup.style.position = "fixed";
        vocabPopup.style.top = "50%";
        vocabPopup.style.left = "50%";
        vocabPopup.style.transform = "translate(-50%, -50%)";
        vocabPopup.style.background = "rgba(0,0,0,0.9)";
        vocabPopup.style.color = "white";
        vocabPopup.style.padding = "20px";
        vocabPopup.style.borderRadius = "10px";
        vocabPopup.style.zIndex = "100000";
        vocabPopup.style.maxWidth = "400px";
        vocabPopup.style.textAlign = "center";
        vocabPopup.innerHTML = `
          <h3 style="margin: 0 0 15px 0;">词汇分析中...</h3>
          <p style="margin: 0 0 10px 0; font-size: 16px;">"${currentSubtitle.text}"</p>
          <p style="margin: 0 0 15px 0; color: #ccc;">请稍候</p>
        `;
        
        document.body.appendChild(vocabPopup);
  
        // Request vocabulary extraction
        chrome.runtime.sendMessage(
          {
            action: "extractVocabulary",
            text: currentSubtitle.text
          },
          async function(response) {
            if (chrome.runtime.lastError) {
              vocabPopup.innerHTML = `
                <h3 style="margin: 0 0 15px 0;">分析失败</h3>
                <p style="margin: 0 0 10px 0; color: #ff6b6b;">请稍后重试</p>
                <p style="margin: 0 0 15px 0; color: #ccc;">点击关闭</p>
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
                      `<span style="color: #FDD835; font-size: 12px;">已保存</span>` :
                      `<button 
                          class="add-word-btn" 
                          style="
                            background: transparent;
                            border: 1px solid #4CAF50;
                            color: #4CAF50;
                            padding: 2px 8px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                          "
                          data-word="${word}"
                          data-translation="${translation}"
                        >添加</button>`}
                    </div>
                  `;
                })
                .join('');

              vocabPopup.innerHTML = `
                <p style="margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
                  "${highlightedText}"
                </p>
                <div style="margin: 15px 0;">
                  ${vocabLines}
                </div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 12px; text-align: center;">关闭</p>
              `;

              // Add click handlers for add buttons
              vocabPopup.querySelectorAll('.add-word-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  e.stopPropagation(); // Prevent popup from closing
                  const word = btn.dataset.word;
                  const translation = btn.dataset.translation;
                  await addToSavedWords(word, translation);
                  btn.outerHTML = `<span style="color: #FDD835; font-size: 12px;">已保存</span>`;
                });
              });
            } else {
              vocabPopup.innerHTML = `
                <h3 style="margin: 0 0 15px 0;">分析失败</h3>
                <p style="margin: 0 0 10px 0; color: #ff6b6b;">${response?.error || '未知错误'}</p>
                <p style="margin: 0 0 15px 0; color: #ccc;">点击关闭</p>
              `;
            }
          }
        );
        
        // Close popup when clicked
        vocabPopup.addEventListener("click", () => {
          document.body.removeChild(vocabPopup);
        });
        
        // Auto close after 15 seconds (increased from 5s for reading time)
        setTimeout(() => {
          if (document.body.contains(vocabPopup)) {
            document.body.removeChild(vocabPopup);
          }
        }, 15000);
      });
    } else {
      console.log("No current subtitle found");
    }
  }

function handleSelectPlaybackSpeed() {
  console.log("选择倍速 - Selecting playback speed");
  if (!videoPlayer) {
    console.log("No video player available");
    return;
  }

  // Create a speed selection popup
  const speedPopup = document.createElement("div");
  speedPopup.id = "speed-popup";
  speedPopup.style.position = "fixed";
  speedPopup.style.top = "50%";
  speedPopup.style.left = "50%";
  speedPopup.style.transform = "translate(-50%, -50%)";
  speedPopup.style.background = "rgba(0,0,0,0.9)";
  speedPopup.style.color = "white";
  speedPopup.style.padding = "20px";
  speedPopup.style.borderRadius = "10px";
  speedPopup.style.zIndex = "100000";
  speedPopup.style.textAlign = "center";
  
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const currentSpeed = videoPlayer.playbackRate;
  
  speedPopup.innerHTML = `
    <h3 style="margin: 0 0 15px 0;">选择播放速度</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
      ${speeds.map(speed => `
        <button style="
          background: ${speed === currentSpeed ? '#0078ff' : '#333'};
          color: white;
          border: none;
          padding: 10px;
          border-radius: 5px;
          cursor: pointer;
        " data-speed="${speed}">${speed}x</button>
      `).join('')}
    </div>
    <p style="margin: 15px 0 0 0; color: #ccc; font-size: 12px;">点击任意位置关闭</p>
  `;
  
  document.body.appendChild(speedPopup);
  
  // Add click handlers for speed buttons
  speedPopup.querySelectorAll('button[data-speed]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const speed = parseFloat(button.dataset.speed);
      videoPlayer.playbackRate = speed;
      console.log(`Changed playback speed to ${speed}x`);
      document.body.removeChild(speedPopup);
    });
  });
  
  // Close popup when clicked outside buttons
  speedPopup.addEventListener("click", (e) => {
    if (e.target === speedPopup) {
      document.body.removeChild(speedPopup);
    }
  });
}

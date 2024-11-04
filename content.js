
// Global variables
let mutedKeywords = [];
let mutedUsernames = [];
let categories = {};
let muteStats = {
  totalMuted: 0,
  mutedByKeyword: 0,
  mutedByUsername: 0,
  byCategory: {}
};
let observerActive = false;
let processedTweets = new Set();

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get([
    'mutedKeywords',
    'mutedUsernames',
    'categories',
    'muteStats',
    'autoHide'
  ], function(result) {
    mutedKeywords = result.mutedKeywords || [];
    mutedUsernames = result.mutedUsernames || [];
    categories = result.categories || {};
    muteStats = result.muteStats || {
      totalMuted: 0,
      mutedByKeyword: 0,
      mutedByUsername: 0,
      byCategory: {}
    };
    
    if (!observerActive) {
      initializeObserver();
    }
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (let key in changes) {
    switch(key) {
      case 'mutedKeywords':
        mutedKeywords = changes[key].newValue || [];
        break;
      case 'mutedUsernames':
        mutedUsernames = changes[key].newValue || [];
        break;
      case 'categories':
        categories = changes[key].newValue || {};
        break;
    }
  }
});

// Check if text matches any muted keywords
function matchesMutedKeywords(text) {
  text = text.toLowerCase();
  return mutedKeywords.find(keyword => {
    if (keyword.isRegex) {
      try {
        const regex = new RegExp(keyword.value, 'i');
        return regex.test(text);
      } catch (e) {
        console.error('Invalid regex:', keyword.value);
        return false;
      }
    }
    return text.includes(keyword.value.toLowerCase());
  });
}

// Check if username is muted
function isUsernameMuted(username) {
  return mutedUsernames.some(mutedUsername => 
    username.toLowerCase().includes(mutedUsername.toLowerCase())
  );
}

// Update mute statistics
function updateStats(type, category = null) {
  muteStats.totalMuted++;
  
  if (type === 'keyword') {
    muteStats.mutedByKeyword++;
    if (category) {
      muteStats.byCategory[category] = (muteStats.byCategory[category] || 0) + 1;
    }
  } else if (type === 'username') {
    muteStats.mutedByUsername++;
  }

  chrome.storage.local.set({ muteStats });
}

// Process a tweet element
function processTweet(tweetElement) {
  if (processedTweets.has(tweetElement)) return;
  processedTweets.add(tweetElement);

  // Get tweet text
  const tweetText = tweetElement.textContent;
  
  // Get username (adjust selector based on X's DOM structure)
  const usernameElement = tweetElement.querySelector('[data-testid="User-Name"]');
  const fullUsername = usernameElement ? usernameElement.textContent.trim() : '';
  const username = fullUsername.split('@')[1] || fullUsername; // Extract username without @

  // Check for muted username
  if (username && isUsernameMuted(username)) {
    hideTweet(tweetElement, 'username', null, username);
    updateStats('username');
    return;
  }

  // Check for muted keywords
  const matchedKeyword = matchesMutedKeywords(tweetText);
  if (matchedKeyword) {
    hideTweet(tweetElement, 'keyword', matchedKeyword);
    updateStats('keyword', matchedKeyword.category);
  }
}

// Hide tweet and show muted banner
function hideTweet(tweetElement, muteReason, keyword = null, username = null) {
  chrome.storage.local.get(['autoHide'], function(result) {
    const autoHide = result.autoHide || false;

    tweetElement.classList.add('hidden-tweet');

    if (!autoHide) {
      // Create and show banner only if autoHide is false
      const banner = document.createElement('div');
      banner.className = 'muted-banner';

      let muteMessage = 'Tweet hidden due to ';
      if (muteReason === 'username') {
        muteMessage += `muted username`;
      } else {
        muteMessage += `muted keyword`;
      }

      banner.innerHTML = `
        <div class="muted-message">${muteMessage}</div>
        <div class="muted-actions">
          <button class="show-tweet">Show Tweet</button>
          <button class="keep-hidden">Keep Hidden</button>
        </div>
      `;

      if (keyword?.category && categories[keyword.category]) {
        banner.style.borderLeft = `4px solid ${categories[keyword.category].color}`;
      } else if (muteReason === 'username') {
        banner.style.borderLeft = `4px solid #1DA1F2`; // Twitter blue color for username mutes
      }

      banner.querySelector('.show-tweet').addEventListener('click', () => {
        tweetElement.classList.remove('hidden-tweet');
        banner.remove();
      });

      banner.querySelector('.keep-hidden').addEventListener('click', () => {
        banner.remove();
      });

      tweetElement.parentNode.insertBefore(banner, tweetElement);
    }
  });
}

// Initialize the mutation observer
function initializeObserver() {
  observerActive = true;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for tweet elements (adjust selector based on X's DOM structure)
          const tweets = node.querySelectorAll('article');
          tweets.forEach(processTweet);
        }
      });
    });
  });

  // Start observing the timeline
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .muted-banner {
    padding: 12px 16px;
    margin: 12px 0;
    background-color: #f7f9f9;
    border: 1px solid #ebeef0;
    border-radius: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }

  .muted-banner:hover {
    background-color: #f0f3f4;
  }

  .muted-message {
    color: #536471;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .muted-actions {
    display: flex;
    gap: 12px;
    margin-top: 10px;
  }

  .muted-actions button {
    padding: 6px 16px;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .show-tweet {
    background-color: #1DA1F2;
    color: white;
  }

  .show-tweet:hover {
    background-color: #1a8cd8;
  }

  .keep-hidden {
    background-color: #536471;
    color: white;
  }

  .keep-hidden:hover {
    background-color: #455a64;
  }

  .hidden-tweet {
    display: none !important;
  }
`;
document.head.appendChild(styleSheet);

// Initial load
loadSettings();
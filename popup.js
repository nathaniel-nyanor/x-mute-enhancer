document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const elements = {
    keywordInput: document.getElementById('keywordInput'),
    categorySelect: document.getElementById('categorySelect'),
    regexToggle: document.getElementById('regexToggle'),
    addKeywordBtn: document.getElementById('addKeyword'),
    keywordList: document.getElementById('keywordList'),
    categoryInput: document.getElementById('categoryInput'),
    categoryColor: document.getElementById('categoryColor'),
    addCategoryBtn: document.getElementById('addCategory'),
    categoryList: document.getElementById('categoryList'),
    exportBtn: document.getElementById('exportData'),
    importBtn: document.getElementById('importData'),
    importFile: document.getElementById('importFile'),
    usernameInput: document.getElementById('usernameInput'),
    addUsernameBtn: document.getElementById('addUsername'),
    usernameList: document.getElementById('usernameList'),
    statsData: document.getElementById('statsData'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    autoHideToggle: document.getElementById('autoHideToggle')
  };

  // Initialize tabs
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  function switchTab(tabId) {
    elements.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
  }

  // Load data
  loadData();

  // Event listeners
  elements.addKeywordBtn.addEventListener('click', addKeyword);
  elements.addCategoryBtn.addEventListener('click', addCategory);
  elements.addUsernameBtn.addEventListener('click', addUsername);
  elements.exportBtn.addEventListener('click', exportData);
  elements.importBtn.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', importData);
  elements.autoHideToggle.addEventListener('change', async function() {
    await chrome.storage.local.set({ autoHide: this.checked });
  });

  // Functions
  async function loadData() {
    const data = await chrome.storage.local.get([
      'mutedKeywords',
      'categories',
      'mutedUsernames',
      'muteStats',
      'autoHide'
    ]);

    updateCategorySelect(data.categories || {});
    displayKeywords(data.mutedKeywords || []);
    displayCategories(data.categories || {});
    displayUsernames(data.mutedUsernames || []);
    updateStats(data.muteStats || {});
    elements.autoHideToggle.checked = data.autoHide || false;
  }

  async function addKeyword() {
    const keyword = elements.keywordInput.value.trim();
    const category = elements.categorySelect.value;
    const isRegex = elements.regexToggle.checked;

    if (!keyword) return;

    try {
      if (isRegex) {
        // Test if valid regex
        new RegExp(keyword);
      }

      const data = await chrome.storage.local.get(['mutedKeywords']);
      const keywords = data.mutedKeywords || [];
      
      const newKeyword = {
        value: keyword,
        category,
        isRegex,
        dateAdded: new Date().toISOString()
      };

      if (!keywords.some(k => k.value === keyword)) {
        keywords.push(newKeyword);
        await chrome.storage.local.set({ mutedKeywords: keywords });
        elements.keywordInput.value = '';
        displayKeywords(keywords);
      }
    } catch (e) {
      alert('Invalid regex pattern');
    }
  }

  async function addCategory() {
    const name = elements.categoryInput.value.trim();
    const color = elements.categoryColor.value;

    if (!name) return;

    const data = await chrome.storage.local.get(['categories']);
    const categories = data.categories || {};

    if (!categories[name]) {
      categories[name] = {
        color,
        dateAdded: new Date().toISOString()
      };
      await chrome.storage.local.set({ categories });
      elements.categoryInput.value = '';
      updateCategorySelect(categories);
      displayCategories(categories);
    }
  }

  async function addUsername() {
    let username = elements.usernameInput.value.trim().toLowerCase();
    username = username.startsWith('@') ? username.slice(1) : username;

    if (!username) return;

    const data = await chrome.storage.local.get(['mutedUsernames']);
    const usernames = data.mutedUsernames || [];

    if (!usernames.includes(username)) {
      usernames.push(username);
      await chrome.storage.local.set({ mutedUsernames: usernames });
      elements.usernameInput.value = '';
      displayUsernames(usernames);
      alert(`@${username} has been added to the mute list.`);
    } else {
      alert(`@${username} is already in the mute list.`);
    }
  }

  function displayKeywords(keywords) {
    elements.keywordList.innerHTML = keywords.map(keyword => `
      <div class="keyword-item">
        <span>
          ${keyword.value}
          ${keyword.isRegex ? '<span class="regex-indicator">[Regex]</span>' : ''}
          ${keyword.category ? `<span class="category-tag" style="background-color: ${getCategoryColor(keyword.category)}">${keyword.category}</span>` : ''}
        </span>
        <button class="remove-btn" data-keyword="${keyword.value}">Remove</button>
      </div>
    `).join('');

    // Add remove button listeners
    elements.keywordList.querySelectorAll('.remove-btn').forEach(button => {
      button.addEventListener('click', () => removeKeyword(button.dataset.keyword));
    });
  }

  function displayCategories(categories) {
    elements.categoryList.innerHTML = Object.entries(categories).map(([name, data]) => `
      <div class="keyword-item">
        <span style="color: ${data.color}">${name}</span>
        <button class="remove-btn" data-category="${name}">Remove</button>
      </div>
    `).join('');

    elements.categoryList.querySelectorAll('.remove-btn').forEach(button => {
      button.addEventListener('click', () => removeCategory(button.dataset.category));
    });
  }

  function displayUsernames(usernames) {
    elements.usernameList.innerHTML = usernames.map(username => `
      <div class="keyword-item">
        <span>@${username}</span>
        <button class="remove-btn" data-username="${username}">Remove</button>
      </div>
    `).join('');

    elements.usernameList.querySelectorAll('.remove-btn').forEach(button => {
      button.addEventListener('click', () => removeUsername(button.dataset.username));
    });
  }

  function updateStats(stats) {
    elements.statsData.innerHTML = `
      <p>Total posts muted: ${stats.totalMuted || 0}</p>
      <p>Muted by keywords: ${stats.mutedByKeyword || 0}</p>
      <p>Muted by username: ${stats.mutedByUsername || 0}</p>
      <h4>By Category:</h4>
      ${Object.entries(stats.byCategory || {}).map(([category, count]) => 
        `<p>${category}: ${count}</p>`
      ).join('')}
    `;
  }

  function updateCategorySelect(categories) {
    const options = ['<option value="">Select Category</option>'];
    for (const category in categories) {
      options.push(`<option value="${category}">${category}</option>`);
    }
    elements.categorySelect.innerHTML = options.join('');
  }

  async function removeKeyword(keyword) {
    const data = await chrome.storage.local.get(['mutedKeywords']);
    const keywords = data.mutedKeywords.filter(k => k.value !== keyword);
    await chrome.storage.local.set({ mutedKeywords: keywords });
    displayKeywords(keywords);
  }

  async function removeCategory(category) {
    const data = await chrome.storage.local.get(['categories', 'mutedKeywords']);
    const { categories, mutedKeywords } = data;

    // Remove category
    delete categories[category];

    // Update keywords that used this category
    const updatedKeywords = mutedKeywords.map(keyword => {
      if (keyword.category === category) {
        return { ...keyword, category: '' };
      }
      return keyword;
    });

    await chrome.storage.local.set({ 
      categories,
      mutedKeywords: updatedKeywords
    });

    displayCategories(categories);
    displayKeywords(updatedKeywords);
    updateCategorySelect(categories);
  }

  async function removeUsername(username) {
    const data = await chrome.storage.local.get(['mutedUsernames']);
    const usernames = data.mutedUsernames.filter(u => u !== username);
    await chrome.storage.local.set({ mutedUsernames: usernames });
    displayUsernames(usernames);
  }

  async function exportData() {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'x-muter-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        await chrome.storage.local.set(data);
        loadData();
        alert('Settings imported successfully!');
      } catch (error) {
        alert('Error importing settings. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }

  function getCategoryColor(categoryName) {
    const categories = JSON.parse(localStorage.getItem('categories') || '{}');
    return categories[categoryName]?.color || '#1DA1F2';
  }
});

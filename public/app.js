// Client-Side Controller for Aetheria RPG Portal

const API_BASE = '/api';

// Application State
let state = {
  character: null,
  role: null,
  isGuest: false,
  questInterval: null,
  questEndTime: null
};

// UI Elements
const loadingScreen = document.getElementById('loading-screen');
const authPanel = document.getElementById('auth-panel');
const gameDashboard = document.getElementById('game-dashboard');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const logoutBtn = document.getElementById('logout-btn');
const toastContainer = document.getElementById('toast-container');

// Class selection visual card toggle
const classCards = document.querySelectorAll('.class-card');
classCards.forEach(card => {
  card.addEventListener('click', () => {
    classCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  });
});

// Faction selection visual toggle
const factionTabs = document.querySelectorAll('.faction-tab-btn');
const factionGrids = document.querySelectorAll('.faction-grid');

factionTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    factionTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const targetFaction = tab.getAttribute('data-faction');
    factionGrids.forEach(grid => {
      if (grid.id === `grid-${targetFaction}`) {
        grid.classList.remove('hidden');
        grid.classList.add('active');
        
        const firstCard = grid.querySelector('.class-card');
        if (firstCard) firstCard.click();
      } else {
        grid.classList.add('hidden');
        grid.classList.remove('active');
      }
    });
  });
});

// Toast System
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  toastContainer.appendChild(toast);
  
  // Trigger transition
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Fetch helper with Credentials (for session cookies)
async function apiFetch(url, options = {}) {
  options.credentials = 'include'; // Critical for session cookie persistence
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json'
    };
  }
  
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server error occurred');
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    if (!options.hideErrorToast) {
      showToast(err.message, 'error');
    }
    throw err;
  }
}

// Check session on load
async function checkSession() {
  if (window.INITIAL_STATE) {
    state.character = window.INITIAL_STATE.character;
    state.role = window.INITIAL_STATE.role;
    state.isGuest = window.INITIAL_STATE.isGuest;
    showToast(`${state.character.name} 紐⑦뿕媛?? ?묒냽???섏쁺?⑸땲??`, 'success');
    switchToDashboard();
  } else {
    switchToAuth();
  }
}

// Switch UI Panels
function switchToDashboard() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.classList.add('hidden');
  authPanel.classList.add('hidden');
  
  if (state.role === 'admin') {
    gameDashboard.classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
  } else {
    document.getElementById('admin-dashboard').classList.add('hidden');
    gameDashboard.classList.remove('hidden');
    // Set navbar name
    document.getElementById('player-username').innerText = state.character.name;
    const linkBtn = document.getElementById('link-account-btn');
    if (linkBtn) {
      if (state.isGuest) {
        linkBtn.classList.remove('hidden');
      } else {
        linkBtn.classList.add('hidden');
      }
    }
    renderCharacter();
  }
}

function switchToAuth() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.classList.add('hidden');
  gameDashboard.classList.add('hidden');
  if (document.getElementById('admin-dashboard')) {
    document.getElementById('admin-dashboard').classList.add('hidden');
  }
  authPanel.classList.remove('hidden');
  state.character = null;
  state.role = null;
  if (state.questInterval) {
    clearInterval(state.questInterval);
    state.questInterval = null;
  }
}

// Tab Switches
tabLoginBtn.addEventListener('click', () => {
  tabLoginBtn.classList.add('active');
  tabRegisterBtn.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

tabRegisterBtn.addEventListener('click', () => {
  tabRegisterBtn.classList.add('active');
  tabLoginBtn.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

// Submit Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiFetch(`${API_BASE}/login`, {
      method: 'POST',
      body: { username, password }
    });
    state.character = data.character;
    state.role = data.role;
    state.isGuest = data.isGuest;
    showToast('濡쒓렇???깃났!', 'success');
    switchToDashboard();
  } catch (err) {
    // Handled by apiFetch toast
  }
});

// Submit Registration (Start as Guest)
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const charName = document.getElementById('register-char-name').value;
  const charClass = document.querySelector('input[name="charClass"]:checked').value;

  try {
    const data = await apiFetch(`${API_BASE}/register`, {
      method: 'POST',
      body: { charClass, charName }
    });
    state.character = data.character;
    state.role = 'user';
    state.isGuest = data.isGuest;
    showToast('鍮꾪쉶??怨꾩젙?쇰줈 ?덈줈??紐⑦뿕???쒖옉?섏뿀?듬땲??', 'success');
    switchToDashboard();
  } catch (err) {
    // Handled by apiFetch toast
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await apiFetch(`${API_BASE}/logout`, { method: 'POST' });
    showToast('?덉쟾?섍쾶 濡쒓렇?꾩썐 ?섏뿀?듬땲??', 'info');
    switchToAuth();
  } catch (err) {
    // Fail-safe redirect anyway
    switchToAuth();
  }
});

// Link Account Modal Logic
const linkAccountBtn = document.getElementById('link-account-btn');
const linkAccountModal = document.getElementById('link-account-modal');
const linkCancelBtn = document.getElementById('link-cancel-btn');
const linkAccountForm = document.getElementById('link-account-form');

if (linkAccountBtn) {
  linkAccountBtn.addEventListener('click', () => {
    linkAccountModal.classList.remove('hidden');
  });
}

if (linkCancelBtn) {
  linkCancelBtn.addEventListener('click', () => {
    linkAccountModal.classList.add('hidden');
  });
}

if (linkAccountForm) {
  linkAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('link-username').value;
    const password = document.getElementById('link-password').value;

    try {
      await apiFetch(`${API_BASE}/link-account`, {
        method: 'POST',
        body: { username, password }
      });
      state.isGuest = false;
      showToast('?깃났?곸쑝濡?怨꾩젙???곕룞?섏뿀?듬땲?? ?댁젣遺????ID濡?濡쒓렇?명븷 ???덉뒿?덈떎.', 'success');
      linkAccountModal.classList.add('hidden');
      if (document.getElementById('link-account-btn')) {
        document.getElementById('link-account-btn').classList.add('hidden');
      }
    } catch (err) {
      // Handled by apiFetch
    }
  });
}

// Rendering Character Sheet
function renderCharacter() {
  const char = state.character;
  if (!char) return;

  // Base Info
  document.getElementById('char-name').innerText = char.name;
  
  const classKorean = {
    GopherWarrior: '怨좏띁 ?꾩궗 (Go)',
    RoutineMage: '怨좊（??留덈쾿??(Go)',
    FerrisKnight: '?섎━??湲곗궗 (Rust)',
    BorrowCheckerRogue: '鍮뚮┝ 寃?ш린 ?꾩쟻 (Rust)',
    NodeNinja: '?대깽??猷⑦봽 ?뚯옄 (Node)',
    NodeSummoner: '肄쒕갚 ?뚰솚??(Node)',
    PythonRanger: '?ㅼ뿬?곌린 沅곸닔 (Python)',
    PythonBerserker: 'GIL 愿묒쟾??(Python)',
    JavaKnight: '?⑺넗由?湲곗궗 (Java)',
    JavaCleric: 'GC ?ъ젣 (Java)'
  };
  
  const classBadge = document.getElementById('char-class');
  classBadge.innerText = classKorean[char.class] || char.class;
  classBadge.classList.remove('go-badge', 'rust-badge', 'node-badge', 'python-badge', 'java-badge');
  if (char.class === 'GopherWarrior' || char.class === 'RoutineMage') {
    classBadge.classList.add('go-badge');
  } else if (char.class === 'FerrisKnight' || char.class === 'BorrowCheckerRogue') {
    classBadge.classList.add('rust-badge');
  } else if (char.class.startsWith('Node')) {
    classBadge.classList.add('node-badge');
  } else if (char.class.startsWith('Python')) {
    classBadge.classList.add('python-badge');
  } else if (char.class.startsWith('Java')) {
    classBadge.classList.add('java-badge');
  }
  
  document.getElementById('char-level').innerText = char.level;
  document.getElementById('char-gold').innerText = `${char.gold} G`;

  // Avatar Images
  const avatarImages = {
    GopherWarrior: 'assets/gopher_warrior.jpg',
    RoutineMage: 'assets/gopher_mage.jpg',
    FerrisKnight: 'assets/ferris_knight.jpg',
    BorrowCheckerRogue: 'assets/ferris_rogue.jpg',
    NodeNinja: 'assets/node_ninja.jpg',
    NodeSummoner: 'assets/node_summoner.jpg',
    PythonRanger: 'assets/python_ranger.jpg',
    PythonBerserker: 'assets/python_berserker.jpg',
    JavaKnight: 'assets/java_knight.jpg',
    JavaCleric: 'assets/java_cleric.jpg'
  };
  document.getElementById('char-avatar-img').src = avatarImages[char.class] || 'assets/gopher_warrior.jpg';

  // HP Bar
  const hpPercent = (char.hp / char.maxHp) * 100;
  document.getElementById('hp-fill').style.width = `${hpPercent}%`;
  document.getElementById('hp-text').innerText = `${char.hp} / ${char.maxHp}`;

  // MP Bar
  const mpPercent = (char.mp / char.maxMp) * 100;
  document.getElementById('mp-fill').style.width = `${mpPercent}%`;
  document.getElementById('mp-text').innerText = `${char.mp} / ${char.maxMp}`;

  // XP Bar
  const xpPercent = (char.xp / char.xpNeeded) * 100;
  document.getElementById('xp-fill').style.width = `${xpPercent}%`;
  document.getElementById('xp-text').innerText = `${char.xp} / ${char.xpNeeded}`;

  // Stats & Point Allocation
  document.getElementById('stat-strength').innerText = char.stats.strength;
  document.getElementById('stat-intelligence').innerText = char.stats.intelligence;
  document.getElementById('stat-dexterity').innerText = char.stats.dexterity;
  document.getElementById('stat-luck').innerText = char.stats.luck;

  const statsList = document.querySelector('.stats-list');
  const pointsBadge = document.getElementById('available-points-badge');
  
  if (char.statPoints > 0) {
    statsList.classList.add('can-train');
    pointsBadge.classList.remove('hidden');
    document.getElementById('stat-points-val').innerText = char.statPoints;
  } else {
    statsList.classList.remove('can-train');
    pointsBadge.classList.add('hidden');
  }

  // Equipment mapping
  const SHOP_ITEMS = {
    potion: { name: '泥대젰 臾쇱빟', icon: '?㎦' },
    sword: { name: 'Go Compiler Blade', icon: '?뿠截? },
    staff: { name: 'Routine Channel Wand', icon: '?뵰' },
    armor: { name: 'Rust Safe Shield', icon: '?썳截? },
    ring: { name: 'Ownership Ring', icon: '?뭾' }
  };

  const slots = ['weapon', 'armor', 'ring'];
  slots.forEach(slot => {
    const eqElement = document.getElementById(`eq-${slot}`);
    const itemKey = char.equipment[slot];
    
    if (itemKey && SHOP_ITEMS[itemKey]) {
      eqElement.className = 'eq-item-card';
      eqElement.querySelector('.eq-icon').innerText = SHOP_ITEMS[itemKey].icon;
      eqElement.querySelector('.eq-name').innerText = SHOP_ITEMS[itemKey].name;
      
      // Allow unequip on click
      eqElement.onclick = () => handleItemAction('unequip', itemKey, slot);
    } else {
      eqElement.className = 'eq-item-card empty';
      const placeholderIcons = { weapon: '?뷂툘', armor: '?썳截?, ring: '?뭾' };
      eqElement.querySelector('.eq-icon').innerText = placeholderIcons[slot];
      eqElement.querySelector('.eq-name').innerText = '鍮꾩뼱?덉쓬';
      eqElement.onclick = null;
    }
  });

  // Render Inventory
  const invGrid = document.getElementById('inventory-grid');
  invGrid.innerHTML = '';
  const totalSlots = 8; // 8 inventory slot grid
  
  for (let i = 0; i < totalSlots; i++) {
    const slot = document.createElement('div');
    const itemKey = char.inventory[i];
    
    if (itemKey && SHOP_ITEMS[itemKey]) {
      slot.className = 'inv-slot';
      
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'inv-item-card';
      itemWrapper.innerHTML = `<span class="inv-item-icon">${SHOP_ITEMS[itemKey].icon}</span>`;
      
      // Tooltip or helper action
      const itemTitle = SHOP_ITEMS[itemKey].name;
      slot.title = itemKey === 'potion' ? `${itemTitle} (?대┃ ??蹂듭슜)` : `${itemTitle} (?대┃ ???μ갑)`;
      
      slot.appendChild(itemWrapper);
      
      // Click actions: Potion uses, others equip
      slot.addEventListener('click', () => {
        if (itemKey === 'potion') {
          handleItemAction('use', 'potion');
        } else {
          handleItemAction('equip', itemKey);
        }
      });
    } else {
      slot.className = 'inv-slot empty';
    }
    invGrid.appendChild(slot);
  }

  // Render Logs
  const logContent = document.getElementById('event-log-content');
  logContent.innerHTML = '';
  char.logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // Style lines based on keywords
    if (log.includes('LEVEL UP')) {
      entry.className = 'log-entry system-msg';
      entry.style.color = 'var(--gold)';
      entry.style.fontWeight = 'bold';
    } else if (log.includes('Gained +') && log.includes('XP')) {
      entry.className = 'log-entry xp-gain';
    } else if (log.includes('Gold')) {
      entry.className = 'log-entry gold-gain';
    } else if (log.includes('damage')) {
      entry.className = 'log-entry combat-dmg';
    } else if (log.includes('Healed') || log.includes('Used Potion')) {
      entry.className = 'log-entry combat-heal';
    } else {
      entry.className = 'log-entry';
    }
    
    entry.innerText = log;
    logContent.appendChild(entry);
  });

  // Handle Active Quest UI State
  const activeQuestPanel = document.getElementById('active-quest-panel');
  const questListPanel = document.getElementById('quest-list-panel');
  
  if (char.questState.active) {
    activeQuestPanel.classList.remove('hidden');
    questListPanel.classList.add('hidden');
    
    // Set quest name
    const questNames = {
      quest1: '?섎ː: 媛꾨떒??踰꾧렇 ?쎌뒪',
      quest2: '?섎ː: ?덇굅??由ы뙥?좊쭅',
      quest3: '?섎ː: 肄붿뼱 ?쇱쿂 媛쒕컻',
      quest4: '?섎ː: DB 留덉씠洹몃젅?댁뀡'
    };
    document.getElementById('active-quest-name').innerText = questNames[char.questState.questId] || '紐⑦뿕 ?섎ː';
    
    // Begin/Resume local progress countdown
    startLocalQuestTimer(char.questState);
  } else {
    activeQuestPanel.classList.add('hidden');
    questListPanel.classList.remove('hidden');
    
    if (state.questInterval) {
      clearInterval(state.questInterval);
      state.questInterval = null;
    }
  }
}

// Local Quest Countdown
function startLocalQuestTimer(questState) {
  if (state.questInterval) {
    clearInterval(state.questInterval);
  }

  const duration = questState.duration;
  const startTime = questState.startTime;
  state.questEndTime = startTime + duration;

  const timerText = document.getElementById('active-quest-timer');
  const progressBarFill = document.getElementById('active-quest-fill');

  function updateTimer() {
    const now = Date.now();
    const timeRemaining = state.questEndTime - now;
    
    if (timeRemaining <= 0) {
      clearInterval(state.questInterval);
      state.questInterval = null;
      timerText.innerText = '?섎ː ?꾨즺! 蹂닿퀬 以?..';
      progressBarFill.style.width = '100%';
      
      // Auto complete on backend
      completeQuest();
    } else {
      const secondsLeft = (timeRemaining / 1000).toFixed(1);
      timerText.innerText = `?⑥? ?쒓컙: ${secondsLeft}珥?;
      
      const percent = ((duration - timeRemaining) / duration) * 100;
      progressBarFill.style.width = `${percent}%`;
    }
  }

  // Initial call and set interval
  updateTimer();
  state.questInterval = setInterval(updateTimer, 100);
}

// Request complete quest from server
async function completeQuest() {
  try {
    const data = await apiFetch(`${API_BASE}/quest`, {
      method: 'POST',
      body: { action: 'complete' }
    });
    state.character = data.character;
    showToast('?섎ː媛 臾댁궗???꾨즺?섏뿀?듬땲??', 'success');
    renderCharacter();
  } catch (err) {
    // On error, let user retry or reset if needed
  }
}

// Start Quest Button listener
document.querySelectorAll('.start-quest-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const questId = btn.getAttribute('data-quest-id');
    try {
      const data = await apiFetch(`${API_BASE}/quest`, {
        method: 'POST',
        body: { action: 'start', questId }
      });
      state.character = data.character;
      renderCharacter();
    } catch (err) {
      // Toast displayed by apiFetch
    }
  });
});

// Hunt Button listener
document.querySelectorAll('.hunt-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    console.log("Hunt button clicked!");
    const monsterId = btn.getAttribute('data-monster-id');
    try {
      const data = await apiFetch(`${API_BASE}/hunt`, {
        method: 'POST',
        body: { monsterId }
      });
      state.character = data.character;
      renderCharacter();
      if (data.won) {
        showToast(data.log, 'success');
      } else {
        showToast(data.log, 'error');
      }
    } catch (err) {
      console.error("Hunt error:", err);
      showToast(err.message, 'error');
    }
  });
});

// Train Stat point listener
document.querySelectorAll('.train-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const stat = btn.getAttribute('data-stat');
    try {
      const data = await apiFetch(`${API_BASE}/stats/train`, {
        method: 'POST',
        body: { stat }
      });
      state.character = data.character;
      renderCharacter();
    } catch (err) {}
  });
});

// Render Shop UI
function renderShop() {
  const shopData = {
    "potion": { id: "potion", name: "Health Potion", type: "consumable", cost: 10, healAmount: 50, description: "Heals 50 HP instantly" },
    "sword":  { id: "sword", name: "Go Compiler Blade", type: "weapon", slot: "weapon", cost: 50, stats: { strength: 6 }, description: "+6 Strength (Go Weapon)" },
    "staff":  { id: "staff", name: "Routine Channel Wand", type: "weapon", slot: "weapon", cost: 50, stats: { intelligence: 6 }, description: "+6 Intelligence (Go Weapon)" },
    "armor":  { id: "armor", name: "Rust Safe Shield", type: "armor", slot: "armor", cost: 75, stats: { strength: 2, dexterity: -1 }, hpBonus: 40, description: "+40 Max HP, +2 Str, -1 Dex (Rust Armor)" },
    "ring":   { id: "ring", name: "Ownership Ring", type: "ring", slot: "ring", cost: 100, stats: { luck: 8 }, description: "+8 Luck (Rust Accessory)" },
  };

  const ul = document.getElementById('shop-items-list');
  if (!ul) return;
  ul.innerHTML = '';
  
  Object.values(shopData).forEach(item => {
    const li = document.createElement('li');
    li.className = 'shop-item';
    
    // Check if affordable
    const canAfford = state.character.gold >= item.cost;
    const btnClass = canAfford ? 'btn-primary' : 'btn-secondary';
    const disableAttr = canAfford ? '' : 'disabled';
    
    let statsHtml = '';
    if (item.stats) {
      if (item.stats.strength) statsHtml += `<span class="stat-tag stat-str">STR +${item.stats.strength}</span> `;
      if (item.stats.intelligence) statsHtml += `<span class="stat-tag stat-int">INT +${item.stats.intelligence}</span> `;
      if (item.stats.dexterity) statsHtml += `<span class="stat-tag stat-dex">DEX +${item.stats.dexterity}</span> `;
      if (item.stats.luck) statsHtml += `<span class="stat-tag stat-luck">LUK +${item.stats.luck}</span> `;
    }
    if (item.hpBonus) {
      statsHtml += `<span class="stat-tag">Max HP +${item.hpBonus}</span> `;
    }

    li.innerHTML = `
      <div class="shop-item-info">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h4 class="shop-item-name">${item.name}</h4>
          <span class="shop-item-type">${item.type}</span>
        </div>
        <p class="shop-item-desc">${item.description}</p>
        <div class="shop-item-stats">${statsHtml}</div>
      </div>
      <button class="rpg-btn ${btnClass} btn-sm buy-btn" data-id="${item.id}" ${disableAttr}>
        ${item.cost} G
      </button>
    `;
    ul.appendChild(li);
  });

  // Attach buy listeners
  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.target.getAttribute('data-id');
      try {
        const data = await apiFetch(`${API_BASE}/shop/buy`, {
          method: 'POST',
          body: { itemId }
        });
        state.character = data.character;
        showToast('?꾩씠??援щℓ ?깃났!', 'success');
        renderCharacter();
        renderShop(); // re-render to update affordable status
      } catch (err) {}
    });
  });
}

// --- Admin Dashboard Logic ---
document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
  try {
    await apiFetch(`${API_BASE}/logout`, { method: 'POST' });
    showToast('愿由ъ옄 濡쒓렇?꾩썐 ?섏뿀?듬땲??', 'info');
    switchToAuth();
  } catch (err) {
    switchToAuth();
  }
});

document.getElementById('start-war-btn')?.addEventListener('click', async () => {
  try {
    const btn = document.getElementById('start-war-btn');
    btn.disabled = true;
    btn.innerText = '?꾩웳 吏꾪뻾 以?..';
    
    const data = await apiFetch(`${API_BASE}/admin/war`, { method: 'POST' });
    
    btn.disabled = false;
    btn.innerText = '吏꾩쁺??媛쒖떆 (Start Faction War)';
    
    const resultsDiv = document.getElementById('war-results');
    const resultsList = document.getElementById('war-results-list');
    resultsDiv.style.display = 'block';
    
    let html = `<li><strong style="color: var(--gold);">?몣 ?곗듅 吏꾩쁺: ${data.winner}</strong></li>`;
    html += `<li>?꾩껜 ?먯닔 ?꾪솴:</li>`;
    
    Object.entries(data.scores).sort((a,b) => b[1] - a[1]).forEach(([faction, score]) => {
      html += `<li>- ${faction}: ${score} ??/li>`;
    });
    
    resultsList.innerHTML = html;
    showToast('吏꾩쁺?꾩씠 ?꾨즺?섏뿀?듬땲??', 'success');
  } catch (err) {
    document.getElementById('start-war-btn').disabled = false;
    document.getElementById('start-war-btn').innerText = '吏꾩쁺??媛쒖떆 (Start Faction War)';
  }
});


// Equip, Unequip, Use Items action handler
async function handleItemAction(action, itemId, slot = null) {
  try {
    const data = await apiFetch(`${API_BASE}/item/action`, {
      method: 'POST',
      body: { action, itemId, slot }
    });
    state.character = data.character;
    renderCharacter();
    
    if (action === 'use') {
      showToast('臾쇱빟???ъ슜?섏뿬 ?뚮났?덉뒿?덈떎!', 'success');
    } else if (action === 'equip') {
      showToast('?λ퉬瑜??μ갑?덉뒿?덈떎.', 'success');
    } else if (action === 'unequip') {
      showToast('?λ퉬瑜??μ갑 ?댁젣?덉뒿?덈떎.', 'info');
    }
  } catch (err) {
    // Handle error
  }
}

// Initialize on page load
checkSession();


// --- Multiplayer / Town Square Logic ---

let chatPollingInterval = null;
let playersPollingInterval = null;

function startTownSquare() {
  if (state.role === 'admin') return;
  
  if (!chatPollingInterval) {
    chatPollingInterval = setInterval(fetchChat, 3000);
    fetchChat(); // initial fetch
  }
  if (!playersPollingInterval) {
    playersPollingInterval = setInterval(fetchActivePlayers, 10000);
    fetchActivePlayers(); // initial fetch
  }
}

function stopTownSquare() {
  clearInterval(chatPollingInterval);
  clearInterval(playersPollingInterval);
  chatPollingInterval = null;
  playersPollingInterval = null;
}

async function fetchChat() {
  try {
    const data = await apiFetch(`${API_BASE}/chat`);
    renderChat(data);
  } catch (err) {}
}

async function fetchActivePlayers() {
  try {
    const data = await apiFetch(`${API_BASE}/active-players`);
    renderActivePlayers(data);
  } catch (err) {}
}

function renderChat(messages) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  // Check if scrolled to bottom
  const isAtBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 10;
  
  let html = '';
  if (!messages || messages.length === 0) {
    html = '<p style="color: var(--text-dim); text-align: center; font-size: 0.8rem;">아직 메시지가 없습니다.</p>';
  } else {
    messages.forEach(msg => {
      const d = new Date(msg.created_at);
      const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      html += 
        <div class="chat-msg">
          <span class="chat-time">[+timeStr+]</span>
          <span class="chat-author">+msg.charName+</span>: 
          <span class="chat-text">+escapeHtml(msg.message)+</span>
        </div>
      ;
    });
  }
  box.innerHTML = html;
  
  if (isAtBottom) {
    box.scrollTop = box.scrollHeight;
  }
}

function renderActivePlayers(players) {
  const list = document.getElementById('active-players-list');
  if (!list) return;
  
  let html = '';
  if (!players || players.length === 0) {
    html = '<p style="color: var(--text-dim); text-align: center; font-size: 0.8rem;">접속자가 없습니다.</p>';
  } else {
    players.forEach(p => {
      // Don't show wave button for yourself
      const isSelf = p.charName === state.character?.name;
      html += 
        <div class="active-player-item">
          <div class="active-player-info">
            <span class="class-badge +getClassColor(p.class)+" style="font-size: 0.7rem; padding: 2px 4px;">Lv.+p.level+</span>
            <span>+p.charName+</span>
          </div>
          +(!isSelf ? <button class="wave-btn" data-target="+p.username+">??</button> : '')+
        </div>
      ;
    });
  }
  list.innerHTML = html;
  
  // Attach wave events
  document.querySelectorAll('.wave-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target.getAttribute('data-target');
      try {
        await apiFetch(`${API_BASE}/interact`, {
          method: 'POST',
          body: { targetUsername: target }
        });
        showToast('인사를 건넸습니다!', 'success');
      } catch (err) {}
    });
  });
}

function getClassColor(cls) {
  if (!cls) return '';
  if (cls.includes('Gopher') || cls.includes('Routine')) return 'go-badge';
  if (cls.includes('Ferris') || cls.includes('Borrow')) return 'rust-badge';
  if (cls.includes('Node')) return 'node-badge';
  if (cls.includes('Python')) return 'python-badge';
  if (cls.includes('Java')) return 'java-badge';
  return '';
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  
  try {
    await apiFetch(`${API_BASE}/chat`, {
      method: 'POST',
      body: { message }
    });
    input.value = '';
    fetchChat(); // Update immediately
  } catch (err) {}
});

// Hook into existing switch functions
const originalSwitchToDashboard = switchToDashboard;
switchToDashboard = function() {
  originalSwitchToDashboard();
  startTownSquare();
};

const originalSwitchToAuth = switchToAuth;
switchToAuth = function() {
  originalSwitchToAuth();
  stopTownSquare();
};


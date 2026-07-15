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
    showToast(`${state.character.name} 모험가님, 접속을 환영합니다!`, 'success');
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
    showToast('로그인 성공!', 'success');
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
    showToast('비회원 계정으로 새로운 모험이 시작되었습니다!', 'success');
    switchToDashboard();
  } catch (err) {
    // Handled by apiFetch toast
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  try {
    await apiFetch(`${API_BASE}/logout`, { method: 'POST' });
    showToast('안전하게 로그아웃 되었습니다.', 'info');
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
      showToast('성공적으로 계정이 연동되었습니다! 이제부터 이 ID로 로그인할 수 있습니다.', 'success');
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
    GopherWarrior: '고퍼 전사 (Go)',
    RoutineMage: '고루틴 마법사 (Go)',
    FerrisKnight: '페리스 기사 (Rust)',
    BorrowCheckerRogue: '빌림 검사기 도적 (Rust)',
    NodeNinja: '이벤트 루프 닌자 (Node)',
    NodeSummoner: '콜백 소환사 (Node)',
    PythonRanger: '들여쓰기 궁수 (Python)',
    PythonBerserker: 'GIL 광전사 (Python)',
    JavaKnight: '팩토리 기사 (Java)',
    JavaCleric: 'GC 사제 (Java)'
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
    potion: { name: '체력 물약', icon: '🧪' },
    sword: { name: 'Go Compiler Blade', icon: '🗡️' },
    staff: { name: 'Routine Channel Wand', icon: '🔮' },
    armor: { name: 'Rust Safe Shield', icon: '🛡️' },
    ring: { name: 'Ownership Ring', icon: '💍' }
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
      const placeholderIcons = { weapon: '⚔️', armor: '🛡️', ring: '💍' };
      eqElement.querySelector('.eq-icon').innerText = placeholderIcons[slot];
      eqElement.querySelector('.eq-name').innerText = '비어있음';
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
      slot.title = itemKey === 'potion' ? `${itemTitle} (클릭 시 복용)` : `${itemTitle} (클릭 시 장착)`;
      
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
      quest1: '의뢰: 간단한 버그 픽스',
      quest2: '의뢰: 레거시 리팩토링',
      quest3: '의뢰: 코어 피처 개발',
      quest4: '의뢰: DB 마이그레이션'
    };
    document.getElementById('active-quest-name').innerText = questNames[char.questState.questId] || '모험 의뢰';
    
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
      timerText.innerText = '의뢰 완료! 보고 중...';
      progressBarFill.style.width = '100%';
      
      // Auto complete on backend
      completeQuest();
    } else {
      const secondsLeft = (timeRemaining / 1000).toFixed(1);
      timerText.innerText = `남은 시간: ${secondsLeft}초`;
      
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
    showToast('의뢰가 무사히 완료되었습니다!', 'success');
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
        showToast('아이템 구매 성공!', 'success');
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
    showToast('관리자 로그아웃 되었습니다.', 'info');
    switchToAuth();
  } catch (err) {
    switchToAuth();
  }
});

document.getElementById('start-war-btn')?.addEventListener('click', async () => {
  try {
    const btn = document.getElementById('start-war-btn');
    btn.disabled = true;
    btn.innerText = '전쟁 진행 중...';
    
    const data = await apiFetch(`${API_BASE}/admin/war`, { method: 'POST' });
    
    btn.disabled = false;
    btn.innerText = '진영전 개시 (Start Faction War)';
    
    const resultsDiv = document.getElementById('war-results');
    const resultsList = document.getElementById('war-results-list');
    resultsDiv.style.display = 'block';
    
    let html = `<li><strong style="color: var(--gold);">👑 우승 진영: ${data.winner}</strong></li>`;
    html += `<li>전체 점수 현황:</li>`;
    
    Object.entries(data.scores).sort((a,b) => b[1] - a[1]).forEach(([faction, score]) => {
      html += `<li>- ${faction}: ${score} 점</li>`;
    });
    
    resultsList.innerHTML = html;
    showToast('진영전이 완료되었습니다!', 'success');
  } catch (err) {
    document.getElementById('start-war-btn').disabled = false;
    document.getElementById('start-war-btn').innerText = '진영전 개시 (Start Faction War)';
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
      showToast('물약을 사용하여 회복했습니다!', 'success');
    } else if (action === 'equip') {
      showToast('장비를 장착했습니다.', 'success');
    } else if (action === 'unequip') {
      showToast('장비를 장착 해제했습니다.', 'info');
    }
  } catch (err) {
    // Handle error
  }
}

// Initialize on page load
checkSession();


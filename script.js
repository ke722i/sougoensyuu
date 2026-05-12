let currentUser = null;
let currentUserIcon = "icon1";
let selectedIcon = "icon1";
let currentDebateId = null;
let gameData = { theme: '', stance: '', turn: 5, maxTurn: 5, isWaiting: false };
let modalCallback = null;

const backgrounds = {
  'signup-screen': 'url("back_png/back_01.jpg")',
  'login-screen': 'url("back_png/back_01.jpg")',
  'theme-screen': 'url("back_png/back_02.jpg")',
  'stanceScreen': 'url("back_png/back_02.jpg")',
  'gameScreen': 'url("back_png/back_03.jpg")',
  'resultScreen': 'url("back_png/back_04.jpg")',
  'ranking-screen': 'url("back_png/back_02.jpg")',
  'history-screen': 'url("back_png/back_02.jpg")'
};

/* =========================================
   アイコン画像設定
   ここに画像パスを入力してください
========================================= */

const iconData = {

  icon1: {
    menu: "icon_png/01_hiyoko.png", // ←右上アイコン画像
    character: "icon_png/02_hiyoko.png" // ←チャット画面画像
  },

  icon2: {
    menu: "icon_png/03_risu.png",
    character: "icon_png/04_risu.png"
  },

  icon3: {
    menu: "icon_png/05_pengin.png",
    character: "icon_png/06_pengin.png"
  },

  icon4: {
    menu: "icon_png/07_gorira.png",
    character: "icon_png/08_gorira.png"
  },

  icon5: {
    menu: "icon_png/09_ma-motto.png",
    character: "icon_png/10_ma-motto.png"
  }

};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (!target) return;
  target.classList.add('active');

  const menu = document.getElementById('user-menu');
  if (menu) menu.style.display = 'none';

  if (id === 'login-screen' || id === 'signup-screen') updateUserIDDisplay(null);

  if (backgrounds[id]) {
    const wrapper = document.querySelector('.game-wrapper');
    if (wrapper) wrapper.style.backgroundImage = backgrounds[id];
  }
}

function updateUserIDDisplay(userId) {

  const badge = document.getElementById('user-display');
  const menuId = document.getElementById('menu-user-id');

  // 右上アイコン
  const userIcon = document.getElementById('headerUserIcon');

  if (userId) {

    if (badge) badge.style.display = 'flex';

    if (menuId) {
      menuId.innerText = `${userId} さん`;
    }

    // アイコン変更
    if (userIcon && iconData[currentUserIcon]) {
      userIcon.src = iconData[currentUserIcon].menu;
    }

  } else {

    if (badge) {
      badge.style.display = 'none';
    }

    // アイコンをリセット
    if (userIcon) {
      userIcon.src = "";
    }
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function showNotification(message, color = '#4caf50') {
  const banner = document.getElementById('notification-banner');
  if (!banner) return;
  banner.innerText = message;
  banner.style.backgroundColor = color;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 3000);
}

async function handleSignup() {
  const username = document.getElementById('signupId')?.value.trim() || '';
  const password = document.getElementById('signupPw')?.value || '';
  if (!username || !password) {
    showNotification('ユーザーIDとパスワードを入力してください', '#e95464');
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        icon: selectedIcon
      })
    });
    const data = await res.json();
    console.log(data.user);
    if (!res.ok) {
      showNotification(data.error || '新規登録に失敗しました', '#e95464');
      return;
    }
    currentUser = username;
    currentUserIcon = selectedIcon;
    updateUserIDDisplay(currentUser);
    showScreen('theme-screen');
    showNotification('新規登録が完了しました');
  } catch {
    showNotification('サーバー接続に失敗しました', '#e95464');
  }
}

async function handleLogin() {
  const username = document.getElementById('loginId')?.value.trim() || '';
  const password = document.getElementById('loginPw')?.value || '';
  if (!username || !password) {
    showNotification('ユーザーIDとパスワードを入力してください', '#e95464');
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showNotification(data.error || 'ログインに失敗しました', '#e95464');
      return;
    }
    currentUser = data.user?.username || username;
    currentUserIcon = data.user?.icon || "icon1";
    updateUserIDDisplay(currentUser);
    showScreen('theme-screen');
    showNotification('ログインしました');
  } catch {
    showNotification('サーバー接続に失敗しました', '#e95464');
  }
}

function logout() {

  currentUser = null;
  currentDebateId = null;

  // アイコン状態も初期化
  currentUserIcon = "icon1";

  updateUserIDDisplay(null);

  showScreen('login-screen');
}

function updateTurnDisplay() {
  const el = document.getElementById('turnText');
  if (el) el.innerText = `残りターン: ${gameData.turn}`;
}

function addMessage(type, text) {
  const chat = document.getElementById('chat');
  if (!chat) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${type}`;

  const nameEl = document.createElement('small');
  nameEl.style.display = 'block';
  nameEl.style.opacity = '0.6';
  nameEl.style.marginBottom = '4px';
  nameEl.textContent = type === 'user' ? 'あなた' : 'AI';
  msgDiv.appendChild(nameEl);

  const bodyEl = document.createElement('div');
  bodyEl.style.whiteSpace = 'pre-wrap';
  bodyEl.textContent = String(text ?? '');
  msgDiv.appendChild(bodyEl);

  chat.appendChild(msgDiv);
  chat.scrollTop = chat.scrollHeight;
}

function showStance(id) {
  const data = {
    ai1: { title: 'AIは人間の知能を超える？', options: ['超える', '超えない'] },
    ai2: { title: 'AIと人間、どちらが信頼できる？', options: ['AI', '人間'] },
    ai3: { title: 'AIで人間は幸せになる？', options: ['幸せになる', '幸せにならない'] },
    life1: { title: '安定した人生を選ぶべき？', options: ['選ぶべき', '挑戦すべき'] },
    life2: { title: 'お金は人生で最も重要？', options: ['重要', '重要ではない'] },
    life3: { title: '努力と才能、どちらが重要？', options: ['努力', '才能'] },
    human1: { title: '正直であることは常に正しい？', options: ['正しい', '場合による'] },
    human2: { title: '他人を完全に理解できる？', options: ['できる', 'できない'] },
    human3: { title: '恋愛と友情、大事なのは？', options: ['恋愛', '友情'] }
  };

  const selected = data[id];
  if (!selected) return;
  gameData.theme = selected.title;
  const title = document.getElementById('themeTitle');
  if (title) title.innerText = selected.title;

  const container = document.getElementById('stanceButtons');
  if (!container) return;
  container.innerHTML = '';
  selected.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.innerText = opt;
    btn.onclick = () => startGame(opt);
    container.appendChild(btn);
  });
  showScreen('stanceScreen');
}

function startCustomTheme() {
  const theme = document.getElementById('customThemeInput')?.value.trim() || '';
  if (!theme) {
    alert('テーマを入力してください');
    return;
  }
  gameData.theme = theme;
  startGame('自由入力');
}

async function startGame(stance) {
  gameData.stance = stance;
  gameData.turn = gameData.maxTurn;
  gameData.isWaiting = false;

  const themeText = document.getElementById('themeText');
  if (themeText) themeText.innerText = `テーマ: ${gameData.theme}`;
  updateTurnDisplay();

  const chat = document.getElementById('chat');
  if (chat) chat.innerHTML = '';

  const input = document.getElementById('userInput');
  if (input) {
    input.disabled = false;
    input.placeholder = 'メッセージを入力...';
  }

  showScreen('gameScreen');

  // ユーザーキャラ画像変更
  const userImg = document.getElementById('userImg');

  if (userImg && iconData[currentUserIcon]) {
    userImg.src = iconData[currentUserIcon].character;
  }

  if (!currentUser) {
    addMessage('ai', '先にログインしてください。');
    return;
  }

  try {
    const res = await fetch('/api/debate/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, theme: gameData.theme, stance })
    });
    const data = await res.json();
    if (!res.ok) {
      addMessage('ai', data.error || '討論開始に失敗しました。');
      return;
    }
    currentDebateId = data.debate?.id || null;
    addMessage('ai', data.aiReply || '討論を開始します。');
  } catch {
    addMessage('ai', 'サーバー接続に失敗しました。');
  }
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const userText = input?.value.trim() || '';

  if (!userText || gameData.isWaiting || gameData.turn <= 0) return;
  if (!currentDebateId) {
    addMessage('ai', '討論セッションが未開始です。もう一度開始してください。');
    return;
  }

  addMessage('user', userText);
  input.value = '';
  gameData.turn--;
  updateTurnDisplay();
  gameData.isWaiting = true;

  const chat = document.getElementById('chat');
  const loading = document.createElement('div');
  loading.className = 'message ai';
  loading.id = 'temp-loading';
  loading.innerHTML = "<small style='display:block; opacity:0.6; margin-bottom:4px;'>AI</small>思考中";
  if (chat) {
    chat.appendChild(loading);
    chat.scrollTop = chat.scrollHeight;
  }

  let dotCount = 0;
  const timer = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    const dots = '.'.repeat(dotCount);
    const el = document.getElementById('temp-loading');
    if (el) el.innerHTML = `<small style='display:block; opacity:0.6; margin-bottom:4px;'>AI</small>思考中${dots}`;
  }, 300);

  try {
    const res = await fetch('/api/debate/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debateId: currentDebateId, message: userText })
    });
    const data = await res.json();
    if (!res.ok) {
      addMessage('ai', data.error || 'AI応答の取得に失敗しました。');
    } else {
      addMessage('ai', data.aiReply || 'AI応答が空でした。');
    }
  } catch {
    addMessage('ai', 'サーバー接続に失敗しました。');
  } finally {
    clearInterval(timer);
    document.getElementById('temp-loading')?.remove();
    gameData.isWaiting = false;
  }

  if (gameData.turn <= 0) {
    if (input) {
      input.disabled = true;
      input.placeholder = '討論は終了しました';
    }
    setTimeout(() => {
      openModal('全ターンが終了しました。結果を表示しますか？', '結果を見る', '続ける', showResult);
    }, 400);
  }
}

async function showResult() {
  showScreen('resultScreen');
  const scoreText = document.getElementById('scoreText');
  const commentText = document.getElementById('commentText');
  if (scoreText) scoreText.innerText = '--点';
  if (commentText) commentText.innerText = '結果取得中...';

  if (!currentDebateId) {
    if (commentText) commentText.innerText = '討論セッションが見つかりません。';
    return;
  }

  try {
    const res = await fetch('/api/debate/end', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debateId: currentDebateId })
    });
    const data = await res.json();
    if (!res.ok) {
      if (commentText) commentText.innerText = data.error || '結果取得に失敗しました。';
      return;
    }

    if (scoreText) {
      const score = data.debate?.score ?? 0;
      scoreText.innerText = `${score}点`;

      // ★ 勝敗表示
      const outcomeEl = document.getElementById('resultOutcome');

      if (outcomeEl) {

        // 初期化
        outcomeEl.className = 'result-outcome';

        if (score <= 49) {
          outcomeEl.innerText = '敗北...';
          outcomeEl.classList.add('result-lose');
        } else if (score === 50) {
          outcomeEl.innerText = '引き分け';
          outcomeEl.classList.add('result-draw');
        } else {
          outcomeEl.innerText = '勝利！';
          outcomeEl.classList.add('result-win');
        }

      } else {
        console.log("resultOutcomeが見つからない");
      }
    }

    if (commentText) commentText.innerText = data.debate?.summary || '講評はありません。';
    currentDebateId = null;
  } catch {
    if (commentText) commentText.innerText = 'サーバー接続に失敗しました。';
  }
}

async function showHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (!currentUser) {
    showNotification('先にログインしてください', '#e95464');
    return;
  }

  list.innerHTML = "<p style='text-align:center;'>履歴を読み込み中...</p>";
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(currentUser)}/debates`);
    const data = await res.json();
    if (!res.ok) {
      list.innerHTML = `<p style='text-align:center;color:#e95464;'>${data.error || '履歴取得に失敗しました'}</p>`;
      showScreen('history-screen');
      return;
    }

    const debates = Array.isArray(data.debates) ? data.debates : [];

    /* =========================
      プロフィール表示更新
    ========================= */

    // ユーザー名
    document.getElementById('mypageUserId').innerText =
      currentUser + "さん";

    // アイコン
    if (iconData[currentUserIcon]) {

      document.getElementById('mypageIcon').src =
        iconData[currentUserIcon].menu;
    }

    function changeUserName() {

      const newName = prompt("新しいIDを入力してください");
      if (!newName) return;
      currentUser = newName;
      updateUserIDDisplay(currentUser);
      document.getElementById('mypageUserId').innerText =
        currentUser;
      showNotification("IDを変更しました");
    }

    function changeUserIcon() {
      const icons = ["icon1", "icon2", "icon3", "icon4", "icon5"];
      let currentIndex = icons.indexOf(currentUserIcon);
      currentIndex++;
      if (currentIndex >= icons.length) {
        currentIndex = 0;
      }

      currentUserIcon = icons[currentIndex];
      // 右上更新
      updateUserIDDisplay(currentUser);
      // マイページ更新
      document.getElementById('mypageIcon').src =
        iconData[currentUserIcon].menu;
      showNotification("アイコンを変更しました");
    }

    if (debates.length === 0) {
      list.innerHTML = "<p style='text-align:center;'>履歴はまだありません</p>";
      showScreen('history-screen');
      return;
    }

    list.innerHTML = '';
    debates.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const dt = item.date_time ? new Date(item.date_time).toLocaleString() : '-';
      div.innerHTML = `<small style=\"color:#666;\">${dt}</small><br><strong>${item.theme || '-'}</strong><br>状態: ${item.status || '-'} / スコア: <span style=\"color:#e95464;\">${item.score ?? '-'}点</span> / MBTI: ${item.mbti || '-'}`;
      div.onclick = async () => {
        try {
          const r = await fetch(`/api/debates/${item.id}/messages`);
          const d = await r.json();
          if (!r.ok) {
            openModal(d.error || 'チャット履歴取得に失敗しました', '閉じる', '戻る', null);
            document.getElementById('modalCancel').style.display = 'none';
            return;
          }
          const lines = (d.messages || []).map((m) => m.content).join('\n');
          openModal(lines || 'チャット履歴はありません。', '閉じる', '戻る', null);
          document.getElementById('modalCancel').style.display = 'none';
        } catch {
          openModal('チャット履歴取得に失敗しました', '閉じる', '戻る', null);
          document.getElementById('modalCancel').style.display = 'none';
        }
      };
      list.appendChild(div);
    });
    showScreen('history-screen');
  } catch {
    list.innerHTML = "<p style='text-align:center;color:#e95464;'>サーバー接続に失敗しました</p>";
    showScreen('history-screen');
  }
}

function showRanking() {
  showScreen('ranking-screen');
  updateRankingList();
}

async function updateRankingList() {
  const periodSelect = document.getElementById('rankingPeriod');
  const list = document.getElementById('rankingList');
  if (!periodSelect || !list) return;

  const period = periodSelect.value;
  list.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>読み込み中...</p>";
  try {
    const res = await fetch(`/api/ranking?period=${encodeURIComponent(period)}`);
    const data = await res.json();
    if (!res.ok) {
      list.innerHTML = `<p style='text-align:center; color:#e95464; margin-top:20px;'>${data.error || 'ランキング取得に失敗しました'}</p>`;
      return;
    }

    const rows = Array.isArray(data.ranking) ? data.ranking : [];
    if (rows.length === 0) {
      list.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>データがありません</p>";
      return;
    }

    list.innerHTML = '';
    rows.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '10px';
      row.innerHTML = `<div style=\"display:flex;align-items:center;gap:10px;\"><span style=\"font-weight:bold;width:25px;color:#e95464;\">${index + 1}</span><img src=\"icon_png/01_hiyoko.png\" style=\"width:30px;height:30px;border-radius:50%;\"><div><div style=\"font-weight:bold;font-size:0.9rem;\">${item.name}</div><div style=\"font-size:0.75rem;color:#888;\">${item.theme}</div></div></div><div style=\"font-weight:bold;color:#4caf50;\">${item.score} pt</div>`;
      list.appendChild(row);
    });
  } catch {
    list.innerHTML = "<p style='text-align:center; color:#e95464; margin-top:20px;'>サーバー接続に失敗しました</p>";
  }
}

function openModal(msg, confirmText, cancelText, cb) {
  const modal = document.getElementById('customModal');
  const msgElem = document.getElementById('modalMessage');
  const confirmBtn = document.getElementById('modalConfirm');
  const cancelBtn = document.getElementById('modalCancel');
  if (!modal || !msgElem) return;

  msgElem.innerText = msg;
  confirmBtn.innerText = confirmText;
  cancelBtn.innerText = cancelText;
  cancelBtn.style.display = 'inline-block';

  modalCallback = cb;
  confirmBtn.onclick = () => {
    if (modalCallback) modalCallback();
    closeModal();
  };
  cancelBtn.onclick = closeModal;
  modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('customModal');
  if (modal) modal.style.display = 'none';
}

function handleResultButton() {
  if (gameData.turn > 0) {
    openModal('議論を中断して結果を表示しますか？', '結果を見る', '戻る', showResult);
  } else {
    showResult();
  }
}

function backToTitle() {
  openModal('中断してテーマ選択に戻りますか？', '中断する', '続ける', () => showScreen('theme-screen'));
}

document.addEventListener('DOMContentLoaded', () => {
  showScreen('login-screen');

  const userInput = document.getElementById('userInput');
  if (userInput) {
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  const loginPw = document.getElementById('loginPw');
  if (loginPw) {
    loginPw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }
});

window.onclick = function (event) {
  const badge = document.getElementById('user-display');
  const menu = document.getElementById('user-menu');
  if (badge && !badge.contains(event.target)) {
    if (menu) menu.style.display = 'none';
  }
};

function selectIcon(element) {

  // 選択状態を全部解除
  document.querySelectorAll('.selectable-icon').forEach((icon) => {
    icon.classList.remove('selected');
  });

  // 押したものを選択状態に
  element.classList.add('selected');

  // data-icon を保存
  selectedIcon = element.dataset.icon;
}

async function changeUserName() {

  const newName = prompt("新しいユーザーIDを入力してください");

  if (!newName) return;

  try {

    const res = await fetch('/api/user/change-name', {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        oldName: currentUser,
        newName: newName
      })
    });

    const data = await res.json();

    if (!res.ok) {

      showNotification(
        data.error || "ID変更に失敗しました",
        "#e95464"
      );

      return;
    }

    currentUser = newName;

    // 右上更新
    updateUserIDDisplay(currentUser);

    // マイページ更新
    document.getElementById('mypageUserId').innerText =
      currentUser;

    showNotification("IDを変更しました");

  } catch {

    showNotification(
      "サーバー接続に失敗しました",
      "#e95464"
    );
  }
}

async function changeUserIcon() {

  const icons = [
    "icon1",
    "icon2",
    "icon3",
    "icon4",
    "icon5"
  ];

  let currentIndex =
    icons.indexOf(currentUserIcon);

  currentIndex++;

  if (currentIndex >= icons.length) {

    currentIndex = 0;
  }

  const newIcon = icons[currentIndex];

  try {

    const res = await fetch('/api/user/change-icon', {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        username: currentUser,
        icon: newIcon
      })
    });

    const data = await res.json();

    if (!res.ok) {

      showNotification(
        data.error || "アイコン変更に失敗しました",
        "#e95464"
      );

      return;
    }

    currentUserIcon = newIcon;

    // 右上更新
    updateUserIDDisplay(currentUser);

    // マイページ更新
    document.getElementById('mypageIcon').src =
      iconData[currentUserIcon].menu;

    showNotification("アイコンを変更しました");

  } catch {

    showNotification(
      "サーバー接続に失敗しました",
      "#e95464"
    );
  }
}
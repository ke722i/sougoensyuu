let currentUser = null;
let currentUserIcon = "icon1";
let selectedIcon = "icon1";
let currentDebateId = null;
let gameData = { theme: '', stance: '', turn: 5, maxTurn: 5, isWaiting: false };
let modalCallback = null;
let screenHistory = [];
let previousScreen = null;

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
  const current = document.querySelector('.screen.active')?.id;

  if (current && current !== id) {
    previousScreen = current;
  }

  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));

  const target = document.getElementById(id);
  if (!target) return;

  target.classList.add('active');

  const menu = document.getElementById('user-menu');
  if (menu) menu.style.display = 'none';

  if (backgrounds[id]) {
    document.querySelector('.game-wrapper').style.backgroundImage = backgrounds[id];
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
    document.getElementById('rankingBtn').style.display = 'flex';
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
    document.getElementById('rankingBtn').style.display = 'flex';
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

  const rankingBtn = document.getElementById('rankingBtn');
  if (rankingBtn) rankingBtn.style.display = 'none';

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

  // --- 追加：難易度の取得 ---
  const difficultyElement = document.querySelector('input[name="difficulty"]:checked');
  const difficulty = difficultyElement ? difficultyElement.value : '中';
  // -----------------------

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
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: currentUser, 
        theme: gameData.theme, 
        stance,
        difficulty: difficulty // ★ ここに difficulty を追加！
      })
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

async function handleStartBattle() {
  const currentUsername = localStorage.getItem('username'); // 保存されているユーザー名
  const selectedTheme = document.getElementById('themeTitle').innerText;
  
  // 立場（ボタンの選択状態などから取得）
  const selectedStance = document.querySelector('.stance-btn.active')?.innerText || "未選択";

  // --- ここで難易度を取得 ---
  const difficultyElement = document.querySelector('input[name="difficulty"]:checked');
  const difficulty = difficultyElement ? difficultyElement.value : "中"; 

  // サーバーへ送信
  try {
    const response = await fetch('/api/debate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUsername,
        theme: selectedTheme,
        stance: selectedStance,
        difficulty: difficulty // 難易度を送信！
      })
    });

    const data = await response.json();
    if (response.ok) {
      // 画面を対戦画面に切り替える処理など
      console.log("討論開始！ ID:", data.debate.id);
      showScreen('debate-screen'); 
    } else {
      alert("エラー: " + data.error);
    }
  } catch (error) {
    console.error("通信エラー:", error);
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
  const outcomeE1 = document.getElementById('resultOutcome');

  if (scoreText) scoreText.innerText = '--点';
  if (commentText) commentText.innerText = '結果取得中...';
  if (outcomeE1) {
    outcomeE1.innerText = '';
    outcomeE1.className = 'result-outcome';
  }
  
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
      プロフィール表示更新 (追加・修正)
    ========================= */

    // ユーザー名
    document.getElementById('mypageUserId').innerText = currentUser + "さん";

    // アイコン
    if (iconData[currentUserIcon]) {
      document.getElementById('mypageIcon').src = iconData[currentUserIcon].menu;
    }

    // --- 【追加】統計（平均スコアとMBTI）の計算と反映 ---
    if (debates.length > 0) {
      // 1. 平均スコアの計算 (nullやundefinedを除外して計算)
      const validScores = debates.filter(d => d.score !== null && d.score !== undefined);
      const totalScore = validScores.reduce((sum, item) => sum + Number(item.score), 0);
      const avgScore = validScores.length > 0 ? Math.round(totalScore / validScores.length) : 0;
      
      // 2. 最新のMBTIを取得 (配列の最初が最新と想定)
      const latestMbti = debates[0].mbti || "---";

      // 3. 画面に反映
      document.getElementById('mypageAverage').innerText = avgScore;
      document.getElementById('mypageMbti').innerText = latestMbti;
    } else {
      // 履歴がない場合はリセット
      document.getElementById('mypageAverage').innerText = "0";
      document.getElementById('mypageMbti').innerText = "---";
    }
    // ----------------------------------------------

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
      div.innerHTML = `<small style="color:#666;">${dt}</small><br><strong>${item.theme || '-'}</strong><br>状態: ${item.status || '-'} / スコア: <span style="color:#e95464;">${item.score ?? '-'}点</span> / MBTI: ${item.mbti || '-'}`;
      
      div.onclick = async () => {
        try {
          const r = await fetch(`/api/debates/${item.id}/messages`);
          const d = await r.json();
          if (!r.ok) {
            openModal(d.error || 'チャット履歴取得に失敗しました', '閉じる', '戻る', null);
            document.getElementById('modalCancel').style.display = 'none';
            return;
          }
          const modal = document.getElementById('customModal');
          const content = document.querySelector('.modal-content');
          const msgElem = document.getElementById('modalMessage');

          content.classList.add('chat-log-modal');

          console.log(d.messages);
          const messages = (d.messages || []).map((m) => {

            const text = String(m.content || "");

            // ★ここが重要：contentから判定する
            const isUser =
              text.startsWith("USER:") ||
              text.startsWith("User:") ||
              text.startsWith("あなた:");

            const type = isUser ? "user" : "ai";

            // 表示用にラベルを消す
            const cleanText = text
              .replace(/^USER:\s*/i, "")
              .replace(/^AI:\s*/i, "");

            const name = type === "user" ? "あなた" : "AI";

            return `
              <div class="chat-log-message ${type}">
                <div class="chat-log-name">${name}</div>
                <div class="chat-log-text">${cleanText}</div>
              </div>
            `;
          }).join('');

          openModal(`
            <div class="chat-log-container">
              ${messages || 'チャット履歴はありません。'}
            </div>
          `, '閉じる', '戻る', null);

          document.getElementById('modalCancel').style.display = 'none';
        } catch {
          openModal('チャット履歴取得に失敗しました', '閉じる', '戻る', null);
          document.getElementById('modalCancel').style.display = 'none';
        }
      };
      list.appendChild(div);
    });
    
    showScreen('history-screen');
  } catch (e) {
    console.error(e);
    list.innerHTML = "<p style='text-align:center;color:#e95464;'>サーバー接続に失敗しました</p>";
    showScreen('history-screen');
  }
}

let currentDiff = 'easy'; // 現在選択されている難易度を保存
let cachedRankingData = null; // サーバーデータを保存

// ランキング表示
async function showRanking() {
    showScreen('ranking-screen');
    await updateRankingList(true); // 画面を開くときはサーバーから取得
}

// 難易度ボタンが押された時の動作
function changeDiffTab(diff) {
    currentDiff = diff; // 選択された難易度（easy/normal/hard）を保存
    
    // 全ボタンから active クラスを消し、押されたボタンだけに付ける
    document.querySelectorAll('.diff-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${diff}'`)) {
            btn.classList.add('active');
        }
    });

    // タイトルの更新
    const titleElem = document.getElementById('currentRankTitle');
    const titles = { easy: ' 弱モード', normal: ' 中モード', hard: ' 強モード' };
    if (titleElem) {
        titleElem.innerText = `${titles[diff]}ランキング`;
        titleElem.className = `rank-title rank-${diff}`;
    }

    // 表示を更新
    updateRankingList(false);
}

// データの取得と反映
async function updateRankingList(forceFetch = false) {
    try {
        if (!cachedRankingData || forceFetch) {
            const res = await fetch('/api/ranking');
            cachedRankingData = await res.json();
        }

        // HTMLから選択中の「期間」を取得
        const period = document.getElementById('rankingPeriod').value;
        
        // 選択中の「難易度」と「期間」でデータを抽出
        const list = cachedRankingData[currentDiff][period];
        
        // メインテーブルに描画
        renderTable('rankingTableMain', list);

    } catch (error) {
        console.error("ランキング更新失敗:", error);
    }
}

function renderTable(tableId, list) {
    const container = document.getElementById(tableId);
    if (!container) return;
    
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="color:gray; text-align:center; padding:20px;">記録がありません</p>';
        return;
    }

    const iconMap = {
        'icon1': '01_hiyoko.png',
        'icon2': '03_risu.png',
        'icon3': '05_pengin.png',
        'icon4': '07_gorira.png',
        'icon5': '09_ma-motto.png'
    };

    container.innerHTML = list.slice(0, 10).map((item, index) => {
        const iconFile = iconMap[item.icon] || '01_hiyoko.png';
        const cleanTheme = item.theme.replace(/\[.*?\]/g, '').trim();

        return `
        <div class="rank-user-card">
            <div class="rank-badge">${index + 1}</div>
            <img src="icon_png/${iconFile}" class="rank-avatar">
            <div class="rank-info">
                <div class="rank-top-row">
                    <span class="rank-username">${item.name}</span>
                    <span class="rank-user-mbti">${item.mbti}</span>
                </div>
                <div class="rank-theme-name">${cleanTheme}</div>
            </div>
            <div class="rank-score-box">
                <span class="rank-score-val">${item.sum_score}</span>
                <span class="rank-score-unit">点</span>
            </div>
        </div>
        `;
    }).join('');
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

  const content = document.querySelector('.modal-content');

  if (content) {
    content.classList.remove('chat-log-modal');
  }

  if (modal) {
    modal.style.display = 'none';
  }
}

function goBack() {
  if (previousScreen) {
    showScreen(previousScreen);
    previousScreen = null;
  } else {
    showScreen('theme-screen');
  }
}

function handleResultButton() {
  if (gameData.turn > 0) {
    openModal('議論を中断して結果を表示しますか？', '結果を見る', '戻る', showResult);
  } else {
    showResult();
  }
}

function backToTitle() {
  openModal('前の画面に戻りますか？', '戻る', 'キャンセル', goBack);
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

async function updatePlayerStats(username) {
    try {
        const response = await fetch(`/api/user/stats/${username}`);
        const data = await response.json();

        // HTMLの要素（画像3枚目の右側パネル）を書き換える
        // 推定MBTIの表示場所 (例: id="estimatedMbti")
        const mbtiElement = document.getElementById('estimatedMbti');
        if (mbtiElement) {
            mbtiElement.innerText = data.estimatedMbti;
            mbtiElement.style.color = "#ff4d6d"; // 強調色
        }

        // 平均スコアの表示場所 (例: id="averageScore")
        const scoreElement = document.getElementById('averageScore');
        if (scoreElement) {
            scoreElement.innerText = `${data.avgScore} 点`;
        }
    } catch (error) {
        console.error("ステータスの更新に失敗しました", error);
    }
}

// 履歴画面を表示する関数の中で呼び出す
async function loadDashboard(username) {
    try {
        const response = await fetch(`/api/user/stats/${username}`);
        const data = await response.json();

        // 取得したデータを画面に反映
        document.getElementById('estimatedMbti').innerText = data.estimatedMbti;
        document.getElementById('averageScore').innerText = `${data.avgScore} 点`;
        
        // その後、既存の履歴一覧（画像3枚目の左側）をロードする処理を続ける...
    } catch (error) {
        console.error("統計データのロード失敗:", error);
    }
}

async function refreshStats() {
    // ローカルストレージなどからログイン中のユーザー名を取得
    const username = localStorage.getItem('username'); 
    if (!username) return;

    try {
        const response = await fetch(`/api/user/stats/${username}`);
        const data = await response.json();

        // HTML側のID「mypageMbti」を書き換える
        const mbtiElem = document.getElementById('mypageMbti');
        if (mbtiElem) mbtiElem.innerText = data.estimatedMbti;

        // HTML側のID「mypageAverage」を書き換える
        const avgElem = document.getElementById('mypageAverage');
        if (avgElem) avgElem.innerText = data.avgScore;
        
        console.log("統計データを更新しました:", data);
    } catch (error) {
        console.error("統計データの反映に失敗しました:", error);
    }
}

// サーバーから取得したデータをHTMLに反映させる処理
async function updateMyPageStats(username) {
  try {
    const response = await fetch(`/api/user/stats/${username}`);
    const data = await response.json();

    // HTMLの id="mypageMbti" に値をセット
    const mbtiElement = document.getElementById('mypageMbti');
    if (mbtiElement) {
      mbtiElement.innerText = data.estimatedMbti; 
    }

    // HTMLの id="mypageAverage" に値をセット
    const avgElement = document.getElementById('mypageAverage');
    if (avgElement) {
      avgElement.innerText = data.avgScore;
    }
  } catch (error) {
    console.error("マイページ統計の取得に失敗しました:", error);
  }
}
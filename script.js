/* ==========================================================================
   ゲームデータ・初期設定
   ========================================================================== */
let gameData = { 
    theme: "", 
    stance: "", 
    turn: 5, 
    maxTurn: 5, 
    isWaiting: false 
};
let modalCallback = null;

const aiReplies = [
    "その意見は興味深いですが、別の視点もあります。",
    "なるほど。しかし、客観的なデータに基づくとどうでしょうか？",
    "論理的には理解できますが、感情面での配慮が欠けていませんか？",
    "非常に鋭い指摘ですね。認めざるを得ません。",
    "それは一般論に過ぎないのではないでしょうか？",
    "もっと具体的な事例を挙げて説明してください。"
];

const backgrounds = {
    'signup-screen': 'url("back_png/back_01.jpg")',
    'login-screen': 'url("back_png/back_01.jpg")',
    'theme-screen': 'url("back_png/back_02.jpg")',
    'stanceScreen': 'url("back_png/back_02.jpg")',
    'gameScreen':   'url("back_png/back_03.jpg")',
    'resultScreen': 'url("back_png/back_04.jpg")',
    'ranking-screen': 'url("back_png/back_02.jpg")',
    'history-screen': 'url("back_png/back_02.jpg")'
};

// 1. デモデータの作成
function initDemoHistory() {
    if (!localStorage.getItem("debateHistory")) {
        const demoData = [
            { date: "2026/04/25 14:20", theme: "AIは人間の知能を超える？", stance: "超える", score: 85, detail: "AIの進化速度と計算能力に基づいた論理的な主張を展開しました。" },
            { date: "2026/04/26 10:05", theme: "努力と才能、どちらが重要？", stance: "努力", score: 92, detail: "継続的な努力が才能を凌駕する具体例を挙げ、AIを納得させました。" }
        ];
        localStorage.setItem("debateHistory", JSON.stringify(demoData));
    }
}
initDemoHistory();

/* ==========================================================================
   画面制御・表示ロジック
   ========================================================================== */
function showScreen(id) {
    const screens = document.querySelectorAll(".screen");
    screens.forEach(s => s.classList.remove("active"));

    const targetScreen = document.getElementById(id);
    if (!targetScreen) {
        console.error("指定されたスクリーンIDが見つかりません:", id);
        return;
    }
    targetScreen.classList.add("active");

    // メニューを閉じる
    const menu = document.getElementById("user-menu");
    if (menu) menu.style.display = "none";

    // ログイン・登録画面に戻った時はIDバッジを隠す
    if (id === 'login-screen' || id === 'signup-screen') {
        updateUserIDDisplay(null);
    }

    // 背景の切り替え
    if (backgrounds[id]) {
        const wrapper = document.querySelector('.game-wrapper');
        if (wrapper) {
            wrapper.style.backgroundImage = backgrounds[id];
        }
    }
}

function updateUserIDDisplay(userId) {
    const badge = document.getElementById("user-display");
    const menuId = document.getElementById("menu-user-id");

    if (userId) {
        if (badge) badge.style.display = "flex"; 
        if (menuId) menuId.innerText = userId + " さん";
    } else {
        if (badge) badge.style.display = "none";
    }
}

function toggleUserMenu() {
    const menu = document.getElementById("user-menu");
    if (!menu) return;
    const isVisible = menu.style.display === "block";
    menu.style.display = isVisible ? "none" : "block";
}

/* ==========================================================================
   認証ロジック
   ========================================================================== */
function showNotification(message, color = "#4caf50") {
    const banner = document.getElementById("notification-banner");
    if (!banner) return;
    
    banner.innerText = message;
    banner.style.backgroundColor = color;
    banner.classList.add("show");

    setTimeout(() => {
        banner.classList.remove("show");
    }, 3000);
}

function handleLogin() {
    const loginInput = document.getElementById("loginId");
    const userId = loginInput ? loginInput.value.trim() : "";

    if (!userId) {
        showNotification("ユーザーIDを入力してください", "#e95464");
        return;
    }

    // 成功時
    updateUserIDDisplay(userId);
    showScreen('theme-screen');
    showNotification("ログインしました", "#4caf50");
}

function handleSignup() {
    const signupInput = document.getElementById("signupId");
    const userId = signupInput ? signupInput.value.trim() : "";

    if (!userId) {
        showNotification("ユーザーIDを入力してください", "#e95464");
        return;
    }

    showNotification("登録が完了しました！", "#4caf50");
    updateUserIDDisplay(userId);
    showScreen('theme-screen'); 
}

function logout() {
    showScreen('login-screen');
    updateUserIDDisplay(null);
}

/* ==========================================================================
   メインゲーム処理
   ========================================================================== */
function startGame(stance) {
    gameData.stance = stance;
    gameData.turn = gameData.maxTurn;
    gameData.isWaiting = false;

    const themeText = document.getElementById("themeText");
    if (themeText) themeText.innerText = `テーマ: ${gameData.theme}`;
    
    updateTurnDisplay();
    const chat = document.getElementById("chat");
    if (chat) chat.innerHTML = "";
    
    addMessage("ai", `議論を開始しましょう。テーマは「${gameData.theme}」です。あなたの立場は「${stance}」ですね。`);
    
    const inputArea = document.getElementById("userInput");
    if (inputArea) {
        inputArea.disabled = false;
        inputArea.placeholder = "メッセージを入力...";
    }
    showScreen("gameScreen");
}

async function sendMessage() {
    const input = document.getElementById("userInput");
    const userText = input ? input.value.trim() : "";
    
    if (!userText || gameData.isWaiting || gameData.turn <= 0) return;

    addMessage("user", userText);
    input.value = "";
    gameData.turn--;
    updateTurnDisplay();
    gameData.isWaiting = true;

    const chat = document.getElementById("chat");
    const loading = document.createElement("div");
    loading.className = "message ai";
    loading.id = "temp-loading";
    loading.innerHTML = "思考中...";
    chat.appendChild(loading);
    chat.scrollTop = chat.scrollHeight;

    setTimeout(() => {
        const loadingElem = document.getElementById("temp-loading");
        if (loadingElem) loadingElem.remove();
        
        const randomReply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
        addMessage("ai", randomReply);
        gameData.isWaiting = false;

        if (gameData.turn <= 0) {
            if (input) {
                input.disabled = true;
                input.placeholder = "議論は終了しました";
            }
            setTimeout(() => {
                openModal("全ターンが終了しました。結果を確認しましょう！", "結果を見る", "チャット内容を見る", showResult);
            }, 600);
        }
    }, 1200);
}

function addMessage(type, text) {
    const chat = document.getElementById("chat");
    if (!chat) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${type}`;
    const name = (type === "user") ? "あなた" : "AI";
    msgDiv.innerHTML = `<small style="display:block; opacity:0.6; margin-bottom:4px;">${name}</small>${text}`;
    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;
}

function updateTurnDisplay() {
    const turnElement = document.getElementById("turnText");
    if (turnElement) {
        turnElement.innerText = `残りターン: ${gameData.turn}`;
    }
}

// 期間別のデモデータ
const demoRankings = {
    today: [
        { name: "User_01", theme: "AIは人間の知能を超える？", score: 98 },
        { name: "User_05", theme: "努力と才能、どちらが重要？", score: 92 },
        { name: "User_02", theme: "お金は人生で最も重要？", score: 85 },
    ],
    week: [
        { name: "King_Debater", theme: "AIと人間、どちらが信頼できる？", score: 99 },
        { name: "User_01", theme: "AIは人間の知能を超える？", score: 98 },
        { name: "LogicMaster", theme: "安定した人生を選ぶべき？", score: 95 },
        { name: "User_09", theme: "努力と才能、どちらが重要？", score: 88 }
    ],
    month: [
        { name: "Legend_AI", theme: "正直であることは常に正しい？", score: 100 },
        { name: "King_Debater", theme: "AIと人間、どちらが信頼できる？", score: 99 },
        { name: "User_01", theme: "AIは人間の知能を超える？", score: 98 },
    ]
};

// ランキング画面の表示
function showRanking() {
    showScreen('ranking-screen');
    updateRankingList(); 
}

// プルダウン変更時の更新処理
function updateRankingList() {
    const periodSelect = document.getElementById("rankingPeriod");
    const listContainer = document.getElementById("rankingList");
    
    if (!periodSelect || !listContainer) return;
    
    const period = periodSelect.value;
    listContainer.innerHTML = ""; 

    const data = demoRankings[period] || [];

    data.slice(0, 10).forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "history-item";
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.padding = "10px";

        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: bold; width: 25px; color: #e95464;">${index + 1}</span>
                <img src="icon_png/01_hiyoko.png" style="width: 30px; height: 30px; border-radius: 50%;">
                <div>
                    <div style="font-weight: bold; font-size: 0.9rem;">${item.name}</div>
                    <div style="font-size: 0.75rem; color: #888;">${item.theme}</div>
                </div>
            </div>
            <div style="font-weight: bold; color: #4caf50;">${item.score} pt</div>
        `;
        listContainer.appendChild(row);
    });

    if (data.length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>データがありません</p>";
    }
}

/* ==========================================================================
   テーマ・履歴・モーダル
   ========================================================================== */
function showStance(id) {
    const data = {
        ai1: { title: "AIは人間の知能を超える？", options: ["超える", "超えない"] },
        ai2: { title: "AIと人間、どちらが信頼できる？", options: ["AI", "人間"] },
        ai3: { title: "AIで人間は幸せになる？", options: ["幸せになる", "ならない"] },
        life1: { title: "安定した人生を選ぶべき？", options: ["選ぶべき", "挑戦すべき"] },
        life2: { title: "お金は人生で最も重要？", options: ["重要", "そうではない"] },
        life3: { title: "努力と才能、どちらが重要？", options: ["努力", "才能"] },
        human1: { title: "正直であることは常に正しい？", options: ["正しい", "場合による"] },
        human2: { title: "他人を完全に理解できるか？", options: ["できる", "できない"] },
        human3: { title: "恋愛と友情、大事なのは？", options: ["恋愛", "友情"] }
    };
    const selected = data[id];
    if (!selected) return;

    gameData.theme = selected.title;
    document.getElementById("themeTitle").innerText = selected.title;
    const container = document.getElementById("stanceButtons");
    container.innerHTML = "";
    selected.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.innerText = opt;
        btn.onclick = () => startGame(opt);
        container.appendChild(btn);
    });
    showScreen("stanceScreen");
}

function startCustomTheme() {
    const input = document.getElementById("customThemeInput");
    const theme = input ? input.value.trim() : "";
    if (!theme) {
        alert("テーマを入力してください");
        return;
    }
    gameData.theme = theme;
    startGame("中立・自由回答");
}

function showHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    list.innerHTML = "";
    const history = JSON.parse(localStorage.getItem("debateHistory") || "[]");

    history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
            <small style="color:#666;">${item.date}</small><br>
            <strong>${item.theme}</strong><br>
            主張: ${item.stance} / スコア: <span style="color:#e95464;">${item.score}点</span>
        `;
        div.onclick = () => {
            openModal(`【詳細履歴】\nテーマ: ${item.theme}\n主張: ${item.stance}\nスコア: ${item.score}点\n\n${item.detail}`, "閉じる", "チャットを見る", null);
            document.getElementById("modalCancel").style.display = "none";
        };
        list.appendChild(div);
    });
    showScreen('history-screen');
}

function showResult() {
    const score = Math.floor(Math.random() * 41) + 60;
    const scoreElem = document.getElementById("scoreText");
    if (scoreElem) scoreElem.innerText = `${score}点`;
    
    const historyData = {
        date: new Date().toLocaleString(),
        theme: gameData.theme,
        stance: gameData.stance,
        score: score,
        detail: `この議論では「${gameData.theme}」について「${gameData.stance}」の立場で挑みました。`
    };

    let history = JSON.parse(localStorage.getItem("debateHistory") || "[]");
    history.unshift(historyData);
    localStorage.setItem("debateHistory", JSON.stringify(history));

    showScreen("resultScreen");
}

function openModal(msg, confirmText, cancelText, cb) {
    const modal = document.getElementById("customModal");
    const msgElem = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");

    if (!modal || !msgElem) return;

    msgElem.innerText = msg;
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;
    cancelBtn.style.display = "inline-block"; // 非表示にされた後でも再表示できるように

    modalCallback = cb;
    confirmBtn.onclick = () => {
        if (modalCallback) modalCallback();
        closeModal();
    };
    cancelBtn.onclick = closeModal;

    modal.style.display = "flex";
}

function closeModal() {
    const modal = document.getElementById("customModal");
    if (modal) modal.style.display = "none";
}

function handleResultButton() {
    if (gameData.turn > 0) {
        openModal("議論を中断して結果を表示しますか？", "結果を見る", "戻る", showResult);
    } else {
        showResult();
    }
}

function backToTitle() {
    openModal("中断してテーマ選択に戻りますか？", "中断する", "続ける", () => showScreen('theme-screen'));
}

/* ==========================================================================
   イベントリスナー
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 初回画面表示
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

    const loginPw = document.getElementById("loginPw");
    if(loginPw) {
        loginPw.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleLogin();
        });
    }
});

// モーダルやメニューの外側をクリックした際の処理
window.onclick = function(event) {
    const badge = document.getElementById("user-display");
    const menu = document.getElementById("user-menu");
    if (badge && !badge.contains(event.target)) {
        if (menu) menu.style.display = "none";
    }
}
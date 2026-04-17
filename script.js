let gameData = {
  theme: "",
  stance: "",
  turn: 5,
  maxTurn: 5,
  isWaiting: false
};

// 画面切り替え
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// 自由入力テーマの開始
function startCustomTheme() {
  const input = document.getElementById("customThemeInput");
  const theme = input.value.trim();
  if (!theme) return alert("テーマを入力してください");
  gameData.theme = theme;
  startGame("中立・自由");
}

// 固定テーマの立場選択表示
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

// ゲーム開始処理
function startGame(stance) {
  gameData.stance = stance;
  gameData.turn = gameData.maxTurn;
  document.querySelector(".input-area").style.display = "flex";
  document.querySelector(".finish-btn").style.display = "block";
  document.getElementById("themeText").innerText = `テーマ: ${gameData.theme}`;
  updateTurnDisplay();
  const chat = document.getElementById("chat");
  chat.innerHTML = "";
  
  const initialMsg = stance === "中立・自由" 
    ? `自由テーマ「${gameData.theme}」ですね。あなたの意見をどうぞ！` 
    : `あなたは「${stance}」の立場ですね。議論を開始します。あなたの意見をどうぞ！`;
    
  addMessage("ai", initialMsg);
  showScreen("gameScreen");
  setTimeout(() => document.getElementById("userInput").focus(), 100);
}

// メッセージ表示
function addMessage(type, text) {
  const chat = document.getElementById("chat");
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${type}`;
  msgDiv.innerHTML = `<div class="bubble">${text}</div>`;
  chat.appendChild(msgDiv);
  chat.scrollTop = chat.scrollHeight;
}

// ターン数表示更新
function updateTurnDisplay() {
  document.getElementById("turnText").innerText = `残りターン: ${gameData.turn}`;
}

// メッセージ送信
async function sendMessage() {
  const input = document.getElementById("userInput");
  const userText = input.value.trim();
  if (!userText || gameData.isWaiting || gameData.turn <= 0) return;

  addMessage("user", userText);
  input.value = "";
  input.style.height = "54px"; 
  
  gameData.turn--;
  updateTurnDisplay();
  gameData.isWaiting = true;

  const loadingId = "load-" + Date.now();
  const typingHtml = `
    <div class="typing-container">
      AIが考え中
      <div class="dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>
  `;
  addMessage("ai", `<span id="${loadingId}">${typingHtml}</span>`);

  try {
    const response = await fetch("http://10.15.142.19:3000/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: userText, 
        theme: gameData.theme, 
        stance: gameData.stance 
      })
    });
    
    const data = await response.json();
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
      loadingEl.innerHTML = data.reply || "返信を取得できませんでした。";
    }

    if (gameData.turn <= 0) {
      document.querySelector(".finish-btn").style.display = "none";
      showResultButton();
    }
  } catch (e) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.innerText = "接続エラー: サーバーが応答していません。";
  } finally {
    gameData.isWaiting = false;
  }
}

// 結果を見るボタン表示
function showResultButton() {
  document.querySelector(".input-area").style.display = "none";
  const chat = document.getElementById("chat");
  const btn = document.createElement("button");
  btn.innerText = "ディベートの結果を見る";
  btn.className = "start-btn";
  btn.style.margin = "20px auto";
  btn.style.display = "block";
  btn.onclick = showResult;
  chat.appendChild(btn);
  chat.scrollTop = chat.scrollHeight;
}

// 結果表示 (MBTI取得ロジックを追加)
async function showResult() {
  // 画面を切り替えて初期表示をセット
  showScreen("resultScreen");
  document.getElementById("scoreText").innerText = "分析中...";
  document.getElementById("commentText").innerText = "これまでの議論に基づき、あなたのMBTI性格タイプを分析しています...";

  try {
    // サーバーに診断結果（MBTI）をリクエスト
    const response = await fetch("http://10.15.142.19:3000/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: "議論を終了します。これまでの私の意見や対話スタイルから推測されるMBTIタイプとその理由、および議論の総評を教えてください。", 
        theme: gameData.theme,
        stance: gameData.stance
      })
    });

    const data = await response.json();
    
    // スコアの演出 (60-99点)
    const score = Math.floor(Math.random() * 40) + 60;
    document.getElementById("scoreText").innerText = `${score}点`;
    
    // AIからの診断結果を反映
    if (data.reply) {
      document.getElementById("commentText").innerText = data.reply;
    } else {
      document.getElementById("commentText").innerText = "診断結果を取得できませんでした。";
    }

  } catch (e) {
    console.error("Result fetch error:", e);
    document.getElementById("scoreText").innerText = "Error";
    document.getElementById("commentText").innerText = "サーバーとの接続に失敗しました。";
  }
}

// 途中終了確認
function confirmFinish() {
  if (confirm("まだターンが残っていますが、議論を終了して結果を表示しますか？")) {
    document.querySelector(".input-area").style.display = "none";
    document.querySelector(".finish-btn").style.display = "none";
    showResult();
  }
}

// タイトルへ戻る
function backToTitle() {
  if (confirm("タイトルに戻ります。現在の議論内容は破棄されますがよろしいですか？")) {
    showScreen("login-screen");
  }
}

// イベントリスナーの設定
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("userInput");

  input.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
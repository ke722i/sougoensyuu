let currentUser = null;
let gameData = { theme: "", stance: "", turn: 5, maxTurn: 5, isWaiting: false };

// 画面切り替え関数
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

// 認証処理 (ログイン・登録)
async function handleAuth(type) {
  const user = document.getElementById("authUser").value;
  const pass = document.getElementById("authPass").value;

  if (!user || !pass) return alert("ユーザー名とパスワードを入力してください");

  try {
    const response = await fetch(`http://10.15.142.19:3000/api/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass })
    });

    const data = await response.json();
    if (response.ok) {
      currentUser = data.username;
      const badge = document.getElementById("userBadge");
      if (badge) {
        badge.innerText = `ログイン中: ${currentUser} (前回のMBTI: ${data.mbti || '未診断'})`;
      }
      showScreen('theme-screen');
    } else {
      alert(data.error || "認証に失敗しました");
    }
  } catch (error) {
    console.error("Auth error:", error);
    alert("サーバーに接続できません。server.jsが起動しているか確認してください。");
  }
}

// テーマの表示と立場選択の生成
function showStance(id) {
  const data = {
    ai1: { title: "AIは人間の知能を超える？", options: ["超える", "超えない"] },
    ai2: { title: "AIと人間, どちらが信頼できる？", options: ["AI", "人間"] },
    ai3: { title: "AIで人間は幸せになる？", options: ["幸せになる", "ならない"] },
    life1: { title: "安定した人生を選ぶべき？", options: ["選ぶべき", "挑戦すべき"] },
    life2: { title: "お金は人生で最も重要？", options: ["重要", "そうではない"] },
    life3: { title: "努力と才能, どちらが重要？", options: ["努力", "才能"] },
    human1: { title: "正直であることは常に正しい？", options: ["正しい", "場合による"] },
    human2: { title: "他人を完全に理解できるか？", options: ["できる", "できない"] },
    human3: { title: "恋愛と友情, 大事なのは？", options: ["恋愛", "友情"] }
  };
  
  const selected = data[id];
  if (!selected) return;

  gameData.theme = selected.title;
  document.getElementById("themeTitle").innerText = selected.title;
  
  const container = document.getElementById("stanceButtons");
  container.innerHTML = "";
  
  selected.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "start-btn";
    btn.style.margin = "5px";
    btn.innerText = opt;
    btn.onclick = (e) => {
      e.preventDefault();
      startGame(opt);
    };
    container.appendChild(btn);
  });
  showScreen("stanceScreen");
}

// ゲーム開始処理
function startGame(stance) {
  gameData.stance = stance;
  gameData.turn = gameData.maxTurn;
  
  document.getElementById("themeText").innerText = `テーマ: ${gameData.theme}`;
  document.getElementById("turnText").innerText = `残りターン: ${gameData.turn}`;
  
  const chat = document.getElementById("chat");
  chat.innerHTML = "";
  
  addMessage("ai", `${stance}の立場ですね。議論を始めましょう。意気込みをどうぞ！`);
  showScreen("gameScreen");
}

// メッセージ送信 (APIエラー時にターンが減らないように修正)
async function sendMessage() {
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  
  if (!text || gameData.isWaiting) return;

  // ユーザーのメッセージを先に表示
  addMessage("user", text);
  input.value = "";
  gameData.isWaiting = true;

  try {
    const response = await fetch("http://10.15.142.19:3000/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: text, 
        theme: gameData.theme, 
        stance: gameData.stance,
        username: currentUser 
      })
    });
    
    const data = await response.json();
    
    // 成功した場合のみ、AIのメッセージを表示しターンを減らす
    if (response.ok && data.reply) {
      addMessage("ai", data.reply);
      
      // ここでターンをカウントダウン
      gameData.turn--;
      document.getElementById("turnText").innerText = `残りターン: ${gameData.turn}`;
      
      if (gameData.turn <= 0) {
        addMessage("ai", "規定のターン数が終了しました。「結果を見る」ボタンを押して分析を確認してください。");
      }
    } else {
      // API側でエラーメッセージが返ってきた場合
      addMessage("ai", "AIが少し疲れているようです。もう一度同じ内容を送ってみてください。");
    }
  } catch (e) {
    // ネットワークエラー等の場合
    addMessage("ai", "通信エラーが発生しました。サーバーが動いているか確認してください。");
  } finally {
    gameData.isWaiting = false;
  }
}

// 結果の生成とDBへの保存 (AIによる本物の採点対応)
async function showResult() {
  showScreen("resultScreen");
  document.getElementById("scoreText").innerText = "AIによる厳正な採点中...";
  document.getElementById("commentText").innerText = "";
  
  try {
    const response = await fetch("http://10.15.142.19:3000/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: "結果を表示してください。", 
        theme: gameData.theme, 
        stance: gameData.stance,
        username: currentUser 
      })
    });
    
    const data = await response.json();
    
    // AIの返答からスコアを抽出
    const scoreMatch = data.reply.match(/【合計点：(\d+)点】/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0; 

    // MBTIタイプの抽出
    const mbtiMatch = data.reply.match(/【MBTI：(.+?)】/);
    const mbtiType = mbtiMatch ? mbtiMatch[1] : "分析不能";

    // 画面表示
    document.getElementById("scoreText").innerText = `${score}点`;
    document.getElementById("commentText").innerText = data.reply;

    // データベースに保存
    await fetch("http://10.15.142.19:3000/api/save-battle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        username: currentUser, 
        theme: gameData.theme, 
        score: score, 
        mbti: mbtiType 
      })
    });
  } catch (e) {
    console.error(e);
    document.getElementById("commentText").innerText = "結果の取得中にエラーが発生しました。";
  }
}

// 履歴の取得と表示
async function showHistory() {
  if (!currentUser) return;
  showScreen("historyScreen");
  
  try {
    const res = await fetch(`http://10.15.142.19:3000/api/history/${currentUser}`);
    const history = await res.json();
    const list = document.getElementById("historyList");
    
    if (history.length === 0) {
      list.innerHTML = "<p style='text-align:center;'>まだ対戦履歴がありません。</p>";
      return;
    }

    list.innerHTML = history.map(h => `
      <div class="history-item" style="background:#fff; padding:15px; margin:10px 0; border-radius:10px; border-left: 5px solid #4CAF50;">
        <small>${new Date(h.date).toLocaleDateString()}</small>
        <p><strong>テーマ:</strong> ${h.theme}</p>
        <p><strong>スコア:</strong> ${h.score}点 | <strong>MBTI:</strong> ${h.mbti}</p>
      </div>
    `).join('');
  } catch (e) {
    console.error("History fetch error:", e);
  }
}

// チャットメッセージの追加
function addMessage(type, text) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerHTML = `<div class="bubble">${text}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// 議論を終了する前の確認
function confirmFinish() {
  if (confirm("議論を終了して、AIの採点とMBTI診断結果を見ますか？")) {
    showResult();
  }
}

// --- リフレッシュ対策 ---
window.onbeforeunload = function(e) {
  const gameScreen = document.getElementById("gameScreen");
  if (gameScreen && gameScreen.classList.contains("active")) {
    e.preventDefault();
    return "議論の途中でページを離れると、現在のデータが失われます。";
  }
};
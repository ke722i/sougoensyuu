let gameData = {
  theme: "",
  stance: "",
  turn: 5,
  maxTurn: 5
};

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* 主張選択 */
function showStance(theme) {
  gameData.theme = theme;
  document.getElementById("stanceTheme").innerText = theme;

  const container = document.getElementById("stanceButtons");
  container.innerHTML = "";

  let options = [];

  if (theme === "努力は才能に勝てる？") {
    options = ["勝てる", "勝てない"];
  } else if (theme === "AIは人間を超えるべき？") {
    options = ["超えるべき", "超えるべきではない"];
  } else {
    options = ["お金", "幸せ"];
  }

  options.forEach(option => {
    const btn = document.createElement("button");
    btn.innerText = option;
    btn.onclick = () => startGame(option);
    container.appendChild(btn);
  });

  showScreen("stanceScreen");
}

/* ゲーム開始 */
function startGame(stance) {
  gameData.stance = stance;
  gameData.turn = gameData.maxTurn;

  document.getElementById("themeText").innerText =
    "テーマ：" + gameData.theme + "（あなた：" + stance + "）";

  updateTurn();

  document.getElementById("chat").innerHTML = "";
  addMessage("ai", "あなたは「" + stance + "」の立場ですね。議論を開始します。");

  showScreen("gameScreen");
}

function updateTurn() {
  document.getElementById("turnText").innerText = "残り：" + gameData.turn;
}

function addMessage(type, text) {
  const msg = document.createElement("div");
  msg.className = "message " + type;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerText = text;

  msg.appendChild(bubble);
  document.getElementById("chat").appendChild(msg);
}

/* AI応答 */
function getAIResponse() {
  return "その意見の根拠は何ですか？";
}

function sendMessage() {
  const input = document.getElementById("userInput");
  if (!input.value) return;

  addMessage("user", input.value);
  addMessage("ai", getAIResponse());

  input.value = "";

  gameData.turn--;
  updateTurn();

  if (gameData.turn <= 0) {
    setTimeout(showResult, 500);
  }
}

/* Enter送信 */
document.getElementById("userInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") sendMessage();
});

/* 結果 */
function showResult() {
  const score = Math.floor(Math.random() * 101);

  const scoreEl = document.getElementById("scoreText");
  const commentEl = document.getElementById("commentText");

  scoreEl.innerHTML = score + "<span style='font-size:24px;'>点</span>";

  let resultText = "";
  let comment = "";

  if (score > 50) {
    resultText = "勝利";
    scoreEl.style.color = "#22c55e";
    comment = "良い主張でした！";
  } else if (score === 50) {
    resultText = "引き分け";
    scoreEl.style.color = "#f59e0b";
    comment = "互角の勝負！";
  } else {
    resultText = "敗北";
    scoreEl.style.color = "#ef4444";
    comment = "説得力を高めましょう";
  }

  commentEl.innerHTML =
  "<div class='result-main'>" + resultText + "</div>" +
  "<div class='result-sub'>" + comment + "</div>";

  showScreen("resultScreen");
}

/* 戻る */
function backToTitle() {
  if (!confirm("タイトルに戻りますか？")) return;

  gameData = { theme: "", stance: "", turn: 5, maxTurn: 5 };
  document.getElementById("chat").innerHTML = "";

  showScreen("titleScreen");
}

/* リスタート */
function restart() {
  showScreen("titleScreen");
}
function login() {
  const loginScreen = document.getElementById("login-screen");
  const mainGame = document.getElementById("main-game");
  const userInput = document.getElementById("userInput");
  const chat = document.getElementById("chat");

  loginScreen.style.display = "none";
  mainGame.style.display = "block";

  setTimeout(() => {
    userInput.focus();
  }, 100);

  chat.innerHTML += `<p style="color: gray; text-align: center; font-size: 0.9em;">--- 議論を開始しました ---</p>`;
}

async function sendMessage() {
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");
  const theme = document.getElementById("theme").value;
  const userText = input.value;

  if (!userText) return;

  chat.innerHTML += `<p class="user">${userText}</p>`;
  input.value = "";

  const loadingId = "loading-" + Date.now(); 
  chat.innerHTML += `<p class="ai" id="${loadingId}" style="color: gray; font-style: italic;">AIが考え中...</p>`;
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch("http://10.15.142.19:3000/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, theme: theme })
    });

    const data = await response.json();
    const loadingElement = document.getElementById(loadingId);
    const aiReply = data.reply || "エラー：返信を取得できませんでした。";
    
    if (loadingElement) {
      loadingElement.innerText = aiReply;
      loadingElement.style.color = ""; 
      loadingElement.style.fontStyle = "normal";
    }

    chat.scrollTop = chat.scrollHeight;

  } catch (error) {
    console.error("Communication Error:", error);
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
      loadingElement.innerHTML = "サーバーに接続できません。";
      loadingElement.style.color = "red";
    }
  }
}

document.getElementById("userInput").addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    event.preventDefault(); 
    sendMessage();
  }
});

window.addEventListener("keydown", function(event) {
  const loginScreen = document.getElementById("login-screen");
  if (event.key === "Enter" && loginScreen && loginScreen.style.display !== "none") {
    login();
  }
});
async function sendMessage() {
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");
  const theme = document.getElementById("theme").value;

  const userText = input.value;
  if (!userText) return;

  // 1. ユーザーが書いたプロンプトをチャットに挿入
  chat.innerHTML += `<p class="user">${userText}</p>`;
  input.value = "";

  // 2. ロード中の返事
  const loadingId = "loading-" + Date.now(); // Create a unique ID to find this message later
  chat.innerHTML += `<p class="ai" id="${loadingId}" style="color: gray italic;">AIが考え中...</p>`;
  
  // 自動スクロール（画面調整）
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch("http://10.15.142.19:3000/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userText,
        theme: theme
      })
    });

    const data = await response.json();
    
    // 3. ロード中のメッセージをAIの返事に書き換える
    const loadingElement = document.getElementById(loadingId);
    const aiReply = data.reply || "エラー：返信を取得できませんでした。";
    
    if (loadingElement) {
      loadingElement.innerText = aiReply;
      loadingElement.style.color = ""; // 色の初期化
      loadingElement.style.fontStyle = "normal";
    }

    chat.scrollTop = chat.scrollHeight;

  } catch (error) {
    console.error("Communication Error:", error);
    
    // エラーメッセージ
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
      loadingElement.innerHTML = "サーバーに接続できません。";
      loadingElement.style.color = "red";
    }
  }
}
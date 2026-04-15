async function sendMessage() {
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");
  const theme = document.getElementById("theme").value;

  const userText = input.value;
  if (!userText) return; // Don't send empty messages

  // ユーザー表示 - Note the use of backticks ``
  chat.innerHTML += `<p class="user">${userText}</p>`;

  input.value = "";

  try {
    // APIへ送信
    const response = await fetch("http://localhost:3000/api", {
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

    // AI表示 - Note the use of backticks ``
    // We check if data.reply exists, otherwise show an error
    const aiReply = data.reply || "エラー：返信を取得できませんでした。";
    chat.innerHTML += `<p class="ai">${aiReply}</p>`;

    // Automatic scroll to bottom
    chat.scrollTop = chat.scrollHeight;

  } catch (error) {
    console.error("Communication Error:", error);
    chat.innerHTML += `<p class="ai" style="color: red;">サーバーに接続できませんでした。</p>`;
  }
}
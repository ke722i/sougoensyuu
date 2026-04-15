async function sendMessage() {
  const input = document.getElementById("userInput");
  const chat = document.getElementById("chat");
  const theme = document.getElementById("theme").value;

  const userText = input.value;
  if (!userText) return;

  chat.innerHTML += `<p class="user">${userText}</p>`;
  input.value = "";

  try {
    // UPDATED: Points to your school IP instead of localhost
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
    const aiReply = data.reply || "エラー：返信を取得できませんでした。";
    chat.innerHTML += `<p class="ai">${aiReply}</p>`;
    
    chat.scrollTop = chat.scrollHeight;

  } catch (error) {
    console.error("Communication Error:", error);
    chat.innerHTML += `<p class="ai" style="color: red;">サーバー（10.15.142.19）に接続できません。</p>`;
  }
}
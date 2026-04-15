const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); 
app.use(express.json());

const MY_API_KEY = "AIzaSyCC7VcRcDtPwG00cnKQrG4Hy9W4RZidi_k"; 

app.post("/api", async (req, res) => {
  const { message, theme } = req.body;
  console.log(`\n--- New Request ---`);
  console.log(`Theme: ${theme}`);
  console.log(`User:  ${message}`);

  try {
    // We switched from 'v1beta' to 'v1' and added '-latest' for reliability
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${MY_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `あなたはプロの討論者です。テーマ「${theme}」について、相手の意見「${message}」に対して、論理的に反論してください。短く3文程度で日本語で答えてください。` }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log("❌ Google API Error:", data.error.message);
      return res.json({ reply: "Google API Error: " + data.error.message });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (reply) {
      console.log("✅ AI Reply Success!");
      res.json({ reply });
    } else {
      console.log("❓ Debugging JSON:", JSON.stringify(data));
      res.json({ reply: "AIが返答を生成できませんでした。構造を確認してください。" });
    }

  } catch (error) {
    console.error("💥 Fetch Error:", error);
    res.status(500).json({ reply: "サーバーエラーが発生しました。" });
  }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("-----------------------------------------");
  console.log(`🚀 SERVER IS LIVE!`);
  console.log(`URL: http://10.15.142.19:${PORT}`);
  console.log("-----------------------------------------");
});
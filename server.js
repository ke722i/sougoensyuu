require('dotenv').config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); 
app.use(express.json());

const MY_API_KEY = process.env.GEMINI_API_KEY; 

app.get("/", (req, res) => {
  res.send("<h1>🤖 Debate & MBTI AI Backend is Running!</h1><p>Status: Healthy</p>");
});

app.post("/api", async (req, res) => {
  const { message, theme, stance } = req.body;
  
  console.log(`\n--- New Request ---`);
  console.log(`Theme: ${theme}`);
  console.log(`Stance: ${stance}`);
  console.log(`User:  ${message}`);

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${MY_API_KEY}`;

    // システムプロンプトの構築：終了時と通常時の挙動を厳格に分離
    let systemInstruction = `あなたは親しみやすくも論理的なAIディベートパートナー兼、心理分析のエキスパートです。
    現在のテーマは「${theme}」で、ユーザーは「${stance}」の立場です。
    
    以下のガイドラインを「絶対の優先順位」として回答してください：
    
    1. 【最優先：終了判定】ユーザーの入力が「議論を終了する」「結果を見る」「最終判定に移る」といった終了の意志を含む場合：
       - 以降の反論や深掘りする質問は「一切禁止」です。
       - これまでの発言から推測されるMBTIタイプとその具体的な理由のみを150文字程度で詳しく解説してください。
       - 回答の最後は必ず【MBTI：タイプ名】で締めてください。
    
    2. 【通常時：ディベート】議論が継続している場合：
       - ユーザーの「${message}」に対して、論理的な反論や深掘りする質問を返してください。
       - 100文字以内で、親しみやすい丁寧語（です・ます調）を使用してください。
    
    3. 【共通：MBTI分析】会話を通じて、ユーザーの思考パターン（論理的か感情的か、直感的か現実的か等）を常に蓄積・分析してください。
    
    4. 【共通：柔軟な対応】質問や挨拶には直接答え、不自然に議論を強制しないでください。
    
    ユーザーの入力内容：${message}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemInstruction }]
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
      res.json({ reply: "AIが返答を生成できませんでした。" });
    }

  } catch (error) {
    console.error("💥 Fetch Error:", error);
    res.status(500).json({ reply: "サーバーエラーが発生しました。" });
  }
});

const PORT = 3000;
const LIVE_SERVER_PORT = 5500;

app.listen(PORT, "0.0.0.0", () => {
  console.log("=========================================");
  console.log("🚀 議論＆MBTI診断サーバー：起動完了");
  console.log(`📡 Backend API: http://10.15.142.19:${PORT}/api`);
  console.log("-----------------------------------------");
  console.log("🎮 ステータス: 待機中...");  
  console.log(`1. ブラウザでこちらにアクセス: http://10.15.142.19:${LIVE_SERVER_PORT}`);
  console.log("   (または、index.htmlをダブルクリック。)");
  console.log("=========================================");
});
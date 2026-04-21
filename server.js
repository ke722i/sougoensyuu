require('dotenv').config();
const express = require("express");
const cors = require("cors");
const Datastore = require('nedb-promises');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors()); 
app.use(express.json());

// データベースの初期化 (自動的にファイルが作成されます)
const usersDB = Datastore.create('users.db');
const battlesDB = Datastore.create('battles.db');

const MY_API_KEY = process.env.GEMINI_API_KEY; 

// --- 認証 API ---

// ユーザー登録
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await usersDB.findOne({ username });
    if (existingUser) return res.status(400).json({ error: "このユーザー名は既に使用されています。" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersDB.insert({ 
      username, 
      password: hashedPassword, 
      mbti: "未診断", 
      totalBattles: 0 
    });
    
    res.json({ message: "登録が完了しました！", username });
  } catch (error) {
    res.status(500).json({ error: "登録に失敗しました。" });
  }
});

// ログイン
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await usersDB.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      res.json({ username: user.username, mbti: user.mbti });
    } else {
      res.status(401).json({ error: "ユーザー名またはパスワードが正しくありません。" });
    }
  } catch (error) {
    res.status(500).json({ error: "ログインに失敗しました。" });
  }
});

// --- 履歴保存 API ---

app.post("/api/save-battle", async (req, res) => {
  const { username, theme, score, mbti } = req.body;
  try {
    await battlesDB.insert({ username, theme, score, mbti, date: new Date() });
    await usersDB.update({ username }, { $set: { mbti: mbti }, $inc: { totalBattles: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "データの保存に失敗しました。" });
  }
});

app.get("/api/history/:username", async (req, res) => {
  const history = await battlesDB.find({ username: req.params.username }).sort({ date: -1 });
  res.json(history);
});

// --- メインディベート API ---

app.post("/api", async (req, res) => {
  const { message, theme, stance, username } = req.body;
  const user = await usersDB.findOne({ username });
  
  // ユーザーの過去のMBTIを記憶として注入
  const memoryContext = user && user.mbti !== "未診断" 
    ? `[過去の分析結果: このユーザーは過去に ${user.mbti} と診断されました。]`
    : "";

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${MY_API_KEY}`;

    let systemInstruction = `${memoryContext}
    あなたは論理的かつ親しみやすいAIディベーターです。
    テーマ: ${theme} / ユーザーの立場: ${stance}
    
    【ルール】
    1. 終了の意志がある場合：反論を止め、MBTI診断結果を【MBTI：タイプ名】形式で含めて回答してください。
    2. 継続中の場合：100文字以内で論理的な反論を返してください。`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemInstruction }] }] })
    });

    const data = await response.json();
    res.json({ reply: data.candidates[0].content.parts[0].text });
  } catch (error) {
    res.status(500).json({ reply: "エラーが発生しました。" });
  }
});

app.listen(3000, "0.0.0.0", () => console.log("🚀 Server Ready"));
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL接続プール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// データベースの初期化（テーブル作成）
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        mbti VARCHAR(10) DEFAULT '未診断',
        totalBattles INTEGER DEFAULT 0,
        totalScore INTEGER DEFAULT 0,
        averageScore FLOAT DEFAULT 0
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS battles (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        theme VARCHAR(255) NOT NULL,
        score INTEGER NOT NULL,
        mbti VARCHAR(10) NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initDB();

const MY_API_KEY = process.env.GEMINI_API_KEY; 

// --- 認証 API ---

app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) return res.status(400).json({ error: "このユーザー名は既に使用されています。" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.json({ message: "登録が完了しました！", username });
    } catch (error) {
        res.status(500).json({ error: "登録に失敗しました。" });
    }
});

app.post("/api/login", async (req, res) => {
   const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ username: user.username, mbti: user.mbti, averageScore: user.averagescore || 0 });
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
    await pool.query('INSERT INTO battles (username, theme, score, mbti) VALUES ($1, $2, $3, $4)', [username, theme, score, mbti]);
    await pool.query('UPDATE users SET mbti = $1, totalBattles = totalBattles + 1, totalScore = totalScore + $2, averageScore = (totalScore + $2) / (totalBattles + 1) WHERE username = $3', [mbti, score, username]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "データの保存に失敗しました。" });
  }
});

app.get("/api/history/:username", async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM battles WHERE username = $1 ORDER BY date DESC', [req.params.username]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "履歴の取得に失敗しました。" });
    }
});

// 平均点取得API
app.get("/api/average/:username", async (req, res) => {
  try {
    const result = await pool.query('SELECT averageScore FROM users WHERE username = $1', [req.params.username]);
    if (result.rows.length > 0) {
      res.json({ averageScore: result.rows[0].averagescore || 0 });
    } else {
      res.status(404).json({ error: "ユーザーが見つかりません。" });
    }
  } catch (error) {
    res.status(500).json({ error: "平均点の取得に失敗しました。" });
  }
});

app.post("/api", async (req, res) => {
    const { message, theme, stance, username } = req.body;
    try {
        const result = await pool.query('SELECT mbti FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        const memoryContext = user && user.mbti !== "未診断"
            ? `[過去の傾向: ${user.mbti}]`
            : "";

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${MY_API_KEY}`;

        let systemInstruction = `あなたは厳格なAIディベーター兼採点官です。
テーマ: ${theme} / 立場: ${stance} ${memoryContext}

【フェーズ判断】
ユーザーの発言が終了・結果を求めるものであれば「採点」、それ以外は「議論」を行ってください。

■議論フェーズ：
100文字以内で、ユーザーの矛盾を突く鋭い反論を1つ返してください。

■採点フェーズ：
ユーザーのこれまでの発言（たとえ短くても）から、その意図や思考の傾向を汲み取り、以下の【配点基準】で採点してください。
※「議論がない」と決めつけず、参加姿勢や言葉選びからベーススコア（最低点）を保証してください。

余計な挨拶や長文解説を排除し、簡潔に箇条書きで出力してください。

・論理性(30)：[点] [15文字以内のポジティブな解説]
・根拠(20)：[点] [15文字以内のポジティブな解説]
・反論力(20)：[点] [15文字以内のポジティブな解説]
・一貫性(10)：[点] [15文字以内のポジティブな解説]
・説得力(10)：[点] [15文字以内のポジティブな解説]
・表現力(10)：[点] [15文字以内のポジティブな解説]

【MBTI：[4文字]】[そのタイプの魅力的な特徴を15文字以内]

最後に必ずこの形式で締めること：
【合計点：[数値]点】`;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    { role: "user", parts: [{ text: `${systemInstruction}\n\nユーザーの発言: ${message}` }] }
                ],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini Error:", data.error);
            return res.status(500).json({ reply: "APIエラーが発生しました。" });
        }

        if (data.candidates && data.candidates[0].content) {
            res.json({ reply: data.candidates[0].content.parts[0].text });
        } else {
            throw new Error("Invalid response");
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "サーバーエラーが発生しました。" });
    }
});

app.listen(3000, "0.0.0.0", () => {
    console.log("🚀 Server Ready with Scoring Logic");
    console.log("Access: http://localhost:3000");
});
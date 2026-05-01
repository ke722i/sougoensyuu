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
    // まず、postgresデータベースに接続してデータベースを作成（存在しない場合のみ）
    const tempPool = new Pool({
      connectionString: process.env.DATABASE_URL.replace('/sougoensyuu_db', '/postgres'),
    });
    
    try {
      await tempPool.query('CREATE DATABASE sougoensyuu_db');
    } catch (err) {
      // データベースが既に存在する場合はエラーを無視
      if (err.code !== '42P04') {
        throw err;
      }
    }
    await tempPool.end();

    // 既存のテーブルを削除
    await pool.query('DROP TABLE IF EXISTS battles');
    await pool.query('DROP TABLE IF EXISTS users');

    // 新しいuser_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_table (
        user_ID SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // log_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_table (
        discussions_ID SERIAL PRIMARY KEY,
        user_ID INTEGER NOT NULL REFERENCES user_table(user_ID),
        mbti CHAR(4) NOT NULL,
        date_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        theme VARCHAR(255) NOT NULL,
        sum_score INTEGER DEFAULT 0,
        game_result VARCHAR(50) NOT NULL
      );
    `);

    // chat_log_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_log_table (
        chat_id SERIAL PRIMARY KEY,
        discussion_ID INTEGER NOT NULL REFERENCES log_table(discussions_ID),
        chat_log TEXT NOT NULL
      );
    `);

    // week_record_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS week_record_table (
        week_identification_number SERIAL PRIMARY KEY,
        user_ID INTEGER NOT NULL REFERENCES user_table(user_ID),
        week_sum_score INTEGER DEFAULT 0 NOT NULL,
        week_discussion_count INTEGER DEFAULT 0 NOT NULL,
        week_average_score DECIMAL(5,2) DEFAULT 0.00,
        target_week DATE NOT NULL
      );
    `);

    // user_information_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_information_table (
        user_ID INTEGER NOT NULL PRIMARY KEY REFERENCES user_table(user_ID),
        average_score INTEGER NOT NULL,
        general_score INTEGER NOT NULL,
        winning_rate DECIMAL(5,2) NOT NULL,
        discussions_count INTEGER NOT NULL,
        best_score INTEGER NOT NULL,
        mbti_total CHAR(4) NOT NULL
      );
    `);

    // log_score_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_score_table (
        score_id SERIAL PRIMARY KEY,
        discussions_ID INTEGER NOT NULL REFERENCES log_table(discussions_ID),
        user_ID INTEGER NOT NULL REFERENCES user_table(user_ID),
        logic_score INTEGER DEFAULT 0,
        evidence_score INTEGER DEFAULT 0,
        rebuttal_score INTEGER DEFAULT 0,
        consistency_score INTEGER DEFAULT 0,
        persuasion_score INTEGER DEFAULT 0,
        expression_score INTEGER DEFAULT 0,
        sum_score INTEGER DEFAULT 0
      );
    `);

    // year_record_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS year_record_table (
        year_discussion_number SERIAL PRIMARY KEY,
        user_ID INTEGER NOT NULL REFERENCES user_table(user_ID),
        year_sum_score INTEGER DEFAULT 0 NOT NULL,
        year_discussion_count INTEGER DEFAULT 0 NOT NULL,
        year_average_score DECIMAL(5,2) DEFAULT 0.00,
        target_year DATE NOT NULL
      );
    `);

    // month_record_tableを作成（存在しない場合のみ）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS month_record_table (
        month_discussion_number SERIAL PRIMARY KEY,
        user_ID INTEGER NOT NULL REFERENCES user_table(user_ID),
        month_sum_score INTEGER DEFAULT 0 NOT NULL,
        month_discussion_count INTEGER DEFAULT 0 NOT NULL,
        month_average_score DECIMAL(5,2) DEFAULT 0.00,
        target_month DATE NOT NULL
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
        const existingUser = await pool.query('SELECT * FROM user_table WHERE name = $1', [username]);
        if (existingUser.rows.length > 0) return res.status(400).json({ error: "このユーザー名は既に使用されています。" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO user_table (name, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.json({ message: "登録が完了しました！", username });
    } catch (error) {
        res.status(500).json({ error: "登録に失敗しました。" });
    }
});

app.post("/api/login", async (req, res) => {
   const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM user_table WHERE name = $1', [username]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ username: user.name });
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
    // user_IDを取得
    const userResult = await pool.query('SELECT user_ID FROM user_table WHERE name = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "ユーザーが見つかりません。" });
    }
    const user_ID = userResult.rows[0].user_id;

    // log_tableに保存
    await pool.query('INSERT INTO log_table (user_ID, mbti, theme, sum_score, game_result) VALUES ($1, $2, $3, $4, $5)',
      [user_ID, mbti, theme, score, 'completed']); // game_resultは仮に'completed'を設定

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "データの保存に失敗しました。" });
  }
});

app.get("/api/history/:username", async (req, res) => {
    try {
        // user_IDを取得
        const userResult = await pool.query('SELECT user_ID FROM user_table WHERE name = $1', [req.params.username]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "ユーザーが見つかりません。" });
        }
        const user_ID = userResult.rows[0].user_id;

        // log_tableから履歴を取得
        const result = await pool.query('SELECT * FROM log_table WHERE user_ID = $1 ORDER BY date_time DESC', [user_ID]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "履歴の取得に失敗しました。" });
    }
});

// 平均点取得API
app.get("/api/average/:username", async (req, res) => {
  try {
    // user_IDを取得
    const userResult = await pool.query('SELECT user_ID FROM user_table WHERE name = $1', [req.params.username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "ユーザーが見つかりません。" });
    }
    const user_ID = userResult.rows[0].user_id;

    // log_tableから平均点を計算
    const result = await pool.query('SELECT AVG(sum_score) as averageScore FROM log_table WHERE user_ID = $1', [user_ID]);
    const averageScore = result.rows[0].averagescore || 0;
    res.json({ averageScore: Math.round(averageScore) });
  } catch (error) {
    res.status(500).json({ error: "平均点の取得に失敗しました。" });
  }
});

app.post("/api", async (req, res) => {
    const { message, theme, stance, username } = req.body;
    try {
        const result = await pool.query('SELECT 1 FROM user_table WHERE name = $1', [username]);
        const user = result.rows[0];

        const memoryContext = "";

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
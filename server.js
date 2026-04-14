import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// ES module対応
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ミドルウェア
app.use(cors());
app.use(express.json());

// publicフォルダ
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// ルート
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// 🔑 APIキー（.env想定 / 直書き禁止）
const API_KEY = (process.env.API_KEY || "").trim();

// AI API
app.post("/ai", async (req, res) => {
  try {
    const { message, theme } = req.body;

    // 入力チェック
    if (!message) {
      return res.status(400).json({ error: "messageがありません" });
    }

    if (!theme) {
      return res.status(400).json({ error: "themeがありません" });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: "API_KEYが設定されていません" });
    }

    // OpenAIリクエスト
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
あなたはディベート対戦AIです。
テーマ：「${theme}」

必ずユーザーと反対の立場で論理的に反論してください。
100文字以内で簡潔に答えてください。
`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    // OpenAIエラーハンドリング
    if (!response.ok) {
      console.error("OpenAIエラー:", data);
      return res.status(response.status).json({
        error: "OpenAI APIエラー",
        detail: data
      });
    }

    const reply = data?.choices?.[0]?.message?.content || "応答なし";

    console.log("AIレスポンス ↓");
    console.log(reply);

    // フロントに返すのはシンプルに
    res.json({ reply });

  } catch (error) {
    console.error("サーバーエラー:", error);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// 起動
app.listen(3000, () => {
  console.log("🔥 サーバー起動: http://localhost:3000");
});
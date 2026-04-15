import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const API_KEY = (process.env.API_KEY || "").trim();

app.post("/ai", async (req, res) => {
  try {
    const { message, theme } = req.body;

    if (!message) {
      return res.status(400).json({ error: "messageがありません" });
    }

    if (!theme) {
      return res.status(400).json({ error: "themeがありません" });
    }

    if (!API_KEY) {
      return res.status(500).json({ error: "API_KEYが設定されていません" });
    }

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
            content: `あなたはディベートAIです。テーマ：「${theme}」。必ず反対意見を100文字以内で答えてください。`
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const reply = data?.choices?.[0]?.message?.content || "応答なし";

    console.log("AI:", reply);

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "サーバーエラー" });
  }
});

app.listen(3000, () => {
  console.log("🔥 サーバー起動: http://localhost:3000");
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function initDB() {
  const dbInfo = await pool.query('SELECT current_database() AS db');
  console.log(`[DB] 接続成功: ${dbInfo.rows[0].db}`);

  async function ensureTable(tableName, createSql) {
    const existsResult = await pool.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${tableName}`]
    );
    const exists = existsResult.rows[0].exists;

    if (exists) {
      console.log(`[TABLE] ${tableName}: 既に存在しています`);
      return;
    }

    await pool.query(createSql);
    console.log(`[TABLE] ${tableName}: 作成されました`);
  }

  await ensureTable(
    'user_table',
    `
      CREATE TABLE "user_table" (
        "user_ID" SERIAL PRIMARY KEY,
        "name" VARCHAR(50) UNIQUE NOT NULL,
        "password" VARCHAR(255) NOT NULL,
        "icon" VARCHAR(50) DEFAULT 'icon1'
      );
    `
  );

  await ensureTable(
    'log_table',
    `
      CREATE TABLE "log_table" (
        "discussions_ID" SERIAL PRIMARY KEY,
        "user_ID" INTEGER NOT NULL REFERENCES "user_table"("user_ID") ON DELETE CASCADE,
        "mbti" CHAR(4) NOT NULL,
        "date_time" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "theme" VARCHAR(255) NOT NULL,
        "sum_score" INTEGER DEFAULT 0,
        "game_result" VARCHAR(50) NOT NULL
      );
    `
  );

  await ensureTable(
    'chat_log_table',
    `
      CREATE TABLE "chat_log_table" (
        "chat_id" SERIAL PRIMARY KEY,
        "discussion_ID" INTEGER NOT NULL REFERENCES "log_table"("discussions_ID") ON DELETE CASCADE,
        "chat_log" TEXT NOT NULL
      );
    `
  );

  await ensureTable(
    'week_record_table',
    `
      CREATE TABLE "week_record_table" (
        "week_identification_number" SERIAL PRIMARY KEY,
        "user_ID" INTEGER NOT NULL REFERENCES "user_table"("user_ID") ON DELETE CASCADE,
        "week_sum_score" INTEGER NOT NULL DEFAULT 0,
        "week_discussion_count" INTEGER NOT NULL DEFAULT 0,
        "week_average_score" DECIMAL(5,2) DEFAULT 0.00,
        "target_week" DATE NOT NULL
      );
    `
  );

  await ensureTable(
    'user_information_table',
    `
      CREATE TABLE "user_information_table" (
        "average_score" INTEGER NOT NULL,
        "general_score" INTEGER NOT NULL,
        "winning_rate" DECIMAL(6,2) NOT NULL,
        "discussions_count" INTEGER NOT NULL,
        "best_score" INTEGER NOT NULL,
        "user_ID" INTEGER PRIMARY KEY REFERENCES "user_table"("user_ID") ON DELETE CASCADE,
        "mbti_total" CHAR(4) NOT NULL
      );
    `
  );

  await ensureTable(
    'log_score_table',
    `
      CREATE TABLE "log_score_table" (
        "score_id" SERIAL PRIMARY KEY,
        "discussions_ID" INTEGER NOT NULL REFERENCES "log_table"("discussions_ID") ON DELETE CASCADE,
        "user_ID" INTEGER NOT NULL REFERENCES "user_table"("user_ID") ON DELETE CASCADE,
        "logic_score" INTEGER DEFAULT 0,
        "evidence_score" INTEGER DEFAULT 0,
        "rebuttal_score" INTEGER DEFAULT 0,
        "consistency_score" INTEGER DEFAULT 0,
        "persuasion_score" INTEGER DEFAULT 0,
        "expression_score" INTEGER DEFAULT 0,
        "sum_score" INTEGER DEFAULT 0
      );
    `
  );

  await ensureTable(
    'year_record_table',
    `
      CREATE TABLE "year_record_table" (
        "year_discussion_number" SERIAL PRIMARY KEY,
        "user_ID" INTEGER NOT NULL REFERENCES "user_table"("user_ID") ON DELETE CASCADE,
        "year_sum_score" INTEGER NOT NULL DEFAULT 0,
        "year_discussion_count" INTEGER NOT NULL DEFAULT 0,
        "year_average_score" DECIMAL(6,2) DEFAULT 0.00,
        "target_year" DATE NOT NULL
      );
    `
  );

  await ensureTable(
    'month_record_table',
    `
      CREATE TABLE "month_record_table" (
        "month_discussion_number" SERIAL PRIMARY KEY,
        "user_ID" INTEGER NOT NULL REFERENCES "user_table"("user_ID") ON DELETE CASCADE,
        "month_sum_score" INTEGER NOT NULL DEFAULT 0,
        "month_discussion_count" INTEGER NOT NULL DEFAULT 0,
        "month_average_score" DECIMAL(6,2) DEFAULT 0.00,
        "target_month" DATE NOT NULL
      );
    `
  );

  console.log('[DB] 初期化チェックが完了しました');
}

function parseEvaluation(text) {
  // ヘルパー関数: 日本語名または英語名で数値を検索する
  const extract = (keys, max) => {
    // 例: (論理性|LOGIC_SCORE).*?(\d+) という正規表現を作る
    const pattern = `(?:${keys.join('|')}).*?(\\d+)`;
    const reg = new RegExp(pattern, 'i');
    const match = text.match(reg);
    
    // 数値が見つかればそれを返し、なければ最低限の点数(4割)を返す
    const val = match ? Number(match[1]) : Math.floor(max * 0.4);
    return Math.max(0, Math.min(max, val));
  };

  // 各項目を抽出 (日本語・英語どちらにも対応)
  const logicScore = extract(['論理性', '論理', 'LOGIC_SCORE', 'LOGIC'], 30);
  const evidenceScore = extract(['根拠', 'EVIDENCE_SCORE', 'EVIDENCE'], 20);
  const rebuttalScore = extract(['反論力', '反論', 'REBUTTAL_SCORE', 'REBUTTAL'], 20);
  const consistencyScore = extract(['一貫性', 'CONSISTENCY_SCORE', 'CONSISTENCY'], 10);
  const persuasionScore = extract(['説得力', 'PERSUASION_SCORE', 'PERSUASION'], 10);
  const expressionScore = extract(['表現力', '表現', 'EXPRESSION_SCORE', 'EXPRESSION'], 10);

  // 合計点の抽出 (なければ加算)
  const scoreMatch = text.match(/(?:合計点|FINAL_SCORE).*?(\d+)/i);
  let score = scoreMatch ? Number(scoreMatch[1]) : (logicScore + evidenceScore + rebuttalScore + consistencyScore + persuasionScore + expressionScore);
  score = Math.max(0, Math.min(100, score));

  // MBTIの抽出 (英語4文字を優先的に探す)
  const mbtiMatch = text.match(/[I|E][N|S][T|F][J|P]/i);
  const mbti = mbtiMatch ? mbtiMatch[0].toUpperCase() : 'INTP';

  return {
    score,
    mbti,
    logicScore,
    evidenceScore,
    rebuttalScore,
    consistencyScore,
    persuasionScore,
    expressionScore
  };
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.9, 
        maxOutputTokens: 2048, // 1024から引き上げ
        topP: 0.95 
      },
      // セーフティ設定を追加（議論が止まらないようにする）
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    }),
  });

  const data = await response.json();
  
  // デバッグ用：もし止まったらターミナルに理由を表示
  if (data.candidates?.[0]?.finishReason === "SAFETY") {
    console.error("AIが安全性の判断により回答を中断しました。");
    return "（議論が白熱しすぎたため、回答が制限されました。別の視点で話しましょう。）";
  }

  if (!response.ok || data.error) throw new Error(data?.error?.message || 'Gemini API Error');
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

app.post('/api/register', async (req, res) => {
  const { username, password, icon } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  try {
    const exists = await pool.query('SELECT 1 FROM "user_table" WHERE "name" = $1', [username]);
    if (exists.rowCount > 0) return res.status(409).json({ error: 'username already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO "user_table" ("name", "password", "icon") VALUES ($1, $2, $3) RETURNING "user_ID", "name"',
      [username, passwordHash, icon || 'icon1']
    );
    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to register user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  try {
    const result = await pool.query('SELECT "user_ID", "name", "password", "icon" FROM "user_table" WHERE "name" = $1', [username]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    return res.json({ user: { id: user.user_ID, username: user.name, icon: user.icon } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to login' });
  }
});

app.post('/api/debate/start', async (req, res) => {
  const { username, theme, stance } = req.body;
  if (!username || !theme || !stance) return res.status(400).json({ error: 'username, theme, stance are required' });

  try {
    const userResult = await pool.query('SELECT "user_ID" FROM "user_table" WHERE "name" = $1', [username]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'user not found' });

    const userId = userResult.rows[0].user_ID;
    const intro = `テーマ「${theme}」で討論開始。あなたの立場は「${stance}」。最初の主張をどうぞ。`;

    const debate = await pool.query(
      'INSERT INTO "log_table" ("user_ID", "mbti", "theme", "sum_score", "game_result") VALUES ($1, $2, $3, 0, $4) RETURNING "discussions_ID", "date_time"',
      [userId, 'UNKN', `${theme} / ${stance}`, 'active']
    );

    const discussionId = debate.rows[0].discussions_ID;
    await pool.query('INSERT INTO "chat_log_table" ("discussion_ID", "chat_log") VALUES ($1, $2)', [discussionId, `AI: ${intro}`]);

    return res.json({ debate: { id: discussionId, theme, stance, started_at: debate.rows[0].date_time }, aiReply: intro });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to start debate' });
  }
});

app.post('/api/debate/message', async (req, res) => {
  const { debateId, message } = req.body;
  if (!debateId || !message) return res.status(400).json({ error: 'debateId and message are required' });

  try {
    const debateResult = await pool.query('SELECT "discussions_ID", "theme", "game_result" FROM "log_table" WHERE "discussions_ID" = $1', [debateId]);
    if (debateResult.rowCount === 0) return res.status(404).json({ error: 'debate not found' });
    if (debateResult.rows[0].game_result !== 'active') return res.status(400).json({ error: 'debate already ended' });

    await pool.query('INSERT INTO "chat_log_table" ("discussion_ID", "chat_log") VALUES ($1, $2)', [debateId, `USER: ${message}`]);

    const logs = await pool.query('SELECT "chat_log" FROM "chat_log_table" WHERE "discussion_ID" = $1 ORDER BY "chat_id" ASC LIMIT 30', [debateId]);
    const historyText = logs.rows.map((r) => r.chat_log).join('\n');

    const theme = debateResult.rows[0].theme;
    const stance = theme.split(' / ')[1] || '';

    const prompt = `あなたは論理学に精通した鋭いAIディベーターです。
テーマ: ${theme} / あなたの立場: ${stance}

【指示】
1. ユーザーの最新発言に含まれる矛盾や論理の弱点を突いてください。
2. 150文字以内で、簡潔かつ攻撃的に反論してください。
3. 学術的な議論なので、セーフティフィルターに触れないよう、言葉を選びつつも厳しい議論を行ってください。

【会話履歴】
${historyText}

ユーザーの最新発言: ${message}`;

    let aiReply;
    try {
      aiReply = await callGemini(prompt);
    } catch (geminiError) {
      console.error('Gemini message error:', geminiError.message);
      aiReply = 'AI応答の取得に失敗したため簡易応答です。根拠を1つ具体化して続けてください。';
    }

    await pool.query('INSERT INTO "chat_log_table" ("discussion_ID", "chat_log") VALUES ($1, $2)', [debateId, `AI: ${aiReply}`]);

    return res.json({ aiReply });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to process debate message' });
  }
});

app.post('/api/debate/end', async (req, res) => {
  const { debateId } = req.body;
  if (!debateId) return res.status(400).json({ error: 'debateId is required' });

  try {
    const debateResult = await pool.query('SELECT "discussions_ID", "user_ID", "theme", "game_result" FROM "log_table" WHERE "discussions_ID" = $1', [debateId]);
    if (debateResult.rowCount === 0) return res.status(404).json({ error: 'debate not found' });

    const debate = debateResult.rows[0];
    if (debate.game_result !== 'active') {
      const ended = await pool.query('SELECT "discussions_ID", "sum_score", "mbti" FROM "log_table" WHERE "discussions_ID" = $1', [debateId]);
      return res.json({ debate: { id: ended.rows[0].discussions_ID, score: ended.rows[0].sum_score, mbti: ended.rows[0].mbti, summary: '' } });
    }

    const logs = await pool.query('SELECT "chat_log" FROM "chat_log_table" WHERE "discussion_ID" = $1 ORDER BY "chat_id" ASC', [debateId]);
    const historyText = logs.rows.map((r) => r.chat_log).join('\n');

    // 評価プロンプトの作成
    // app.post('/api/debate/end', ...) 内の evalPrompt を修正
    const evalPrompt = `
    討論評価AIとして、以下の会話ログから「数値」および「MBTI」を判定してください。
    解説や講評などの文章は一切不要です。以下のフォーマットを厳守してください。

    【MBTI判定ガイドライン】
    - 外向(E)/内向(I): 発言の積極性、エネルギーの方向
    - 感覚(S)/直観(N): 具体的な事実重視か、概念・可能性重視か
    - 思考(T)/感情(F): 論理・客観性重視か、価値観・調和重視か
    - 判断(J)/知覚(P): 結論を急ぐか、柔軟に情報を広げるか
    これらをログから分析し、最も適合するタイプを導き出してください。

    【出力フォーマット】
    論理性: (0-30)
    根拠: (0-20)
    反論力: (0-20)
    一貫性: (0-10)
    説得力: (0-10)
    表現力: (0-10)
    MBTI: (4文字)

    【会話ログ】
    ${historyText}
    `;

    let evaluationText;
    try {
      // AIを呼び出す
      evaluationText = await callGemini(evalPrompt);
      console.log("AI Evaluation Response:", evaluationText); // 通信成功時の内容を確認
    } catch (geminiError) {
      // エラーが発生した場合、ターミナルに詳細を表示させる
      console.error('--- Gemini API 呼び出し失敗 ---');
      console.error('エラー内容:', geminiError.message);
      
      // 失敗した場合のみ予備データ。ただし、毎回これが出るなら上のエラーログを確認。
      evaluationText = [
        '論理性: 21',
        '根拠: 14',
        '反論力: 14',
        '一貫性: 7',
        '説得力: 7',
        '表現力: 7',
        'MBTI: INTP'
      ].join('\n');
    }

    // 数値を抽出（正規表現を強化）
    const {
      score,
      mbti,
      logicScore,
      evidenceScore,
      rebuttalScore,
      consistencyScore,
      persuasionScore,
      expressionScore
    } = parseEvaluation(evaluationText);

    // DB更新処理
    await pool.query(
      'UPDATE "log_table" SET "sum_score" = $2, "mbti" = $3, "game_result" = $4 WHERE "discussions_ID" = $1',
      [debateId, score, mbti, 'completed']
    );

    await pool.query(
      'DELETE FROM "log_score_table" WHERE "discussions_ID" = $1 AND "user_ID" = $2',
      [debateId, debate.user_ID]
    );

    await pool.query(
      `INSERT INTO "log_score_table" (
        "discussions_ID", "user_ID", "logic_score", "evidence_score", "rebuttal_score", "consistency_score", "persuasion_score", "expression_score", "sum_score"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [debateId, debate.user_ID, logicScore, evidenceScore, rebuttalScore, consistencyScore, persuasionScore, expressionScore, score]
    );

    return res.json({ debate: { id: Number(debateId), score, mbti, summary: evaluationText } });
  } catch (error) {
    console.error("サーバー内エラー:", error);
    return res.status(500).json({ error: 'failed to end debate' });
  }
});

app.get('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userResult = await pool.query('SELECT "user_ID", "name" FROM "user_table" WHERE "name" = $1', [username]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'user not found' });

    const user = userResult.rows[0];
    const stats = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE "game_result" = 'completed')::int AS debates_count,
        COALESCE(ROUND(AVG("sum_score"))::int, 0) AS average_score,
        COALESCE(MAX("sum_score"), 0) AS best_score
      FROM "log_table"
      WHERE "user_ID" = $1`,
      [user.user_ID]
    );

    return res.json({ user: { id: user.user_ID, username: user.name }, stats: stats.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to fetch user' });
  }
});

app.get('/api/users/:username/debates', async (req, res) => {
  try {
    const { username } = req.params;
    const userResult = await pool.query('SELECT "user_ID" FROM "user_table" WHERE "name" = $1', [username]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'user not found' });

    const userId = userResult.rows[0].user_ID;
    const debates = await pool.query(
      `SELECT "discussions_ID" AS id, "theme", "game_result" AS status, "sum_score" AS score, "mbti", "date_time"
       FROM "log_table"
       WHERE "user_ID" = $1
       ORDER BY "date_time" DESC`,
      [userId]
    );

    return res.json({ debates: debates.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to fetch debates' });
  }
});

app.get('/api/debates/:debateId/messages', async (req, res) => {
  try {
    const debateId = Number(req.params.debateId);
    if (!debateId) return res.status(400).json({ error: 'invalid debateId' });

    const result = await pool.query(
      'SELECT "chat_id" AS id, "chat_log" AS content FROM "chat_log_table" WHERE "discussion_ID" = $1 ORDER BY "chat_id" ASC',
      [debateId]
    );

    return res.json({ messages: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to fetch messages' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT current_database() AS db');
    const hasRankingRoute = !!app._router?.stack?.some(
      (layer) => layer.route && layer.route.path === '/api/ranking'
    );
    res.json({ ok: true, database: r.rows[0].db, hasRankingRoute });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/ranking', async (req, res) => {
  try {
  const period = String(req.query.period || 'week');
  
  // バリデーションを先に通す
  if (!['week', 'month', 'year'].includes(period)) {
    return res.status(400).json({ error: 'period must be week/month/year' });
  }

  // startExpr には SQL の関数を「文字列」として格納
  let startExpr;
  if (period === 'week') {
    // 'week' は月曜日から始まる週の初めを返します
    startExpr = "date_trunc('week', CURRENT_TIMESTAMP)";
  } else if (period === 'month') {
    startExpr = "date_trunc('month', CURRENT_TIMESTAMP)";
  } else if (period === 'year') {
    startExpr = "date_trunc('year', CURRENT_TIMESTAMP)";
  }

  // クエリ例（pgモジュールなどを使用している場合）
  // テンプレートリテラルで startExpr を直接埋め込む際は、引用符で囲まないように注意
  const query = `
    SELECT * FROM battles 
    WHERE created_at >= ${startExpr}
    ORDER BY created_at DESC
  `;

    const q = `
      SELECT
        u."name" AS name,
        l."theme" AS theme,
        l."sum_score" AS score,
        l."date_time" AS date_time
      FROM "log_table" l
      JOIN "user_table" u ON u."user_ID" = l."user_ID"
      WHERE l."game_result" = 'completed'
        AND l."date_time" >= ${startExpr}
      ORDER BY l."sum_score" DESC, l."date_time" DESC
      LIMIT 10
    `;
    const result = await pool.query(q);
    return res.json({ period, ranking: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'failed to fetch ranking' });
  }
});

app.get('/api/ranking/debug', (_req, res) => {
  res.json({ ok: true, route: '/api/ranking' });
});

// server.js の例
app.get('/api/user/stats/:username', (req, res) => {
  const userId = req.params.userId;
  
  // データベース（NeDBなど）からそのユーザーの全履歴を取得
  db.find({ userId: userId }, (err, docs) => {
    if (err || docs.length === 0) {
      return res.json({ avgScore: 0, estimatedMbti: "---" });
    }

    // 平均スコアの計算
    const totalScore = docs.reduce((sum, doc) => sum + Number(doc.score), 0);
    const avgScore = Math.round(totalScore / docs.length);

    // 最新のMBTIを取得（または最も多いタイプを集計）
    // ここでは一番新しい履歴のMBTIを返すと仮定
    const latestDoc = docs.sort((a, b) => b.timestamp - a.timestamp)[0];
    const estimatedMbti = latestDoc.mbti || "---";

    res.json({
      avgScore: avgScore,
      estimatedMbti: estimatedMbti
    });
  });
});

initDB()
  .then(() => {
    app.listen(3000, '0.0.0.0', () => {
      console.log('Server started: http://localhost:3000');
    });
  })
  .catch((error) => {
    console.error('DB init failed:', error);
    process.exit(1);
  });
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
        "password" VARCHAR(255) NOT NULL
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
  const logicMatch = text.match(/LOGIC_SCORE:\s*(\d{1,3})/i);
  const evidenceMatch = text.match(/EVIDENCE_SCORE:\s*(\d{1,3})/i);
  const rebuttalMatch = text.match(/REBUTTAL_SCORE:\s*(\d{1,3})/i);
  const consistencyMatch = text.match(/CONSISTENCY_SCORE:\s*(\d{1,3})/i);
  const persuasionMatch = text.match(/PERSUASION_SCORE:\s*(\d{1,3})/i);
  const expressionMatch = text.match(/EXPRESSION_SCORE:\s*(\d{1,3})/i);
  const scoreMatch = text.match(/FINAL_SCORE:\s*(\d{1,3})/i);
  const mbtiMatch = text.match(/MBTI:\s*([A-Z]{4})/i);

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const logicScore = clamp(Number(logicMatch?.[1] ?? 0) || 0, 0, 30);
  const evidenceScore = clamp(Number(evidenceMatch?.[1] ?? 0) || 0, 0, 20);
  const rebuttalScore = clamp(Number(rebuttalMatch?.[1] ?? 0) || 0, 0, 20);
  const consistencyScore = clamp(Number(consistencyMatch?.[1] ?? 0) || 0, 0, 10);
  const persuasionScore = clamp(Number(persuasionMatch?.[1] ?? 0) || 0, 0, 10);
  const expressionScore = clamp(Number(expressionMatch?.[1] ?? 0) || 0, 0, 10);

  let score = scoreMatch ? Number(scoreMatch[1]) : NaN;
  if (Number.isNaN(score)) {
    score = logicScore + evidenceScore + rebuttalScore + consistencyScore + persuasionScore + expressionScore;
  }
  score = Math.max(0, Math.min(100, score));

  const mbti = mbtiMatch ? mbtiMatch[1].toUpperCase() : 'INTP';
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

  // レートリミット: 無料枠対策で3秒待機
  await new Promise(resolve => setTimeout(resolve, 3000));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || `Gemini API error (${response.status})`);
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  try {
    const exists = await pool.query('SELECT 1 FROM "user_table" WHERE "name" = $1', [username]);
    if (exists.rowCount > 0) return res.status(409).json({ error: 'username already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO "user_table" ("name", "password") VALUES ($1, $2) RETURNING "user_ID", "name"',
      [username, passwordHash]
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
    const result = await pool.query('SELECT "user_ID", "name", "password" FROM "user_table" WHERE "name" = $1', [username]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    return res.json({ user: { id: user.user_ID, username: user.name } });
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

    const prompt = `あなたは厳格なAIディベーター兼採点官です。
テーマ: ${theme} / 立場: ${stance}

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
【合計点：[数値]点】

${historyText}
ユーザー最新発言: ${message}`;

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

    const evalPrompt = [
      'あなたは討論評価AIです。',
      `テーマ: ${debate.theme}`,
      '会話ログを読み、ユーザーの討論を評価してください。',
      '必ず次のフォーマットで返してください。',
      'LOGIC_SCORE: 0-30の整数',
      'EVIDENCE_SCORE: 0-20の整数',
      'REBUTTAL_SCORE: 0-20の整数',
      'CONSISTENCY_SCORE: 0-10の整数',
      'PERSUASION_SCORE: 0-10の整数',
      'EXPRESSION_SCORE: 0-10の整数',
      'FINAL_SCORE: 0-100の整数',
      'MBTI: 4文字（例: INTP）',
      'COMMENT: 日本語で3-5文の講評',
      '',
      historyText,
    ].join('\n');

    let evaluationText;
    try {
      evaluationText = await callGemini(evalPrompt);
    } catch (geminiError) {
      console.error('Gemini evaluation error:', geminiError.message);
      evaluationText = [
        'LOGIC_SCORE: 21',
        'EVIDENCE_SCORE: 14',
        'REBUTTAL_SCORE: 14',
        'CONSISTENCY_SCORE: 7',
        'PERSUASION_SCORE: 7',
        'EXPRESSION_SCORE: 7',
        'FINAL_SCORE: 70',
        'MBTI: INTP',
        'COMMENT: 論点提示は明確でした。'
      ].join('\n');
    }

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
    console.error(error);
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
    const period = String(req.query.period || 'today');
    let startExpr = "date_trunc('day', CURRENT_TIMESTAMP)";
    if (period === 'week') startExpr = "date_trunc('week', CURRENT_TIMESTAMP)";
    if (period === 'month') startExpr = "date_trunc('month', CURRENT_TIMESTAMP)";
    if (!['today', 'week', 'month'].includes(period)) {
      return res.status(400).json({ error: 'period must be today/week/month' });
    }

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

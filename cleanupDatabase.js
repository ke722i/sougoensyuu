require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL接続プール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupUsers() {
  try {
    // 全ユーザーを取得
    const result = await pool.query('SELECT * FROM users');
    const allUsers = result.rows;
    console.log(`現在のレコード数: ${allUsers.length}`);

    // ユーザー名でグループ化して、重複を検出
    const userMap = {};
    for (const user of allUsers) {
      if (!userMap[user.username]) {
        userMap[user.username] = [];
      }
      userMap[user.username].push(user);
    }

    // 重複があるユーザーを削除して、最新のレコードのみ保持
    for (const username in userMap) {
      const records = userMap[username];
      if (records.length > 1) {
        console.log(`ユーザー '${username}' に重複が見つかりました（${records.length}件）。最新のレコードのみ保持します。`);
        
        // 最新のレコード（idが最大のもの）を保持
        const latestRecord = records.reduce((max, user) => user.id > max.id ? user : max);
        
        // その他のレコードを削除
        for (const record of records) {
          if (record.id !== latestRecord.id) {
            await pool.query('DELETE FROM users WHERE id = $1', [record.id]);
            console.log(`  削除: id = ${record.id}`);
          }
        }
      }
    }

    // クリーンアップ後のレコード数を確認
    const remainingResult = await pool.query('SELECT COUNT(*) FROM users');
    const remainingCount = parseInt(remainingResult.rows[0].count);
    console.log(`クリーンアップ後のレコード数: ${remainingCount}`);
    console.log('クリーンアップが完了しました。');
  } catch (error) {
    console.error('クリーンアップ中にエラーが発生しました:', error);
  } finally {
    await pool.end();
  }
}

// スクリプト実行
cleanupUsers();

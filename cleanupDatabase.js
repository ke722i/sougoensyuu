const Datastore = require('nedb-promises');

// データベースの初期化
const usersDB = Datastore.create('users.db');

async function cleanupUsers() {
  try {
    // 全ユーザーを取得
    const allUsers = await usersDB.find({});
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
        
        // 最新のレコード（最後のもの）を保持
        const latestRecord = records[records.length - 1];
        
        // その他のレコードを削除
        for (let i = 0; i < records.length - 1; i++) {
          await usersDB.remove({ _id: records[i]._id });
          console.log(`  削除: _id = ${records[i]._id}`);
        }
      }
    }

    // クリーンアップ後のレコード数を確認
    const remainingUsers = await usersDB.find({});
    console.log(`クリーンアップ後のレコード数: ${remainingUsers.length}`);
    console.log('クリーンアップが完了しました。');
  } catch (error) {
    console.error('クリーンアップ中にエラーが発生しました:', error);
  }
}

// スクリプト実行
cleanupUsers();

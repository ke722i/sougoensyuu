const Datastore = require('nedb-promises');

// データベースの初期化
const usersDB = Datastore.create('users.db');
const battlesDB = Datastore.create('battles.db');

async function calculateAndUpdateAverageScores() {
  try {
    // 全ユーザーを取得
    const users = await usersDB.find({});

    for (const user of users) {
      // battles.dbから該当ユーザーの対戦履歴を取得
      const battles = await battlesDB.find({ username: user.username });
      
      // スコアの合計を計算
      const totalScore = battles.reduce((sum, battle) => sum + battle.score, 0);
      const totalBattles = battles.length;

      if (totalBattles > 0) {
        // 平均点を計算 (小数点第1位まで)
        const averageScore = Math.round((totalScore / totalBattles) * 10) / 10;

        // usersDBを更新（totalScoreとtotalBattlesを同期、平均点を追加）
        await usersDB.update(
          { username: user.username },
          { $set: { totalScore: totalScore, totalBattles: totalBattles, averageScore: averageScore } },
          { upsert: false }
        );

        console.log(`ユーザー ${user.username} の平均点を更新: ${averageScore} (総スコア: ${totalScore}, 対戦回数: ${totalBattles})`);
      } else {
        // 対戦履歴がない場合
        await usersDB.update(
          { username: user.username },
          { $set: { totalScore: 0, totalBattles: 0, averageScore: 0 } },
          { upsert: false }
        );
        console.log(`ユーザー ${user.username} の平均点を更新: 0 (対戦なし)`);
      }
    }

    console.log('全ユーザーの平均点計算と更新が完了しました。');
  } catch (error) {
    console.error('平均点計算中にエラーが発生しました:', error);
  }
}

// スクリプト実行
calculateAndUpdateAverageScores();
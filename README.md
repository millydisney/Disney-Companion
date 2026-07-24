# Disney Companion Realtime

リアルタイム共同編集対応の動作確認版です。

## GitHubへアップロードするファイル
- index.html
- styles.css
- app.js
- manifest.webmanifest

既存リポジトリ内の同名ファイルを、この4ファイルで置き換えてください。
README.mdはアップロードしてもしなくても動作に影響しません。

## 動作確認
1. 表示名を入力
2. 「新しいプランを作る」
3. 共有ボタンからURLを別の端末へ送る
4. 別端末で表示名を入力して参加
5. どちらかで予定を追加し、両方へ反映されるか確認

## 重要
現在のRealtime Databaseはテストモードです。
公開前にFirebase AuthenticationとSecurity Rulesを設定してください。

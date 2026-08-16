# 管理者ページ 初回設定

今回追加したファイル:
- admin.html
- admin.css
- admin.js

通常のアプリはこれまでどおり `index.html` で開きます。
管理ページは公開URLの末尾を `/admin.html` にすると開けます。

例:
`https://millydisney.github.io/＜リポジトリ名＞/admin.html`

## 1. Firebase Authentication
Firebase Console → Authentication → Sign-in method → Google を有効にします。

## 2. 最初の管理者を登録
1. admin.html からGoogleログイン
2. 「まだ管理者登録されていません」とUIDが表示される
3. UIDをコピー
4. Realtime Database のルートに以下を作る

admins
  └─ ＜コピーしたUID＞ : true

その後 admin.html を再読み込みします。

## 3. Firebase Storage
Firebase Console → Storage を有効化します。
写真は `food-images/` 以下に保存されます。

## 4. 重要: 公開前のSecurity Rules
現在Realtime Databaseをテストモードで使用している場合、管理者ページを作っただけでは安全ではありません。
本公開前にAuthenticationを前提としたDatabase / Storageルールへ必ず変更してください。

## 管理画面で登録できる項目
- 商品名
- ランド / シー
- しっかりめ / 軽食 / スイーツ / ドリンク
- 種類（チュロス、ポップコーン等）
- 味
- 価格
- エリア
- 店舗
- モバイルオーダー
- 期間限定
- 販売開始・終了日
- 写真
- 写真提供者
- 管理メモ
- 販売中 / 販売予定 / 販売終了

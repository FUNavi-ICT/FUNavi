# contact-worker

FUNavi ホームページ（https://funavi.kuren.dev ）のお問い合わせフォームから送られた内容を受け取り、Discord のチャンネルに通知する Cloudflare Workers です。

## 初回の公開手順

```sh
cd contact-worker
npx wrangler login                          # ブラウザで Cloudflare にログイン
npx wrangler secret put DISCORD_WEBHOOK_URL # Discord の Webhook URL を貼り付け
npx wrangler deploy                         # 公開（表示された URL を contact.html の ENDPOINT に設定）
```

## 更新

`src/index.js` を直したら `npx wrangler deploy` で反映します。

## 動作

- `ALLOWED_ORIGIN`（wrangler.toml）以外のページからの送信は拒否します
- 入力チェック：名前100文字・メールアドレス254文字・内容3000文字まで、種類は3つのいずれか
- ボット除けの隠し入力欄（website）に入力があった送信は通知しません
- Webhook URL は秘密情報なので、リポジトリには含めず `wrangler secret` で設定します

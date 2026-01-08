# 通勤圏内の仕事情報マップ（MVP）

- 地図（Leaflet + OpenStreetMap）を表示
- 地図クリック地点を通勤起点として、半径10kmの円を表示
- 円内にある求人だけをマーカー表示
- 求人マーカークリックで「職種名 / 会社名」をポップアップ表示

## 起動

```bash
npm install
npm run dev
```

## 求人データについて

- 通常は **Adzuna Job Search API（Japan）** から、起動時に**1回だけ**求人一覧を取得して表示に使用します。
- **APIが失敗した場合は必ずダミーデータ（`src/data/jobs.json`）** を使用します。

### Adzunaの設定（任意）

このプロジェクト直下に **`.env.local`** を作成して、以下を設定してください（`.env.local`はGit管理しません）。

```bash
VITE_ADZUNA_APP_ID=YOUR_APP_ID
VITE_ADZUNA_APP_KEY=YOUR_APP_KEY
```

未設定の場合は自動でダミーデータを使います。

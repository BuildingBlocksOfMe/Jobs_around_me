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

- MVPでは **ダミーデータ（`src/data/jobs.json`）** を表示します。

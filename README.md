# Star History

自托管 star 曲线图，为 [FaceLogin](https://github.com/EthanZer0/FaceLogin) 生成官方 [star-history.com](https://star-history.com) 风格的星标历史图表。

## 图表

![Star History](https://raw.githubusercontent.com/EthanZer0/StarHistory/main/star-history.svg)

## 原理

完全复刻官方 star-history 项目的渲染管线（1:1）：

- **渲染核心** `src/`：官方 `xy-chart.tsx` + `drawAxis/drawLabels/drawLegend/drawWatermark` + d3 依赖，逐字移植
- **数据获取** `src/api.js`：官方 `getRepoStarRecords` 采样逻辑（GitHub API，全量拉取）
- **生成** `scripts/fetch.mjs`：拉数据 → JSDOM + XYChart + svgo 生成 SVG（Date 模式 + 插零点，对齐官方前端交互图）
- **调度** `.github/workflows/star-history.yml`：每日 UTC 02:47 更新

## 在 README 中引用

```markdown
![FaceLogin Star History](https://raw.githubusercontent.com/EthanZer0/StarHistory/main/star-history.svg)
```

## 本地运行

```bash
npm install
# 拉取数据并生成
STAR_HISTORY_TOKEN=<token> node scripts/fetch.mjs
# 或只用已有历史重新生成
node scripts/fetch.mjs
```

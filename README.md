# Star History

自托管 star 曲线图，用官方 [star-history.com](https://star-history.com) 渲染管线为多个 GitHub 项目批量生成星标历史图表。

## 图表

![FaceLogin Star History](https://raw.githubusercontent.com/EthanZer0/StarHistory/main/svg/EthanZer0-FaceLogin.svg)

## 原理

完全复刻官方 star-history 项目的渲染管线（1:1）：

- **渲染核心** `src/`：官方 `xy-chart.tsx` + `drawAxis/drawLabels/drawLegend/drawWatermark` + d3 依赖，逐字移植
- **数据获取** `src/api.js`：官方 `getRepoStarRecords` 采样逻辑（GitHub API，全量拉取）
- **批量生成** `scripts/fetch.mjs`：读 `repos.json`，为每个 repo 生成 `svg/{owner-repo}.svg` + `history/{owner-repo}.json`
- **调度** `.github/workflows/star-history.yml`：每日 UTC 02:47 更新

## 配置要生成的项目

编辑 [repos.json](repos.json)，列出要生成 star 图的仓库：

```json
[
  "EthanZer0/FaceLogin",
  "owner/other-repo"
]
```

workflow 会自动为每个 repo 生成独立 SVG，无需改代码。

## 在 README 中引用

```markdown
![FaceLogin Star History](https://raw.githubusercontent.com/EthanZer0/StarHistory/main/svg/EthanZer0-FaceLogin.svg)
```

## 本地运行

```bash
npm install
STAR_HISTORY_TOKEN=<token> node scripts/fetch.mjs     # 批量（读 repos.json）
# 或单 repo 覆盖
node scripts/fetch.mjs --repos owner/repo --out out.svg
```

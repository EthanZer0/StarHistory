#!/usr/bin/env node
/**
 * 拉取 star 历史并生成 SVG（供 GitHub Action 使用）
 *
 * 用法：
 *   node scripts/fetch.mjs [--repos owner/repo] [--out star-history.svg]
 *
 * 流程：
 *   1. 官方 getRepoStarRecords 全量拉取（采样，不合并旧历史）
 *   2. 写入 history.json
 *   3. 官方渲染管线生成 star-history.svg（Date 模式 + 插零点）
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { getRepoStarRecords } from '../src/api.js';
import { convertDataToChartData } from '../src/chart.js';
import { JSDOM } from 'jsdom';
import { optimize } from 'svgo';
import { XYChart } from '../src/xy-chart.js';
import { addFont } from '../src/addFont.js';
import { addFilter } from '../src/addFilter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPO = 'EthanZer0/FaceLogin';
const HISTORY_FILE = path.join(ROOT, 'history.json');
const MAX_REQUEST_AMOUNT = 16;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { repos: REPO, out: path.join(ROOT, 'star-history.svg') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repos') opts.repos = args[++i];
    else if (args[i] === '--out') opts.out = args[++i];
  }
  return opts;
}

// 官方 fixJsdomSvgCasing
function fixJsdomSvgCasing(svgContent) {
  return svgContent
    .replace(/feturbulence/g, 'feTurbulence')
    .replace(/fedisplacementmap/g, 'feDisplacementMap')
    .replace(/filterunits/g, 'filterUnits')
    .replace(/basefrequency/g, 'baseFrequency')
    .replace(/xchannelselector/g, 'xChannelSelector')
    .replace(/ychannelselector/g, 'yChannelSelector');
}

function patchJsdom(dom) {
  dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  dom.window.SVGElement.prototype.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0 });
  dom.window.SVGElement.prototype.getComputedTextLength = () => 100;
}

// 官方渲染（Date 模式，laptop 尺寸）
async function renderSVG(repoData, outPath) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  patchJsdom(dom);
  const body = dom.window.document.querySelector('body');
  const svg = dom.window.document.createElement('svg');
  body.append(svg);
  svg.setAttribute('width', '800');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  XYChart(
    svg,
    {
      title: 'Star History',
      xLabel: 'Date',
      yLabel: 'GitHub Stars',
      data: convertDataToChartData(repoData, 'Date', { insertZeroPoint: true }),
      showDots: false,
      transparent: false,
      theme: 'light',
    },
    {
      xTickLabelType: 'Date',
      chartWidth: 800,
      useLogScale: false,
      legendPosition: 'top-left',
    }
  );

  const svgContent = fixJsdomSvgCasing(svg.outerHTML);
  const optimized = optimize(svgContent, { multipass: true }).data;
  fs.writeFileSync(outPath, optimized);
  console.log(`已生成 ${outPath} (${optimized.length} bytes)`);
}

async function main() {
  const opts = parseArgs();

  // 1. 全量拉取（官方 getRepoStarRecords 采样，不合并旧历史）
  console.log(`拉取 ${opts.repos}...`);
  const fresh = await getRepoStarRecords(opts.repos, process.env.STAR_HISTORY_TOKEN, MAX_REQUEST_AMOUNT);
  console.log(`最新数据: ${fresh.length} 条 (${fresh[0]?.date} ~ ${fresh[fresh.length - 1]?.date})`);

  // 2. 写入 history.json（官方采样全量）
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(fresh, null, 2));
  console.log(`history.json: ${fresh.length} 条`);
  fresh.forEach((r) => console.log(`  ${r.date} → ${r.count}`));

  // 3. 生成 SVG
  const repoData = [{ repo: opts.repos, starRecords: fresh, logoUrl: '' }];
  await renderSVG(repoData, opts.out);
}

main().catch((e) => {
  console.error('失败:', e.message);
  process.exit(1);
});

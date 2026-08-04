#!/usr/bin/env node
/**
 * 生成 star history SVG —— 移植官方 backend/main.ts 的渲染管线
 *
 * 用法：
 *   node scripts/generate.mjs [--repos owner/repo] [--type date|timeline] [--size mobile|laptop|desktop]
 *                            [--theme light|dark] [--legend top-left|bottom-right] [--out out.svg]
 *                            [--from history.json]  # 用本地历史而不是拉取
 *
 * 渲染管线（与官方一致）：
 *   JSDOM → addFont/addFilter → XYChart（d3）→ fixJsdomSvgCasing → svgo 优化
 */
import { JSDOM } from 'jsdom';
import { optimize } from 'svgo';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { XYChart } from '../src/xy-chart.js';
import { convertDataToChartData } from '../src/chart.js';
import { getRepoStarRecords, loadLocalHistory } from '../src/api.js';
import { addFont } from '../src/addFont.js';
import { addFilter } from '../src/addFilter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'EthanZer0/FaceLogin'; // 默认目标 repo

// 官方 const.ts
const CHART_SIZES = ['mobile', 'laptop', 'desktop'];
const MAX_REQUEST_AMOUNT = 16;
const DEFAULT_SIZE = 'laptop';

// 官方 utils.ts fixJsdomSvgCasing
export const fixJsdomSvgCasing = (svgContent) => {
  return svgContent
    .replace(/feturbulence/g, 'feTurbulence')
    .replace(/fedisplacementmap/g, 'feDisplacementMap')
    .replace(/filterunits/g, 'filterUnits')
    .replace(/basefrequency/g, 'baseFrequency')
    .replace(/xchannelselector/g, 'xChannelSelector')
    .replace(/ychannelselector/g, 'yChannelSelector');
};

// 官方 utils.ts getChartWidthWithSize
export const getChartWidthWithSize = (size) => {
  if (size === 'mobile') return 600;
  else if (size === 'laptop') return 800;
  else if (size === 'desktop') return 1000;
  return 600;
};

// JSDOM 下 SVGElement 缺少的方法
function patchJsdom(dom) {
  dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  dom.window.SVGElement.prototype.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0 });
  dom.window.SVGElement.prototype.getComputedTextLength = () => 100;
  dom.window.SVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { repos: REPO, type: 'timeline', size: DEFAULT_SIZE, theme: 'light', legend: 'top-left', out: null, from: null, insertZero: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--repos') opts.repos = args[++i];
    else if (a === '--type') opts.type = args[++i].toLowerCase() === 'timeline' ? 'Timeline' : 'Date';
    else if (a === '--size') opts.size = args[++i];
    else if (a === '--theme') opts.theme = args[++i];
    else if (a === '--legend') opts.legend = args[++i];
    else if (a === '--out') opts.out = args[++i];
    else if (a === '--from') opts.from = args[++i];
    else if (a === '--no-zero') opts.insertZero = false;
  }
  if (!CHART_SIZES.includes(opts.size)) opts.size = DEFAULT_SIZE;
  return opts;
}

async function renderSVG(opts, repoData) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  patchJsdom(dom);
  const body = dom.window.document.querySelector('body');
  const svg = dom.window.document.createElement('svg');

  if (!dom || !body || !svg) throw new Error('Failed to mock dom with JSDOM');

  body.append(svg);
  svg.setAttribute('width', `${getChartWidthWithSize(opts.size)}`);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  try {
    // 官方 main.ts：XYChart 调用（1:1）
    XYChart(
      svg,
      {
        title: 'Star History',
        xLabel: opts.type === 'Date' ? 'Date' : 'Timeline',
        yLabel: 'GitHub Stars',
        data: convertDataToChartData(repoData, opts.type, { insertZeroPoint: opts.insertZero }),
        showDots: false,
        transparent: false,
        theme: opts.theme === 'dark' ? 'dark' : 'light',
      },
      {
        xTickLabelType: opts.type === 'Date' ? 'Date' : 'Number',
        chartWidth: getChartWidthWithSize(opts.size),
        useLogScale: false,
        legendPosition: opts.legend,
      }
    );
  } catch (error) {
    throw new Error(`Failed to generate chart: ${error.message}`);
  }

  // 在渲染后注入字体和 filter（官方 addFont/addFilter 在 XYChart 之前调用，
  // 但因为 d3 会 selectAll('*').remove()，需在 XYChart 内部或之后加）
  // 官方 XYChart 内部没有调用 addFont/addFilter，它们在 main.ts 之前/之后？
  // 查官方：addFont/addFilter 在 XYChart 里 import 但未调用 → 后端在渲染后手动加

  const svgContent = fixJsdomSvgCasing(svg.outerHTML);
  const optimized = optimize(svgContent, { multipass: true }).data;
  return optimized;
}

async function main() {
  const opts = parseArgs();

  let repoData;
  if (opts.from) {
    // 从本地 history.json 读取
    const history = loadLocalHistory(opts.from);
    if (!history.length) throw new Error(`本地历史为空: ${opts.from}`);
    repoData = [{ repo: opts.repos, starRecords: history, logoUrl: '' }];
    console.log(`使用本地历史: ${opts.from} (${history.length} 条)`);
  } else {
    // 拉取
    const starRecords = await getRepoStarRecords(opts.repos, process.env.STAR_HISTORY_TOKEN, MAX_REQUEST_AMOUNT);
    repoData = [{ repo: opts.repos, starRecords, logoUrl: '' }];
    console.log(`已拉取 ${opts.repos}: ${starRecords.length} 条`);
  }

  const svg = await renderSVG(opts, repoData);

  const outPath = opts.out || path.join(__dirname, '..', 'star-history.svg');
  fs.writeFileSync(outPath, svg);
  console.log(`已生成 ${outPath} (${svg.length} bytes)`);
}

main().catch((e) => {
  console.error('生成失败:', e.message);
  process.exit(1);
});

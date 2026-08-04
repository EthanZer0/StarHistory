#!/usr/bin/env node
/**
 * 批量拉取 star 历史并生成 SVG（供 GitHub Action 使用）
 *
 * 用法：
 *   node scripts/fetch.mjs                     # 读 repos.json，批量生成
 *   node scripts/fetch.mjs --repos a/b --out x.svg   # 单 repo 覆盖
 *
 * 配置：repos.json（repo 列表）
 *   ["EthanZer0/FaceLogin", "owner/other"]
 *
 * 流程（每个 repo）：
 *   1. 官方 getRepoStarRecords 全量拉取（采样，不合并旧历史）
 *   2. 写入 history/{owner-repo}.json
 *   3. 官方渲染管线生成 svg/{owner-repo}.svg（Date 模式 + 插零点）
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { getRepoStarRecords } from '../src/api.js';
import { convertDataToChartData } from '../src/chart.js';
import { JSDOM } from 'jsdom';
import { optimize } from 'svgo';
import { XYChart } from '../src/xy-chart.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MAX_REQUEST_AMOUNT = 16;
const DEFAULT_REPOS_FILE = path.join(ROOT, 'repos.json');

// repo "owner/name" → 文件名安全形式 "owner-name"
function repoToFileName(repo) {
  return repo.replace('/', '-');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { reposFile: DEFAULT_REPOS_FILE, singleRepo: null, singleOut: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repos') opts.singleRepo = args[++i];
    else if (args[i] === '--out') opts.singleOut = args[++i];
    else if (args[i] === '--repos-file') opts.reposFile = args[++i];
  }
  return opts;
}

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

// 官方渲染（Date 模式，laptop 尺寸，单 repo）
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
  console.log(`  已生成 ${outPath} (${optimized.length} bytes)`);
}

// 处理单个 repo：拉取 + 写 history + 生成 SVG
async function processRepo(repo, historyDir, svgDir) {
  console.log(`\n=== ${repo} ===`);
  const fresh = await getRepoStarRecords(repo, process.env.STAR_HISTORY_TOKEN, MAX_REQUEST_AMOUNT);
  console.log(`  最新数据: ${fresh.length} 条 (${fresh[0]?.date} ~ ${fresh[fresh.length - 1]?.date})`);
  fresh.forEach((r) => console.log(`    ${r.date} → ${r.count}`));

  const fname = repoToFileName(repo);
  const histPath = path.join(historyDir, `${fname}.json`);
  fs.writeFileSync(histPath, JSON.stringify(fresh, null, 2));
  console.log(`  history: ${histPath} (${fresh.length} 条)`);

  const outPath = path.join(svgDir, `${fname}.svg`);
  const repoData = [{ repo, starRecords: fresh, logoUrl: '' }];
  await renderSVG(repoData, outPath);
}

async function main() {
  const opts = parseArgs();
  const historyDir = path.join(ROOT, 'history');
  const svgDir = path.join(ROOT, 'svg');
  fs.mkdirSync(historyDir, { recursive: true });
  fs.mkdirSync(svgDir, { recursive: true });

  if (opts.singleRepo) {
    // 单 repo 覆盖模式
    await processRepo(opts.singleRepo, historyDir, svgDir);
    if (opts.singleOut) {
      fs.copyFileSync(path.join(svgDir, `${repoToFileName(opts.singleRepo)}.svg`), opts.singleOut);
      console.log(`已复制到 ${opts.singleOut}`);
    }
    return;
  }

  // 批量模式：读 repos.json
  let repos;
  try {
    repos = JSON.parse(fs.readFileSync(opts.reposFile, 'utf8'));
  } catch (e) {
    console.error(`无法读取 ${opts.reposFile}:`, e.message);
    process.exit(1);
  }
  if (!Array.isArray(repos) || repos.length === 0) {
    console.error(`repos.json 应为非空数组: ${opts.reposFile}`);
    process.exit(1);
  }

  console.log(`批量生成 ${repos.length} 个 repo: ${repos.join(', ')}`);
  for (const repo of repos) {
    try {
      await processRepo(repo, historyDir, svgDir);
    } catch (e) {
      console.error(`  ✗ ${repo} 失败: ${e.message || e}`);
    }
  }
  console.log('\n完成');
}

main().catch((e) => {
  console.error('失败:', e.message);
  process.exit(1);
});

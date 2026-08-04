// 官方 api.tsx → JS（1:1 移植 getRepoStarRecords）
// 数据源：GitHub API stargazers 列表（采样 maxRequestAmount）
import fs from 'fs';
import path from 'path';

const API_PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 15000;

const GITHUB_TOKEN = process.env.STAR_HISTORY_TOKEN || process.env.GITHUB_TOKEN || '';

async function githubFetch(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'star-history-action',
        Accept: 'application/vnd.github.v3.star+json',
        ...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}),
        ...headers,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw { status: res.status, message: body.slice(0, 200) };
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getRepoStargazers(repo, token, page) {
  let url = `https://api.github.com/repos/${repo}/stargazers?per_page=${API_PER_PAGE}`;
  if (page !== undefined) url = `${url}&page=${page}`;
  return githubFetch(url);
}

export async function getRepoStargazersCount(repo, token) {
  const res = await githubFetch(`https://api.github.com/repos/${repo}`);
  return (await res.json()).stargazers_count;
}

// 官方 getDateString（yyyy/MM/dd）
export function getDateString(t) {
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 官方 getRepoStarRecords（1:1）
export async function getRepoStarRecords(repo, token, maxRequestAmount) {
  const patchRes = await getRepoStargazers(repo, token);

  const headerLink = patchRes.headers.get('link') || '';
  let pageCount = 1;
  const regResult = /next.*&page=(\d*).*last/.exec(headerLink);
  if (regResult && regResult[1] && Number.isInteger(Number(regResult[1]))) {
    pageCount = Number(regResult[1]);
  }

  const patchData = await patchRes.json();
  if (pageCount === 1 && patchData.length === 0) {
    throw { status: patchRes.status, data: [] };
  }

  const requestPages = [];
  if (pageCount < maxRequestAmount) {
    for (let i = 1; i <= pageCount; i++) requestPages.push(i);
  } else {
    for (let i = 1; i <= maxRequestAmount; i++) {
      requestPages.push(Math.round((i * pageCount) / maxRequestAmount) - 1);
    }
    if (!requestPages.includes(1)) requestPages[0] = 1;
  }

  const starRecordsMap = new Map();

  if (requestPages.length < maxRequestAmount) {
    const starRecordsData = [];
    for (const page of requestPages) {
      const res = await getRepoStargazers(repo, token, page);
      starRecordsData.push(...(await res.json()));
    }
    for (let i = 0; i < starRecordsData.length; ) {
      starRecordsMap.set(getDateString(starRecordsData[i].starred_at), i + 1);
      i += Math.floor(starRecordsData.length / maxRequestAmount) || 1;
    }
  } else {
    for (let index = 0; index < requestPages.length; index++) {
      const page = requestPages[index];
      const res = await getRepoStargazers(repo, token, page);
      const data = await res.json();
      if (data.length > 0) {
        const starRecord = data[0];
        const pageStartPosition = API_PER_PAGE * (requestPages[index] - 1);
        starRecordsMap.set(getDateString(starRecord.starred_at), pageStartPosition);
      }
    }
  }

  const starAmount = await getRepoStargazersCount(repo, token);
  starRecordsMap.set(getDateString(Date.now()), starAmount);

  const starRecords = [];
  starRecordsMap.forEach((v, k) => {
    starRecords.push({ date: k, count: v });
  });

  return starRecords;
}

// 读取本地累积历史（跨运行保留）
export function loadLocalHistory(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`读取本地历史失败: ${filePath}`, e.message);
  }
  return [];
}

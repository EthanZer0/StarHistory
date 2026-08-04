// 官方 addFont.tsx → JS（字体从 assets/xkcd-woff.b64 读取，运行时内嵌）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, '..', 'assets', 'xkcd-woff.b64');

export const xkcdFontUrl = (() => {
  try {
    const b64 = fs.readFileSync(FONT_PATH, 'utf8').trim();
    return `data:application/font-woff;charset=utf-8;base64,${b64}`;
  } catch (e) {
    console.warn('字体文件缺失，回退系统字体:', FONT_PATH);
    return '';
  }
})();

export const addFont = (selection) => {
  selection.append('defs').append('style').attr('type', 'text/css').text(`@font-face {
      font-family: "xkcd";
      src: url(${xkcdFontUrl}) format('woff');
    }`);
};

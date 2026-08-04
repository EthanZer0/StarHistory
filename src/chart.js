// 官方 chart.tsx → JS（1:1 移植 convertDataToChartData）
// 数据 → {x, y}，支持 Date / Timeline 两种模式 + insertZeroPoint

// 官方 getTimeStampByDate
export function getTimeStampByDate(t) {
  return new Date(t).getTime();
}

// 官方 getDateString（yyyy/MM/dd，可带格式）
export function getDateString(t, format = 'yyyy/MM/dd hh:mm:ss') {
  const d = new Date(getTimeStampByDate(t));
  const map = {
    yyyy: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    dd: String(d.getDate()).padStart(2, '0'),
    hh: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0'),
  };
  return format.replace(/yyyy|MM|dd|hh|mm|ss/g, (match) => map[match]);
}

export const DEFAULT_MAX_REQUEST_AMOUNT = 15;

// 官方 convertDataToChartData（1:1）
export function convertDataToChartData(repoData, chartMode, options) {
  if (chartMode === 'Date') {
    const datasets = repoData.map(({ repo, starRecords, logoUrl }) => {
      const chartData = starRecords.map((item) => ({
        x: new Date(item.date),
        y: Number(item.count),
      }));

      if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
        const firstDate = new Date(chartData[0].x);
        firstDate.setDate(firstDate.getDate() - 1);
        chartData.unshift({ x: firstDate, y: 0 });
      }

      return { label: repo, logo: logoUrl, data: chartData };
    });

    return { datasets };
  } else {
    const datasets = repoData.map(({ repo, starRecords, logoUrl }) => {
      const chartData = starRecords.map((item) => ({
        x: getTimeStampByDate(new Date(item.date)) - getTimeStampByDate(new Date(starRecords[0].date)),
        y: Number(item.count),
      }));

      if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
        chartData.unshift({ x: -1, y: 0 });
      }

      return { label: repo, logo: logoUrl, data: chartData };
    });

    return { datasets };
  }
}

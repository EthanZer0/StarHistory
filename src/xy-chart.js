// 官方 xy-chart.tsx → JS 移植（1:1，逐字保留逻辑）
// 依赖：d3-scale, d3-selection, d3-shape, d3-axis, dayjs, lodash/uniq
import { scaleLinear, scaleTime, scaleSymlog } from 'd3-scale';
import { select } from 'd3-selection';
import { line, curveMonotoneX } from 'd3-shape';
import dayjs from 'dayjs';
import uniq from 'lodash/uniq.js';

import { drawXAxis, drawYAxis } from './drawAxis.js';
import { drawTitle, drawXLabel, drawYLabel } from './drawLabels.js';
import { drawLegend } from './drawLegend.js';
import { drawWatermark } from './drawWatermark.js';
import { getFormatTimeline, getTimestampFormatUnit } from './getFormatTimeline.js';
import { colors, darkColors } from './types.js';
import { addFont } from './addFont.js';
import { addFilter } from './addFilter.js';

const margin = {
  top: 50,
  right: 30,
  bottom: 50,
  left: 50,
};

const getDefaultOptions = (transparent) => {
  return {
    envType: 'node',
    xTickLabelType: 'Date',
    dateFormat: 'MMM DD, YYYY',
    xTickCount: 5,
    yTickCount: 5,
    showLine: true,
    dotSize: 0.5,
    dataColors: colors,
    fontFamily: 'xkcd',
    backgroundColor: transparent ? 'transparent' : 'white',
    strokeColor: 'black',
    legendPosition: 'top-left',
  };
};

const getDarkThemeDefaultOptions = (transparent) => {
  return {
    ...getDefaultOptions(transparent),
    dataColors: darkColors,
    backgroundColor: transparent ? 'transparent' : '#0d1117',
    strokeColor: 'white',
  };
};

export const XYChart = (svg, { title, xLabel, yLabel, data: { datasets }, showDots, theme, transparent }, initialOptions) => {
  const options = {
    ...(theme === 'dark' ? getDarkThemeDefaultOptions(transparent) : getDefaultOptions(transparent)),
    ...initialOptions,
  };

  if (title) margin.top = 60;
  if (xLabel) margin.bottom = 50;
  if (yLabel) margin.left = 70;

  const data = { datasets };

  const filter = 'url(#xkcdify)';
  const fontFamily = options.fontFamily || 'xkcd';
  const clientWidth = Number(svg.clientWidth || svg.getAttribute('width') || '') || 600;
  const clientHeight = (clientWidth * 2) / 3;

  const d3Selection = select(svg)
    .style('stroke-width', 3)
    .style('font-family', fontFamily)
    .style('background', options.backgroundColor)
    .attr('width', clientWidth)
    .attr('height', clientHeight)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  d3Selection.selectAll('*').remove();

  // 官方 xy-chart.tsx:140-141：渲染前注入字体和手绘 filter
  addFont(d3Selection);
  addFilter(d3Selection);

  const chart = d3Selection.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  if (options.xTickLabelType === 'Date') {
    data.datasets.forEach((dataset) => {
      dataset.data.forEach((d) => {
        d.x = dayjs(d.x);
      });
    });
  }

  const allData = [];
  data.datasets.map((d) => allData.push(...d.data));

  const allXData = allData.map((d) => d.x);
  const allYData = allData.map((d) => d.y);

  const chartWidth = clientWidth - margin.left - margin.right;
  const chartHeight = clientHeight - margin.top - margin.bottom;

  let xScale = scaleTime()
    .domain([
      Math.min(...allXData.map((d) => Number(d))),
      Math.max(...allXData.map((d) => Number(d))),
    ])
    .range([0, chartWidth]);

  if (options.xTickLabelType === 'Number') {
    xScale = scaleLinear()
      .domain([0, Math.max(...allXData.map((d) => Number(d)))])
      .range([0, chartWidth]);
  }

  let yScale;
  if (options.useLogScale) {
    const maxYData = Math.max(...allYData);
    yScale = scaleSymlog()
      .domain([0, maxYData])
      .range([chartHeight, 0])
      .constant(10);
  } else {
    yScale = scaleLinear()
      .domain([0, Math.max(...allYData)])
      .range([chartHeight, 0]);
  }

  const svgChart = chart.append('g').attr('pointer-events', 'all');

  drawWatermark(svgChart, chartWidth, chartHeight);

  if (title) {
    if (uniq(datasets.map((d) => d.label.split('/')[0])).length === 1) {
      drawTitle(d3Selection, title, datasets[0].logo, options.strokeColor, options.chartWidth);
    } else {
      drawTitle(d3Selection, title, '', options.strokeColor, options.chartWidth);
    }
  }
  if (xLabel) drawXLabel(d3Selection, xLabel, options.strokeColor);
  if (yLabel) {
    const maxYData = Math.max(...allYData);
    let offsetY = 24;
    if (maxYData > 100000) offsetY = 2;
    else if (maxYData > 10000) offsetY = 8;
    else if (maxYData > 1000) offsetY = 12;
    else if (maxYData > 100) offsetY = 20;
    drawYLabel(d3Selection, yLabel, options.strokeColor, offsetY);
  }

  drawXAxis(svgChart, {
    xScale,
    tickCount: options.xTickCount,
    moveDown: chartHeight,
    fontFamily,
    stroke: options.strokeColor,
    type: options.xTickLabelType,
  });
  drawYAxis(svgChart, {
    yScale,
    tickCount: options.yTickCount,
    fontFamily,
    stroke: options.strokeColor,
    useLogScale: options.useLogScale,
  });

  if (options.showLine) {
    const drawLine = line()
      .x((d) => xScale(d.x) || 0)
      .y((d) => yScale(d.y) || 0)
      .curve(curveMonotoneX);

    svgChart
      .selectAll('.xkcd-chart-xyline')
      .data(data.datasets)
      .enter()
      .append('path')
      .attr('class', 'xkcd-chart-xyline')
      .attr('d', (d) => drawLine(d.data))
      .attr('fill', 'none')
      .attr('stroke', (_, i) => options.dataColors[i])
      .attr('filter', filter);
  }

  if (showDots) {
    const dotInitSize = 3.5 * (options.dotSize === undefined ? 1 : options.dotSize);
    const dotHoverSize = 6 * (options.dotSize === undefined ? 1 : options.dotSize);
    svgChart
      .selectAll('.xkcd-chart-xycircle-group')
      .data(data.datasets)
      .enter()
      .append('g')
      .attr('class', 'xkcd-chart-xycircle-group')
      .attr('filter', filter)
      .attr('xy-group-index', (_, i) => i)
      .selectAll('.xkcd-chart-xycircle-circle')
      .data((dataset) => dataset.data)
      .enter()
      .append('circle')
      .attr('class', 'chart-tooltip-dot')
      .style('stroke', (_, i, nodes) => {
        const xyGroupIndex = Number(select(nodes[i].parentElement).attr('xy-group-index'));
        return options.dataColors[xyGroupIndex];
      })
      .style('fill', (_, i, nodes) => {
        const xyGroupIndex = Number(select(nodes[i].parentElement).attr('xy-group-index'));
        return options.dataColors[xyGroupIndex];
      })
      .attr('r', dotInitSize)
      .attr('cx', (d) => xScale(d.x) || 0)
      .attr('cy', (d) => yScale(d.y) || 0);
  }

  // 图例
  const legendItems = data.datasets.map((dataset, i) => ({
    color: options.dataColors[i] || '',
    text: dataset.label,
    logo: dataset.logo,
  }));

  drawLegend(svgChart, {
    items: legendItems,
    strokeColor: options.strokeColor,
    backgroundColor: options.backgroundColor,
    legendPosition: options.legendPosition || 'top-left',
    chartWidth,
    chartHeight,
  });
};

export { margin };

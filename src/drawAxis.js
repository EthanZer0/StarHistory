// 官方 drawAxis.tsx → JS（1:1）
import { axisBottom, axisLeft } from 'd3-axis';
import getFormatNumber, { getNumberFormatUnit } from './getFormatNumber.js';
import { getFormatTimeline, getTimestampFormatUnit } from './getFormatTimeline.js';

export const drawXAxis = (selection, { xScale, tickCount, moveDown, fontFamily, stroke, type }) => {
  const xAxisGenerator = axisBottom(xScale).tickSize(0).tickPadding(6).ticks(tickCount);

  if (type === 'Number') {
    let index = 1;
    let type_ = undefined;
    xAxisGenerator.tickFormat((d) => {
      const timestamp = Number(d);
      const tickAmount = selection.selectAll('.xaxis > .tick').nodes().length;
      index++;
      if (timestamp === 0 || (tickAmount >= 7 && index % 2 === 0)) {
        return ' ';
      }
      if (!type_) {
        type_ = getTimestampFormatUnit(timestamp);
      }
      return getFormatTimeline(timestamp, type_);
    });
  }

  selection.append('g').attr('class', 'xaxis').attr('transform', `translate(0,${moveDown})`).call(xAxisGenerator);

  selection.selectAll('.domain').attr('filter', 'url(#xkcdify)').style('stroke', stroke);

  selection.selectAll('.xaxis > .tick > text').style('font-family', fontFamily).style('font-size', '16px').style('fill', stroke);
};

export const drawYAxis = (selection, { yScale, tickCount, fontFamily, stroke, useLogScale }) => {
  let type = undefined;
  const yAxisGenerator = axisLeft(yScale)
    .tickSize(1)
    .tickPadding(6);

  if (useLogScale) {
    // 官方 log 刻度逻辑（完整保留）
    const domain = yScale.domain();
    const maxValue = Math.max(...domain);

    const logTicks = [0];

    let startPower = 0;
    if (maxValue >= 10000) startPower = 2;
    else if (maxValue >= 100) startPower = 1;
    else if (maxValue >= 10) startPower = 1;
    else {
      if (maxValue <= 5) logTicks.push(Math.ceil(maxValue));
      else logTicks.push(5, Math.ceil(maxValue));

      yAxisGenerator.tickValues(logTicks).tickFormat((d) => (d === 0 ? '0' : d.toString()));

      selection.append('g').attr('class', 'yaxis').call(yAxisGenerator);
      selection.selectAll('.domain').attr('filter', 'url(#xkcdify)').style('stroke', stroke);
      selection.selectAll('.yaxis > .tick > text').style('font-family', fontFamily).style('font-size', '16px').style('fill', stroke);
      return;
    }

    let power = startPower;
    let tickCount_ = 1;
    const maxTicks = 6;

    while (Math.pow(10, power) <= maxValue && tickCount_ < maxTicks) {
      const tick = Math.pow(10, power);
      logTicks.push(tick);
      tickCount_++;
      power++;
    }

    if (tickCount_ < maxTicks && maxValue > logTicks[logTicks.length - 1]) {
      const lastTick = logTicks[logTicks.length - 1];
      if (maxValue > lastTick * 2) logTicks.push(Math.pow(10, Math.ceil(Math.log10(maxValue))));
    }

    yAxisGenerator.tickValues(logTicks).tickFormat((d) => {
      if (d === 0) return '0';
      if (!type) type = getNumberFormatUnit(d);
      return getFormatNumber(d, type);
    });
  } else {
    yAxisGenerator.ticks(tickCount, 's').tickFormat((d) => {
      if (d === 0) return ' ';
      if (!type) type = getNumberFormatUnit(d);
      return getFormatNumber(d, type);
    });
  }

  selection.append('g').attr('class', 'yaxis').call(yAxisGenerator);

  selection.selectAll('.domain').attr('filter', 'url(#xkcdify)').style('stroke', stroke);

  selection.selectAll('.yaxis > .tick > text').style('font-family', fontFamily).style('font-size', '16px').style('fill', stroke);
};

// 官方 drawLabels.tsx → JS（1:1）
export const drawTitle = (selection, text, logoURL, color, chartWidth) => {
  let logoX = '38%', clipX = '39.5%';
  if (selection.node()?.getBoundingClientRect()) {
    logoX = selection.node().getBoundingClientRect().width * 0.5 - 84;
    clipX = selection.node().getBoundingClientRect().width * 0.5 - 73;
  }
  if (chartWidth) {
    logoX = chartWidth * 0.5 - 84;
    clipX = chartWidth * 0.5 - 73;
  }

  selection.append('text').style('font-size', '20px').style('font-weight', 'bold').style('fill', color).attr('x', '50%').attr('y', 30).attr('text-anchor', 'middle').text(text);
  selection
    .append('svg')
    .append('defs')
    .append('clipPath')
    .attr('id', 'clip-circle-title')
    .append('circle')
    .attr('r', 11)
    .attr('cx', clipX)
    .attr('cy', 12 + 11);
  if (logoURL) {
    selection.append('image').attr('x', logoX).attr('y', 12).attr('height', 22).attr('width', 22).attr('href', logoURL).attr('clip-path', 'url(#clip-circle-title)');
  }
};

export const drawXLabel = (selection, text, color) => {
  selection
    .append('text')
    .style('font-size', '17px')
    .style('fill', color)
    .attr('x', '50%')
    .attr('y', (Number(selection.attr('height')) || 10) - 10)
    .attr('text-anchor', 'middle')
    .text(text);
};

export const drawYLabel = (selection, text, color, offsetY = 6) => {
  selection
    .append('text')
    .attr('text-anchor', 'end')
    .attr('dy', '.75em')
    .attr('transform', 'rotate(-90)')
    .style('font-size', '17px')
    .style('fill', color)
    .text(text)
    .attr('y', offsetY)
    .call((f) => {
      const defaultTextLength = 100;
      let textLength = defaultTextLength;
      if (f.node()?.getComputedTextLength) {
        textLength = f.node().getComputedTextLength();
      }
      const offsetX = Math.floor(textLength / 2 - ((Number(selection.attr('height')) || 10) / 2));
      f.attr('x', offsetX);
    });
};

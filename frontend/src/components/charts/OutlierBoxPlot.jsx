import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const OutlierBoxPlot = () => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const W = ref.current.clientWidth || 480;
    const H = 150;
    const m = { top: 20, right: 20, bottom: 30, left: 36 };
    const svg = d3.select(ref.current).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const cols = [
      { label: 'age',    q1: 25, med: 36, q3: 50, low: 18,    high: 72,     out: [215, 287, 340]     },
      { label: 'income', q1: 38, med: 62, q3: 95, low: 12,    high: 180,    out: [430, 610]           },
    ];

    const bw = (W - m.left - m.right) / cols.length;
    const bh = 28;

    cols.forEach((c, ci) => {
      const allVals = [c.low, c.q1, c.med, c.q3, c.high, ...c.out];
      const xScale = d3.scaleLinear()
        .domain([d3.min(allVals) * 0.85, d3.max(allVals) * 1.15])
        .range([m.left + ci * bw + 10, m.left + (ci + 1) * bw - 10]);
      const cy2 = m.top + (H - m.top - m.bottom) / 2;

      // whisker
      svg.append('line')
        .attr('x1', xScale(c.low)).attr('x2', xScale(c.high))
        .attr('y1', cy2).attr('y2', cy2)
        .attr('stroke', '#252540').attr('stroke-width', 1.5);
      [c.low, c.high].forEach(v => {
        svg.append('line')
          .attr('x1', xScale(v)).attr('x2', xScale(v))
          .attr('y1', cy2 - 8).attr('y2', cy2 + 8)
          .attr('stroke', '#252540').attr('stroke-width', 1.5);
      });

      // IQR box
      svg.append('rect')
        .attr('x', xScale(c.q1)).attr('y', cy2 - bh / 2)
        .attr('width', xScale(c.q3) - xScale(c.q1)).attr('height', bh)
        .attr('fill', 'rgba(255,107,43,0.12)').attr('stroke', '#ff6b2b')
        .attr('stroke-width', 1.5).attr('rx', 4);

      // median
      svg.append('line')
        .attr('x1', xScale(c.med)).attr('x2', xScale(c.med))
        .attr('y1', cy2 - bh / 2).attr('y2', cy2 + bh / 2)
        .attr('stroke', '#ff6b2b').attr('stroke-width', 2.5);

      // outliers
      c.out.forEach(o => {
        svg.append('circle').attr('cx', xScale(o)).attr('cy', cy2).attr('r', 5.5)
          .attr('fill', '#ef444420').attr('stroke', '#ef4444').attr('stroke-width', 1.5);
      });

      // label
      svg.append('text')
        .attr('x', xScale((c.q1 + c.q3) / 2)).attr('y', m.top + (H - m.top - m.bottom) + 16)
        .attr('text-anchor', 'middle').attr('fill', '#4b5563')
        .attr('font-size', 10).attr('font-family', 'Space Mono').text(c.label);
    });

    // Legend
    [['#ff6b2b', 'IQR'], ['#ef4444', 'Outlier']].forEach(([c, l], i) => {
      svg.append('circle').attr('cx', m.left + i * 72 + 4).attr('cy', 10).attr('r', 4)
        .attr('fill', c);
      svg.append('text').attr('x', m.left + i * 72 + 12).attr('y', 14)
        .attr('fill', '#4b5563').attr('font-size', 9).attr('font-family', 'Space Mono').text(l);
    });
  }, []);

  return <svg ref={ref} style={{ width: '100%' }} />;
};

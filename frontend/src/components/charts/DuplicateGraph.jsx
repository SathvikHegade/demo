import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const DuplicateGraph = () => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const W = 400, H = 280;
    const svg = d3.select(ref.current).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    // Subtle grid
    const defs = svg.append('defs');
    const pattern = defs.append('pattern').attr('id','grid').attr('width',20).attr('height',20).attr('patternUnits','userSpaceOnUse');
    pattern.append('path').attr('d','M 20 0 L 0 0 0 20').attr('fill','none').attr('stroke','#1a1a2e').attr('stroke-width',0.5);
    svg.append('rect').attr('width',W).attr('height',H).attr('fill','url(#grid)').attr('rx',12);

    const nodes = [
      { id: 0, g: 0, label: 'Row 23' }, { id: 1, g: 0, label: 'Row 405' }, { id: 2, g: 0, label: 'Row 71' },
      { id: 3, g: 1, label: 'Row 12' }, { id: 4, g: 1, label: 'Row 78' },  { id: 5, g: 1, label: 'Row 99' },
      { id: 6, g: 2, label: 'Row 201' },{ id: 7, g: 2, label: 'Row 356' },
    ];
    const links = [
      {source:0,target:1,v:1.0},{source:1,target:2,v:0.97},{source:0,target:2,v:0.95},
      {source:3,target:4,v:0.88},{source:4,target:5,v:0.91},{source:3,target:5,v:0.86},
      {source:6,target:7,v:1.0},
    ];
    const colors = ['#ff6b2b', '#8b5cf6', '#22d3ee'];

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(56))
      .force('charge', d3.forceManyBody().strength(-140))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(26));

    const link = svg.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', d => colors[d.source.g])
      .attr('stroke-opacity', 0.35).attr('stroke-width', d => d.v * 2);

    const node = svg.append('g').selectAll('g').data(nodes).join('g')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle').attr('r', 18)
      .attr('fill', d => colors[d.g] + '15')
      .attr('stroke', d => colors[d.g])
      .attr('stroke-width', 1.5)
      .style('filter', d => `drop-shadow(0 0 6px ${colors[d.g]}55)`);

    node.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', '#9ca3af').attr('font-size', 8.5).attr('font-family', 'Space Mono').text(d => d.label);

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${Math.max(20,Math.min(W-20,d.x))},${Math.max(20,Math.min(H-20,d.y))})`);
    });
  }, []);

  return (
    <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: '#07070f' }}>
      <svg ref={ref} style={{ width: '100%' }} />
    </div>
  );
};

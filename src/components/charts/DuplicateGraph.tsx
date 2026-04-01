import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const DuplicateGraph = ({ data }: { data?: any }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    
    // Mock data for nodes and links if none provided
    const nodes = [
      { id: 1, group: 1, name: "Row 23" },
      { id: 2, group: 1, name: "Row 405" },
      { id: 3, group: 2, name: "Row 12" },
      { id: 4, group: 2, name: "Row 78" },
      { id: 5, group: 2, name: "Row 99" }
    ];
    const links = [
      { source: 1, target: 2, value: 0.99 },
      { source: 3, target: 4, value: 0.85 },
      { source: 4, target: 5, value: 0.92 },
      { source: 3, target: 5, value: 0.88 }
    ];

    const width = 400;
    const height = 300;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
      
    svg.selectAll('*').remove();

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#a855f7')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.value * 3);

    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 8)
      .attr('fill', '#f97316')
      .call(drag(simulation) as any);

    node.append('title')
      .text(d => d.name);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    function drag(simulation: any) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  }, []);

  return (
    <div className="w-full flex justify-center bg-[#111118] border border-[#1e1e2e] rounded-lg">
      <svg ref={svgRef}></svg>
    </div>
  );
};

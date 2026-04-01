import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const OutlierBoxPlot = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 150;
    const margin = {top: 20, right: 20, bottom: 30, left: 40};

    // Dummy statistics for Age
    const q1 = 25, median = 35, q3 = 50, min = 18, max = 75;
    const outliers = [85, 99, 120];

    const x = d3.scaleLinear()
      .domain([0, 130])
      .range([margin.left, width - margin.right]);

    const center = height / 2;

    // Main horizontal line
    svg.append("line")
      .attr("x1", x(min))
      .attr("x2", x(max))
      .attr("y1", center)
      .attr("y2", center)
      .attr("stroke", "#64748b")
      .attr("stroke-width", 2);

    // Box
    svg.append("rect")
      .attr("x", x(q1))
      .attr("y", center - 20)
      .attr("height", 40)
      .attr("width", x(q3) - x(q1))
      .attr("stroke", "#f97316")
      .attr("fill", "rgba(249, 115, 22, 0.2)");

    // Median, min, max
    svg.selectAll("lines")
      .data([min, median, max])
      .enter()
      .append("line")
      .attr("x1", d => x(d))
      .attr("x2", d => x(d))
      .attr("y1", center - 20)
      .attr("y2", center + 20)
      .attr("stroke", d => d === median ? "#f97316" : "#64748b")
      .attr("stroke-width", 2);

    // Outliers
    svg.selectAll("outliers")
      .data(outliers)
      .enter()
      .append("circle")
      .attr("cx", d => x(d))
      .attr("cy", center)
      .attr("r", 4)
      .style("fill", "#ef4444")
      .attr("stroke", "#111118");

  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
        <h4 className="text-[#f1f5f9] font-mono text-sm mb-2 text-center w-full">Age Distribution</h4>
        <svg ref={svgRef} width="400" height="150" className="max-w-full"></svg>
    </div>
  );
};

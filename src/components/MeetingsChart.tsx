import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { CalendarEvent } from '../types';
import { eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, format } from 'date-fns';
import { it } from 'date-fns/locale';

interface MeetingsChartProps {
  events: CalendarEvent[];
  currentDate: Date;
}

export function MeetingsChart({ events, currentDate }: MeetingsChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    d3.select(svgRef.current).selectAll('*').remove();

    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    const data = days.map(day => ({
      date: day,
      label: format(day, 'E', { locale: it }).substring(0, 3),
      count: events.filter(e => isSameDay(new Date(e.date), day)).length
    }));

    const margin = { top: 10, right: 10, bottom: 20, left: 15 };
    const width = 256 - margin.left - margin.right;
    const height = 130 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
      .domain(data.map(d => d.label))
      .range([0, width])
      .padding(0.1);

    const maxCount = d3.max(data, d => d.count) || 1;
    
    const y = d3.scaleLinear()
      .domain([0, maxCount + Math.ceil(maxCount * 0.2)])
      .range([height, 0]);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y)
        .ticks(3)
        .tickSize(-width)
        .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-dasharray', '2,2');
      
    svg.selectAll('.grid .domain').remove();

    // Area
    const area = d3.area<typeof data[0]>()
      .x(d => x(d.label) || 0)
      .y0(height)
      .y1(d => y(d.count))
      .curve(d3.curveMonotoneX);

    // Line
    const line = d3.line<typeof data[0]>()
      .x(d => x(d.label) || 0)
      .y(d => y(d.count))
      .curve(d3.curveMonotoneX);

    // Gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
      
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#A881F3')
      .attr('stop-opacity', 0.4);
      
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#A881F3')
      .attr('stop-opacity', 0.0);

    svg.append('path')
      .datum(data)
      .attr('fill', 'url(#area-gradient)')
      .attr('d', area);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#A881F3')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Data points
    svg.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => x(d.label) || 0)
      .attr('cy', d => y(d.count))
      .attr('r', 3)
      .attr('fill', '#1C1C1E')
      .attr('stroke', '#A881F3')
      .attr('stroke-width', 1.5);

    // X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .selectAll('text')
      .style('fill', '#a1a1aa')
      .style('font-size', '10px')
      .style('font-family', 'inherit')
      .style('text-transform', 'capitalize')
      .attr('dy', '10px');

    svg.selectAll('.domain').remove();

    // Y axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(3).tickFormat(d3.format('d')).tickSize(0))
      .selectAll('text')
      .style('fill', '#71717a')
      .style('font-size', '10px')
      .style('font-family', 'inherit')
      .attr('dx', '-5px');

    svg.selectAll('.domain').remove();

  }, [events, currentDate]);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-sm font-medium text-white mb-4">
        Statistiche Settimana
      </div>
      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
}

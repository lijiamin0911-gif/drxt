/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface ChartDataItem {
  label: string;
  value: number;
}

export function TrendChart({ data }: { data: ChartDataItem[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        暂无趋势数据
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = 500;
  const height = 240;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const roundedMax = Math.ceil(maxVal * 1.15); // Add 15% padding at top

  // Generate Y axis ticks
  const ticksY = [0, roundedMax * 0.25, roundedMax * 0.5, roundedMax * 0.75, roundedMax];

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.value / roundedMax) * chartHeight;
    return { x, y, label: d.label, val: d.value };
  });

  // SVG Path generator
  let linePath = '';
  let areaPath = '';
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    areaPath = `M ${points[0].x} ${padding.top + chartHeight}`;
    
    // Draw smooth lines or straight lines
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      // Cubic bezier control points for beautiful smooth curve
      const cpX1 = p1.x + (p2.x - p1.x) / 3;
      const cpY1 = p1.y;
      const cpX2 = p2.x - (p2.x - p1.x) / 3;
      const cpY2 = p2.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p2.x} ${p2.y}`;
    }

    // Capture path segments for fill
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const cpX1 = p1.x + (p2.x - p1.x) / 3;
      const cpY1 = p1.y;
      const cpX2 = p2.x - (p2.x - p1.x) / 3;
      const cpY2 = p2.y;
      areaPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p2.x} ${p2.y}`;
    }
    areaPath += ` L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;
  }

  const formatCurrencyAbbrev = (val: number) => {
    if (val >= 10000) {
      return `¥${(val / 10000).toFixed(1)}万`;
    }
    return `¥${val.toFixed(0)}`;
  };

  return (
    <div className="relative w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a5c9e" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#1a5c9e" stopOpacity="0.0"/>
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines & Labels */}
        {ticksY.map((tick, i) => {
          const y = padding.top + chartHeight - (tick / roundedMax) * chartHeight;
          return (
            <g key={i} className="opacity-40">
              <line 
                x1={padding.left} 
                y1={y} 
                x2={width - padding.right} 
                y2={y} 
                stroke="#e4e4e7" 
                strokeDasharray="4 4" 
                strokeWidth={1}
              />
              <text 
                x={padding.left - 8} 
                y={y + 4} 
                fontSize="10" 
                fill="#71717a" 
                textAnchor="end"
                fontFamily="sans-serif"
              >
                {formatCurrencyAbbrev(tick)}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels */}
        {points.map((pt, i) => {
          // Render alternate labels if too many to avoid overlapping
          if (points.length > 8 && i % 2 !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={pt.x}
              y={height - padding.bottom + 16}
              fontSize="10"
              fill="#71717a"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              {pt.label.replace(/^\d{4}-/, '')}
            </text>
          );
        })}

        {/* Shaded Area */}
        {areaPath && (
          <path d={areaPath} fill="url(#trendGradient)" />
        )}

        {/* Curve Line */}
        {linePath && (
          <path 
            d={linePath} 
            fill="none" 
            stroke="#1a5c9e" 
            strokeWidth={2.5} 
            strokeLinecap="round"
          />
        )}

        {/* Points & Interactive Hover Areas */}
        {points.map((pt, i) => (
          <g key={i}>
            {/* Pulsing glow point when hovered */}
            {hoverIndex === i && (
              <circle cx={pt.x} cy={pt.y} r={8} fill="#1a5c9e" opacity="0.3" className="transition-all duration-150" />
            )}
            <circle 
              cx={pt.x} 
              cy={pt.y} 
              r={hoverIndex === i ? 5 : 3.5} 
              fill={hoverIndex === i ? "#ffffff" : "#1a5c9e"}
              stroke="#1a5c9e"
              strokeWidth={2}
              className="transition-all duration-150"
            />
            {/* Target overlay of hover */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={16}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip Popup */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div 
          className="absolute z-10 px-2.5 py-1.5 bg-zinc-900 text-white rounded text-xs shadow-lg transition-all duration-100 ease-out pointer-events-none"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `${(points[hoverIndex].y / height) * 100 - 18}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-medium whitespace-nowrap text-zinc-300">{points[hoverIndex].label}</div>
          <div className="font-bold text-sm text-sky-400 whitespace-nowrap">
            ¥{points[hoverIndex].val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </div>
  );
}


interface PieDataItem {
  name: string;
  value: number;
}

export function DonutChart({ data }: { data: PieDataItem[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        暂无比例数据
      </div>
    );
  }

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // Palette of beautiful corporate colors
  const colors = ['#1a5c9e', '#16a085', '#d68910', '#8e44ad', '#c0392b', '#27ae60', '#2980b9'];

  // Dimensions
  const size = 200;
  const radius = 80;
  const strokeWidth = 24;
  const innerRadius = radius - strokeWidth;
  const center = size / 2;

  let currentAngle = -Math.PI / 2; // Start from top 12 o'clock

  const slices = data.map((item, i) => {
    const percentage = total > 0 ? item.value / total : 0;
    const angle = percentage * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Is it a full circle?
    const isFullCircle = percentage >= 0.999;

    // Helper to calculate X/Y coordinates
    const getCoordinates = (ang: number, r: number) => {
      return {
        x: center + Math.cos(ang) * r,
        y: center + Math.sin(ang) * r
      };
    };

    const outerStart = getCoordinates(startAngle, radius);
    const outerEnd = getCoordinates(endAngle, radius);
    const innerStart = getCoordinates(endAngle, innerRadius);
    const innerEnd = getCoordinates(startAngle, innerRadius);

    const largeArcFlag = angle > Math.PI ? '1' : '0';

    let d = '';
    if (isFullCircle) {
      // Build donut with two full circles
      d = `
        M ${center} ${center - radius}
        A ${radius} ${radius} 0 1 0 ${center} ${center + radius}
        A ${radius} ${radius} 0 1 0 ${center} ${center - radius}
        M ${center} ${center - innerRadius}
        A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center + innerRadius}
        A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center - innerRadius}
        Z
      `;
    } else {
      // Normal sector path
      d = `
        M ${outerStart.x} ${outerStart.y}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}
        L ${innerStart.x} ${innerStart.y}
        A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}
        Z
      `;
    }

    return {
      d,
      color: colors[i % colors.length],
      name: item.name,
      value: item.value,
      percentage
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-full w-full">
      <div className="relative w-44 h-44 flex-shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {slices.map((slice, i) => {
            const isHovered = hoverIndex === i;
            return (
              <path
                key={i}
                d={slice.d}
                fill={slice.color}
                className="cursor-pointer transition-all duration-200"
                opacity={hoverIndex === null || isHovered ? 1 : 0.45}
                style={{
                  transform: isHovered ? 'scale(1.04)' : 'scale(1.0)',
                  transformOrigin: 'center'
                }}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
          {/* Central status */}
          <circle cx={center} cy={center} r={innerRadius - 4} fill="#ffffff" />
          <foreignObject 
            x={center - innerRadius + 4} 
            y={center - innerRadius + 8} 
            width={(innerRadius - 4) * 2} 
            height={(innerRadius - 4) * 2}
          >
            <div className="flex flex-col items-center justify-center h-full text-center px-1">
              {hoverIndex !== null && slices[hoverIndex] ? (
                <>
                  <span className="text-[10px] text-zinc-400 font-medium truncate w-full">
                    {slices[hoverIndex].name}
                  </span>
                  <span className="text-xs font-bold text-zinc-800">
                    {slices[hoverIndex].value >= 10000 
                      ? `¥${(slices[hoverIndex].value / 10000).toFixed(1)}万` 
                      : `¥${slices[hoverIndex].value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </span>
                  <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.25 rounded-full mt-0.5">
                    {(slices[hoverIndex].percentage * 100).toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-zinc-400 font-medium whitespace-nowrap">
                    总销售额
                  </span>
                  <span className="text-xs font-bold text-zinc-800 truncate w-full px-1">
                    {total >= 10000 
                      ? `¥${(total / 10000).toFixed(1)}万` 
                      : `¥${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  </span>
                </>
              )}
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* Side Legends */}
      <div className="flex flex-col gap-2 max-h-[170px] overflow-y-auto w-full text-xs">
        {slices.map((slice, i) => (
          <div 
            key={i} 
            className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors ${
              hoverIndex === i ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'
            }`}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div className="flex items-center gap-2 truncate">
              <span 
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                style={{ backgroundColor: slice.color }} 
              />
              <span className="text-zinc-700 font-medium truncate">{slice.name}</span>
            </div>
            <div className="text-right flex-shrink-0 pl-2 text-zinc-500 font-mono">
              <span className="font-semibold text-zinc-700">
                {(slice.percentage * 100).toFixed(1)}%
              </span>
              <span className="ml-1.5 text-[10px]">
                ({slice.value >= 10000 
                  ? `${(slice.value / 10000).toFixed(1)}万`
                  : slice.value.toLocaleString(undefined, { maximumFractionDigits: 0 })})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export function BarChart({ data }: { data: ChartDataItem[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        暂无柱状数据
      </div>
    );
  }

  // Dimensions
  const padding = { top: 20, right: 10, bottom: 40, left: 60 };
  const width = 500;
  const height = 240;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const roundedMax = Math.ceil(maxVal * 1.15); // Add 15% top height

  const ticksY = [0, roundedMax * 0.25, roundedMax * 0.5, roundedMax * 0.75, roundedMax];

  const barCount = data.length;
  // Calculate bar width nicely
  const maxBarWidth = Math.min(32, chartWidth / Math.max(barCount, 1) * 0.5);
  const spaceBetween = (chartWidth - (maxBarWidth * barCount)) / Math.max(barCount + 1, 1);

  const bars = data.map((d, i) => {
    const w = maxBarWidth;
    const h = (d.value / roundedMax) * chartHeight;
    const x = padding.left + spaceBetween + i * (w + spaceBetween);
    const y = padding.top + chartHeight - h;
    return {
      x,
      y,
      w,
      h,
      label: d.label,
      value: d.value
    };
  });

  const formatCurrencyAbbrev = (val: number) => {
    if (val >= 10000) {
      return `¥${(val / 10000).toFixed(1)}万`;
    }
    return `¥${val.toFixed(0)}`;
  };

  return (
    <div className="relative w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
        {/* Y Axis Grid Lines */}
        {ticksY.map((tick, i) => {
          const y = padding.top + chartHeight - (tick / roundedMax) * chartHeight;
          return (
            <g key={i} className="opacity-40">
              <line 
                x1={padding.left} 
                y1={y} 
                x2={width - padding.right} 
                y2={y} 
                stroke="#e4e4e7" 
                strokeDasharray="4 4" 
                strokeWidth={1}
              />
              <text 
                x={padding.left - 8} 
                y={y + 4} 
                fontSize="10" 
                fill="#71717a" 
                textAnchor="end"
                fontFamily="sans-serif"
              >
                {formatCurrencyAbbrev(tick)}
              </text>
            </g>
          );
        })}

        {/* X Axis horizontal line */}
        <line 
          x1={padding.left} 
          y1={padding.top + chartHeight} 
          x2={width - padding.right} 
          y2={padding.top + chartHeight} 
          stroke="#d4d4d8" 
          strokeWidth={1}
        />

        {/* Bars */}
        {bars.map((bar, i) => {
          const isHovered = hoverIndex === i;
          return (
            <g key={i}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={Math.max(bar.h, 2)} // Always show at least a hint of a bar
                rx="3"
                ry="3"
                fill={isHovered ? "#1d4ed8" : "#1a5c9e"}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              {/* X Axis Labels */}
              <text
                x={bar.x + bar.w / 2}
                y={height - padding.bottom + 16}
                fontSize="10"
                fill="#71717a"
                textAnchor="middle"
                fontFamily="sans-serif"
                className="truncate"
              >
                {bar.label.length > 5 ? `${bar.label.slice(0, 4)}…` : bar.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Tooltip */}
      {hoverIndex !== null && bars[hoverIndex] && (
        <div 
          className="absolute z-10 px-2.5 py-1.5 bg-zinc-900 text-white rounded text-xs shadow-lg transition-all duration-100 ease-out pointer-events-none"
          style={{
            left: `${((bars[hoverIndex].x + bars[hoverIndex].w / 2) / width) * 100}%`,
            top: `${(bars[hoverIndex].y / height) * 100 - 10}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-medium text-zinc-300 whitespace-nowrap">{bars[hoverIndex].label}</div>
          <div className="font-bold text-sm text-yellow-400 whitespace-nowrap">
            ¥{bars[hoverIndex].value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

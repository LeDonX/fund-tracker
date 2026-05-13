import React from 'react';

export default function FormatNumber({ value, isPercent = false, isCurrency = false, showSign = true }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="text-slate-400">--</span>;
  }

  if (value === 0) {
    const zeroValue = isCurrency
      ? Number(0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00';

    return <span className="text-slate-500">{zeroValue}{isPercent ? '%' : ''}</span>;
  }

  const colorClass = value > 0 ? 'text-red-500' : 'text-green-500';
  const sign = value > 0 && showSign ? '+' : '';

  let formattedValue = Math.abs(value).toFixed(2);
  if (isCurrency) {
    formattedValue = Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <span className={`font-medium ${colorClass}`}>
      {sign}{value < 0 ? '-' : ''}{formattedValue}{isPercent ? '%' : ''}
    </span>
  );
}

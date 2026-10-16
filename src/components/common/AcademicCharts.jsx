import { useEffect, useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const ACADEMIC_CHART_COLORS = [3, 1, 2, 4, 5, 6].map((index) => `var(--neu-chart-${index})`);

function useChartAnimation() {
  const [canAnimate, setCanAnimate] = useState(() => typeof window !== 'undefined'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !document.documentElement.classList.contains('reduce-motion'));

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setCanAnimate(!motionPreference.matches && !document.documentElement.classList.contains('reduce-motion'));
    const observer = new MutationObserver(update);
    motionPreference.addEventListener('change', update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    update();
    return () => {
      motionPreference.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return canAnimate;
}

function ExtrudedBar({ x, y, width, height, value, fill, isActive }) {
  if (!(Number(value) > 0) || !(width > 0) || !(height > 0)) return null;
  const depth = Math.min(8, width * 0.22, height * 0.5);
  const rise = depth * 0.6;
  const side = `color-mix(in srgb, ${fill} 72%, #000)`;
  const top = `color-mix(in srgb, ${fill} ${isActive ? 62 : 79}%, #fff)`;
  return <g className="academic-chart-column">
    <polygon points={`${x + width},${y} ${x + width + depth},${y - rise} ${x + width + depth},${y + height - rise} ${x + width},${y + height}`} fill={side} />
    <rect x={x} y={y} width={width} height={height} fill={fill} />
    <polygon points={`${x},${y} ${x + depth},${y - rise} ${x + width + depth},${y - rise} ${x + width},${y}`} fill={top} />
  </g>;
}

// Missing figures remain gaps; a recorded zero remains an actual chart value.
function academicChartValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function formatChartCount(value) {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

function formatChartTick(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function shortChartLabel(label) {
  return String(label).replace(/^Level\s+(\d+)$/i, 'L$1').replace(/^(\d+)(?:st|nd|rd|th)\s+Year$/i, '$1');
}

export function AcademicChartTooltip({ active, payload, label, valueLabel = 'Total' }) {
  if (!active || !payload?.length) return null;
  const point = payload.find((entry) => entry.type !== 'none');
  if (!point) return null;
  return <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'var(--neu-surface)', color: 'var(--neu-ink)', boxShadow: 'var(--neu-overlay)', border: '1px solid var(--neu-line)' }}>
    <p className="font-semibold">{point.payload?.label ?? label ?? point.name}</p>
    <p className="mt-1" style={{ color: 'var(--neu-muted)' }}>{valueLabel}: <strong className="tabular-nums" style={{ color: 'var(--neu-ink)' }}>{formatChartCount(point.value)}</strong></p>
  </div>;
}

export function TrendChart({
  title,
  description,
  data = [],
  valueLabel = 'Enrollment',
  hasData = data.length > 0,
  empty = 'Annual figures will appear after reports have been submitted.',
  className = ''
}) {
  const headingId = useId();
  const canAnimate = useChartAnimation();
  const series = data.map((point) => ({ ...point, value: academicChartValue(point.value) }));
  const showData = hasData && series.some((point) => point.value !== null);
  const latest = showData ? [...series].reverse().find((point) => point.value !== null) : null;
  const descriptionText = showData
    ? `${valueLabel} by Academic Year. ${series.map((point) => `${point.label}: ${point.value === null ? 'not submitted' : formatChartCount(point.value)}`).join('. ')}.`
    : empty;

  return <article className={`surface-panel min-w-0 p-5 sm:p-6 ${className}`} aria-labelledby={headingId}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="section-heading" id={headingId}>{title}</h2>
        <p className="muted-copy mt-1">{description}</p>
      </div>
      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: 'var(--neu-muted)', boxShadow: 'var(--neu-pressed)' }}>Annual Trend</span>
    </div>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs" style={{ color: 'var(--neu-muted)' }}>{latest ? `Latest submitted · ${latest.label}` : valueLabel}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: 'var(--neu-ink)' }}>{latest ? formatChartCount(latest.value) : '—'}</p>
      </div>
      <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--neu-muted)' }}><span className="h-0.5 w-5 rounded-full" style={{ background: 'var(--neu-chart-1)' }} aria-hidden="true" />{valueLabel}</p>
    </div>
    {showData ? <div className="mt-4 h-60 min-w-0" role="img" aria-label={descriptionText}>
      <div className="academic-chart-depth h-full w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 240, height: 240 }}>
          <LineChart data={series.map((point) => ({ ...point, value: showData ? point.value : null }))} margin={{ top: 14, right: 16, bottom: 8, left: -16 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--neu-line)" strokeDasharray="3 5" />
            <XAxis dataKey="label" tick={{ fill: 'var(--neu-muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickMargin={12} height={36} minTickGap={20} interval="preserveStartEnd" padding={{ left: 10, right: 10 }} />
            <YAxis allowDecimals={false} domain={[0, (max) => Math.max(1, max)]} tickFormatter={formatChartTick} tick={{ fill: 'var(--neu-muted)', fontSize: 12 }} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<AcademicChartTooltip valueLabel={valueLabel} />} cursor={{ stroke: 'var(--neu-line)', strokeDasharray: '4 4' }} isAnimationActive={canAnimate} />
            <Line type="linear" dataKey="value" stroke="var(--neu-shadow)" strokeWidth={6} opacity={0.7} transform="translate(0, 5)" dot={false} activeDot={false} connectNulls={false} tooltipType="none" legendType="none" pointerEvents="none" isAnimationActive={canAnimate} animationDuration={1000} animationEasing="ease-out" />
            <Line type="linear" dataKey="value" name={valueLabel} stroke="var(--neu-chart-1)" strokeWidth={3} dot={{ r: 4, fill: 'var(--neu-surface)', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'var(--neu-chart-1)', stroke: 'var(--neu-surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={canAnimate} animationDuration={1000} animationEasing="ease-out" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div> : <div className="empty-work mt-6">{hasData ? 'No numeric figures are available in these submitted records.' : empty}</div>}
    {showData && <>
      <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3 lg:grid-cols-4" style={{ borderColor: 'var(--neu-line)' }}>
        {series.map((point, index) => <div key={`${point.label}-${index}`} className="min-w-0">
          <dt className="break-words text-xs" style={{ color: 'var(--neu-muted)' }}>{point.label}</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--neu-ink)' }}>{formatChartCount(point.value)}</dd>
        </div>)}
      </dl>
      {series.filter((point) => point.value !== null).length === 1 && <p className="muted-copy mt-4 text-xs">One Academic Year is available. A trend will appear when another year is submitted.</p>}
      {series.some((point) => point.value === null) && <p className="muted-copy mt-3 text-xs">Gaps indicate Academic Years without submitted figures.</p>}
    </>}
  </article>;
}

export function AggregateChart({
  title,
  description,
  items = [],
  hasData = items.length > 0,
  empty = 'No CCT figures have been submitted yet.',
  variant = 'donut',
  valueLabel = 'Total',
  className = ''
}) {
  const headingId = useId();
  const canAnimate = useChartAnimation();
  const data = items.map((item, index) => ({
    ...item,
    value: academicChartValue(item.value),
    color: item.color || ACADEMIC_CHART_COLORS[index % ACADEMIC_CHART_COLORS.length]
  }));
  const showData = hasData && data.some((item) => item.value !== null);
  const total = data.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const isBar = variant === 'bar';
  const chartDescription = showData
    ? `${isBar ? 'Bar' : 'Donut'} chart. ${data.map((item) => `${item.label}: ${formatChartCount(item.value)}`).join('. ')}. ${valueLabel}: ${formatChartCount(total)}.`
    : empty;

  return <article className={`surface-panel min-w-0 p-5 sm:p-6 ${className}`} aria-labelledby={headingId}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="section-heading" id={headingId}>{title}</h2>
        <p className="muted-copy mt-1">{description}</p>
      </div>
      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: 'var(--neu-muted)', boxShadow: 'var(--neu-pressed)' }}>
        {isBar ? 'Distribution' : 'Share of Total'}
      </span>
    </div>

    <div className={isBar ? 'mt-5' : 'mt-5 grid min-w-0 items-center gap-4'} style={isBar ? undefined : { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
      <div className="relative min-w-0" role="img" aria-label={chartDescription}>
        {isBar ? showData ? <div className="academic-chart-depth h-60 min-w-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 240, height: 240 }}>
            <BarChart data={data.map((item) => ({ ...item, value: showData ? item.value : null }))} margin={{ top: 16, right: 12, bottom: 6, left: -20 }} accessibilityLayer={false} barCategoryGap="35%">
              <CartesianGrid vertical={false} stroke="var(--neu-line)" strokeDasharray="3 5" />
              <XAxis dataKey="label" tickFormatter={shortChartLabel} tick={{ fill: 'var(--neu-muted)', fontSize: 12 }} tickLine={false} axisLine={false} interval={0} height={35} tickMargin={12} />
              <YAxis allowDecimals={false} domain={[0, (max) => Math.max(1, max)]} tickFormatter={formatChartTick} tick={{ fill: 'var(--neu-muted)', fontSize: 12 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<AcademicChartTooltip valueLabel={valueLabel} />} cursor={{ fill: 'var(--neu-line)', opacity: 0.2 }} isAnimationActive={canAnimate} />
              <Bar dataKey="value" name={valueLabel} maxBarSize={50} shape={<ExtrudedBar />} activeBar={<ExtrudedBar />} isAnimationActive={canAnimate} animationDuration={850} animationEasing="ease-out">
                {data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={item.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div> : <div className="empty-work py-8">Awaiting submitted figures</div> : <div className="academic-chart-donut-depth relative mx-auto h-60 w-full max-w-64" aria-hidden="true">
          {showData && total > 0 ? <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 240, height: 240 }}>
            <PieChart accessibilityLayer={false}>
              {[52, 50.5, 49].map((vertical, layer) => <Pie key={vertical} data={data} dataKey="value" nameKey="label" cx="50%" cy={`${vertical}%`} innerRadius="65%" outerRadius="84%" paddingAngle={data.filter((item) => item.value > 0).length > 1 ? 3 : 0} startAngle={90} endAngle={-270} stroke="none" tooltipType="none" legendType="none" rootTabIndex={-1} pointerEvents="none" isAnimationActive={canAnimate} animationDuration={950} animationEasing="ease-out">
                {data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={`color-mix(in srgb, ${item.color} ${58 + layer * 9}%, #000)`} />)}
              </Pie>)}
              <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="47.5%" innerRadius="65%" outerRadius="84%" paddingAngle={data.filter((item) => item.value > 0).length > 1 ? 3 : 0} startAngle={90} endAngle={-270} stroke="var(--neu-surface)" strokeWidth={2} rootTabIndex={-1} isAnimationActive={canAnimate} animationDuration={950} animationEasing="ease-out">
                {data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={item.color} />)}
              </Pie>
              <Tooltip content={<AcademicChartTooltip valueLabel={valueLabel} />} isAnimationActive={canAnimate} />
            </PieChart>
          </ResponsiveContainer> : <svg className="h-full w-full" viewBox="0 0 240 240" fill="none">
            <circle cx="120" cy="120" r="92" stroke="var(--neu-line)" strokeWidth="24" opacity="0.55" />
          </svg>}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <strong className="block max-w-full break-words text-2xl font-semibold tabular-nums" style={{ color: 'var(--neu-ink)' }}>
              {showData ? formatChartTick(total) : '—'}
            </strong>
            <span className="mt-1 text-xs leading-4" style={{ color: 'var(--neu-muted)' }}>{showData ? valueLabel : 'Awaiting data'}</span>
          </div>
        </div>}
      </div>

      <div className={isBar ? 'mt-4' : 'min-w-0'}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--neu-line)' }}>
          <span className="text-xs" style={{ color: 'var(--neu-muted)' }}>{valueLabel}</span>
          <strong className="text-base tabular-nums" style={{ color: 'var(--neu-ink)' }}>{showData ? formatChartCount(total) : '—'}</strong>
        </div>
        <dl className={isBar ? 'grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3' : 'space-y-3'}>
          {data.map((item, index) => <div key={`${item.label}-${index}`} className="flex min-w-0 items-start gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <dt className="break-words text-xs" style={{ color: 'var(--neu-muted)' }}>{item.label}</dt>
              <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold tabular-nums" style={{ color: 'var(--neu-ink)' }}>
                {showData ? formatChartCount(item.value) : '—'}
                {!isBar && showData && item.value !== null && <span className="text-xs font-normal" style={{ color: 'var(--neu-muted)' }}>{total > 0 ? `${(item.value / total * 100).toFixed(1)}%` : '0%'}</span>}
              </dd>
            </div>
          </div>)}
        </dl>
      </div>
    </div>
    {!showData && <p className="muted-copy mt-4 rounded-xl px-3 py-2 text-xs" style={{ boxShadow: 'var(--neu-pressed)' }}>{hasData ? 'No numeric figures are available in these submitted records.' : empty}</p>}
    {showData && total === 0 && <p className="muted-copy mt-4 text-xs">Submitted figures total zero. No {isBar ? 'bars' : 'slices'} are drawn.</p>}
  </article>;
}

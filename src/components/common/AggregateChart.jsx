export function AggregateChart({ title, description, items, hasData = items.length > 0, empty = 'No CCT figures have been submitted yet.' }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return <article className="surface-panel p-6" aria-label={title}>
    <h2 className="section-heading">{title}</h2><p className="muted-copy mt-1">{description}</p>
    <div className="mt-6 space-y-5">{hasData ? items.map((item, index) => <div key={item.label}>
      <div className="mb-2 flex justify-between gap-3 text-sm"><span>{item.label}</span><strong className="tabular-nums">{Number(item.value || 0).toLocaleString()}</strong></div>
      <div className="chart-track" role="meter" aria-label={item.label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number(item.value) || 0}>
        <div className="chart-fill" style={{ width: `${(Number(item.value) || 0) / max * 100}%`, background: index % 2 ? 'var(--neu-chart-3)' : 'var(--neu-chart-1)' }} />
      </div>
    </div>) : <p className="empty-work">{empty}</p>}</div>
  </article>;
}

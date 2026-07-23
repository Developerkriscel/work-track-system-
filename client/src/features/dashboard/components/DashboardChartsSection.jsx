import { clampDashboardPercent } from '@/features/dashboard/services/dashboardPresentation';

function MiniProgressChart({ percent }) {
  return (
    <div className="dashboard-donut">
      <div
        className="dashboard-donut__ring"
        style={{
          background: `conic-gradient(#3463eb 0 ${percent}%, #eef3fb ${percent}% 100%)`
        }}
      />
      <div className="dashboard-donut__inner">
        <strong>{percent}%</strong>
        <span>Load</span>
      </div>
    </div>
  );
}

function SparkBars({ labels = [], data = [] }) {
  const peak = Math.max(...data, 1);
  return (
    <div className="spark-bars">
      {labels.map((label, index) => {
        const value = Number(data[index] || 0);
        const height = `${Math.max(12, Math.round((value / peak) * 100))}%`;
        return (
          <div key={`${label}-${index}`} className="spark-bars__item">
            <div className="spark-bars__bar-wrap">
              <div className="spark-bars__bar" style={{ height }} />
            </div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownBars({ labels = [], data = [] }) {
  const peak = Math.max(...data, 1);
  return (
    <div className="breakdown-list">
      {labels.map((label, index) => {
        const value = Number(data[index] || 0);
        const width = `${Math.max(value ? 18 : 8, Math.round((value / peak) * 100))}%`;
        return (
          <div key={`${label}-${index}`} className="breakdown-list__row">
            <div className="breakdown-list__meta">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <div className="breakdown-list__track">
              <div className="breakdown-list__fill" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardChartsSection({ kpis = {}, lineChart = { labels: [], data: [] }, barChart = { labels: [], data: [] } }) {
  const occupied = clampDashboardPercent(kpis.occupiedBandwidth);

  return (
    <div className="dashboard-chart-grid">
      <article className="migration-panel">
        <h2>Today Summary</h2>
        <div className="dashboard-summary">
          <MiniProgressChart percent={occupied} />
          <div className="dashboard-summary__stats">
            <div><span>Assumed</span><strong>{kpis.assumedBandwidthHours || '8h 0m'}</strong></div>
            <div><span>Planned</span><strong>{kpis.plannedBandwidthHours || '0h 0m'}</strong></div>
            <div><span>Completed</span><strong>{kpis.actualBandwidthHours || '0h 0m'}</strong></div>
            <div><span>Difference</span><strong>{kpis.bandwidthDifference || '0h 0m'}</strong></div>
          </div>
        </div>
      </article>

      <article className="migration-panel">
        <h2>Last 7 Days Performance</h2>
        <SparkBars labels={lineChart.labels} data={lineChart.data} />
      </article>

      <article className="migration-panel">
        <h2>Pending Tasks Breakdown</h2>
        <BreakdownBars labels={barChart.labels} data={barChart.data} />
      </article>
    </div>
  );
}

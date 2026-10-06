import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = {
  blue: '#3b82f6',
  purple: '#6366f1',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  slate: '#64748b'
};

const getStatusColor = (statusName) => {
  const s = String(statusName).toLowerCase();
  if (s.includes('complete') || s.includes('close') || s.includes('resolve') || s.includes('paid')) return COLORS.green;
  if (s.includes('open') || s.includes('new') || s.includes('progress')) return COLORS.blue;
  if (s.includes('hold') || s.includes('pending') || s.includes('wait')) return COLORS.orange;
  if (s.includes('cancel') || s.includes('fail') || s.includes('overdue')) return COLORS.red;
  return COLORS.purple;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>
          {payload[0].name || payload[0].payload.name || payload[0].payload.owner}
        </p>
        <p style={{ margin: '4px 0 0', fontWeight: 600, color: payload[0].payload.fill || '#6366f1', fontSize: '18px' }}>
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

function StatusPieChart({ title, dataArray }) {
  const chartData = useMemo(() => {
    if (!dataArray || !dataArray.length) return [];
    const counts = {};
    dataArray.forEach(item => {
      const status = item.Status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: getStatusColor(name) }));
  }, [dataArray]);

  return (
    <article className="migration-panel" style={{ padding: '24px', flex: '1 1 300px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: '#1e293b', textAlign: 'center' }}>
        {title}
      </h2>
      <div style={{ height: '420px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="35%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No Data</p>
        )}
      </div>
    </article>
  );
}

function BandwidthBarChart({ title, dataArray }) {
  return (
    <article className="migration-panel" style={{ padding: '24px', flex: '1 1 300px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: '#1e293b', textAlign: 'center' }}>
        {title}
      </h2>
      <div style={{ height: '360px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {dataArray && dataArray.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataArray} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="owner" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
              <Bar dataKey="count" fill="url(#colorBandwidth)" radius={[4, 4, 0, 0]} barSize={32} />
              <defs>
                <linearGradient id="colorBandwidth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={1} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No Data</p>
        )}
      </div>
    </article>
  );
}

export function ClientExplorerCharts({ explorer }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
      <StatusPieChart title="Client Tasks Status" dataArray={explorer.tasks} />
      <BandwidthBarChart title="Bandwidth by Owner (Tasks)" dataArray={explorer.bandwidth} />
      <StatusPieChart title="Invoices Status" dataArray={explorer.invoices} />
    </div>
  );
}

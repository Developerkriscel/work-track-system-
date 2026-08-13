import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

// Premium Theme Colors matching your app
const COLORS = {
  blue: '#3b82f6',
  purple: '#6366f1',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  slate: '#64748b'
};

// Map typical statuses to colors
const getStatusColor = (statusName) => {
  const s = String(statusName).toLowerCase();
  if (s.includes('complete') || s.includes('close') || s.includes('resolve')) return COLORS.green;
  if (s.includes('open') || s.includes('new') || s.includes('progress')) return COLORS.blue;
  if (s.includes('hold') || s.includes('pending') || s.includes('wait')) return COLORS.orange;
  if (s.includes('cancel') || s.includes('fail')) return COLORS.red;
  return COLORS.purple;
};

// Custom Tooltip for Glassmorphism Look
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
          {payload[0].name || payload[0].payload.name}
        </p>
        <p style={{ margin: '4px 0 0', fontWeight: 600, color: payload[0].payload.fill || '#3b82f6', fontSize: '18px' }}>
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export function DashboardCharts({ tickets = [], fms = [], todo = [], charts = null }) {
  // Aggregate Tickets by Status
  const ticketData = useMemo(() => {
    if (Array.isArray(charts?.ticketData)) {
      return charts.ticketData.map((entry) => ({
        ...entry,
        fill: entry.fill || getStatusColor(entry.name)
      }));
    }
    const counts = {};
    tickets.forEach(t => {
      const status = t.Status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: getStatusColor(name) }));
  }, [charts?.ticketData, tickets]);

  // Aggregate FMS by Status
  const fmsData = useMemo(() => {
    if (Array.isArray(charts?.fmsData)) {
      return charts.fmsData.map((entry) => ({
        ...entry,
        fill: entry.fill || getStatusColor(entry.name)
      }));
    }
    const counts = {};
    fms.forEach(f => {
      const status = f.Status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: getStatusColor(name) }));
  }, [charts?.fmsData, fms]);

  // Aggregate Workload by User (combining tickets and fms for active users)
  const userWorkload = useMemo(() => {
    if (Array.isArray(charts?.userWorkload)) return charts.userWorkload;
    const counts = {};
    const process = (items) => {
      items.forEach(item => {
        // Skip completed/closed items for workload calculation if possible
        const status = String(item.Status || '').toLowerCase();
        if (status.includes('complete') || status.includes('close')) return;
        
        const user = item.User || 'Unassigned';
        counts[user] = (counts[user] || 0) + 1;
      });
    };
    process(tickets);
    process(fms);
    process(todo);
    
    // Convert to array, sort by count descending, take top 8
    return Object.entries(counts)
      .map(([name, activeTasks]) => ({ name, activeTasks }))
      .sort((a, b) => b.activeTasks - a.activeTasks)
      .slice(0, 8);
  }, [charts?.userWorkload, tickets, fms, todo]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
      
      {/* Tickets Breakdown */}
      <article className="migration-panel" style={{ flex: '1 1 300px', padding: '24px', position: 'relative' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1e293b' }}>Tickets by Status</h2>
          <div style={{ height: '360px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ticketData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {ticketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {ticketData.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px', marginTop: '32px' }}>
              No data available
            </div>
          )}
        </article>

      {/* FMS Breakdown */}
      <article className="migration-panel" style={{ flex: '1 1 300px', padding: '24px', position: 'relative' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1e293b' }}>FMS by Status</h2>
          <div style={{ height: '360px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fmsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {fmsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {fmsData.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px', marginTop: '32px' }}>
              No data available
            </div>
          )}
        </article>

      {/* User Workload */}
      <article className="migration-panel" style={{ flex: '2 1 500px', padding: '24px', position: 'relative' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#1e293b' }}>Active Workload by User (Top 8)</h2>
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userWorkload} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }} content={<CustomTooltip />} />
                <Bar dataKey="activeTasks" name="Active Tasks" fill={COLORS.purple} radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {userWorkload.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px', marginTop: '32px' }}>
              No data available
            </div>
          )}
        </article>

    </div>
  );
}

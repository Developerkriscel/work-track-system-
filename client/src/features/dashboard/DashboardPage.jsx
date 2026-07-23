import { useMemo } from 'react';
import { DashboardChartsSection } from '@/features/dashboard/components/DashboardChartsSection';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import { DashboardKpiGrid } from '@/features/dashboard/components/DashboardKpiGrid';
import { DashboardMiniStats } from '@/features/dashboard/components/DashboardMiniStats';
import { DashboardTasksSection } from '@/features/dashboard/components/DashboardTasksSection';
import { useDashboardData } from '@/features/dashboard/useDashboardData';

export function DashboardPage() {
  const { employeeId, currentUser, range, setRange, ranges, error, data } = useDashboardData();

  const dashboardUser = data?.currentUser || data?.user || currentUser || null;
  const kpis = data?.kpis || {};
  const lineChart = data?.chartData?.lineChart || { labels: [], data: [] };
  const barChart = data?.chartData?.barChart || { labels: [], data: [] };
  const todaysTasks = useMemo(() => data?.todaysTasks || [], [data]);

  return (
    <section className="page-card dashboard-page">
      <DashboardHeader
        employeeId={employeeId}
        dashboardUser={dashboardUser}
        range={range}
        ranges={ranges}
        onRangeChange={setRange}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">{error}</div>
      ) : null}

      <DashboardKpiGrid kpis={kpis} />
      <DashboardMiniStats kpis={kpis} />
      <DashboardChartsSection kpis={kpis} lineChart={lineChart} barChart={barChart} />
      <DashboardTasksSection tasks={todaysTasks} />
    </section>
  );
}

import { useMemo } from 'react';
import { DashboardChartsSection } from '@/features/dashboard/components/DashboardChartsSection';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import { DashboardKpiGrid } from '@/features/dashboard/components/DashboardKpiGrid';
import { DashboardMiniStats } from '@/features/dashboard/components/DashboardMiniStats';
import { DashboardTasksSection } from '@/features/dashboard/components/DashboardTasksSection';
import { useDashboardData } from '@/features/dashboard/useDashboardData';

export function DashboardPage() {
  const {
    employeeId,
    currentUser,
    range,
    setRange,
    ranges,
    error,
    clearError,
    data,
    viewMode,
    setViewMode,
    canViewTeamDashboard,
    taskPage,
    setTaskPage,
    tasksLoading
  } = useDashboardData();

  const dashboardUser = data?.currentUser || data?.user || currentUser || null;
  const kpis = data?.kpis || {};
  const lineChart = data?.chartData?.lineChart || { labels: [], data: [] };
  const barChart = data?.chartData?.barChart || { labels: [], data: [] };
  const todaysTasks = useMemo(() => data?.todaysTasks || [], [data]);
  const teamCount = Number(data?.kpis?.teamMembers || 0);
  const taskPagination = data?.taskPagination || { page: taskPage, pageCount: 1, total: todaysTasks.length };

  return (
    <section className="page-card dashboard-page">
      <DashboardHeader
        employeeId={employeeId}
        dashboardUser={dashboardUser}
        range={range}
        ranges={ranges}
        onRangeChange={setRange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        canViewTeamDashboard={canViewTeamDashboard}
        teamCount={teamCount}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">
          <span>{error}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button>
        </div>
      ) : null}

      <DashboardKpiGrid kpis={kpis} />
      <DashboardMiniStats kpis={kpis} />
      <DashboardChartsSection kpis={kpis} lineChart={lineChart} barChart={barChart} />
      <DashboardTasksSection
        tasks={todaysTasks}
        showOwner={viewMode === 'team'}
        loading={tasksLoading}
        pagination={taskPagination}
        onPageChange={setTaskPage}
      />
    </section>
  );
}

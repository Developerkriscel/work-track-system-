## Dashboard Feature

This feature owns the employee dashboard currently mounted at `/`.

Legacy Apps Script sources:

- `#home-view`
- `#todays-tasks-table`
- `#upcoming-tasks-table`
- `#kpi-filtered-table`
- `#bandwidth-donut-chart`
- `#tasks-line-chart`
- `#tasks-bar-chart`

Current React ownership:

- `DashboardPage.jsx`
- `useDashboardData.js`
- `api.js`
- `components/DashboardHeader.jsx`
- `components/DashboardKpiGrid.jsx`
- `components/DashboardMiniStats.jsx`
- `components/DashboardChartsSection.jsx`
- `components/DashboardTasksSection.jsx`
- `services/dashboardPresentation.js`

Folder intent:

- keep KPI, chart, summary, and task surfaces inside React ownership
- keep range/filter state inside React

Remaining parity gaps:

- KPI drilldown table/panel
- exact upcoming/today task parity
- final chart and spacing audit

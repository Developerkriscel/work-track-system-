import { featureContracts } from '@/architecture/featureContracts';

export const reportsManifest = {
  feature: 'reports',
  contract: featureContracts.reports,
  plannedModules: [
    'ReportsHeader',
    'ReportsRangeControl',
    'TicketReportTable',
    'FmsReportTable',
    'ReportExportActions'
  ]
};

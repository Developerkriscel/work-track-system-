import { featureContracts } from '@/architecture/featureContracts';

export const expensesManifest = {
  feature: 'expenses',
  contract: featureContracts.expenses,
  plannedModules: [
    'ExpensesHeader',
    'ExpensesSummaryCards',
    'ExpenseFormPanel',
    'ExpensesHistoryTable',
    'ReceiptPreviewDialog'
  ]
};

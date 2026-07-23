import { featureContracts } from '@/architecture/featureContracts';

export const approvalsManifest = {
  feature: 'approvals',
  contract: featureContracts.approvals,
  plannedModules: [
    'ApprovalsHeader',
    'ApprovalFilters',
    'TicketApprovalTable',
    'LeaveApprovalTable',
    'IntimationApprovalTable',
    'AttendanceApprovalTable',
    'ApprovalActionDialog'
  ]
};

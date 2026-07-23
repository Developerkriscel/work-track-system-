import { featureContracts } from '@/architecture/featureContracts';

export const ticketsManifest = {
  feature: 'tickets',
  contract: featureContracts.tickets,
  plannedModules: [
    'TicketFilters',
    'TicketTabs',
    'TicketTable',
    'TicketFormDialog',
    'TicketAssignmentDialog',
    'TicketScheduleDialog',
    'TicketChatDialog'
  ]
};

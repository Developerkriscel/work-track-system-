import mongoose from 'mongoose';

const legacyRowSchema = new mongoose.Schema(
  {
    legacyId: { type: String, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, strict: false }
);

export const legacyModuleSpecs = {
  User: { collection: 'users_legacy', label: 'Users', aliases: ['Users', 'Employee', 'Emp', 'Master'] },
  EmpMaster: { collection: 'emp_master_legacy', label: 'EMP Master', aliases: ['EMP Master', 'EMP', 'Intern', 'Freelancer'] },
  Client: { collection: 'clients_legacy', label: 'Clients', aliases: ['Clients', 'Customer'] },
  Ticket: { collection: 'tickets_legacy', label: 'Tickets', aliases: ['Tickets'] },
  Attendance: { collection: 'attendance_legacy', label: 'Attendance', aliases: ['Attendance'] },
  AttendancePolicy: { collection: 'attendance_policy_legacy', label: 'Attendance Policy', aliases: ['Attendance Policy', 'Attendance Settings'] },
  Holiday: { collection: 'holidays_legacy', label: 'Holidays', aliases: ['Holiday', 'Holidays'] },
  Leave: { collection: 'leaves_legacy', label: 'Leaves', aliases: ['Leaves', 'Leave'] },
  Intimation: { collection: 'intimations_legacy', label: 'Intimations', aliases: ['Intimations', 'Intimation'] },
  Expense: { collection: 'expenses_legacy', label: 'Expenses', aliases: ['Expenses', 'Expense'] },
  FmsTask: { collection: 'fms_legacy', label: 'FMS', aliases: ['FMS', 'Checklist'] },
  Todo: { collection: 'todos_legacy', label: 'To-Do', aliases: ['To-Do', 'Todo'] },
  Invoice: { collection: 'invoices_legacy', label: 'Invoices', aliases: ['Invoices', 'PMT', 'Payment'] },
  Message: { collection: 'messages_legacy', label: 'Messages', aliases: ['Messages'] },
  SocialMedia: { collection: 'social_media_legacy', label: 'Social Media', aliases: ['Social'] },
  SocialHistory: { collection: 'social_history_legacy', label: 'Social History', aliases: ['SocialHistory', 'Social History'] },
  FormsPortal: { collection: 'forms_portal_legacy', label: 'Forms Portal', aliases: ['Forms', 'Forms Portal'] },
  TicketHistory: { collection: 'ticket_history_legacy', label: 'Ticket History', aliases: ['TicketHistory', 'Ticket History'] },
  WhatsAppLog: { collection: 'whatsapp_logs_legacy', label: 'WhatsApp Logs', aliases: ['WhatsApp', 'WA', 'WhatsApp Logs'] }
};

const modelDefs = Object.fromEntries(
  Object.entries(legacyModuleSpecs).map(([name, spec]) => [name, spec.collection])
);

export const LegacyModels = Object.fromEntries(
  Object.entries(modelDefs).map(([name, collection]) => [
    name,
    mongoose.models[name] || mongoose.model(name, legacyRowSchema, collection)
  ])
);

export const legacyModelNames = Object.keys(modelDefs);

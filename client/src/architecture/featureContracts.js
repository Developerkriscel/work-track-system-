import { appscriptUiInventory } from './appscriptUiInventory';

function buildContract(featureKey, screens, notes = []) {
  return {
    featureKey,
    screens: screens.map((screen) => ({
      legacyScreen: screen.key,
      views: screen.views || [],
      tabs: screen.tabs || [],
      filters: screen.filters || [],
      forms: screen.forms || [],
      templates: screen.templates || [],
      tables: screen.tables || [],
      charts: screen.charts || [],
      media: screen.media || [],
      modals: screen.modals || [],
      scripts: screen.scripts || []
    })),
    notes
  };
}

const employeeScreens = appscriptUiInventory.employeePortal.screens;
const clientScreens = appscriptUiInventory.clientPortal.screens;
const managementScreens = appscriptUiInventory.managementDashboard.screens;

export const featureContracts = {
  auth: buildContract(
    'auth',
    [
      employeeScreens.find((screen) => screen.key === 'login'),
      clientScreens.find((screen) => screen.key === 'clientLogin')
    ].filter(Boolean),
    ['Support employee and client login without depending on legacy page scripts.']
  ),
  dashboard: buildContract(
    'dashboard',
    [employeeScreens.find((screen) => screen.key === 'dashboard')].filter(Boolean),
    ['Keep dashboard KPI cards, charts, workload tables, and range controls aligned with legacy UI.']
  ),
  attendance: buildContract(
    'attendance',
    [employeeScreens.find((screen) => screen.key === 'attendance')].filter(Boolean),
    ['Attendance contains camera capture, leave flow, intimation flow, and attendance history table behavior. The retired request-status tab is intentionally excluded.']
  ),
  tickets: buildContract(
    'tickets',
    [employeeScreens.find((screen) => screen.key === 'tickets')].filter(Boolean),
    ['Employee ticket system requires create, edit, assign, schedule, message, and client-response modal parity.']
  ),
  fms: buildContract(
    'fms',
    [employeeScreens.find((screen) => screen.key === 'fms')].filter(Boolean),
    ['FMS includes filterable task table, done workflow, and external form modal behavior.']
  ),
  approvals: buildContract(
    'approvals',
    [employeeScreens.find((screen) => screen.key === 'approvals')].filter(Boolean),
    ['Approval queue must preserve ticket, leave, intimation, and attendance handling.']
  ),
  formsPortal: buildContract(
    'forms-portal',
    [employeeScreens.find((screen) => screen.key === 'formsPortal')].filter(Boolean),
    ['Forms Portal needs listing, filtering, editor modal, and selected-user access assignment parity.']
  ),
  clientsPortal: buildContract(
    'clients-portal',
    [employeeScreens.find((screen) => screen.key === 'clientsPortalAdmin')].filter(Boolean),
    ['This feature now represents the admin-side clients portal maintenance workspace.']
  ),
  clientPortal: buildContract(
    'client-portal',
    [
      clientScreens.find((screen) => screen.key === 'clientDashboard'),
      clientScreens.find((screen) => screen.key === 'clientTickets'),
      clientScreens.find((screen) => screen.key === 'clientInvoices'),
      clientScreens.find((screen) => screen.key === 'clientReports')
    ].filter(Boolean),
    ['This feature owns the dedicated client login-to-workspace route family separate from the admin-side clients portal.']
  ),
  clientSocial: buildContract(
    'client-social',
    [clientScreens.find((screen) => screen.key === 'clientSocial')].filter(Boolean),
    ['Client social workflow is owned by the React client route and Mongo-backed API.']
  ),
  expenses: buildContract(
    'expenses',
    [employeeScreens.find((screen) => screen.key === 'expenses')].filter(Boolean),
    ['Expense submission and expense history table must remain visually identical to the live system.']
  ),
  reports: buildContract(
    'reports',
    [employeeScreens.find((screen) => screen.key === 'reports')].filter(Boolean),
    ['Reports include ticket and FMS reporting tables plus export actions and range controls.']
  ),
  admin: buildContract(
    'admin',
    [
      employeeScreens.find((screen) => screen.key === 'empMaster'),
      employeeScreens.find((screen) => screen.key === 'users')
    ].filter(Boolean),
    ['EMP Master and Users are only part of the admin surface; forms and clients admin controls also intersect here.']
  ),
  todo: buildContract(
    'todo',
    [employeeScreens.find((screen) => screen.key === 'todo')].filter(Boolean),
    ['To-Do is owned by the standalone React employee route and Mongo-backed API.']
  ),
  managementDashboard: buildContract(
    'management-dashboard',
    managementScreens,
    ['Management dashboard is owned by its standalone React route and Mongo-backed API.']
  )
};

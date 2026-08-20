# Super Admin Blueprint

This document describes the current Super Admin experience in the React app as it exists today in the codebase. It focuses on the actual routes, buttons, filters, tabs, dialogs, and table actions wired in `client/src`.

## Scope

Super Admin is not a single page in this app. It is a permissioned role that can move across several operational surfaces:

- `Dashboard`
- `Attendance`
- `Ticket System`
- `FMS Tracker`
- `Approvals`
- `My Approval Status`
- `Forms Portal`
- `To-Do`
- `Clients Portal`
- `Expenses`
- `Reports`
- `Management Dashboard`
- `EMP Master`
- `Settings`

The shell also exposes global navigation, notification, refresh, and profile controls.

## Role Rules

- Super Admin is explicitly allowed in the router for admin-facing surfaces such as `/emp-master`, `/clients-portal`, `/reports`, and `/management-dashboard`.
- `Management Dashboard` is hidden from the sidebar, but the route exists and is reachable.
- `EMP Master` appears under multiple route aliases:
  - `/emp-master`
  - `/users`
  - `/admin`
- The top-right profile menu does not expose password change for Super Admin in the shell, but password change is available on the `Settings` page.
- The notification panel adds the `Approvals` filter tab for elevated roles such as Super Admin.

## Global Shell

### Sidebar Navigation

Visible or reachable navigation entries:

- Dashboard
- Attendance
- Ticket System
- FMS Tracker
- Approvals
- My Approval Status
- Forms Portal
- To-Do
- Clients Portal
- Expenses
- Reports
- EMP Master
- Settings

Hidden from the sidebar, but still routed:

- Management Dashboard
- `/users`
- `/admin`

### Topbar Buttons

- Mobile menu open
- Refresh
- Notifications bell
- Theme toggle
- Profile menu open

### Profile Menu

- Sign Out
- Change Password exists in the component logic, but the shell disables password change for Super Admin

### Notification Panel

Buttons and controls:

- Refresh
- Tabs:
  - All
  - Tickets
  - Attendance
  - FMS
  - Approvals
  - Other

Clickable notification cards can route the user to:

- `/ticket-system`
- `/attendance`
- `/fms-tracker`
- `/expenses`
- `/approvals`
- `/todo`

## Dashboard

Route:

- `/`

Main controls:

- Date Range select
- My Dashboard / My Team Dashboard toggle, when team access is available
- Task pagination `Prev` / `Next`

What it shows:

- KPI grid
- Mini stats
- Charts
- Tasks table for the selected range

Buttons:

- My Dashboard
- My Team Dashboard
- Prev
- Next

Filters:

- Date Range

## Attendance

Route:

- `/attendance`

### Header Actions

- Punch
- Apply Leave
- Intimation
- Location Policy

### View Tabs

- Attendance Log
- Team Attendance

### Attendance Log Controls

- Show Calendar / Hide Calendar
- Date Range select
- Start Date, when `custom` is selected
- End Date, when `custom` is selected

### Team Attendance Controls

- Search Employee
- Attendance Date
- View Employee Calendar dropdown

### Punch Flow Buttons

In the attendance entry panel:

- Close
- Capture
- Retake
- Punch In
- Punch Out
- Cancel

Important behavior:

- Punching requires a captured photo.
- Punch Out has an early-out confirmation if the current session is under 8 hours.
- Punch action also captures live location.

### Leave Modal Controls

- Leave Type
- Day Type
- Start Date
- End Date
- Reason
- Cancel
- Submit Leave Request

### Intimation Modal Controls

- Date
- Intimation Type
- Reason / Details
- Cancel
- Submit Intimation

### Team Attendance Edit Dialog

- Punch In Time
- Punch Out Time
- Cancel
- Save Attendance

### Location Policy Card Controls

- Add Office Location
- Delete location block
- Use Current Location
- Enforce office location toggle
- Save Policy

### Attendance Table Filters

- Date range selection for self view
- Team search by employee, id, role, department
- Team date filter
- Employee calendar selection

## Ticket System

Route:

- `/ticket-system`

### Top Level Tabs

- My Tickets
- Team Tickets
- Client Tickets
- Buddy

The `Team Tickets` tab is visible for roles including Super Admin.

### Filter Panel Buttons

- Reset
- Apply Filters
- Create New Ticket
- Hide Form

### Filter Panel Controls

- Select Clients multi-select dropdown
- Task Status multi-select dropdown
- Search
- Time Period

Time period options:

- All Time
- Today
- This Week
- Last Week
- This Month
- Last Month

### Create Ticket Modal

The create form itself supports multi-ticket creation and ticket assignment logic based on role.

### Ticket Row Actions

The exact actions depend on ticket status and current user role. The current implementation includes:

- Start / Restart
- Pause / Complete
- Update TAT/Date
- Assign to Team
- Transfer Task
- Client

### Other Ticket Dialogs

- Reassign dialog
- Schedule dialog
- Action dialog for pause / complete / approval states
- Approval transfer dialog
- Chat dialog
- Ticket details dialog
- Auto-pause confirmation dialog when a running ticket already exists

### Ticket Table Paging

- Page navigation in the table footer
- Page size control through the ticket table state

## FMS Tracker

Route:

- `/fms-tracker`

### Header Buttons

- Add FMS

### Tabs

Tabs come from the FMS presentation layer and may include team-only views depending on role.

### Filter Panel Buttons

- Refresh
- Reset

### Filter Controls

- Employee
- FMS Category
- Plan Date
- Search

### Table Actions

- Open Form
- Mark Done

When a task is already complete:

- Done badge is shown instead of an action button

### FMS Completion Dialog

- Remarks entry
- Cancel
- Submit completion

### FMS Create Dialog

- Create task workflow
- Assignable users selector
- Cancel
- Create / Save

### FMS Page Tabs

The tab strip can include team tabs depending on role and visibility.

## Approvals

Route:

- `/approvals`

### KPI Cards

- Total Pending
- Ticket Queue
- Team Filters

### Tabs

- Leave Requests
- Intimations
- Attendance
- Pending Tickets

### Filter Controls

Shared filter bar controls:

- Employee
- Category
- Status
- Start Date
- End Date
- Search
- Reset

### Status Options

- Pending Action
- Approved / Closed
- Rejected / Rework

### Ticket Approval Actions

- Approve
- Rework
- Transfer

### Other Approval Tables

Leaves, intimations, and attendance tables use the same action-request pattern:

- request approval action
- request rejection or rework
- open the dialog for final remarks

### Approval Action Dialog

Depending on action type, the dialog supports:

- Remarks
- Target approver selection for transfer
- Cancel
- Submit

## My Approval Status

Route:

- `/my-approval-status`

This page is available from the route map and is useful for tracking approval-linked activity. It is more of a read/status surface than an admin console, so it does not expose the heavy CRUD controls found in EMP Master or Clients Portal.

## Forms Portal

Route:

- `/forms-portal`

### Header Buttons

- Refresh
- Add New Form, when admin access is enabled

### Filter Controls

- Department
- Category / Sheet
- Keyword Search (For / Purpose)
- Reset Filters

### Table Actions

- Open Form
- Edit, for admin users
- Delete, for admin users

### Form Viewer

- Embedded iframe preview
- Open in new tab

### Form Editor

The editor supports form metadata and assignment handling. The current workspace can also be mounted in the FMS tab with a fixed `FMS` department scope.

## Clients Portal

Route:

- `/clients-portal`

### Header Buttons

- Refresh
- Add Client, only for Super Admin

### Filter Controls

- Search Client (ID / Name)
- Select Status
- Filter by Service / Category
- Reset Filters

### Table Actions

- Open client details by clicking the Client ID chip
- Edit, for admin users
- Delete, for admin users

### Client Editor Fields

- Client Name
- Mobile Number
- Client Email ID
- Address
- Status
- Password
- Detail Shared
- Services / Categories

### Client Details Panel

Read-only details shown for:

- Client ID
- Status
- Client Name
- Mobile Number
- Email ID
- Detail Shared
- Address
- Services

## Expenses

Route:

- `/expenses`

This page is available to Super Admin, but the current blueprint should treat it as an operational expense workflow, not a core admin maintenance panel.

## Reports

Route:

- `/reports`

### Toolbar Buttons

- Team Tickets / Tickets Report tab
- Team FMS / Management Dashboard tab, depending on role
- PDF
- Excel

### Ticket Report Filters

- Priority
- User
- Date Range
- Start Date, when custom range is active
- End Date, when custom range is active
- Search
- Reset

### FMS Report Filters

- Status
- Search
- Reset

### Ticket Report Table

Columns:

- Ticket ID
- Client
- Employee
- Description
- Priority
- Status
- Plan Date
- Duration

### FMS Report Table

Columns:

- FMS Name
- Task Name
- Assigned To
- Plan Date
- Actual Date
- Status

## Management Dashboard

Route:

- `/management-dashboard`

This route is hidden from the sidebar but reachable by route access.

### Tabs

- Overview Dashboard
- User Explorer
- Client Explorer
- Batch Planner

### Header Controls

- Date range selector
- Refresh

### Overview Content

No direct row-level buttons, but the screen is heavily analytical:

- KPI cards
- Charts
- Tickets summary table
- FMS summary table
- To-Do overview table

### User Explorer Controls

- Select User

### Client Explorer Controls

- Select Client

### Batch Planner

This is the planning and assignment surface. It is used for batch task planning and completion workflows.

### Explorer Tables

User explorer table groups:

- Attendance
- Tickets
- FMS
- To-Do

Client explorer table groups:

- Client Tasks
- Bandwidth by Owner
- Invoices

## EMP Master

Routes:

- `/emp-master`
- `/users`
- `/admin`

### Page Header Buttons

- Add Employee

### Category Tabs

- Master
- Employees
- Freelancers
- Interns
- Inactive Users
- Documents
- Hierarchy

### Search

- Search by employee, ID, role, department, manager, status, and other merged row fields

### Table Row Actions

- View
- Edit
- Delete

If the current actor is not allowed to edit a specific row, the row falls back to `View Only`.

### EMP Editor Controls

The editor is the most detailed admin form in the system.

#### Access & Workflow

- Category
- EMP Code
- User ID
- Role
- Reporting Manager
- Task Approver
- Assign Buddy
- Status
- Portal Password

#### Official Details

- Company Code
- Company Name
- Date of Joining
- Department
- Designation
- Job Type
- Working Hours
- In Timing
- Week Off
- Probation Period
- DOE
- Official Email

#### Personal & Family

- Full Name
- Phone No
- Personal Email ID
- Gender
- Marital Status
- Date of Birth
- Blood Group
- Father Name
- Mother Name
- Spouse Name
- Kids
- Anniversary Date
- Current Address
- Permanent Address
- Emergency contact No.
- Emergency Person Name

#### Payroll & Compliance

- Bank Name
- Bank Account No
- Bank IFSC Code
- Salary (Take Home)
- Pan Card No
- Aadhar No
- PF No
- ESIC No
- CTC

#### Documents Upload

- Offer Letter
- Appointment Letter
- Aadhaar Card
- PAN Card
- Bank Proof
- Education Certificate
- Other Employee Documents

#### Editor Buttons

- Close or Cancel
- Save Data

### Documents View

- Open protected file for each document link

### Hierarchy View

- Tree-style hierarchy display

## Settings

Route:

- `/settings`

### Profile Controls

- Change Picture
- Edit Contact Details
- Save Changes
- Cancel

### Security Controls

- Current Password
- New Password
- Confirm New Password
- Show / Hide password toggle
- Change Password

### Danger Zone

- Sign Out

## Super Admin Action Blueprint

If you want the shortest practical reading of the role:

- Super Admin is the global operator.
- Super Admin can move between operational work, approvals, reporting, and master-data maintenance.
- Super Admin is the highest-level editor for clients and employee master data.
- Super Admin can review and act on tickets, FMS, attendance, leaves, intimations, and approvals.
- Super Admin can export reports and use the management dashboard for planning.

## Important UX Notes

- The app mixes modern React routes with legacy business rules from the older AppScript model.
- Some pages are navigation-visible, some are route-only.
- Some actions are role-gated in the UI and again on the server.
- The password experience is split:
  - top-right profile menu does not offer password change for Super Admin
  - `/settings` does offer password change
- `EMP Master` and `Clients Portal` are the most sensitive CRUD areas for Super Admin.

## Source Files Used

- `client/src/app/router/routes.jsx`
- `client/src/components/layout/AppShell.jsx`
- `client/src/components/common/UserProfileMenu.jsx`
- `client/src/components/common/NotificationPanel.jsx`
- `client/src/features/attendance/AttendancePage.jsx`
- `client/src/features/attendance/components/AttendanceEntryPanel.jsx`
- `client/src/features/attendance/components/AttendanceLocationPolicyCard.jsx`
- `client/src/features/tickets/TicketSystemPage.jsx`
- `client/src/features/tickets/components/TicketFilterPanel.jsx`
- `client/src/features/fms/FmsPage.jsx`
- `client/src/features/fms/components/FmsHeader.jsx`
- `client/src/features/fms/components/FmsTabsPanel.jsx`
- `client/src/features/fms/components/FmsFilterPanel.jsx`
- `client/src/features/fms/components/FmsTaskTable.jsx`
- `client/src/features/approvals/ApprovalsPage.jsx`
- `client/src/features/approvals/components/ApprovalsTabsAndFilters.jsx`
- `client/src/features/approvals/components/TicketApprovalTable.jsx`
- `client/src/features/forms-portal/FormsPortalPage.jsx`
- `client/src/features/forms-portal/components/FormsPortalWorkspace.jsx`
- `client/src/features/forms-portal/components/FormsPortalFilterPanel.jsx`
- `client/src/features/forms-portal/components/FormsPortalTable.jsx`
- `client/src/features/clients-portal/ClientsPortalPage.jsx`
- `client/src/features/clients-portal/components/ClientsPortalFilterPanel.jsx`
- `client/src/features/clients-portal/components/ClientsPortalTable.jsx`
- `client/src/features/clients-portal/components/ClientEditor.jsx`
- `client/src/features/clients-portal/components/ClientDetailsCard.jsx`
- `client/src/features/reports/ReportsPage.jsx`
- `client/src/features/reports/components/ReportsToolbar.jsx`
- `client/src/features/reports/components/TicketReportSection.jsx`
- `client/src/features/reports/components/FmsReportSection.jsx`
- `client/src/features/management-dashboard/ManagementDashboardPage.jsx`
- `client/src/features/management-dashboard/components/ManagementDashboardTabs.jsx`
- `client/src/features/management-dashboard/components/OverviewDashboardSection.jsx`
- `client/src/features/management-dashboard/components/UserExplorerSection.jsx`
- `client/src/features/management-dashboard/components/ClientExplorerSection.jsx`
- `client/src/features/admin/useAdminData.js`
- `client/src/features/emp-master/EmpMasterPage.jsx`
- `client/src/features/settings/SettingsPage.jsx`

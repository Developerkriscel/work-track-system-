const referenceDate = new Date(`${process.env.WORKTRACK_REFERENCE_DATE || '2026-07-03'}T12:00:00+05:30`);
const iso = (offset = 0) => {
  const d = new Date(referenceDate);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const users = [
  { employeeId: 'NL106', password: '', name: 'Nitin Lead', role: 'Super Admin', status: 'Active', managerId: '', department: 'Management', mobile: '9999999999' },
  { employeeId: 'AS101', password: '', name: 'Anita Sharma', role: 'Admin', status: 'Active', managerId: 'NL106', department: 'Operations', mobile: '9999999998' },
  { employeeId: 'KR203', password: '', name: 'Kriscel Rao', role: 'Manager', status: 'Active', managerId: 'AS101', department: 'Digital', mobile: '9999999997' },
  { employeeId: 'VK', password: '', name: 'Vikas Kushwah', role: 'User', status: 'Active', managerId: 'KR203', department: 'Execution', mobile: '9999999994' },
  { employeeId: 'EMP118', password: '', name: 'Riya Mehta', role: 'User', status: 'Active', managerId: 'KR203', department: 'Execution', mobile: '9999999996' },
  { employeeId: 'EMP141', password: '', name: 'Aman Verma', role: 'User', status: 'Active', managerId: 'KR203', department: 'Execution', mobile: '9999999995' }
];

export const clients = [
  { clientId: 'CL000', password: '', name: 'Kriscel Tech Private Limited', status: 'Active', owner: 'VK', contact: 'Vikas Kushwah', mobile: '9876543210', email: 'worktrack@kriscel.com', address: 'Kriscel Tech Office', services: 'WorkTrack, Dashboard, Support' },
  { clientId: 'CL001', password: '', name: 'Acme Retail', status: 'Active', owner: 'KR203', contact: 'Priya Kapoor', mobile: '9876543211', email: 'ops@acmeretail.test', address: 'Acme Retail HQ', services: 'Website, Social Media' },
  { clientId: 'CL002', password: '', name: 'Blue Ocean Foods', status: 'Active', owner: 'AS101', contact: 'Manav Sethi', mobile: '9876543212', email: 'accounts@blueocean.test', address: 'Blue Ocean Foods Office', services: 'Design, Social Media' },
  { clientId: 'CL003', password: '', name: 'CRM FMS', status: 'Active', owner: 'NL106', contact: 'Internal', mobile: '9876543213', email: 'crm@kriscel.com', address: 'Internal', services: 'FMS, CRM' }
];

export const tickets = [
  { ticketId: 'TICKET_26070310363325542', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', employeeId: 'VK', employeeName: 'Vikas Kushwah', category: 'Documentation', priority: 'Normal', description: 'work track system new documentation according to mern implementation', status: 'In Progress', timestamp: iso(0), planDate: iso(0), tatMinutes: 240, startTime: '10:36:58', endTime: '', totalDuration: '2h 51m', remarks: 'Running task.', taskApprover: 'KR203' },
  { ticketId: 'TICKET_26070216051639930', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', employeeId: 'VK', employeeName: 'Vikas Kushwah', category: 'Development', priority: 'Normal', description: 'Analyze new codebase client and dashboard and make MERN parity notes', status: 'Pending Approval', timestamp: iso(-1), planDate: iso(-1), tatMinutes: 120, startTime: '16:07:18', endTime: '17:53:35', totalDuration: '1h 46m', remarks: 'Waiting for approval.', taskApprover: 'KR203' },
  { ticketId: 'TICKET_2607021429055911', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', employeeId: 'VK', employeeName: 'Vikas Kushwah', category: 'Website', priority: 'Normal', description: 'Doing some changes in Kriscel website and make it responsive', status: 'Pending Approval', timestamp: iso(-1), planDate: iso(-1), tatMinutes: 90, startTime: '14:29:20', endTime: '16:02:59', totalDuration: '1h 33m', remarks: 'Waiting for approval.', taskApprover: 'KR203' },
  { ticketId: 'TICKET_2607021024073301', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', employeeId: 'VK', employeeName: 'Vikas Kushwah', category: 'Setup', priority: 'Normal', description: 'Work track system setup read documentation and work through implementation', status: 'Pending Approval', timestamp: iso(-1), planDate: iso(-1), tatMinutes: 240, startTime: '10:24:24', endTime: '14:26:54', totalDuration: '4h 2m', remarks: 'Waiting for approval.', taskApprover: 'KR203' },
  { ticketId: 'TICKET_260701122541345', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', employeeId: 'VK', employeeName: 'Vikas Kushwah', category: 'Development', priority: 'Normal', description: 'Understanding the codebase of work track system and migration planning', status: 'Pending Approval', timestamp: iso(-2), planDate: iso(-2), tatMinutes: 240, startTime: '12:26:01', endTime: '18:09:14', totalDuration: '5h 43m', remarks: 'Waiting for approval.', taskApprover: 'KR203' },
  { ticketId: 'TICKET_260701104141956', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', employeeId: 'VK', employeeName: 'Vikas Kushwah', category: 'Research', priority: 'Normal', description: 'Study about implementation of work track system', status: 'Pending Approval', timestamp: iso(-2), planDate: iso(-2), tatMinutes: 90, startTime: '10:42:23', endTime: '12:19:14', totalDuration: '1h 37m', remarks: 'Waiting for approval.', taskApprover: 'KR203' },
  { ticketId: 'TICKET_260703_1', clientId: 'CL001', clientName: 'Acme Retail', employeeId: 'EMP118', employeeName: 'Riya Mehta', category: 'Website', priority: 'High', description: 'Homepage banner update and mobile spacing check', status: 'In Progress', timestamp: iso(0), planDate: iso(0), tatMinutes: 180, remarks: 'Assigned from client portal.' },
  { ticketId: 'TICKET_260702_2', clientId: 'CL002', clientName: 'Blue Ocean Foods', employeeId: 'EMP141', employeeName: 'Aman Verma', category: 'Social Media', priority: 'Medium', description: 'July campaign creatives approval', status: 'Pending Approval', timestamp: iso(-1), planDate: iso(0), tatMinutes: 120, remarks: 'Waiting for client approval.' },
  { ticketId: 'TICKET_260701_3', clientId: 'CL001', clientName: 'Acme Retail', employeeId: 'KR203', employeeName: 'Kriscel Rao', category: 'CRM', priority: 'Urgent', description: 'Lead import issue after sheet sync', status: 'Open', timestamp: iso(-2), planDate: iso(-1), tatMinutes: 90, remarks: 'Overdue.' }
];

export const fmsTasks = [
  { taskId: 'FMS_1001', clientId: 'CL001', clientName: 'Acme Retail', employeeId: 'EMP118', employeeName: 'Riya Mehta', description: 'Daily marketplace order reconciliation', status: 'Completed', planDate: iso(0), doneDate: iso(0), tatMinutes: 60 },
  { taskId: 'FMS_1002', clientId: 'CL002', clientName: 'Blue Ocean Foods', employeeId: 'EMP141', employeeName: 'Aman Verma', description: 'Packaging artwork QA checklist', status: 'Pending', planDate: iso(0), doneDate: '', tatMinutes: 90 },
  { taskId: 'FMS_1003', clientId: 'CL003', clientName: 'CRM FMS', employeeId: 'KR203', employeeName: 'Kriscel Rao', description: 'Follow-up calls for pending leads', status: 'In Progress', planDate: iso(0), doneDate: '', tatMinutes: 150 }
];

export const todos = [
  { todoId: 'TODO_VK_1', employeeId: 'VK', employeeName: 'Vikas Kushwah', task: 'Review WorkTrack MERN parity screens', priority: 'High', dueDate: iso(1), status: 'Pending', tatMinutes: 60 },
  { todoId: 'TODO_1', employeeId: 'EMP118', employeeName: 'Riya Mehta', task: 'Prepare approval note for banner', priority: 'High', dueDate: iso(0), status: 'Pending', tatMinutes: 45 },
  { todoId: 'TODO_2', employeeId: 'EMP141', employeeName: 'Aman Verma', task: 'Send revised caption bank', priority: 'Medium', dueDate: iso(1), status: 'Pending', tatMinutes: 60 }
];

export const attendance = [
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: iso(0), status: 'Present', inTime: '10:20', outTime: '', duration: '', timerElapsedMinutes: 186, 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: iso(-1), status: 'Present', inTime: '09:59', outTime: '06:32', duration: '8h 33m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: iso(-2), status: 'Present', inTime: '10:00', outTime: '06:20', duration: '8h 20m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-11', status: 'Present', inTime: '09:59', outTime: '06:32', duration: '8h 33m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-12', status: 'Absent', inTime: '', outTime: '', duration: '-' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-13', status: 'Present', inTime: '10:00', outTime: '06:20', duration: '8h 20m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-14', status: 'Weekly Off', inTime: '', outTime: '', duration: '-' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-15', status: 'Present', inTime: '09:58', outTime: '06:17', duration: '8h 19m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-16', status: 'Present', inTime: '11:12', outTime: '06:01', duration: '6h 49m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'EMP118', employeeName: 'Riya Mehta', date: iso(0), status: 'Present', inTime: '09:47', outTime: '', duration: '6h 10m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'EMP141', employeeName: 'Aman Verma', date: iso(0), status: 'Present', inTime: '10:02', outTime: '', duration: '5h 55m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' },
  { employeeId: 'KR203', employeeName: 'Kriscel Rao', date: iso(0), status: 'Present', inTime: '09:34', outTime: '', duration: '6h 40m', 'Lattitude': '28.6139', 'Longitude': '77.2090', 'Photo Url': '/worktrack-logo.png' }
];

export const leaves = [
  { leaveId: 'LEAVE_VK_20260612', employeeId: 'VK', employeeName: 'Vikas Kushwah', startDate: '2026-06-12', endDate: '2026-06-12', status: 'HR Approved', reason: 'Today I am not feeling well. I have a fever, weakness, and a headache, so I am not able to come today', type: 'Sick Leave' },
  { leaveId: 'LEAVE_1', employeeId: 'EMP141', employeeName: 'Aman Verma', startDate: iso(2), endDate: iso(2), status: 'Pending', reason: 'Personal work' }
];

export const intimations = [
  { intimationId: 'INT_VK_20260702', employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-07-02', status: 'Submitted', type: 'Work from Home', reason: 'Assign by mitushi ma am' },
  { intimationId: 'INT_VK_20260606', employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-06', status: 'HR Approved', type: 'Work from Home', reason: 'First Saturday' },
  { intimationId: 'INT_VK_20260604', employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-04', status: 'Rejected', type: 'Late Arrival', reason: '..' },
  { intimationId: 'INT_VK_20260627', employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-27', status: 'HR Approved', type: 'Work from Home', reason: 'Come in hometown' },
  { intimationId: 'INT_VK_20260626', employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-06-26', status: 'HR Approved', type: 'Work from Home', reason: 'Right know I am in hometown' },
  { intimationId: 'INT_VK_20260528', employeeId: 'VK', employeeName: 'Vikas Kushwah', date: '2026-05-28', status: 'HR Approved', type: 'Work from Home', reason: '.' }
];

export const invoices = [
  { invoiceId: 'INV_KRIS_001', clientId: 'CL000', clientName: 'Kriscel Tech Private Limited', amount: 125000, paidAmount: 75000, outstanding: 50000, status: 'Partially Paid', dueDate: iso(-5), agingBucket: '1-30', piLink: '/uploads/sample-pi.pdf', invoiceLink: '/uploads/sample-invoice.pdf' },
  { invoiceId: 'INV_001', clientId: 'CL001', clientName: 'Acme Retail', amount: 85000, paidAmount: 25000, outstanding: 60000, status: 'Partially Paid', dueDate: iso(-7), agingBucket: '1-30' },
  { invoiceId: 'INV_002', clientId: 'CL002', clientName: 'Blue Ocean Foods', amount: 45000, paidAmount: 0, outstanding: 45000, status: 'Unpaid', dueDate: iso(-35), agingBucket: '31-60' }
];

export const socialPosts = [
  {
    postId: 'SOC_KRIS_001',
    clientId: 'CL000',
    clientName: 'Kriscel Tech Private Limited',
    platform: 'LinkedIn',
    contentType: 'Post',
    description: 'WorkTrack migration progress post approval',
    status: 'Pending Approval',
    plannedDate: iso(0),
    caption: 'WorkTrack MERN parity progress update',
    creativeLink: '/uploads/social-worktrack-preview.png'
  },
  {
    postId: 'SOC_KRIS_002',
    clientId: 'CL000',
    clientName: 'Kriscel Tech Private Limited',
    platform: 'Instagram',
    contentType: 'Story',
    description: 'Attendance dashboard story creative',
    status: 'Scheduled',
    plannedDate: iso(1),
    caption: 'Attendance and productivity tracking made simple',
    creativeLink: '/uploads/social-attendance-preview.png'
  }
];

export const socialHistory = [
  { historyId: 'HIST_SOC_KRIS_001', postId: 'SOC_KRIS_001', timestamp: iso(0), updatedBy: 'Kriscel Team', remarks: 'Sent to client for approval.', statusChange: 'Pending Approval' }
];

export const formsPortal = [
  { formId: 'FORM_ATTENDANCE', department: 'HR', sheetName: 'Attendance Regularization', forText: 'Punch correction and attendance support', formLink: 'https://example.com/forms/attendance' },
  { formId: 'FORM_LEAVE', department: 'HR', sheetName: 'Leave Request', forText: 'Apply for leave and leave correction', formLink: 'https://example.com/forms/leave' },
  { formId: 'FORM_EXPENSE', department: 'Accounts', sheetName: 'Expense Claim', forText: 'Submit reimbursement and expense proof', formLink: 'https://example.com/forms/expense' },
  { formId: 'FORM_TICKET', department: 'Operations', sheetName: 'Ticket Support', forText: 'Raise support and workflow tickets', formLink: 'https://example.com/forms/ticket' }
];

export const messages = [
  { messageId: 'MSG_1', taskId: 'TICKET_260702_2', sender: 'Blue Ocean Foods', message: 'Please share the final square creative also.', timestamp: referenceDate.toISOString() }
];

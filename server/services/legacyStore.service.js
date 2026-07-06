import mongoose from 'mongoose';
import { LegacyModels } from '../models/legacyModels.js';
import { attendance, clients, fmsTasks, formsPortal, intimations, invoices, leaves, messages, socialHistory, socialPosts, tickets, todos, users } from '../data/seed.js';

const today = () => new Date().toISOString().slice(0, 10);
const isMongoReady = () => mongoose.connection.readyState === 1;
const memoryRows = new Map();

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
export const isClosedStatus = (status = '') => closedTerms.some((term) => String(status).toLowerCase().includes(term));

export function sheetUser(user) {
  return {
    'Employee ID': user.employeeId,
    'Employee Name': user.name,
    'User ID': user.employeeId,
    Password: user.password,
    Role: user.role,
    Status: user.status,
    Manager: user.managerId,
    'Manager ID': user.managerId,
    Department: user.department,
    Mobile: user.mobile
  };
}

export function sheetClient(client) {
  return {
    Client_Id: client.clientId,
    'Client ID': client.clientId,
    'Client Name': client.name,
    Contact: client.contact,
    'Mobile Number': client.mobile || '',
    'Client Email ID': client.email || '',
    Address: client.address || '',
    Password: client.password,
    Status: client.status,
    Services: client.services || 'WorkTrack Services',
    'Detail Shared': 'Yes'
  };
}

export function sheetTicket(ticket) {
  return {
    'Ticket ID': ticket.ticketId,
    ID: ticket.ticketId,
    Client_Id: ticket.clientId,
    Client: ticket.clientName,
    Name: ticket.clientName,
    'Client Name': ticket.clientName,
    'Employee ID': ticket.employeeId,
    'Employee Name': ticket.employeeName,
    'Task Category': ticket.category,
    Priority: ticket.priority,
    'Task Description': ticket.description,
    Description: ticket.description,
    Status: ticket.status,
    Timestamp: ticket.timestamp,
    Date: ticket.planDate || ticket.timestamp,
    'Plan Date': ticket.planDate,
    'Last Update Date': ticket.lastUpdateDate || ticket.timestamp,
    'Start Time': ticket.startTime || ticket['Start Time'] || '',
    'End Time': ticket.endTime || ticket['End Time'] || '',
    'Total Duration': ticket.totalDuration || ticket['Total Duration'] || ticket.duration || '',
    Attachment: ticket.attachment || ticket.Attachment || '',
    Remarks: ticket.remarks || '',
    TAT: ticket.tatMinutes,
    When: ticket.tatMinutes,
    'Task Approver': ticket.taskApprover || ticket.employeeId,
    'Reassigned By': ticket.reassignedBy || ''
  };
}

export function sheetFms(task) {
  return {
    'Task ID': task.taskId,
    ID: task.taskId,
    Client_Id: task.clientId,
    Client: task.clientName,
    'Client Name': task.clientName,
    'Employee ID': task.employeeId,
    'Employee Name': task.employeeName,
    User: task.employeeName,
    'Task Description': task.description,
    Description: task.description,
    Status: task.status,
    'Plan Date': task.planDate,
    Date: task.planDate,
    'Done Date': task.doneDate,
    TAT: task.tatMinutes,
    rowId: task.taskId,
    actualDate: task.doneDate,
    who: task.employeeName,
    empId: task.employeeId,
    fmsName: task.clientName,
    formLink: ''
  };
}

export function sheetTodo(todo) {
  return {
    'Task ID': todo.todoId,
    ID: todo.todoId,
    TodoID: todo.todoId,
    'Employee ID': todo.employeeId,
    'Employee Name': todo.employeeName,
    User: todo.employeeName,
    Task: todo.task,
    Description: todo.task,
    Priority: todo.priority,
    Status: todo.status,
    'Due Date': todo.dueDate,
    Date: todo.dueDate,
    TAT: todo.tatMinutes
  };
}

export function sheetInvoice(invoice) {
  return {
    InvoiceID: invoice.invoiceId,
    'Invoice ID': invoice.invoiceId,
    ID: invoice.invoiceId,
    CustomerID: invoice.clientId,
    CustomerName: invoice.clientName,
    'Client Name': invoice.clientName,
    Amount: invoice.amount,
    InvoiceAmount: invoice.amount,
    PaidAmount: invoice.paidAmount,
    Outstanding: invoice.outstanding,
    Status: invoice.status,
    DueDate: invoice.dueDate,
    DueDateFmt: invoice.dueDate,
    Date: invoice.dueDate,
    'Aging Bucket': invoice.agingBucket,
    PILink: invoice.piLink || '',
    InvoiceLink: invoice.invoiceLink || ''
  };
}

export function sheetSocial(post) {
  return {
    'Post ID': post.postId,
    ID: post.postId,
    Client_Id: post.clientId,
    'Client Name': post.clientName,
    Platform: post.platform,
    'Content Type': post.contentType,
    Description: post.description,
    Caption: post.caption || post.description,
    Status: post.status,
    'Planned Post Date': post.plannedDate,
    Date: post.plannedDate,
    CreativeLink: post.creativeLink || '',
    'Latest Update Date': post.latestUpdateDate || post.plannedDate
  };
}

export function sheetSocialHistory(history) {
  return {
    'History ID': history.historyId,
    ID: history.historyId,
    'Post ID': history.postId,
    'Update Timestamp': history.timestamp,
    'Updated By': history.updatedBy,
    Remarks: history.remarks,
    'Status Change': history.statusChange,
    'Client Remark': history.clientRemark || ''
  };
}

export function sheetFormPortal(form) {
  return {
    'Form ID': form.formId,
    ID: form.formId,
    Department: form.department,
    'Sheet name': form.sheetName,
    For: form.forText,
    'Form link': form.formLink,
    Status: form.status || 'Active'
  };
}

export function sheetAttendance(row) {
  const date = row.date || row.Date || today();
  const photo = row.photo || row.Photo || row['Photo Url'] || row['Photo URL'] || '';
  const latitude = row.lat || row.Latitude || row.Lattitude || row['Lattitude'] || row['Latitude'] || '';
  const longitude = row.long || row.Longitude || row['Longitude'] || '';
  return {
    AttendanceID: row.AttendanceID || `ATT_${row.employeeId || row.EmpID || Date.now()}_${date}`,
    'Employee ID': row.employeeId || row['Employee ID'] || row.EmpID,
    EmpID: row.employeeId || row['Employee ID'] || row.EmpID,
    'Employee Name': row.employeeName || row['Employee Name'] || row.Name,
    Name: row.employeeName || row['Employee Name'] || row.Name,
    Date: date,
    Action: row.action || row.Action || (row.inTime ? 'Punch In' : ''),
    'Punch In': row.inTime || row['Punch In'] || row.InTime || '',
    'Punch Out': row.outTime || row['Punch Out'] || row.OutTime || '',
    Time: row.inTime || row.Time || '',
    'Timer Elapsed Minutes': row.timerElapsedMinutes || row['Timer Elapsed Minutes'] || '',
    Status: row.status || row.Status || 'Present',
    Duration: row.duration || row.Duration || '',
    Photo: photo,
    'Photo Url': photo,
    'Photo URL': photo,
    Latitude: latitude,
    Lattitude: latitude,
    Longitude: longitude
  };
}

export function sheetMessage(message) {
  return {
    MessageID: message.messageId || message.MessageID,
    TaskID: message.taskId || message.TaskID,
    Sender: message.sender || message.Sender,
    Message: message.message || message.Message,
    Timestamp: message.timestamp || message.Timestamp || new Date().toISOString(),
    IsReadByClient: message.IsReadByClient || false
  };
}

const seedRows = {
  User: () => users.map(sheetUser),
  Client: () => clients.map(sheetClient),
  Ticket: () => tickets.map(sheetTicket),
  Attendance: () => attendance.map(sheetAttendance),
  Leave: () => leaves.map((leave) => ({
    LeaveID: leave.leaveId,
    'Employee ID': leave.employeeId,
    'Employee Name': leave.employeeName,
    'Start Date': leave.startDate,
    'End Date': leave.endDate,
    Status: leave.status,
    Reason: leave.reason
  })),
  Intimation: () => intimations.map((item) => ({
    IntimationID: item.intimationId,
    'Employee ID': item.employeeId,
    'Employee Name': item.employeeName,
    'Intimation Date': item.date,
    'Intimation Type': item.type,
    Status: item.status,
    Reason: item.reason
  })),
  Expense: () => [],
  FmsTask: () => fmsTasks.map(sheetFms),
  Todo: () => todos.map(sheetTodo),
  Invoice: () => invoices.map(sheetInvoice),
  Message: () => messages.map(sheetMessage),
  SocialMedia: () => socialPosts.map(sheetSocial),
  SocialHistory: () => socialHistory.map(sheetSocialHistory),
  FormsPortal: () => formsPortal.map(sheetFormPortal),
  TicketHistory: () => [],
  WhatsAppLog: () => []
};

function cloneRow(row) {
  return JSON.parse(JSON.stringify(row));
}

function getMemoryRows(modelName) {
  if (!memoryRows.has(modelName)) {
    memoryRows.set(modelName, (seedRows[modelName]?.() || []).map(cloneRow));
  }
  return memoryRows.get(modelName);
}

export function getLegacyId(modelName, row = {}) {
  const candidates = {
    User: ['Employee ID', 'User ID', 'EMP Code'],
    Client: ['Client_Id', 'Client ID', 'CustomerID'],
    Ticket: ['Ticket ID', 'Task ID', 'ID'],
    Attendance: ['AttendanceID', 'ID'],
    Leave: ['LeaveID', 'Leave ID', 'ID'],
    Intimation: ['IntimationID', 'Intimation ID', 'ID'],
    Expense: ['ExpenseID', 'Expense ID', 'ID'],
    FmsTask: ['Task ID', 'FMS ID', 'ID', 'rowId'],
    Todo: ['Task ID', 'TodoID', 'ID'],
    Invoice: ['InvoiceID', 'Invoice ID', 'ID'],
    Message: ['MessageID', 'Message ID', 'ID'],
    SocialMedia: ['Post ID', 'ID'],
    SocialHistory: ['History ID', 'ID'],
    FormsPortal: ['Form ID', 'Sheet name', 'ID'],
    TicketHistory: ['History ID', 'Ticket ID', 'ID'],
    WhatsAppLog: ['Log ID', 'ID']
  }[modelName] || ['ID'];

  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return String(row[key]).trim();
  }
  return `${modelName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listRows(modelName) {
  if (!isMongoReady()) return getMemoryRows(modelName).map(cloneRow);
  const Model = LegacyModels[modelName];
  const docs = await Model.find({}).sort({ createdAt: 1 }).lean();
  if (!docs.length) return seedRows[modelName]?.() || [];
  return docs.map((doc) => ({ ...doc.data, _id: String(doc._id), _legacyId: doc.legacyId }));
}

export async function listMongoRows(modelName) {
  if (!isMongoReady()) return [];
  const Model = LegacyModels[modelName];
  const docs = await Model.find({}).sort({ createdAt: 1 }).lean();
  return docs.map((doc) => ({ ...doc.data, _id: String(doc._id), _legacyId: doc.legacyId }));
}

export async function insertRow(modelName, row) {
  const legacyId = getLegacyId(modelName, row);
  if (!isMongoReady()) {
    getMemoryRows(modelName).push(cloneRow(row));
    return row;
  }
  await LegacyModels[modelName].create({ legacyId, data: row });
  return row;
}

export async function upsertRow(modelName, key, value, updateData) {
  const rows = await listRows(modelName);
  const existing = rows.find((row) => String(row[key] || '') === String(value));
  const next = { ...(existing || {}), ...updateData };
  const legacyId = getLegacyId(modelName, next);
  if (!isMongoReady()) {
    const store = getMemoryRows(modelName);
    const index = store.findIndex((row) => String(row[key] || '') === String(value));
    if (index >= 0) store[index] = cloneRow(next);
    else store.push(cloneRow(next));
    return next;
  }
  await LegacyModels[modelName].findOneAndUpdate(
    { legacyId },
    { $set: { legacyId, data: next } },
    { upsert: true, new: true }
  );
  return next;
}

export async function deleteOrDeactivate(modelName, key, value) {
  const rows = await listRows(modelName);
  const row = rows.find((item) => String(item[key] || '') === String(value));
  if (!row) return null;
  const next = { ...row, Status: 'Inactive' };
  if (!isMongoReady()) {
    const store = getMemoryRows(modelName);
    const index = store.findIndex((item) => String(item[key] || '') === String(value));
    if (index >= 0) store[index] = cloneRow(next);
    return next;
  }
  await LegacyModels[modelName].findOneAndUpdate({ legacyId: getLegacyId(modelName, row) }, { $set: { data: next } });
  return next;
}

export async function replaceCollection(modelName, rows) {
  if (!isMongoReady()) throw new Error('MongoDB is not connected. Set MONGO_URI before importing.');
  const Model = LegacyModels[modelName];
  await Model.deleteMany({});
  if (!rows.length) return 0;
  await Model.insertMany(rows.map((row) => ({ legacyId: getLegacyId(modelName, row), data: row })), { ordered: false });
  return rows.length;
}

export function resetMemoryStore() {
  memoryRows.clear();
}

export async function resetLegacyStore() {
  memoryRows.clear();
  if (!isMongoReady()) return;
  const demoPassword = '123456';
  await Promise.all([
    replaceCollection('User', users.map((user) => sheetUser({ ...user, password: demoPassword }))),
    replaceCollection('Client', clients.map((client) => sheetClient({ ...client, password: demoPassword }))),
    replaceCollection('Ticket', tickets.map(sheetTicket)),
    replaceCollection('Attendance', attendance.map(sheetAttendance)),
    replaceCollection('Leave', leaves.map((leave) => ({
      LeaveID: leave.leaveId,
      'Employee ID': leave.employeeId,
      'Employee Name': leave.employeeName,
      'Start Date': leave.startDate,
      'End Date': leave.endDate,
      Status: leave.status,
      Reason: leave.reason
    }))),
    replaceCollection('Intimation', intimations.map((item) => ({
      IntimationID: item.intimationId,
      'Employee ID': item.employeeId,
      'Employee Name': item.employeeName,
      'Intimation Date': item.date,
      'Intimation Type': item.type,
      Status: item.status,
      Reason: item.reason
    }))),
    replaceCollection('Expense', []),
    replaceCollection('FmsTask', fmsTasks.map(sheetFms)),
    replaceCollection('Todo', todos.map(sheetTodo)),
    replaceCollection('Invoice', invoices.map(sheetInvoice)),
    replaceCollection('Message', messages.map(sheetMessage)),
    replaceCollection('SocialMedia', socialPosts.map(sheetSocial)),
    replaceCollection('SocialHistory', socialHistory.map(sheetSocialHistory)),
    replaceCollection('FormsPortal', formsPortal.map(sheetFormPortal)),
    replaceCollection('TicketHistory', []),
    replaceCollection('WhatsAppLog', [])
  ]);
}

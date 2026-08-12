import mongoose from 'mongoose';
import { LegacyModels } from '../models/legacyModels.js';

const today = () => new Date().toISOString().slice(0, 10);
const isMongoReady = () => mongoose.connection.readyState === 1;
const appendOnlyModels = new Set(['Attendance', 'Message', 'TicketHistory', 'SocialHistory', 'WhatsAppLog']);
const READ_CACHE_TTL_MS = Number(process.env.WORKTRACK_READ_CACHE_TTL_MS || 30000);
const readCache = new Map();
const storeMutationListeners = new Set();
let indexesReady = null;

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
    'Visibility Type': form.visibilityType || 'ALL',
    'Visible Users': form.visibleUsers || '',
    Viewer: form.visibilityType === 'ALL' ? 'ALL' : (form.visibleUsers || ''),
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
    Remarks: row.remarks || row.Remarks || '',
    'Admin Remarks': row['Admin Remarks'] || row.adminRemarks || '',
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

async function waitForMongoReady(timeoutMs = 8000) {
  if (isMongoReady()) return true;
  await new Promise((resolve, reject) => {
    const onConnected = () => done(resolve, true);
    const onOpen = () => done(resolve, true);
    const onError = (error) => done(reject, error);
    const timer = setTimeout(() => done(resolve, false), timeoutMs);

    function done(callback, value) {
      clearTimeout(timer);
      mongoose.connection.off('connected', onConnected);
      mongoose.connection.off('open', onOpen);
      mongoose.connection.off('error', onError);
      callback(value);
    }

    mongoose.connection.on('connected', onConnected);
    mongoose.connection.on('open', onOpen);
    mongoose.connection.on('error', onError);
  });
  return isMongoReady();
}

async function assertMongoReady() {
  if (isMongoReady()) return;
  const recovered = await waitForMongoReady();
  if (!recovered) {
    throw new Error('MongoDB is not connected. WorkTrack uses MongoDB data only.');
  }
}

function cloneRows(rows = []) {
  return rows.map((row) => ({ ...row }));
}

function clearReadCache(modelName = '') {
  if (modelName) {
    readCache.delete(modelName);
    return;
  }
  readCache.clear();
}

export function registerStoreMutationListener(listener) {
  if (typeof listener === 'function') {
    storeMutationListeners.add(listener);
  }
  return () => storeMutationListeners.delete(listener);
}

export function touchStoreMutation(modelName = '') {
  clearReadCache(modelName);
  for (const listener of storeMutationListeners) {
    try {
      listener(modelName);
    } catch {
      // Listener errors must never block writes.
    }
  }
}

export async function ensurePerformanceIndexes() {
  await assertMongoReady();
  if (indexesReady) return indexesReady;
  const compoundIndexes = {
    Ticket: [
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.Plan Date': -1 }, { background: true }],
      [{ 'data.Task Approver': 1, 'data.Status': 1, 'data.Plan Date': -1 }, { background: true }],
      [{ 'data.Client_Id': 1, 'data.Status': 1, 'data.Plan Date': -1 }, { background: true }]
    ],
    FmsTask: [
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.Plan Date': -1 }, { background: true }],
      [{ 'data.Task Approver': 1, 'data.Status': 1, 'data.Plan Date': -1 }, { background: true }]
    ],
    Todo: [
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.Due Date': -1 }, { background: true }]
    ],
    Attendance: [
      [{ 'data.Employee ID': 1, 'data.Date': -1 }, { background: true }],
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.Date': -1 }, { background: true }],
      [{ 'data.Task Approver': 1, 'data.Status': 1, 'data.Date': -1 }, { background: true }]
    ],
    Leave: [
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.Start Date': -1 }, { background: true }],
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.End Date': -1 }, { background: true }]
    ],
    Intimation: [
      [{ 'data.Employee ID': 1, 'data.Status': 1, 'data.Intimation Date': -1 }, { background: true }]
    ],
    Expense: [
      [{ 'data.Employee ID': 1, createdAt: -1 }, { background: true }]
    ],
    TicketHistory: [
      [{ 'data.Action By': 1, 'data.Timestamp': -1 }, { background: true }],
      [{ 'data.Employee ID': 1, 'data.Timestamp': -1 }, { background: true }]
    ],
    User: [
      [{ 'data.Status': 1, 'data.Manager ID': 1 }, { background: true }],
      [{ 'data.Status': 1, 'data.Task Approver': 1 }, { background: true }],
      [{ 'data.Status': 1, 'data.Role': 1 }, { background: true }]
    ]
  };
  indexesReady = Promise.all(Object.entries(LegacyModels).map(async ([name, Model]) => {
    await Promise.all([
      Model.collection.createIndex({ createdAt: 1 }).catch(() => null),
      Model.collection.createIndex({ updatedAt: -1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Employee ID': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.EmpID': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.User ID': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Status': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Plan Date': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Date': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Task Approver': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Ticket ID': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Task ID': 1 }).catch(() => null),
      Model.collection.createIndex({ 'data.Client_Id': 1 }).catch(() => null)
    ]);
    await Promise.all((compoundIndexes[name] || []).map(([keys, options]) => Model.collection.createIndex(keys, options).catch(() => null)));
  })).catch((error) => {
    indexesReady = null;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Mongo index warmup skipped: ${error.message}`);
    }
  });
  return indexesReady;
}

const legacyIdKeyMap = {
    User: ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'empCode'],
    EmpMaster: ['EMP Code', 'Employee ID', 'User ID', 'empCode', 'employeeId', 'userId'],
    Client: ['Client_Id', 'Client ID', 'CustomerID', 'clientId', 'customerId'],
    Ticket: ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId'],
    Attendance: ['AttendanceID', 'ID', 'attendanceId'],
    AttendancePolicy: ['PolicyID', 'ID', 'policyId', 'AttendancePolicyID'],
    Leave: ['LeaveID', 'Leave ID', 'ID', 'leaveId'],
    Intimation: ['IntimationID', 'Intimation ID', 'ID', 'intimationId'],
    Expense: ['ExpenseID', 'Expense ID', 'ID', 'expenseId'],
    FmsTask: ['Task ID', 'FMS ID', 'ID', 'rowId', 'taskId', 'fmsId'],
    Todo: ['Task ID', 'TodoID', 'ID', 'todoId', 'taskId'],
    Invoice: ['InvoiceID', 'Invoice ID', 'ID', 'invoiceId'],
    Message: ['MessageID', 'Message ID', 'ID', 'messageId'],
    SocialMedia: ['Post ID', 'ID', 'postId'],
    SocialHistory: ['History ID', 'ID', 'historyId'],
    FormsPortal: ['Form ID', 'Sheet name', 'ID', 'formId', 'sheetName'],
    TicketHistory: ['History ID', 'Ticket ID', 'ID', 'historyId', 'ticketId'],
    WhatsAppLog: ['Log ID', 'ID', 'logId']
  };

export function legacyIdCandidates(modelName) {
  return legacyIdKeyMap[modelName] || ['ID'];
}

export function getLegacyId(modelName, row = {}) {
  const candidates = legacyIdCandidates(modelName);

  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return String(row[key]).trim();
  }
  if (modelName === 'Attendance') {
    const employeeId = row['Employee ID'] || row.EmpID || row.employeeId || 'UNKNOWN';
    const date = row.Date || row.date || today();
    const action = row.Action || row.action || (row['Punch Out'] || row.outTime ? 'Punch Out' : row['Punch In'] || row.inTime ? 'Punch In' : 'Record');
    const time = row.Time || row['Punch In'] || row['Punch Out'] || row.inTime || row.outTime || '';
    return `ATT_${employeeId}_${date}_${String(action).replace(/\s+/g, '_')}_${String(time).replace(/[^A-Za-z0-9]+/g, '')}`;
  }
  return `${modelName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function stripInternalMetadata(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const { _id, _legacyId, __v, createdAt, updatedAt, ...clean } = row;
  return clean;
}

export async function listRows(modelName) {
  await assertMongoReady();
  void ensurePerformanceIndexes();
  const cached = readCache.get(modelName);
  if (cached && Date.now() - cached.at < READ_CACHE_TTL_MS) {
    return cloneRows(cached.rows);
  }
  const Model = LegacyModels[modelName];
  const docs = await Model.find({}).sort({ createdAt: 1 }).lean();
  const rows = docs.map((doc) => ({ ...stripInternalMetadata(doc.data), _id: String(doc._id), _legacyId: doc.legacyId }));
  readCache.set(modelName, { at: Date.now(), rows });
  return cloneRows(rows);
}

export async function listMongoRows(modelName) {
  await assertMongoReady();
  void ensurePerformanceIndexes();
  const Model = LegacyModels[modelName];
  const docs = await Model.find({}).sort({ createdAt: 1 }).lean();
  return docs.map((doc) => ({ ...stripInternalMetadata(doc.data), _id: String(doc._id), _legacyId: doc.legacyId }));
}

export async function insertRow(modelName, row) {
  await assertMongoReady();
  const cleanRow = stripInternalMetadata(row);
  const legacyId = getLegacyId(modelName, cleanRow);
  const Model = LegacyModels[modelName];
  if (!appendOnlyModels.has(modelName)) {
    const existingDoc = await Model.findOne({ legacyId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const next = existingDoc?.data ? { ...stripInternalMetadata(existingDoc.data), ...cleanRow } : cleanRow;
    await Model.findOneAndUpdate(
      existingDoc ? { _id: existingDoc._id } : { legacyId },
      { $set: { legacyId, data: next } },
      { upsert: true, new: true }
    );
    if (existingDoc) {
      await Model.deleteMany({ legacyId, _id: { $ne: existingDoc._id } });
    }
    touchStoreMutation(modelName);
    return next;
  }
  await Model.create({ legacyId, data: cleanRow });
  touchStoreMutation(modelName);
  return cleanRow;
}

export async function upsertRow(modelName, key, value, updateData) {
  await assertMongoReady();
  const Model = LegacyModels[modelName];
  const rawValue = String(value ?? '').trim();
  const idKeys = Array.from(new Set([key, ...(legacyIdCandidates(modelName))].filter(Boolean)));
  const query = rawValue
    ? {
        $or: [
          { legacyId: rawValue },
          ...(rawValue.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: rawValue }] : []),
          ...idKeys.map((candidateKey) => ({ [`data.${candidateKey}`]: rawValue }))
        ]
      }
    : { legacyId: getLegacyId(modelName, updateData) };
  const existingDoc = rawValue ? await Model.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean() : null;
  const existing = existingDoc?.data ? stripInternalMetadata(existingDoc.data) : null;
  const cleanUpdate = stripInternalMetadata(updateData);
  const next = { ...(existing || {}), ...cleanUpdate };
  const legacyId = existingDoc?.legacyId || getLegacyId(modelName, next);
  await Model.findOneAndUpdate(
    existingDoc ? { _id: existingDoc._id } : { legacyId },
    { $set: { legacyId, data: next } },
    { upsert: true, new: true }
  );
  if (existingDoc) {
    await Model.deleteMany({ legacyId, _id: { $ne: existingDoc._id } });
  }
  touchStoreMutation(modelName);
  return next;
}

export async function deleteOrDeactivate(modelName, key, value) {
  const rows = await listRows(modelName);
  const row = rows.find((item) => String(item[key] || '') === String(value));
  if (!row) return null;
  const next = { ...row, Status: 'Inactive' };
  await LegacyModels[modelName].findOneAndUpdate({ legacyId: getLegacyId(modelName, row) }, { $set: { data: next } });
  touchStoreMutation(modelName);
  return next;
}

export async function deleteRow(modelName, key, value) {
  await assertMongoReady();
  const rows = await listRows(modelName);
  const row = rows.find((item) => String(item[key] || '').trim() === String(value || '').trim());
  if (!row) return null;
  const legacyId = row._legacyId || getLegacyId(modelName, row);
  await LegacyModels[modelName].deleteMany({ legacyId });
  touchStoreMutation(modelName);
  return row;
}

export async function replaceCollection(modelName, rows) {
  await assertMongoReady();
  const Model = LegacyModels[modelName];
  await Model.deleteMany({});
  clearReadCache(modelName);
  if (!rows.length) return 0;
  await Model.insertMany(rows.map((row) => {
    const cleanRow = stripInternalMetadata(row);
    return { legacyId: getLegacyId(modelName, cleanRow), data: cleanRow };
  }), { ordered: false });
  touchStoreMutation(modelName);
  return rows.length;
}

export async function resetLegacyStore() {
  await assertMongoReady();
  await Promise.all(Object.keys(LegacyModels).map(async (modelName) => {
    await LegacyModels[modelName].deleteMany({});
  }));
  clearReadCache();
  for (const listener of storeMutationListeners) {
    try {
      listener();
    } catch {
      // ignore listener errors during reset
    }
  }
}

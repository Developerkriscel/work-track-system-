import { saveBase64File } from './fileStorage.service.js';
import { insertRow, listRows, stripInternalMetadata, upsertRow } from './legacyStore.service.js';
import { LegacyModels } from '../models/legacyModels.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const fromLegacyDoc = (doc) => doc ? { ...stripInternalMetadata(doc.data || {}), _id: String(doc._id), _legacyId: doc.legacyId } : null;
const fromLegacyDocs = (docs = []) => docs.map(fromLegacyDoc).filter(Boolean);

function idVariants(value) {
  const raw = safe(value);
  return Array.from(new Set([raw, raw.toUpperCase(), raw.toLowerCase()].filter(Boolean)));
}

function clientTicketClientQuery(clientId) {
  const values = idVariants(clientId);
  return {
    $or: [
      { 'data.Client_Id': { $in: values } },
      { 'data.Client ID': { $in: values } },
      { 'data.CustomerID': { $in: values } },
      { 'data.clientId': { $in: values } }
    ]
  };
}

function ticketIdQuery(ticketId) {
  const values = idVariants(ticketId);
  return {
    $or: [
      { legacyId: { $in: values } },
      { 'data.Ticket ID': { $in: values } },
      { 'data.Task ID': { $in: values } },
      { 'data.ID': { $in: values } },
      { 'data.ticketId': { $in: values } },
      { 'data.taskId': { $in: values } }
    ]
  };
}

function clientOriginTicketQuery() {
  return {
    $or: [
      { 'data.Origin': /^client$/i },
      { 'data.origin': /^client$/i },
      { 'data.Client Ticket': /^(yes|true)$/i },
      { 'data.clientTicket': /^(yes|true)$/i },
      { 'data.Is Client Ticket': /^(yes|true)$/i },
      { 'data.isClientTicket': /^(yes|true)$/i },
      { 'data.Source': /client portal|^client$/i },
      { 'data.source': /client portal|^client$/i },
      { 'data.Ticket Source': /client portal|^client$/i },
      { 'data.ticketSource': /client portal|^client$/i },
      { 'data.Remarks': /created from (mern )?client portal/i },
      { 'data.remarks': /created from (mern )?client portal/i }
    ]
  };
}

function ticketDateRangeQuery(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = normalizedDate(startDate);
  const end = normalizedDate(endDate);
  return {
    $or: ['Plan Date', 'Date', 'Timestamp', 'Created Date', 'Created At'].map((key) => ({
      [`data.${key}`]: { $gte: start, $lte: `${end}T23:59:59.999Z` }
    }))
  };
}

function ticketProjection() {
  return {
    legacyId: 1,
    'data.Ticket ID': 1,
    'data.Task ID': 1,
    'data.ID': 1,
    'data.Client_Id': 1,
    'data.Client ID': 1,
    'data.CustomerID': 1,
    'data.clientId': 1,
    'data.Name': 1,
    'data.Client Name': 1,
    'data.Client': 1,
    'data.Employee ID': 1,
    'data.EmpID': 1,
    'data.employeeId': 1,
    'data.Employee Name': 1,
    'data.User': 1,
    'data.employeeName': 1,
    'data.Task Category': 1,
    'data.Category': 1,
    'data.Priority': 1,
    'data.Task Description': 1,
    'data.Description': 1,
    'data.Status': 1,
    'data.Timestamp': 1,
    'data.Date': 1,
    'data.Plan Date': 1,
    'data.Last Update Date': 1,
    'data.Start Time': 1,
    'data.End Time': 1,
    'data.Total Duration': 1,
    'data.Duration': 1,
    'data.Remarks': 1,
    'data.TAT': 1,
    'data.When': 1,
    'data.Task Approver': 1,
    'data.Reassigned By': 1,
    'data.Source': 1,
    'data.Ticket Source': 1,
    'data.Origin': 1,
    'data.Client Ticket': 1,
    'data.Attachments': 1,
    'data.Attachment': 1,
    'data.HasUnreadMessages': 1,
    'data.HasUnreadAdminMessages': 1
  };
}

function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clientTicketBaseAnd(clientId, { startDate = '', endDate = '' } = {}) {
  const and = [clientTicketClientQuery(clientId), clientOriginTicketQuery()];
  const range = ticketDateRangeQuery(startDate, endDate);
  if (range) and.push(range);
  return and;
}

function clientTicketSearchQuery(search = '') {
  const query = safe(search);
  if (!query) return null;
  const pattern = new RegExp(escapeRegex(query), 'i');
  return {
    $or: [
      { legacyId: pattern },
      { 'data.Ticket ID': pattern },
      { 'data.ID': pattern },
      { 'data.Task Description': pattern },
      { 'data.Description': pattern },
      { 'data.Remarks': pattern },
      { 'data.Status': pattern },
      { 'data.Priority': pattern }
    ]
  };
}

function clientTicketStatusQuery(group = '') {
  const value = safe(group).toLowerCase();
  const responseQuery = { 'data.Status': /pending client response/i };
  const closedQuery = {
    $or: [
      { 'data.Status': /closed/i },
      { 'data.Status': /completed/i },
      { 'data.Status': /resolved/i },
      { 'data.Status': /done/i },
      { 'data.Status': /approved/i },
      { 'data.Status': /cancelled/i }
    ]
  };

  if (value === 'response') return responseQuery;
  if (value === 'closed') return closedQuery;
  if (value === 'open') {
    return {
      $and: [
        { 'data.Status': { $not: /pending client response/i } },
        { 'data.Status': { $not: /closed|completed|resolved|done|approved|cancelled/i } }
      ]
    };
  }
  return null;
}

function clientTicketSort(sortKey = 'createdDate', sortDirection = 'desc') {
  const dir = safe(sortDirection).toLowerCase() === 'asc' ? 1 : -1;
  const keyMap = {
    id: 'data.Ticket ID',
    description: 'data.Task Description',
    latestUpdate: 'data.Last Update Date',
    status: 'data.Status',
    priority: 'data.Priority',
    createdDate: 'data.Timestamp',
    expectedDate: 'data.Plan Date'
  };
  const key = keyMap[sortKey] || keyMap.createdDate;
  return { [key]: dir, updatedAt: -1, 'data.Last Update Date': -1, 'data.Timestamp': -1 };
}

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function today() {
  return referenceNow().toISOString().slice(0, 10);
}

function nowIso() {
  return referenceNow().toISOString();
}
      
function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const date = normalizedDate(value);
  return date >= start && date <= end;
}

function isClosedStatus(status = '') {
  return ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid']
    .some((term) => safe(status).toLowerCase().includes(term));
}

function isClientOriginTicket(row = {}) {
  const remarks = first(row, ['Remarks', 'remarks'], '');
  const source = safe(first(row, ['Source', 'source', 'Ticket Source', 'ticketSource']));
  const origin = safe(first(row, ['Origin', 'origin']));
  const clientTicketFlag = safe(first(row, ['Client Ticket', 'clientTicket', 'Is Client Ticket', 'isClientTicket']));
  const normalizedRemarks = safe(remarks).toLowerCase();
  const normalizedSource = source.toLowerCase();
  const normalizedOrigin = origin.toLowerCase();
  const normalizedClientTicketFlag = clientTicketFlag.toLowerCase();
  return normalizedOrigin === 'client'
    || normalizedClientTicketFlag === 'yes'
    || normalizedClientTicketFlag === 'true'
    || normalizedSource.includes('client portal')
    || normalizedSource === 'client'
    || normalizedRemarks.includes('created from client portal')
    || normalizedRemarks.includes('created from mern client portal');
}

function asTicketRow(row = {}, clients = []) {
  const ticketId = first(row, ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId']);
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const clientNameFromMaster =
    clients.find((item) => eq(item.Client_Id || item['Client ID'], clientId))?.['Client Name'] || '';
  const client = first(row, ['Name', 'Client Name', 'Client', 'clientName'], clientNameFromMaster);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'employeeId']);
  const employeeName = first(row, ['Employee Name', 'User', 'employeeName'], employeeId);
  const description = first(row, ['Task Description', 'Description', 'description']);
  const planDate = first(row, ['Plan Date', 'Date', 'planDate', 'timestamp']);
  const timestamp = first(row, ['Timestamp', 'timestamp', 'Created At', 'Date'], planDate);
  const totalDuration = first(row, ['Total Duration', 'Duration', 'totalDuration', 'duration']);

  return {
    ...row,
    'Ticket ID': ticketId,
    ID: first(row, ['ID', 'Ticket ID', 'ticketId'], ticketId),
    Client_Id: clientId,
    'Client ID': first(row, ['Client ID', 'Client_Id', 'clientId'], clientId),
    Client: client,
    Name: client,
    'Client Name': client,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    User: employeeName,
    'Task Category': first(row, ['Task Category', 'Category', 'category'], 'General'),
    Category: first(row, ['Category', 'Task Category', 'category'], 'General'),
    Priority: first(row, ['Priority', 'priority'], 'Normal'),
    'Task Description': description,
    Description: description,
    Status: first(row, ['Status', 'status'], 'Open'),
    Timestamp: timestamp,
    Date: first(row, ['Date', 'Plan Date', 'planDate', 'timestamp'], planDate),
    'Plan Date': planDate,
    'Last Update Date': first(row, ['Last Update Date', 'lastUpdateDate', 'Timestamp', 'timestamp'], timestamp),
    'Start Time': first(row, ['Start Time', 'startTime']),
    'End Time': first(row, ['End Time', 'endTime']),
    'Total Duration': totalDuration,
    Duration: totalDuration,
    Remarks: first(row, ['Remarks', 'remarks']),
    TAT: first(row, ['TAT', 'When', 'tatMinutes']),
    When: first(row, ['When', 'TAT', 'tatMinutes']),
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID']),
    'Reassigned By': first(row, ['Reassigned By', 'reassignedBy'])
  };
}

function asFmsRow(row = {}) {
  const id = first(row, ['Task ID', 'ID', 'rowId', 'taskId']);
  const planDate = first(row, ['Plan Date', 'Date', 'planDate']);
  const doneDate = first(row, ['Done Date', 'actualDate', 'doneDate']);
  return {
    ...row,
    'Task ID': id,
    ID: id,
    rowId: id,
    Client_Id: first(row, ['Client_Id', 'Client ID', 'clientId']),
    'Client Name': first(row, ['Client Name', 'Client', 'clientName']),
    'Task Description': first(row, ['Task Description', 'Description', 'task']),
    Description: first(row, ['Description', 'Task Description', 'task']),
    Status: first(row, ['Status', 'status'], doneDate ? 'Completed' : 'Pending'),
    'Plan Date': planDate,
    Date: planDate,
    planDate,
    'Done Date': doneDate,
    actualDate: doneDate,
    TAT: first(row, ['TAT', 'When', 'tatMinutes'], ''),
    formLink: first(row, ['formLink', 'Form Link', 'Form link'], ''),
    delayDays: first(row, ['delayDays', 'Delay Days'], ''),
    onTimeStatus: first(row, ['onTimeStatus', 'On Time Status'], '')
  };
}

function asInvoiceRow(row = {}) {
  const id = first(row, ['InvoiceID', 'Invoice ID', 'ID', 'invoiceId']);
  const clientId = first(row, ['CustomerID', 'Client_Id', 'Client ID', 'clientId']);
  const clientName = first(row, ['CustomerName', 'Client Name', 'clientName']);
  const amount = first(row, ['Amount', 'InvoiceAmount', 'amount'], 0);
  const paid = first(row, ['PaidAmount', 'Paid Amount', 'paidAmount'], 0);
  const outstanding = first(row, ['Outstanding', 'outstanding'], amount);
  const dueDate = first(row, ['DueDate', 'Due Date', 'Date', 'dueDate']);
  return {
    ...row,
    InvoiceID: id,
    'Invoice ID': id,
    ID: id,
    CustomerID: clientId,
    Client_Id: clientId,
    CustomerName: clientName,
    'Client Name': clientName,
    Amount: amount,
    InvoiceAmount: amount,
    PaidAmount: paid,
    Outstanding: outstanding,
    Status: first(row, ['Status', 'status'], Number(outstanding) > 0 ? 'Pending' : 'Paid'),
    DueDate: dueDate,
    DueDateFmt: dueDate,
    Date: dueDate,
    'Aging Bucket': first(row, ['Aging Bucket', 'agingBucket'], ''),
    PILink: first(row, ['PILink', 'PI Link', 'piLink'], ''),
    InvoiceLink: first(row, ['InvoiceLink', 'Invoice Link', 'invoiceLink'], '')
  };
}

function asSocialRow(row = {}) {
  const id = first(row, ['Post ID', 'ID', 'postId']);
  return {
    ...row,
    'Post ID': id,
    ID: id,
    Client_Id: first(row, ['Client_Id', 'Client ID', 'clientId']),
    'Client Name': first(row, ['Client Name', 'clientName']),
    Platform: first(row, ['Platform', 'platform']),
    'Content Type': first(row, ['Content Type', 'contentType'], 'Post'),
    Description: first(row, ['Description', 'Caption', 'caption']),
    Caption: first(row, ['Caption', 'Description', 'caption']),
    Status: first(row, ['Status', 'status'], 'Pending Approval'),
    'Planned Post Date': first(row, ['Planned Post Date', 'Date', 'plannedDate']),
    Date: first(row, ['Date', 'Planned Post Date', 'plannedDate']),
    CreativeLink: first(row, ['CreativeLink', 'Creative Link', 'creativeLink'])
  };
}

async function getRows() {
  const [tickets, clients, fms, social, invoices, messages] = await Promise.all([
    listRows('Ticket'),
    listRows('Client'),
    listRows('FmsTask'),
    listRows('SocialMedia'),
    listRows('Invoice'),
    listRows('Message')
  ]);
  return { tickets, clients, fms, social, invoices, messages };
}

async function findClientTicketRows(clientId, { startDate = '', endDate = '' } = {}) {
  const and = clientTicketBaseAnd(clientId, { startDate, endDate });
  const docs = await LegacyModels.Ticket.collection
    .find({ $and: and }, { projection: ticketProjection() })
    .sort({ 'data.Last Update Date': -1, 'data.Timestamp': -1, 'data.Plan Date': -1, updatedAt: -1 })
    .toArray();
  return fromLegacyDocs(docs).filter(isClientOriginTicket);
}

async function findClientTicketPage(clientId, {
  startDate = '',
  endDate = '',
  statusGroup = 'all',
  search = '',
  page = 1,
  pageSize = 10,
  sortKey = 'createdDate',
  sortDirection = 'desc'
} = {}) {
  const baseAnd = clientTicketBaseAnd(clientId, { startDate, endDate });
  const searchQuery = clientTicketSearchQuery(search);
  const statusQuery = clientTicketStatusQuery(statusGroup);
  const filteredAnd = [...baseAnd];
  if (searchQuery) filteredAnd.push(searchQuery);
  if (statusQuery) filteredAnd.push(statusQuery);

  const baseMatch = { $and: baseAnd };
  const filteredMatch = { $and: filteredAnd };
  const limit = Math.max(1, Math.min(100, Number(pageSize) || 10));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * limit;

  const [docs, total, allCount, openCount, responseCount, closedCount] = await Promise.all([
    LegacyModels.Ticket.collection
      .find(filteredMatch, { projection: ticketProjection() })
      .sort(clientTicketSort(sortKey, sortDirection))
      .skip(skip)
      .limit(limit)
      .toArray(),
    LegacyModels.Ticket.collection.countDocuments(filteredMatch),
    LegacyModels.Ticket.collection.countDocuments(baseMatch),
    LegacyModels.Ticket.collection.countDocuments({ $and: [...baseAnd, clientTicketStatusQuery('open')] }),
    LegacyModels.Ticket.collection.countDocuments({ $and: [...baseAnd, clientTicketStatusQuery('response')] }),
    LegacyModels.Ticket.collection.countDocuments({ $and: [...baseAnd, clientTicketStatusQuery('closed')] })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const normalizedPage = Math.min(safePage, totalPages);
  return {
    rows: fromLegacyDocs(docs).filter(isClientOriginTicket),
    pagination: {
      page: normalizedPage,
      pageSize: limit,
      total,
      totalPages,
      start: total ? skip + 1 : 0,
      end: Math.min(skip + docs.length, total)
    },
    counts: {
      all: allCount,
      open: openCount,
      response: responseCount,
      closed: closedCount
    }
  };
}

async function findClientTicket(ticketId, clientId) {
  const docs = await LegacyModels.Ticket.collection
    .find({ $and: [ticketIdQuery(ticketId), clientTicketClientQuery(clientId), clientOriginTicketQuery()] }, { projection: ticketProjection() })
    .limit(5)
    .toArray();
  return fromLegacyDocs(docs).find((item) =>
    eq(first(item, ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId']), ticketId)
    && (!clientId || eq(first(item, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']), clientId))
    && isClientOriginTicket(item)
  ) || null;
}

async function findTaskMessages(taskId) {
  const values = idVariants(taskId);
  const docs = await LegacyModels.Message.collection
    .find({
      $or: [
        { 'data.TaskID': { $in: values } },
        { 'data.Task ID': { $in: values } },
        { 'data.ticketId': { $in: values } }
      ]
    }, { projection: { legacyId: 1, data: 1 } })
    .sort({ 'data.Timestamp': 1, createdAt: 1 })
    .toArray();
  return fromLegacyDocs(docs);
}

async function checkPaymentRestriction(_clientId) {
  return { restricted: false, message: '' };
}

export async function createBulkTicketsWithDetails(ticketList = [], clientInfo = {}) {
  const restriction = await checkPaymentRestriction(clientInfo.Client_Id || clientInfo['Client ID']);
  if (restriction.restricted) return fail(restriction.message);

  const created = [];
  for (const [index, item] of ticketList.entries()) {
    const attachmentUrls = [];
    for (const attachment of item.attachments || []) {
      if (attachment?.base64) {
        attachmentUrls.push(await saveBase64File(attachment, 'client_ticket_attachments'));
      }
    }
    const id = `TICKET_${Date.now()}_${index + 1}`;
    const row = {
      'Ticket ID': id,
      ID: id,
      Client_Id: clientInfo.Client_Id || clientInfo['Client ID'],
      'Client Name': clientInfo['Client Name'] || clientInfo.ClientName || '',
      Name: clientInfo['Client Name'] || clientInfo.ClientName || '',
      'Task Category': item.category,
      Priority: item.priority || 'Medium',
      'Task Description': item.description,
      Description: item.description,
      Status: 'Open',
      Timestamp: nowIso(),
      'Plan Date': item.completionDate || '',
      Attachments: attachmentUrls.join(',\n'),
      Source: 'Client Portal',
      'Ticket Source': 'Client Portal',
      Origin: 'Client',
      'Client Ticket': 'Yes',
      HasUnreadAdminMessages: true,
      'Last Action By': clientInfo['Client Name'] || clientInfo.ClientName || 'Client',
      Remarks: 'Created from client portal.'
    };
    await upsertRow('Ticket', 'Ticket ID', id, row);
    created.push(row);
  }

  return ok({ message: `${created.length} ticket(s) created successfully.`, data: created });
}

export async function getClientTickets(clientId, startDate, endDate, statusFilter = null, options = {}) {
  if (options?.paginated) {
    const result = await findClientTicketPage(clientId, {
      startDate,
      endDate,
      statusGroup: options.statusGroup || statusFilter || 'all',
      search: options.search || '',
      page: options.page || 1,
      pageSize: options.pageSize || 10,
      sortKey: options.sortKey || 'createdDate',
      sortDirection: options.sortDirection || 'desc'
    });
    return ok({
      data: result.rows.map((ticket) => asTicketRow(ticket)),
      pagination: result.pagination,
      counts: result.counts
    });
  }

  let items = (await findClientTicketRows(clientId, { startDate, endDate }))
    .map((ticket) => asTicketRow(ticket));
  if (statusFilter === 'open') items = items.filter((ticket) => !isClosedStatus(ticket.Status));
  if (statusFilter === 'closed') items = items.filter((ticket) => isClosedStatus(ticket.Status));
  return ok({ data: items });
}

export async function getClientInvoices(clientId) {
  const data = await getRows();
  return ok({
    data: data.invoices
      .filter((invoice) => eq(invoice.CustomerID || invoice.Client_Id, clientId))
      .map(asInvoiceRow)
  });
}

export async function getClientDashboardData(clientId) {
  const [ticketsRes, fmsRes, socialRes, invoiceRes] = await Promise.all([
    getClientTickets(clientId),
    getClientChecklists(clientId),
    getClientSocialTasks(clientId),
    getClientInvoices(clientId)
  ]);

  const allTasks = [...ticketsRes.data, ...fmsRes.data, ...socialRes.data];
  const openTickets = ticketsRes.data.filter((ticket) => !isClosedStatus(ticket.Status)).length;
  const pendingChecklists = fmsRes.data.filter((task) => !isClosedStatus(task.Status)).length;
  const pendingSocial = socialRes.data.filter((task) => !isClosedStatus(task.Status)).length;
  const completedTasks = allTasks.filter((task) => isClosedStatus(task.Status)).length;
  const outstandingAmount = invoiceRes.data.reduce((sum, invoice) => sum + num(invoice.Outstanding), 0);
  const statusCounts = allTasks.reduce((acc, task) => {
    const status = first(task, ['Status'], 'Unknown');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const toClientTaskType = (task) =>
    first(task, ['TaskType', 'taskType'], task['Ticket ID'] ? 'Ticket' : task['Post ID'] ? 'Social Media' : 'Checklist');
  const toClientTaskId = (task) => first(task, ['Ticket ID', 'Task ID', 'Post ID', 'ID']);
  const toClientTaskDescription = (task) => first(task, ['Description', 'Task Description', 'Task', 'Caption', 'Post Title'], 'Task');
  const pendingActions = allTasks
    .filter((task) => !isClosedStatus(task.Status))
    .slice(0, 8)
    .map((task) => {
      const taskType = toClientTaskType(task);
      return {
        ...task,
        id: toClientTaskId(task),
        taskType,
        type: `${taskType} ${first(task, ['Status'], 'Open')}`,
        description: toClientTaskDescription(task)
      };
    });
  const recentActivity = allTasks.slice(0, 8).map((task) => ({
    ...task,
    id: toClientTaskId(task),
    type: toClientTaskType(task),
    status: first(task, ['Status'], 'Open'),
    message: `${toClientTaskDescription(task)} updated to ${first(task, ['Status'], 'Open')}`,
    timestamp: first(task, ['Date', 'Plan Date', 'Timestamp'])
  }));
  const dashboardData = {
    kpis: {
      openTickets,
      pendingChecklists,
      pendingSocial,
      completedTasks,
      totalTasks: allTasks.length,
      outstandingAmount
    },
    summary: {
      openTickets,
      pendingChecklists,
      pendingSocial,
      completedTasks,
      totalTasks: allTasks.length,
      outstandingAmount
    },
    statusChartData: { labels: Object.keys(statusCounts), data: Object.values(statusCounts) },
    activityChartData: { labels: [today()], data: [allTasks.length] },
    pendingActions,
    recentActivity
  };

  return ok({ ...dashboardData, data: dashboardData });
}

export async function getClientReportData(clientId, startDate, endDate) {
  const ticketsRes = await getClientTickets(clientId, startDate, endDate);
  const fmsRes = await getClientChecklists(clientId, startDate, endDate);
  const socialRes = await getClientSocialTasks(clientId, startDate, endDate);
  const invoiceRes = await getClientInvoices(clientId);

  const ticketDetails = ticketsRes.data.map((item) => ({
    ...item,
    ID: first(item, ['Ticket ID', 'ID']),
    TaskType: 'Ticket',
    Description: first(item, ['Task Description', 'Description']),
    Date: first(item, ['Plan Date', 'Date', 'Timestamp'])
  }));
  const checklistDetails = fmsRes.data.map((item) => ({
    ...item,
    ID: first(item, ['Task ID', 'ID']),
    TaskType: 'Checklist',
    Description: first(item, ['Task Name', 'Description', 'Task']),
    Date: first(item, ['Plan Date', 'Date'])
  }));
  const socialDetails = socialRes.data.map((item) => ({
    ...item,
    ID: first(item, ['Post ID', 'ID']),
    TaskType: 'Social Media',
    Description: first(item, ['Caption', 'Description', 'Post Title']),
    Date: first(item, ['Planned Post Date', 'Date'])
  }));
  const invoiceDetails = invoiceRes.data.map((item) => ({
    ...item,
    ID: first(item, ['InvoiceID', 'Invoice ID', 'ID']),
    TaskType: 'Invoice',
    Description: first(item, ['Description'], `Invoice ${first(item, ['InvoiceID', 'Invoice ID'])}`),
    Date: first(item, ['Date', 'Invoice Date'])
  }));

  const details = [...ticketDetails, ...checklistDetails, ...socialDetails, ...invoiceDetails];
  const summary = {
    totalTasks: details.length,
    tickets: ticketDetails.length,
    checklists: checklistDetails.length,
    social: socialDetails.length,
    invoices: invoiceDetails.length,
    openTicketCount: ticketsRes.data.filter((ticket) => !isClosedStatus(ticket.Status)).length,
    closedTicketCount: ticketsRes.data.filter((ticket) => isClosedStatus(ticket.Status)).length,
    outstandingAmount: invoiceRes.data.reduce((sum, invoice) => sum + num(invoice.Outstanding), 0)
  };
  return ok({ summary, details, data: { summary, details } });
}

export async function updateTicketStatusByClient(ticketId, newStatus, remarks, clientId) {
  const ticket = await findClientTicket(ticketId, clientId);
  if (!ticket) return fail('Permission denied or Ticket not found.');
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Client_Id: clientId,
    Status: newStatus,
    Remarks: `[[${newStatus} by Client on ${referenceNow().toLocaleDateString('en-IN')}]]${remarks ? `: ${remarks}` : ''}`,
    'Last Update Date': nowIso()
  });
  return ok({ message: 'Ticket updated.', item: row });
}

export async function submitClientResponse(ticketId, remarks, attachment, clientInfo) {
  const clientId = clientInfo?.Client_Id || clientInfo?.['Client ID'] || '';
  const existingTicket = await findClientTicket(ticketId, clientId);
  if (!existingTicket) return fail('Permission denied or Ticket not found.');
  const savedAttachment =
    attachment?.base64 ? await saveBase64File(attachment, 'client_ticket_responses') : safe(attachment);
  const sender = clientInfo?.['Client Name'] || clientInfo?.ClientName || 'Client';
  const timestamp = nowIso();

  const messageRow = {
    MessageID: `MSG_${Date.now()}`,
    TaskID: ticketId,
    Timestamp: timestamp,
    Sender: sender,
    'Sender Type': 'client',
    'Sender ID': clientId,
    Message: remarks || 'Client response submitted.',
    Attachment: savedAttachment
  };
  await insertRow('Message', messageRow);

  const ticket = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Client_Id: clientInfo?.Client_Id || clientInfo?.['Client ID'] || '',
    Status: 'Client Responded',
    'Employee ID': first(existingTicket, ['Reassigned By', 'Employee ID', 'employeeId']),
    Remarks: `${existingTicket.Remarks || ''}\n\n[[Client Response on ${referenceNow().toLocaleDateString('en-IN')}]]${remarks ? `: ${remarks}` : ''}${savedAttachment ? `\nAttachment: ${savedAttachment}` : ''}`,
    'Closing Attachment': savedAttachment || undefined,
    HasUnreadAdminMessages: true,
    'Last Update Date': timestamp,
    'Last Action By': sender
  });

  return ok({ message: 'Client response submitted.', item: ticket, messageItem: messageRow });
}

export async function getTicketDetails(ticketId, clientId) {
  const ticket = await findClientTicket(ticketId, clientId);
  return ticket ? ok({ data: asTicketRow(ticket) }) : fail('Permission denied or Ticket not found.');
}

export async function getMessagesForTask(taskId, clientId) {
  const ticket = await findClientTicket(taskId, clientId);
  if (!ticket) return fail('Permission denied or Ticket not found.');
  const messages = await findTaskMessages(taskId);
  return ok({ data: messages, messages });
}

export async function postMessage(taskId, messageText, client) {
  const clientId = client?.Client_Id || client?.['Client ID'] || '';
  const ticket = await findClientTicket(taskId, clientId);
  if (!ticket) return fail('Permission denied or Ticket not found.');
  const row = {
    MessageID: `MSG_${Date.now()}`,
    TaskID: taskId,
    Timestamp: nowIso(),
    Sender: client?.['Client Name'] || 'Client',
    'Sender Type': 'client',
    'Sender ID': clientId,
    Message: messageText
  };
  await insertRow('Message', row);
  await upsertRow('Ticket', 'Ticket ID', taskId, {
    'Ticket ID': taskId,
    HasUnreadAdminMessages: true,
    'Last Update Date': row.Timestamp,
    'Last Action By': row.Sender
  });
  return ok({ item: row });
}

export async function markTicketMessagesAsRead(taskId, clientId) {
  const ticket = await findClientTicket(taskId, clientId);
  if (!ticket) return fail('Permission denied or Ticket not found.');
  const update = clientId
    ? { 'Ticket ID': taskId, HasUnreadMessages: false }
    : { 'Ticket ID': taskId, HasUnreadAdminMessages: false };
  const row = await upsertRow('Ticket', 'Ticket ID', taskId, update);
  return ok({ item: row });
}

export async function getClientChecklists(clientId, startDate, endDate) {
  const data = await getRows();
  const items = data.fms
    .filter((task) => eq(task.Client_Id, clientId) && dateInRange(first(task, ['Plan Date', 'Date']), startDate, endDate))
    .map(asFmsRow);
  return ok({ data: items });
}

export async function getClientSocialTasks(clientId, startDate, endDate) {
  const data = await getRows();
  return ok({
    data: data.social
      .filter((post) => eq(post.Client_Id, clientId) && dateInRange(first(post, ['Planned Post Date', 'Date']), startDate, endDate))
      .map(asSocialRow)
  });
}

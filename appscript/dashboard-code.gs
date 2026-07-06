// --- CONFIGURATION ---
const SPREADSHEET_ID = '1uiJ9hA7NaxkdbjUwXUxzHt4WgLU6stqFfJhwf0raH9E';

const SHEET_NAMES = {
  USERS: 'Users',
  CLIENTS: 'Clients',
  TICKETS: 'Tickets',
  FMS: 'FMS',
  TODO: 'To-Do',
  ATTENDANCE: 'Attendance',
  LEAVES: 'Leave Requests',
  INTIMATIONS: 'Intimations',
  INVOICES: 'Invoices',
  FOLLOWUPS: 'Followups'
};

// Global Cache to Speed Up Read Execution
let memoSpreadsheet = null;
function getSpreadsheet() {
  if (!memoSpreadsheet) {
    memoSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return memoSpreadsheet;
}

function doGet(e) {
  const htmlOutput = HtmlService.createTemplateFromFile('Index').evaluate().setTitle('Master Analytics Dashboard');
  return htmlOutput
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- ROBUST DATE PARSING ---
function parseDateSafe(val) {
  if (!val) return null;
  if (val instanceof Date) return val;

  let str = String(val).trim();
  if (!str) return null;

  const monthsMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };

  let noYearMatch = str.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,10})(?![-\/ ]\d{4})/i);
  if (noYearMatch) {
    const day = parseInt(noYearMatch[1], 10);
    const monthStr = noYearMatch[2].toLowerCase();
    const year = new Date().getFullYear();
    if (monthsMap[monthStr] !== undefined) {
      return new Date(year, monthsMap[monthStr], day);
    }
  }

  let alphaMatch = str.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,10})[-/ ](\d{4})/i);
  if (alphaMatch) {
    const day = parseInt(alphaMatch[1], 10);
    const monthStr = alphaMatch[2].toLowerCase();
    const year = parseInt(alphaMatch[3], 10);
    if (monthsMap[monthStr] !== undefined) {
      return new Date(year, monthsMap[monthStr], day);
    }
  }

  let alphaMatchSwap = str.match(/^(\d{4})[-/ ]([a-zA-Z]{3,10})[-/ ](\d{1,2})/i);
  if (alphaMatchSwap) {
    const year = parseInt(alphaMatchSwap[1], 10);
    const monthStr = alphaMatchSwap[2].toLowerCase();
    const day = parseInt(alphaMatchSwap[3], 10);
    if (monthsMap[monthStr] !== undefined) {
      return new Date(year, monthsMap[monthStr], day);
    }
  }

  let mmddyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mmddyyyyMatch) {
    const month = parseInt(mmddyyyyMatch[1], 10);
    const day = parseInt(mmddyyyyMatch[2], 10);
    const year = parseInt(mmddyyyyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  let mmddNoYearMatch = str.match(/^(\d{1,2})[-/](\d{1,2})(?![-\/ ]\d{4})/);
  if (mmddNoYearMatch) {
    const month = parseInt(mmddNoYearMatch[1], 10);
    const day = parseInt(mmddNoYearMatch[2], 10);
    const year = new Date().getFullYear();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  const nativeDate = new Date(str);
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate;
  }

  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    const d = new Date((serial - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }

  return null;
}

function getFlexibleValue(row, possibleKeys) {
  const keys = Object.keys(row);
  for (let pk of possibleKeys) {
    const cleanPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let k of keys) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK === cleanPk) {
        return row[k];
      }
    }
  }
  return '';
}

// --- MAIN REPORTING FUNCTION ---
function getAdminReports(startDate, endDate) {
  try {
    const toYMD = (d) => {
      if (!d) return '';
      const dateObj = parseDateSafe(d);
      if (!dateObj || isNaN(dateObj.getTime())) return '';

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const isDateInScope = (dateStr) => dateStr >= startDate && dateStr <= endDate;
    const isDateInLeaveRange = (sDate, eDate, targetStart, targetEnd) => (sDate <= targetEnd && eDate >= targetStart);

    const rawUsers = getSheetData(SHEET_NAMES.USERS);

    // CASE-INSENSITIVE STATUS FILTER FOR ACTIVE USERS [1]
    const activeUsers = rawUsers.filter(u => {
      const status = getFlexibleValue(u, ['Status']);
      return status && String(status).trim().toLowerCase() === 'active';
    }).map(u => ({ id: String(u['Employee ID']).trim(), name: String(u['Employee Name']).trim() }));

    const idToName = {};
    activeUsers.forEach(u => {
      idToName[u.id] = u.name;
    });

    const activeUserNamesSet = new Set(activeUsers.map(u => u.name.toLowerCase()));

    // INACTIVE USER PROTECTION: पेंडिंग काम न खोए, इसलिए सभी टास्कों को सुरक्षित रखें [1]
    const isValidTask = (t) => {
      if (!t.Desc || String(t.Desc).trim() === '') return false;
      return true; // खाली डिस्क्रिप्शन के अलावा सभी टास्कों को डैशबोर्ड पर लाएं
    };

    const clientSheet = getSheetData(SHEET_NAMES.CLIENTS);
    const clientMap = {};
    const activeClientsList = [];
    clientSheet.forEach(c => {
      clientMap[c['Client_Id']] = c['Client Name'];
      if (c['Status'] && String(c['Status']).trim().toLowerCase() === 'active') {
        activeClientsList.push({ id: c['Client_Id'], name: c['Client Name'] });
      }
    });

    const fmtDuration = (val) => {
      if (!val) return "0h 0m";
      const strVal = String(val).trim();
      if (strVal.includes('h') || strVal.includes('m')) return strVal;

      const num = parseInt(strVal, 10);
      if (isNaN(num)) return "0h 0m";

      const h = Math.floor(num / 60);
      const m = num % 60;
      return `${h}h ${m}m`;
    };

    const mapTaskFlexible = (t, type, defaultTAT = 0) => {
      const id = getFlexibleValue(t, ['Task ID', 'Ticket ID', 'FMS ID', 'ID', 'TaskId', 'TicketID']);
      const desc = getFlexibleValue(t, ['Task', 'Task Description', 'Task_Description', 'Description', 'Desc', 'Task Name', 'Task_Name']);

      const tat = getFlexibleValue(t, ['When', 'TAT', 'Plan TAT', 'Planned TAT', 'Planned Duration', 'TAT Minutes']);
      const dateVal = getFlexibleValue(t, ['Planned Date', 'Plan Date', 'Due Date', 'DueDate', 'Due_Date', 'Date', 'PlanDate', 'Timestamp', 'Created Date', 'Target Date']);

      // Status mapping
      let status = getFlexibleValue(t, ['Status', 'State', 'Task Status', 'FMS Status', 'On Time Status']);
      if (type === 'FMS') {
        const actualDate = getFlexibleValue(t, ['Actual Date', 'Actual_Date', 'ActualDate']);
        status = (actualDate && String(actualDate).trim() !== '') ? 'Completed' : 'Pending';
      } else {
        status = status || 'Pending';
      }

      // Employee mapping
      let empVal = '';
      if (type === 'Ticket') {
        empVal = getFlexibleValue(t, ['Help Person Name', 'Employee ID', 'Employee_ID', 'EmployeeID', 'Emp ID']);
      } else {
        empVal = getFlexibleValue(t, ['Employee ID', 'Employee_ID', 'EmployeeID', 'Who', 'Emp ID', 'Emp_ID']);
      }

      let empName = 'Unassigned';
      if (empVal) {
        if (idToName[empVal]) {
          empName = idToName[empVal];
        } else {
          const matchedUser = activeUsers.find(u => u.name.toLowerCase() === empVal.toLowerCase() || u.id.toLowerCase() === empVal.toLowerCase());
          if (matchedUser) {
            empName = matchedUser.name;
          } else {
            // यदि यूजर 'Users' टैब में एक्टिव नहीं है या नाम गलत है, तो भी उसे डैशबोर्ड पर दिखाएं [1]
            empName = `[Unassigned/Inactive] ${empVal}`;
          }
        }
      }

      // Client mapping
      let clientName = 'Internal / General';
      let clientId = '';
      if (type === 'Ticket') {
        clientId = getFlexibleValue(t, ['Client_Id', 'Client ID', 'ClientId']);
        clientName = clientMap[clientId] || clientId || 'Internal';
      } else if (type === 'FMS') {
        clientName = getFlexibleValue(t, ['FMS Name', 'Project', 'FMS Project']) || 'FMS Project';
      } else if (type === 'Todo') {
        clientName = 'General To Do';
      }

      let cleanTAT = defaultTAT;
      if (tat !== null && tat !== undefined && tat !== '') {
        const parsed = parseInt(String(tat).replace(/\D/g, ''), 10);
        if (!isNaN(parsed)) {
          cleanTAT = (type === 'FMS') ? parsed * 60 : parsed;
        }
      }

      // CRM FMS CALLS & FOLLOW UP TASK 5M OVERRIDE AT DATA LAYER [1]
      const isCrmFms = clientName.toLowerCase().includes('crm fms') || clientName.toLowerCase().includes('crm-fms') || clientName.toLowerCase() === 'crm';
      const taskDesc = (desc || '').toLowerCase();
      const isCallOrFollowUp = taskDesc.includes('call') || taskDesc.includes('follow up') || taskDesc.includes('followup') || taskDesc.includes('follow-up');

      if (isCrmFms && isCallOrFollowUp) {
        cleanTAT = 5; // Global Override [1]
      }

      let durationDisplay = "0h 0m";
      if (type === 'FMS') {
        const delayVal = getFlexibleValue(t, ['Delay Days', 'DelayDays', 'Delay']);
        const delayDaysNum = parseFloat(String(delayVal).replace(/[^0-9.-]/g, '')) || 0;
        const actualMinutes = cleanTAT + (delayDaysNum * 24 * 60);

        const h = Math.floor(actualMinutes / 60);
        const m = Math.round(actualMinutes % 60);
        durationDisplay = `${h}h ${m}m`;
      } else {
        const rawDur = getFlexibleValue(t, ['Duration', 'Actual Duration', 'Total Duration', 'Actual Logged']);
        durationDisplay = fmtDuration(rawDur);
      }

      const stepVal = getFlexibleValue(t, ['Step no', 'Step No', 'Step_No', 'StepNo', 'Step']);

      return {
        Type: type,
        User: empName,
        Desc: desc,
        Client: clientName,
        ClientId: clientId,
        Status: status.trim(),
        TAT: cleanTAT,
        Duration: durationDisplay,
        Date: toYMD(dateVal),
        ID: id,
        Step: stepVal
      };
    };

    const tickets = getSheetData(SHEET_NAMES.TICKETS)
      .map(t => mapTaskFlexible(t, 'Ticket', 0))
      .filter(t => {
        const isPastOrUndatedPending = (!t.Date || t.Date < startDate) && isTaskTrulyPending(t.Status);
        return isValidTask(t) && (isDateInScope(t.Date) || isPastOrUndatedPending);
      });

    const fms = getSheetData(SHEET_NAMES.FMS)
      .map(t => mapTaskFlexible(t, 'FMS', 0))
      .filter(t => {
        const isCompleted = t.Status === 'Completed';
        const isPastOrUndatedPending = (!t.Date || t.Date < startDate) && !isCompleted;
        return isValidTask(t) && (isDateInScope(t.Date) || isPastOrUndatedPending);
      });

    const todo = getSheetData(SHEET_NAMES.TODO)
      .map(t => mapTaskFlexible(t, 'Todo', 0))
      .filter(t => {
        const isPastOrUndatedPending = (!t.Date || t.Date < startDate) && isTaskTrulyPending(t.Status);
        return isValidTask(t) && (isDateInScope(t.Date) || isPastOrUndatedPending);
      });

    const attendance = getSheetData(SHEET_NAMES.ATTENDANCE)
      .filter(row => isDateInScope(toYMD(row['Date'])))
      .map(row => ({
        Date: toYMD(row['Date']),
        Time: row['Time'],
        EmpID: String(row['Employee ID']).trim(),
        Name: row['Employee Name'],
        Action: row['Action'],
        Photo: row['Photo Url'] || row['Photo'],
        Status: row['Status'],
        Lat: row['Lat'] || row['Latitude'] || '',
        Long: row['Long'] || row['Longitude'] || ''
      }));

    // Leaves के लिए लचीला फ़िल्टर
    const leaves = getSheetData(SHEET_NAMES.LEAVES).filter(row => {
      const sDate = getFlexibleValue(row, ['Start Date', 'StartDate', 'Start_Date']);
      const eDate = getFlexibleValue(row, ['End Date', 'EndDate', 'End_Date']);
      return isDateInLeaveRange(toYMD(sDate), toYMD(eDate), startDate, endDate);
    });

    // Intimations के लिए लचीला फ़िल्टर
    const intimations = getSheetData(SHEET_NAMES.INTIMATIONS).filter(row => {
      const dateVal = getFlexibleValue(row, ['Intimation Date', 'IntimationDate', 'Date', 'Intimation_Date', 'Timestamp']);
      return isDateInScope(toYMD(dateVal));
    });

    const invoices = [];
    try {
      const invSheet = getSheetData(SHEET_NAMES.INVOICES);
      invSheet.forEach(inv => {
        const custName = getFlexibleValue(inv, ['CustomerName', 'Customer Name', 'Client Name', 'Customer']);
        const outstandingStr = getFlexibleValue(inv, ['Outstanding', 'Outstanding Amount', 'Balance', 'Due Amount']);
        const invoiceAmtStr = getFlexibleValue(inv, ['InvoiceAmount', 'Invoice Amount', 'Amount']);
        const paidAmtStr = getFlexibleValue(inv, ['PaidAmount', 'Paid Amount', 'Paid']);
        const id = getFlexibleValue(inv, ['InvoiceID', 'Invoice ID', 'ID', 'Invoice_ID']);
        const bucket = getFlexibleValue(inv, ['Aging Bucket', 'Bucket', 'Aging']);
        const dueDate = getFlexibleValue(inv, ['DueDate', 'Due Date', 'DueDateFmt']);
        const nextFollowUp = getFlexibleValue(inv, ['Next Follow-up', 'Next Followup', 'NextFollowUp']);
        const notes = getFlexibleValue(inv, ['Notes', 'Remarks', 'NotesFmt']);
        const collector = getFlexibleValue(inv, ['AssignedCollector', 'Assigned Collector', 'Collector']);

        const invoiceAmt = parseFloat(String(invoiceAmtStr).replace(/[^0-9.-]/g, '')) || 0;
        const paidAmt = parseFloat(String(paidAmtStr).replace(/[^0-9.-]/g, '')) || 0;

        let outstanding = parseFloat(String(outstandingStr).replace(/[^0-9.-]/g, ''));
        if (isNaN(outstanding) || String(outstandingStr).trim() === '') {
          outstanding = invoiceAmt - paidAmt;
        }

        invoices.push({
          InvoiceID: id,
          CustomerName: custName,
          Outstanding: outstanding,
          Bucket: bucket || '0-30 Days',
          DueDateFmt: toYMD(dueDate),
          NextFollowUpFmt: toYMD(nextFollowUp),
          Notes: notes,
          AssignedCollector: collector
        });
      });
    } catch (e) { }

    return {
      success: true,
      data: {
        tickets,
        fms,
        todo,
        attendance,
        leaves,
        intimations,
        activeUsers,
        activeClients: activeClientsList,
        invoices
      }
    };

  } catch (e) {
    return { success: false, message: "Error in getAdminReports: " + e.toString() };
  }
}

function isTaskTrulyPending(status) {
  const s = status ? String(status).trim() : 'Open';
  // Closed और Pending Approval को छोड़कर सभी एक्टिव पेंडिंग स्टेटस
  const pendingAndProgress = ['Open', 'Rework', 'Reassigned', 'Paused', 'In Progress', 'Pending', 'Urgent', 'Re-work', 'Allocated', 'Planned', 'Assigned'];
  return pendingAndProgress.includes(s);
}

function createTicketInSheet(d) {
  const id = `TKT_${Date.now()}`;
  appendRowToSheet(SHEET_NAMES.TICKETS, {
    'Ticket ID': id,
    'Timestamp': new Date(),
    'Client_Id': d.Client_Id,
    'Task Description': d.Description,
    'Priority': d.Priority,
    'Status': 'Pending',
    'TAT': d.TAT,
    'Employee ID': d['Employee ID']
  });
  return { success: true };
}

function createTodoInSheet(d) {
  const id = `TODO_${Date.now()}`;
  appendRowToSheet(SHEET_NAMES.TODO, {
    'Task ID': id,
    'Timestamp': new Date(),
    'Employee ID': d['Employee ID'],
    'Task': d.Description,
    'Due Date': d['Plan Date'] || new Date(),
    'Status': 'Pending',
    'TAT': d.TAT
  });
  return { success: true };
}

function getTicketSystemData() {
  try {
    const clients = getSheetData(SHEET_NAMES.CLIENTS)
      .filter(c => c['Status'] && String(c['Status']).trim().toLowerCase() === 'active')
      .map(c => ({ 'Client_Id': c['Client_Id'], 'Client Name': c['Client Name'] }));

    const users = getSheetData(SHEET_NAMES.USERS)
      .filter(u => u['Status'] && String(u['Status']).trim().toLowerCase() === 'active')
      .map(u => ({ 'Employee ID': u['Employee ID'], 'Employee Name': u['Employee Name'] }));

    return { success: true, dropdowns: { clients, users } };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function getScriptUrl() { return ScriptApp.getService().getUrl(); }

// तेज़ प्रोसेसिंग के लिए बैकएंड डेट कनवर्टर
const toYMD = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const match = d.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
  }
  const dateObj = parseDateSafe(d);
  if (!dateObj || isNaN(dateObj.getTime())) return '';

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// सुपरफास्ट सर्वर-साइड डेटा रेंडरर
function getSheetData(sheetName) {
  try {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return [];

    const allValues = sheet.getDataRange().getValues();
    if (allValues.length <= 1) return [];

    const headers = allValues[0].map(h => String(h).trim());
    const values = allValues.slice(1);

    // पहले ही केवल डेट वाले कॉलम इंडेक्स का पता लगाएं (CPU प्रोसेसिंग बचाने के लिए)
    const dateIndices = [];
    if (values.length > 0) {
      const firstRow = values[0];
      for (let i = 0; i < headers.length; i++) {
        if (firstRow[i] instanceof Date) {
          dateIndices.push(i);
        }
      }
    }

    const tz = Session.getScriptTimeZone();
    return values.map(row => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        let val = row[i];
        if (dateIndices.indexOf(i) !== -1 && val instanceof Date) {
          val = Utilities.formatDate(val, tz, "yyyy-MM-dd HH:mm:ss");
        }
        obj[headers[i]] = val;
      }
      return obj;
    });
  } catch (e) {
    console.error("Error reading sheet " + sheetName + ": " + e.toString());
    return [];
  }
}
function appendRowToSheet(sheetName, rowData) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const newRow = headers.map(header => rowData[header] === undefined ? '' : rowData[header]);
  sheet.appendRow(newRow);
}
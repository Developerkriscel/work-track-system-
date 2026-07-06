// --- CONFIGURATION ---
const SPREADSHEET_ID = '1uiJ9hA7NaxkdbjUwXUxzHt4WgLU6stqFfJhwf0raH9E'; // Main App Spreadsheet
const INVOICE_SPREADSHEET_ID = '1oU-hk58HMa9fR7MBi5ShTwBS1c4Og3XdYm4Z_KTCcIs'; // ❗ Invoices Spreadsheet ID
const NOTIFICATION_EMAIL = 'info@kriscel.com'; 

const SHEET_NAMES = {
  CLIENTS: 'Clients',
  TICKETS: 'Tickets',
  CHECKLIST: 'CHECKLIST TASK',
  SOCIAL: 'Social Media',
  SOCIAL_HISTORY: 'Social_History',
  MESSAGES: 'Messages',
  USERS: 'Users' 
};

// --- UTILITY FUNCTIONS ---
function getSheetData(sheetName, spreadsheetId = SPREADSHEET_ID) {
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet) {
        Logger.log(`Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId}.`);
        return [];
    }
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) return [];
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().trim());
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return values.filter(row => row.some(cell => cell !== null && cell !== '')).map(row => {
      return headers.reduce((obj, header, index) => {
        const cellValue = row && row.length > index ? row[index] : null;
        obj[header] = (cellValue instanceof Date) ? cellValue.toISOString() : cellValue;
        return obj;
      }, {});
    });
  } catch (e) {
    Logger.log(`Error in getSheetData for sheet "${sheetName}": ${e.message}`);
    return [];
  }
}

function appendRowsToSheet(sheetName, rowsData) {
  if (rowsData.length === 0) return;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRows = rowsData.map(rowData => headers.map(header => rowData[header] === undefined ? '' : rowData[header]));
  sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
}

function updateRowInSheet(sheetName, key, value, updateData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i][keyIndex] == value) {
      const updatedRow = headers.map((header, index) => updateData.hasOwnProperty(header) ? updateData[header] : values[i][index]);
      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      return true;
    }
  }
  return false;
}

function saveBase64ImageToDrive(base64Data, filename, folderName) {
  if (!base64Data) return '';
  try {
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, 'application/octet-stream', filename);
    let folders = DriveApp.getFoldersByName(folderName);
    let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("File Save Error: " + e.toString());
    return '';
  }
}

// --- CORE APP SCRIPT ---
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Client_Index')
    .setTitle("Client Portal")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// --- CLIENT AUTHENTICATION ---
function clientAuthenticate(clientId, password) {
  try {
    const clients = getSheetData(SHEET_NAMES.CLIENTS);
    const client = clients.find(c => c['Client_Id'] == clientId && c['Password'] == password && c['Status'] === 'Active');
    if (client) {
      const clientInfo = { ...client };
      delete clientInfo.Password;
      return { success: true, client: clientInfo };
    } else {
      return { success: false, message: 'Invalid Client ID or Password, or account is inactive.' };
    }
  } catch (e) {
    return { success: false, message: 'Authentication error: ' + e.message };
  }
}

// ==========================================
// ❗ STRICT PAYMENT RESTRICTION CHECKER (>10 Days)
// ==========================================
function checkPaymentRestriction(clientId) {
  try {
    const invoiceResult = getClientInvoices(clientId);
    if (!invoiceResult.success) return { restricted: false };

    const today = new Date();
    const tenDaysInMs = 10 * 24 * 60 * 60 * 1000; // 10 Days in Milliseconds
    
    // Check if any invoice is unpaid AND invoice date is > 10 days old
    const isRestricted = invoiceResult.data.some(inv => {
      const status = (inv.Status || '').toLowerCase();
      // Filter for unpaid statuses
      if (status !== 'paid' && status !== 'full payment received' && status !== 'cancelled') {
         const invoiceDate = new Date(inv.Date);
         if (!isNaN(invoiceDate.getTime())) {
           const diff = today - invoiceDate;
           // If difference is greater than 10 days
           return diff > tenDaysInMs;
         }
      }
      return false;
    });

    if (isRestricted) {
      return { 
        restricted: true, 
        message: '⛔ Access Restricted — Your payment is overdue by more than 10 days. Please clear your dues to continue ticket actions.' 
      };
    }
    return { restricted: false };

  } catch (e) {
    Logger.log("Restriction Check Error: " + e.message);
    return { restricted: false };
  }
}

// --- TICKET CREATION ---
// --- TICKET CREATION ---
function createBulkTicketsWithDetails(ticketsData, clientInfo) {
  try {
    // 1. Apply Strict Payment Restriction
    const restriction = checkPaymentRestriction(clientInfo.Client_Id);
    if (restriction.restricted) {
       return { success: false, message: restriction.message };
    }

    const ticketsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.TICKETS);
    let lastRow = ticketsSheet.getLastRow();
    
    const newTickets = ticketsData.map((ticket) => {
      lastRow++;
      const ticketId = `TICKET_${Utilities.formatDate(new Date(), "IST", "yyMMdd")}_${lastRow}`;
      
      // --- CHANGED LOGIC FOR MULTIPLE ATTACHMENTS ---
      let attachmentUrls = [];
      
      // Check if 'attachments' array exists and has data
      if (ticket.attachments && Array.isArray(ticket.attachments) && ticket.attachments.length > 0) {
        ticket.attachments.forEach((att, index) => {
           if(att.base64) {
             // Append index to filename to prevent overwriting if names are same
             const filename = `ticket_${ticketId}_${index + 1}_${att.name}`;
             const url = saveBase64ImageToDrive(att.base64, filename, 'Client_Ticket_Attachments');
             if (url) attachmentUrls.push(url);
           }
        });
      } 
      // Fallback for single attachment (legacy support)
      else if (ticket.attachment && ticket.attachment.base64) {
        const filename = `ticket_${ticketId}_${ticket.attachment.name}`;
        const url = saveBase64ImageToDrive(ticket.attachment.base64, filename, 'Client_Ticket_Attachments');
        if (url) attachmentUrls.push(url);
      }
      
      // Join multiple URLs with a comma and newline for cleaner sheet view
      const finalAttachmentString = attachmentUrls.join(',\n');
      
      return {
        'Timestamp': new Date(), 
        'Ticket ID': ticketId, 
        'Client_Id': clientInfo.Client_Id, 
        'Name': clientInfo['Client Name'],
        'Task Description': ticket.description, 
        'Task Category': ticket.category, 
        'Priority': ticket.priority, 
        'Plan Date': ticket.completionDate,
        'Attachment': finalAttachmentString, // Stores multiple links
        'Status': 'Open', 
        'IsNotified': false, 
        'Last Update Date': new Date()
      };
    });

    if (newTickets.length > 0) {
      appendRowsToSheet(SHEET_NAMES.TICKETS, newTickets);
    }
    return { success: true, count: newTickets.length };
  } catch (e) {
    return { success: false, message: 'Error creating tickets: ' + e.message };
  }
}

// --- DATA FETCHING (FOR PAGES) ---
function filterByDate(data, dateColumn, startDate, endDate) { 
    if (!startDate || !endDate) return data; 
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return data.filter(item => { 
        if (!item[dateColumn]) return false; 
        const itemDate = new Date(item[dateColumn]); 
        if (isNaN(itemDate.getTime())) return false; 
        return itemDate >= start && itemDate <= end; 
    }); 
}

function getClientTickets(clientId, startDate, endDate, statusFilter = null) { 
    try { 
        let tickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => t['Client_Id'] == clientId); 
        tickets = filterByDate(tickets, 'Timestamp', startDate, endDate); 

        if (statusFilter) {
            if (statusFilter === 'open') {
                tickets = tickets.filter(ticket => {
                    const s = (ticket.Status || '').toLowerCase().trim();
                    return !(s.includes('closed') || s.includes('cancelled') || s.includes('approved by client') || s.includes('completed') || s.includes('done') || s.includes('resolved'));
                });
            } else if (statusFilter === 'completed') {
                tickets = tickets.filter(ticket => {
                    const s = (ticket.Status || '').toLowerCase().trim();
                    return (s.includes('closed') || s.includes('approved by client') || s.includes('completed') || s.includes('done') || s.includes('resolved'));
                });
            }
        }

        // 🟢 UPDATE: Remarks ko explicitly map kiya gaya hai
        const formattedTickets = tickets.map(t => ({ 
            ...t, 
            ID: t['Ticket ID'], 
            Description: t['Task Description'], 
            Date: t.Timestamp,
            Remarks: t['Remarks'] || '', // Remarks zaroori hai update check karne ke liye
            LastUpdate: t['Last Update Date']
        }));
        
        return { success: true, data: formattedTickets.sort((a,b) => new Date(b.Date) - new Date(a.Date)) }; 
    } catch (e) { 
        return { success: false, message: 'Could not fetch tickets: ' + e.message }; 
    } 
}

function getClientChecklists(clientId, startDate, endDate) { 
    try { 
        let checklists = getSheetData(SHEET_NAMES.CHECKLIST).filter(c => c['Client_Id'] == clientId); 
        checklists = filterByDate(checklists, 'Plan Date', startDate, endDate); 
        const formatted = checklists.map(c => ({...c, ID: c['Task ID'], Description: c['Task Description'], Date: c['Plan Date'] }));
        return { success: true, data: formatted.sort((a,b) => new Date(b.Date) - new Date(a.Date)) }; 
    } catch (e) { return { success: false, message: e.message }; } 
}

function getClientSocialTasks(clientId, startDate, endDate) { 
    try { 
        let socialTasks = getSheetData(SHEET_NAMES.SOCIAL).filter(s => s['Client_Id'] == clientId); 
        socialTasks = filterByDate(socialTasks, 'Planned Post Date', startDate, endDate); 
        const formatted = socialTasks.map(s => ({...s, ID: s['Post ID'], Description: s.Content, Date: s['Planned Post Date'] }));
        return { success: true, data: formatted.sort((a,b) => new Date(b.Date) - new Date(a.Date)) }; 
    } catch (e) { return { success: false, message: e.message }; } 
}

// **INVOICE FETCHING LOGIC**
function getClientInvoices(clientId) {
  try {
    // Sheet ka naam aur ID sahi hona chahiye
    const allInvoices = getSheetData('Pmt Follow-up', INVOICE_SPREADSHEET_ID);
    const clientInvoices = allInvoices.filter(inv => String(inv['CustomerID']).trim() == String(clientId).trim());
    
    const formattedInvoices = clientInvoices.map(inv => ({
        'InvoiceID': inv['InvoiceID'] || inv['Invoice Number'], 
        'Date': inv['InvoiceDate'] || inv['Date'],
        
        // 👇 UPDATE: Total Amount ab Column G (Header: InvoiceAmount) se aayega
        'Amount': inv['InvoiceAmount'] || 0, 

        // 👇 Due Amount Column I (Header: Outstanding) se aayega
        'Outstanding': inv['Outstanding'] || 0, 
        
        'Status': inv['Status'] || 'Pending', 
        'PILink': inv['Pi link'], 
        'InvoiceLink': inv['Invoice']
    }));

    return { success: true, data: formattedInvoices.sort((a, b) => new Date(b.Date) - new Date(a.Date)) };
  } catch (e) {
    Logger.log("Error in getClientInvoices: " + e.message);
    return { success: false, message: "Could not fetch invoices: " + e.message };
  }
}
// --- FIXED DASHBOARD DATA ---
function getClientDashboardData(clientId) {
  try {
    const allTickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => t['Client_Id'] == clientId);
    //const allChecklists = getSheetData(SHEET_NAMES.CHECKLIST).filter(c => c['Client_Id'] == clientId);
    const allSocial = getSheetData(SHEET_NAMES.SOCIAL).filter(s => s['Client_Id'] == clientId);

    // Helper to check if a ticket is effectively closed (Status Closed OR Pending Approval > 24hrs)
    const isTicketClosed = (t) => {
        const s = (t.Status || '').toLowerCase().trim();
        
        // 1. Direct Closed Statuses
        if (s.includes('closed') || s.includes('cancelled') || s.includes('approved by client') || s.includes('completed') || s.includes('done') || s.includes('resolved')) {
            return true;
        }

        // 2. Auto-Approve Logic (Pending Approval > 24 Hours)
        if (s.includes('pending approval')) {
            const updateDate = new Date(t['Last Update Date'] || t['Timestamp']);
            const now = new Date();
            const diffMs = now - updateDate;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            if (diffHours > 24) {
                return true; // Consider as Closed (Auto-Approved)
            }
        }
        return false;
    };

    // --- 1. Consolidate All Tasks ---
    const allTasks = [
      ...allTickets.map(t => ({ 
          ...t, 
          TaskType: 'Ticket', 
          ID: t['Ticket ID'], 
          Description: t['Task Description'], 
          Date: t['Last Update Date'] || t['Close Date'] || t['Timestamp'],
          IsEffectivelyClosed: isTicketClosed(t) // Add flag
      })),
      ...allSocial.map(s => ({ 
          ...s, 
          TaskType: 'Social Media', 
          ID: s['Post ID'], 
          Description: s.Content, 
          Date: s['Latest Update Date'] || s['Last Update Date'] || s['Planned Post Date'],
          IsEffectivelyClosed: (s.Status || '').toLowerCase().includes('posted') || (s.Status || '').toLowerCase().includes('approved')
      }))
    ];

    // --- 2. KPI Calculations ---
    
    // Fix: Only count tickets that are NOT effectively closed
    const openTickets = allTickets.filter(t => !isTicketClosed(t)).length;

    // Fix: Count completed tasks including Auto-Approved ones
    const completedTasks = allTasks.filter(t => t.IsEffectivelyClosed).length;
    
    // --- 3. Outstanding Calculation ---
    let outstandingAmount = 0;
    const invoiceResult = getClientInvoices(clientId);
    if (invoiceResult.success) {
        invoiceResult.data.forEach(inv => {
            const status = (inv.Status || '').toLowerCase();
            if (status !== 'paid' && status !== 'cancelled' && status !== 'full payment received') {
                let currentDue = 0;
                if (inv.Outstanding !== undefined && inv.Outstanding !== '') {
                    currentDue = parseFloat(inv.Outstanding) || 0;
                } else {
                    const total = parseFloat(inv.Amount) || 0;
                    const paid = parseFloat(inv.PaidAmount) || 0;
                    currentDue = total - paid;
                }
                outstandingAmount += currentDue;
            }
        });
    }

    // --- 4. Chart Data Preparation ---
    const statusCounts = allTasks.reduce((acc, task) => {
      let status = task.Status || 'Unknown';
      // Visual fix for chart: Group Auto-Approved into 'Approved' or 'Closed'
      if (task.TaskType === 'Ticket' && task.IsEffectivelyClosed && status.toLowerCase().includes('pending approval')) {
          status = 'Auto Approved'; 
      }
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const statusChartData = { labels: Object.keys(statusCounts), data: Object.values(statusCounts) };
    
    // --- 5. Weekly Activity Chart Logic ---
    const activityChartData = { labels: [], data: [] };
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      activityChartData.labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      
      const startOfDay = new Date(d); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(d); endOfDay.setHours(23,59,59,999);
      
      const count = allTasks.filter(t => {
         // Use the fixed closed logic
         if (!t.IsEffectivelyClosed) return false;
         
         const workDate = new Date(t.Date);
         if (isNaN(workDate.getTime())) return false;
         return workDate >= startOfDay && workDate <= endOfDay;
      }).length;
      
      activityChartData.data.push(count);
    }
    
    // --- 6. Pending Actions & Recent Activity ---
    const pendingActions = [];
    allTickets.forEach(t => {
        // Only show "Approve Ticket" if it is NOT auto-approved yet
        if (!isTicketClosed(t)) {
             const statusLower = t.Status ? t.Status.toLowerCase() : '';
             if (statusLower === 'pending approval') {
                // Double check time logic here to be safe
                pendingActions.push({ type: 'Approve Ticket Solution', description: t['Task Description'], taskType: 'Ticket', id: t['Ticket ID'] });
             }
             if (statusLower === 'pending client response') {
                pendingActions.push({ type: 'Respond to Query', description: t['Task Description'], taskType: 'Ticket', id: t['Ticket ID'] });
             }
        }
    });

    // ... (Social Pending logic remains same) ...
    allSocial.forEach(s => {
        if (s.Status && s.Status.toLowerCase() === 'pending approval') {
            pendingActions.push({ type: 'Approve Social Post', description: s.Content || `For ${s.Platform}`, taskType: 'Social Media', id: s['Post ID'] });
        }
    });

    const recentActivity = allTasks
      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
      .slice(0, 5)
      .map(task => {
        const desc = (task.Description || '').length > 50 ? task.Description.substring(0, 50) + '...' : task.Description;
        let message = `"${desc}" updated to ${task.Status}`;
        if (task.TaskType === 'Ticket' && task.IsEffectivelyClosed && (task.Status||'').toLowerCase().includes('pending approval')) {
             message = `"${desc}" was Auto-Approved.`;
        }
        return {
          id: task.ID, type: task.TaskType, message: message, timestamp: task.Date, status: task.Status,
          icon: task.TaskType === 'Ticket' ? 'fa-ticket-alt' : (task.TaskType === 'Social Media' ? 'fa-share-alt' : 'fa-list-check'),
        };
      });

    return { 
        success: true, 
        data: { 
            kpis: { openTickets, completedTasks, totalTasks: allTasks.length, outstandingAmount: outstandingAmount }, 
            statusChartData: statusChartData, activityChartData: activityChartData,
            pendingActions: pendingActions, recentActivity: recentActivity
        } 
    };
  } catch (e) {
    Logger.log("Dashboard Error: " + e.message);
    return { success: false, message: 'Dashboard Error: ' + e.message };
  }
}
// --- TICKET & SOCIAL POST UPDATES ---
function updateTicketStatusByClient(ticketId, newStatus, remarks, clientId) {
  try {
    // 2. Apply Payment Restriction on Ticket Updates
    if (newStatus.includes("Approved") || newStatus.includes("Reopened")) {
         const restriction = checkPaymentRestriction(clientId);
         if (restriction.restricted) {
             return { success: false, message: restriction.message };
         }
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.TICKETS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ticketIdIndex = headers.indexOf('Ticket ID');
    const clientIdIndex = headers.indexOf('Client_Id');
    const remarksIndex = headers.indexOf('Remarks');
    const statusIndex = headers.indexOf('Status');
    const lastUpdateIndex = headers.indexOf('Last Update Date');

    for (let i = 1; i < values.length; i++) {
        if (values[i][ticketIdIndex] == ticketId) {
            if (values[i][clientIdIndex] != clientId) return { success: false, message: 'Permission denied.' };
            const existingRemarks = values[i][remarksIndex] || '';
            const newRemarkEntry = `[[${newStatus} by Client on ${new Date().toLocaleDateString()}]]${remarks ? `: ${remarks}` : ''}`;
            const updatedRemarks = existingRemarks ? `${existingRemarks}\n${newRemarkEntry}` : newRemarkEntry;
            sheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
            sheet.getRange(i + 1, remarksIndex + 1).setValue(updatedRemarks);
            sheet.getRange(i + 1, lastUpdateIndex + 1).setValue(new Date());
            return { success: true };
        }
    }
    return { success: false, message: 'Ticket not found.' };
  } catch (e) {
    return { success: false, message: 'Error updating ticket: ' + e.message };
  }
}

function submitClientResponse(ticketId, remarks, attachment, clientInfo) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.TICKETS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ticketIdIndex = headers.indexOf('Ticket ID');
    const clientIdIndex = headers.indexOf('Client_Id');
    // Naye Columns dhoondhein
    const employeeIdIndex = headers.indexOf('Employee ID'); 
    const reassignedByIndex = headers.indexOf('Reassigned By'); // Jis user ne client ko bheja tha

    for (let i = 1; i < values.length; i++) {
        if (values[i][ticketIdIndex] == ticketId) {
            if (values[i][clientIdIndex] != clientInfo.Client_Id) {
                return { success: false, message: 'Permission denied.' };
            }
            
            let attachmentUrl = '';
            if (attachment && attachment.base64) {
                const filename = `client_response_${ticketId}_${attachment.fileName}`;
                attachmentUrl = saveBase64ImageToDrive(attachment.base64, filename, 'Client_Response_Attachments');
            }

            const remarksIndex = headers.indexOf('Remarks');
            const existingRemarks = values[i][remarksIndex] || '';
            const newRemarkEntry = `\n\n[[Client Responded on ${new Date().toLocaleString('en-IN')}]]\n${remarks}${attachmentUrl ? `\nAttachment: ${attachmentUrl}` : ''}`;
            
            // --- MAIT UPDATE: Assign ticket back to the original User ---
            const originalUser = values[i][reassignedByIndex]; // Jisne client ko ticket bheja tha
            
            const updateData = {
              'Status': 'Client Responded',
              'Remarks': existingRemarks + newRemarkEntry,
              'Last Update Date': new Date(),
              'HasUnreadAdminMessages': true, // User ko notification milegi
              'Employee ID': originalUser ? originalUser : '' // 👈 Ticket wapis User ko assign kar di
            };

            for (const header in updateData) {
              const colIndex = headers.indexOf(header);
              if (colIndex !== -1) {
                sheet.getRange(i + 1, colIndex + 1).setValue(updateData[header]);
              }
            }

            return { success: true };
        }
    }
    return { success: false, message: 'Ticket not found.' };
  } catch (e) {
    Logger.log('submitClientResponse Error: ' + e.message);
    return { success: false, message: 'Error submitting response: ' + e.message };
  }
}
function updateSocialPostStatusByClient(postId, newStatus, remarks, client) { 
  try { 
    // 3. Apply Payment Restriction on Social Updates
    const restriction = checkPaymentRestriction(client['Client_Id']);
    if (restriction.restricted) {
       return { success: false, message: restriction.message };
    }

    updateRowInSheet(SHEET_NAMES.SOCIAL, 'Post ID', postId, { 'Status': newStatus, 'Last Update Date': new Date() }); 
    const historyEntry = { 'History ID': `HIST_${Date.now()}`, 'Post ID': postId, 'Update Timestamp': new Date(), 'Updated By': client['Client Name'], 'Remarks': remarks, 'Status Change': newStatus }; 
    appendRowsToSheet(SHEET_NAMES.SOCIAL_HISTORY, [historyEntry]); 
    return { success: true }; 
  } catch (e) { 
    return { success: false, message: e.message }; 
  } 
}

function addClientRemarkToHistoryEntry(historyId, clientRemark, client) { 
  try { 
    const entry = getSheetData(SHEET_NAMES.SOCIAL_HISTORY).find(h => h['History ID'] == historyId); 
    if(!entry) return {success:false, message: 'History entry not found.'}; 
    updateRowInSheet(SHEET_NAMES.SOCIAL_HISTORY, 'History ID', historyId, {'Client Remark': clientRemark}); 
    updateRowInSheet(SHEET_NAMES.SOCIAL, 'Post ID', entry['Post ID'], {'Status': 'Client Feedback', 'Last Update Date': new Date()}); 
    return {success:true}; 
  } catch(e){ 
    return {success:false, message:e.message};
  }
}

// --- DETAILS & REPORTS ---
function getTicketDetails(ticketId, clientId) { try { const ticket = getSheetData(SHEET_NAMES.TICKETS).find(t => t['Ticket ID'] == ticketId && t.Client_Id == clientId); if (!ticket) return { success: false, message: "Permission denied or Ticket not found." }; return { success: true, data: ticket }; } catch (e) { return { success: false, message: e.message }; } }
function getChecklistDetails(checklistId, clientId) { try { const checklist = getSheetData(SHEET_NAMES.CHECKLIST).find(c => c['Task ID'] == checklistId && c.Client_Id == clientId); if(!checklist) return {success: false, message: 'Checklist not found.'}; return { success: true, data: checklist }; } catch (e) { return { success: false, message: e.message }; } }

function getSocialTaskDetails(postId) {
  try {
    const post = getSheetData(SHEET_NAMES.SOCIAL).find(s => s['Post ID'] == postId);
    if (!post) {
      return { success: false, message: 'Post not found.'};
    }
    const formatted = {...post, ID: post['Post ID'], Description: post.Content, Date: post['Planned Post Date'] };
    return { success: true, data: formatted };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getSocialTaskHistory(postId) { try { const history = getSheetData(SHEET_NAMES.SOCIAL_HISTORY).filter(h => h['Post ID'] == postId).sort((a, b) => new Date(b['Update Timestamp']) - new Date(a['Update Timestamp'])); return { success: true, history: history }; } catch (e) { return { success: false, message: 'Could not fetch history: ' + e.message }; } }
// **REPORT UPDATE: Include Invoices & FIXED OPEN TICKET COUNT**
function getClientReportData(clientId, startDate, endDate) { 
  try {
    const allTickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => t.Client_Id == clientId);
    //const allChecklists = getSheetData(SHEET_NAMES.CHECKLIST).filter(c => c.Client_Id == clientId);
    const allSocial = getSheetData(SHEET_NAMES.SOCIAL).filter(s => s.Client_Id == clientId);
    
    // Fetch Invoices for Reports
    const invoiceResult = getClientInvoices(clientId);
    const allInvoices = invoiceResult.success ? invoiceResult.data : [];

    let allTasks = [
      ...allTickets.map(t => ({ ID: t['Ticket ID'], TaskType: 'Ticket', Description: t['Task Description'], Status: t.Status, Date: t['Last Update Date'] || t.Timestamp })),
      //...allChecklists.map(c => ({ ID: c['Task ID'], TaskType: 'Checklist', Description: c['Task Description'], Status: c.Status, Date: c['Done Date'] || c['Plan Date'] })),
      ...allSocial.map(s => ({ ID: s['Post ID'], TaskType: 'Social Media', Description: s.Content, Status: s.Status, Date: s['Last Update Date'] || s['Planned Post Date'] })),
      // Add Invoices to the main report array
      ...allInvoices.map(i => ({ ID: i.InvoiceID, TaskType: 'Invoice', Description: `Amount: ${i.Amount}`, Status: i.Status, Date: i.Date }))
    ];
    
    // Date Filtering Logic
    if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        allTasks = allTasks.filter(item => {
            if (!item.Date) return false;
            const itemDate = new Date(item.Date);
            if (isNaN(itemDate.getTime())) return false;
            return itemDate >= start && itemDate <= end;
        });
    }

    // --- 🔴 FIX: CALCULATE ACTUAL OPEN TICKETS ---
    // "Closed" terms to exclude
    const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];

    const openTicketCount = allTasks.filter(t => {
        // Must be a Ticket
        if (t.TaskType !== 'Ticket') return false;
        
        const s = (t.Status || '').toLowerCase().trim();
        if (!s) return false; // No status implies not active/open in this context or invalid

        // If status contains any "closed" term, exclude it. Otherwise, it's OPEN.
        return !closedTerms.some(term => s.includes(term));
    }).length;

    const summary = {
        totalTasks: allTasks.length,
        tickets: openTicketCount, // ✅ अब यहाँ सिर्फ Open Tickets का काउंट जाएगा
        checklists: allTasks.filter(t => t.TaskType === 'Checklist').length,
        social: allTasks.filter(t => t.TaskType === 'Social Media').length,
        invoices: allTasks.filter(t => t.TaskType === 'Invoice').length
    };

    return { success: true, data: { details: allTasks.sort((a, b) => new Date(b.Date) - new Date(a.Date)), summary: summary } };
  } catch (e) { 
    Logger.log("Report Error: " + e.message);
    return { success: false, message: 'Error fetching report: ' + e.message }; 
  } 
}

// --- MESSAGING / CHAT ---
function getMessagesForTask(taskId) { 
  try { 
    const messages = getSheetData(SHEET_NAMES.MESSAGES).filter(m => m.TaskID == taskId).sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp)); 
    return { success: true, messages: messages }; 
  } catch (e) { 
    return { success: false, message: e.message }; 
  } 
}
function postMessage(taskId, messageText, client) { 
  try { 
    const newMessage = { 'MessageID': `MSG_${Date.now()}`, 'TaskID': taskId, 'Timestamp': new Date().toISOString(), 'Sender': client['Client Name'], 'Message': messageText }; 
    appendRowsToSheet(SHEET_NAMES.MESSAGES, [newMessage]); 
    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', taskId, {'HasUnreadAdminMessages': true, 'Last Update Date': new Date() });
    return { success: true, message: newMessage }; 
  } catch (e) { 
    return { success: false, message: e.message }; 
  } 
}
function markTicketMessagesAsRead(taskId, clientId) { 
  try { 
    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', taskId, { 'HasUnreadMessages': false }); 
    return { success: true }; 
  } catch(e) { 
    return { success: false, message: e.message }; 
  } 
}
function checkForNewUpdates(clientId, lastCheckTimestamp) {
  try {
    const checkTime = new Date(lastCheckTimestamp);
    let updates = [];

    // 1. Check Tickets
    const tickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => t.Client_Id == clientId);

    tickets.forEach(t => {
      const s = (t.Status || '').toLowerCase().trim();
      const lastUpdate = new Date(t['Last Update Date']);
      
      // A. Priority Notifications (Always show these if active)
      if (s.includes('pending client response')) {
          updates.push({
            id: t['Ticket ID'],
            type: 'Ticket',
            message: `🔴 Action Required: Reply needed on "${t['Task Description']}"`
          });
      }
      else if (s.includes('pending approval')) {
          updates.push({
            id: t['Ticket ID'],
            type: 'Ticket',
            message: `🔵 Approval Needed: "${t['Task Description']}"`
          });
      }
      // B. Recent Updates (Show only if new)
      else if ((t.IsNotified === false || t.IsNotified === 'false') && lastUpdate > checkTime) {
          let msg = `Update: ${t['Task Description']} is now ${t.Status}`;
          if (s.includes('closed')) msg = `✅ Ticket Closed: ${t['Task Description']}`;
          
          updates.push({
            id: t['Ticket ID'],
            type: 'Ticket',
            message: msg
          });
      }
    });

    // 2. Check Social Media
    const social = getSheetData(SHEET_NAMES.SOCIAL).filter(s => s.Client_Id == clientId);
    
    social.forEach(s => {
      const status = (s.Status || '').toLowerCase();
      const lastUpdate = new Date(s['Latest Update Date']);

      // A. Priority Notifications
      if (status.includes('pending approval')) {
          updates.push({
            id: s['Post ID'],
            type: 'Social Media',
            message: `🎨 Approval Needed: Social Post for ${s.Platform || 'Content'}`
          });
      }
      // B. Recent Updates
      else if (status.includes('posted') && lastUpdate > checkTime) {
          updates.push({
            id: s['Post ID'],
            type: 'Social Media',
            message: `🚀 Published: Your post on ${s.Platform} is live!`
          });
      }
    });

    return { success: true, updates: updates };
  } catch (e) {
    Logger.log("Notification Error: " + e.message);
    return { success: false, updates: [] };
  }
}
function markAsNotified(sheetName, keyColumn, id, updateData) {
  try {
      updateRowInSheet(sheetName, keyColumn, id, updateData);
      return { success: true };
  } catch (e) {
      return { success: false, message: e.message };
  }
}
// --- TAT CALCULATION LOGIC ---
function getLatestPendingDate(clientId) {
  try {
    const tickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => t['Client_Id'] == clientId);
    
    // 1. Filter only Open/Pending/InProgress tickets
    const openTickets = tickets.filter(t => {
      const s = (t.Status || '').toLowerCase().trim();
      // Exclude closed statuses
      return !(s.includes('closed') || s.includes('cancelled') || s.includes('approved') || s.includes('completed') || s.includes('done') || s.includes('resolved'));
    });

    if (openTickets.length === 0) {
      return { success: true, date: null }; // No pending work, start fresh
    }

    // 2. Find the maximum Plan Date among pending tickets
    let maxDate = new Date(0); // Epoch start
    
    openTickets.forEach(t => {
      if (t['Plan Date']) {
        const ticketDate = new Date(t['Plan Date']);
        // Only consider valid dates
        if (!isNaN(ticketDate.getTime()) && ticketDate > maxDate) {
          maxDate = ticketDate;
        }
      }
    });

    // If no valid dates found in pending tickets
    if (maxDate.getTime() === new Date(0).getTime()) {
      return { success: true, date: null };
    }

    return { success: true, date: maxDate.toISOString() };

  } catch (e) {
    Logger.log("TAT Error: " + e.message);
    return { success: false, message: e.message };
  }
}

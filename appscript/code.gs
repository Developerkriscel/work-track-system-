
// --- CONFIGURATION ---
const SPREADSHEET_ID = '1uiJ9hA7NaxkdbjUwXUxzHt4WgLU6stqFfJhwf0raH9E';
// --- EMP MASTER MODULE (HR EXTERNAL SHEET) ---
const EMP_SPREADSHEET_ID = '1XR_mxZkIc3PIWNdEL4YYiqnCTqDAl5i9z5nM0k7TsIc'; // Check karein ID sahi hai

function getEmpMasterData(category) {
  try {
    let ss;
    let sheet;

    // 🟢 HELPER: Check karne ke liye ki row blank to nahi hai
    const hasValidId = (row) => {
      const id = String(row['EMP Code'] || row['Employee ID'] || row['User ID'] || '').trim();
      return id.length > 0;
    };

    // 🟢 'Users' tab ke liye
    if (category === 'Users') {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = ss.getSheetByName('Users');
      let data = getSheetDataFromSheetObject(sheet);

      let activeData = data.filter(row => {
        if (!hasValidId(row)) return false; // 🚫 Blank row hata dega
        let status = String(row['Status'] || '').trim().toLowerCase();
        return status !== 'inactive' && status !== 'resigned' && status !== 'terminated';
      });

      return { success: true, data: activeData };
    }
    // 🟢 'Inactive' tab ke liye
    else if (category === 'Inactive') {
      ss = SpreadsheetApp.openById(EMP_SPREADSHEET_ID);

      const sheetsToSearch = ['Master', 'EMP', 'Freelancer', 'Intern'];
      let combinedData = [];

      sheetsToSearch.forEach(sheetName => {
        sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          let sheetData = getSheetDataFromSheetObject(sheet);

          let inactiveData = sheetData.filter(row => {
            if (!hasValidId(row)) return false; // 🚫 Blank row hata dega
            let status = String(row['Status'] || '').trim().toLowerCase();
            return status === 'inactive' || status === 'resigned' || status === 'terminated';
          });

          inactiveData = inactiveData.map(row => {
            row['_sourceSheet'] = sheetName;
            return row;
          });

          combinedData = combinedData.concat(inactiveData);
        }
      });
      return { success: true, data: combinedData };
    }
    // 🟢 Normal tab (Master, EMP, Intern, Freelancer) ke liye
    else {
      try { ss = SpreadsheetApp.openById(EMP_SPREADSHEET_ID); }
      catch (e) { ss = SpreadsheetApp.openById(SPREADSHEET_ID); }

      sheet = ss.getSheetByName(category);
      if (!sheet) return { success: false, message: `Sheet "${category}" not found.` };

      let data = getSheetDataFromSheetObject(sheet);

      let activeData = data.filter(row => {
        if (!hasValidId(row)) return false; // 🚫 Blank row hata dega
        let status = String(row['Status'] || '').trim().toLowerCase();
        return status !== 'inactive' && status !== 'resigned' && status !== 'terminated';
      });

      return { success: true, data: activeData };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Helper: Save single base64 file to specific folder
function saveFileToFolder(dataObj, folder) {
  try {
    const decoded = Utilities.base64Decode(dataObj.base64);
    const blob = Utilities.newBlob(decoded, dataObj.mimeType, dataObj.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl(); // प्रीव्यू कम्पैटिबिलिटी के लिए getUrl() का उपयोग करें
  } catch (e) {
    Logger.log("Blob Error: " + e.toString());
    return "Error Uploading File";
  }
}

// --- HELPER: SYNC TO USERS SHEET (UPDATED STATUS LOGIC) ---
function syncToAppUsers(empData, category) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID); // Internal Sheet
    const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();

    // Login ID 'User ID' field se uthayenge
    const loginId = String(empData['User ID']).trim();

    // Agar User ID form mein khali hai to user mat banao
    if (!loginId || loginId === "undefined" || loginId === "") {
      Logger.log("User ID missing, skipping App User creation.");
      return;
    }

    let userRowIndex = -1;

    // Check karein ki ye User ID pehle se hai kya
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === loginId) {
        userRowIndex = i + 1;
        break;
      }
    }

    // --- 🔥 STATUS LOGIC UPDATE ---
    // Default hum 'Active' manenge
    let loginStatus = 'Active';
    const empStatus = String(empData['Status']).toLowerCase();

    // Sirf agar banda job chod chuka hai ya nikal diya gaya hai, tabhi login band hoga.
    // Agar 'Pending' hai (Docs incomplete), to wo 'Active' hi rahega.
    if (empStatus === 'resigned' || empStatus === 'inactive' || empStatus === 'terminated') {
      loginStatus = 'Inactive';
    }
    // -----------------------------

    if (userRowIndex > -1) {
      // --- EXISTING USER ---
      // Sirf Status update karenge (Agar change hua ho). Baki details overwrite nahi karenge.
      updateRowInSheet(SHEET_NAMES.USERS, 'Employee ID', loginId, { 'Status': loginStatus });
      Logger.log("User exists. Status synced.");

    } else {
      // --- NEW USER ---
      let defaultRole = 'User';

      const newUser = {
        'Employee ID': loginId,
        'Employee Name': empData['Name'],
        'Role': defaultRole,
        'Password': '123456',   // Default Password
        'Status': loginStatus,
        'Mobile Number': empData['Phone No'] || '',
        'Email': empData['Official mail id if any'] || empData['Personal Email ID'] || '',
        'Manager ID': '',
        'Department': empData['Department'] || ''
      };

      appendRowToSheet(SHEET_NAMES.USERS, newUser);
      Logger.log(`New User ${loginId} created successfully.`);

      // 🔔 NEW USER ONBOARDING WHATSAPP ALERT
      if (newUser['Mobile Number']) {
        const welcomeMsg = `🎉 *WELCOME TO WORK TRACK SYSTEM* 🎉\n` +
          `---------------------------------\n` +
          `Hello *${newUser['Employee Name']}*,\n\n` +
          `Welcome to the team! Your official Work Track Portal account has been created successfully.\n\n` +
          `🔐 *Your Login Credentials:*\n` +
          `• *Employee ID:* *${newUser['Employee ID']}*\n` +
          `• *Default Password:* *123456*\n\n` +
          `👉 Kripya niche diye gaye link par click karke login karein aur profile me jaakar apna password turant change karein.\n\n` +
          `~ Work Track System`;
        sendWhatsAppMessage(newUser['Mobile Number'], welcomeMsg);
      }
    } // 1. 'else' ब्लॉक को बंद करता है
  } catch (e) { // 2. 'try' ब्लॉक को बंद करता है और 'catch' शुरू करता है
    Logger.log("User Sync Error: " + e.toString());
  } // 3. 'catch' ब्लॉक को बंद करता है
} // 4. पूरे फ़ंक्शन को बंद करता है

// --- Helper for External Sheet Reading ---
function getSheetDataFromSheetObject(sheet) {
  if (sheet.getLastRow() <= 1) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
  return values.map(row => headers.reduce((obj, header, index) => {
    obj[header] = row[index]; return obj;
  }, {}));
}

// SHEET_NAMES ऑब्जेक्ट में 'FORMS: "Forms"' लाइन जोड़ें:
const SHEET_NAMES = {
  USERS: 'Users',
  CLIENTS: 'Clients',
  TICKETS: 'Tickets',
  TICKET_HISTORY: 'Ticket_History',
  ATTENDANCE: 'Attendance',
  EXPENSES: 'Expenses',
  LEAVE_REQUESTS: 'Leave Requests',
  INTIMATIONS: 'Intimations',
  EMP_MASTER: 'EMP Master',
  MESSAGES: 'Messages',
  FMS: 'FMS',
  TODO: 'To-Do',
  FORMS: 'Forms' // 🟢 नया जोड़ा गया
};

// --- GET PENDING APPROVALS (STRICT HIERARCHY & HR RULES APPLIED) ---
function getPendingApprovals(adminId) {
  try {
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const adminIdClean = String(adminId || '').trim().toUpperCase();
    const currentUser = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === adminIdClean);

    if (!currentUser) return { success: false, message: 'Access Denied' };

    const userRole = String(currentUser.Role).trim();
    const currentUserName = String(currentUser['Employee Name']).trim().toLowerCase();
    const myTeamIds = getTeamIds(adminId); // Comma-separated list se clean uppercase team IDs laata hai

    const superAdminIds = allUsers
      .filter(u => String(u.Role).trim() === 'Super Admin')
      .map(u => String(u['Employee ID']).trim().toUpperCase());

    // Security check for Attendance/Leaves/Intimations
    const restrictedSuperAdmins = ['NL106', 'S103', 'AS101'];
    const isRestrictedAdmin = restrictedSuperAdmins.includes(adminIdClean);

    let attendanceList = []; let leaves = []; let intimations = []; let pendingTickets = [];

    const getValidName = (name, id) => {
      if (!name || String(name).trim() === '' || String(name).trim().toLowerCase() === 'undefined' || String(name).trim().toLowerCase() === 'null') {
        const u = allUsers.find(user => String(user['Employee ID']).trim().toUpperCase() === String(id).trim().toUpperCase());
        return u ? u['Employee Name'] : id;
      }
      return name;
    };

    // --- 1. ATTENDANCE, LEAVES & INTIMATIONS ---
    if (['HR', 'Super Admin', 'Admin', 'Manager'].includes(userRole)) {

      const rawAttendance = getSheetData(SHEET_NAMES.ATTENDANCE);
      let pendingRaw = rawAttendance.filter(row => {
        let st = row['Status'];
        return st === 'Need Approval' || st === 'Pending';
      });

      // HR RULE: HR will NOT see Super Admin attendance/leaves
      if (['Manager', 'Admin'].includes(userRole)) {
        pendingRaw = pendingRaw.filter(row => myTeamIds.includes(String(row['Employee ID']).trim().toUpperCase()));
      } else if (userRole === 'HR') {
        pendingRaw = pendingRaw.filter(row => !superAdminIds.includes(String(row['Employee ID']).trim().toUpperCase()));
      }

      const groupedMap = {};
      pendingRaw.forEach(row => {
        let rowDateObj = row['Date'];
        if (!(rowDateObj instanceof Date)) {
          let d = new Date(rowDateObj);
          if (isNaN(d.getTime())) {
            let parts = String(rowDateObj).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
            if (parts) {
              let y = parseInt(parts[3], 10);
              if (y < 100) y += 2000;
              d = new Date(y, parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
            }
          }
          rowDateObj = isNaN(d.getTime()) ? new Date() : d;
        }

        let dateKey = Utilities.formatDate(rowDateObj, "IST", "yyyy-MM-dd");
        let uniqueKey = `${String(row['Employee ID']).trim().toUpperCase()}|${dateKey}`;

        if (!groupedMap[uniqueKey]) {
          groupedMap[uniqueKey] = {
            'Employee ID': row['Employee ID'], 'Employee Name': getValidName(row['Employee Name'], row['Employee ID']),
            'DateStr': dateKey, 'PunchIn': '-', 'PunchOut': '-', 'Duration': '-',
            'Status': row['Status'], 'AttendanceID': uniqueKey
          };
        }

        let st = row['Status'];
        if (row['Action'] === 'Punch In') groupedMap[uniqueKey]['PunchIn'] = row['Time'] ? new Date(row['Time']).toLocaleTimeString('en-GB') : '-';
        else if (row['Action'] === 'Punch Out') { groupedMap[uniqueKey]['PunchOut'] = row['Time'] ? new Date(row['Time']).toLocaleTimeString('en-GB') : '-'; groupedMap[uniqueKey]['Duration'] = row['Total Working Hours'] || '-'; }

        let isMyTeam = myTeamIds.includes(String(row['Employee ID']).trim().toUpperCase());
        let actionableStatus = (groupedMap[uniqueKey]['Status'] || st);

        // Security Restriction: Restricted Super Admins (NL106, S103, AS101) cannot approve attendance
        if (isRestrictedAdmin) {
          groupedMap[uniqueKey]['_canApprove'] = false;
          groupedMap[uniqueKey]['_isActionableByMe'] = false;
        } else {
          groupedMap[uniqueKey]['_canApprove'] = (userRole === 'Super Admin' || userRole === 'HR' || isMyTeam);

          if (userRole === 'Super Admin' || userRole === 'HR') {
            groupedMap[uniqueKey]['_isActionableByMe'] = (actionableStatus === 'Need Approval' || actionableStatus === 'Pending');
          } else if (userRole === 'Manager' || userRole === 'Admin') {
            groupedMap[uniqueKey]['_isActionableByMe'] = isMyTeam && (actionableStatus === 'Need Approval' || actionableStatus === 'Pending');
          }
        }
      });
      attendanceList = Object.values(groupedMap);

      let allLeaves = getSheetData(SHEET_NAMES.LEAVE_REQUESTS).filter(l => l.Status === 'Pending');
      let allIntimations = getSheetData(SHEET_NAMES.INTIMATIONS).filter(i => i.Status === 'Submitted');

      allLeaves = allLeaves.map(l => {
        l['Employee Name'] = getValidName(l['Employee Name'], l['Employee ID']);
        let isMyTeamL = myTeamIds.includes(String(l['Employee ID']).trim().toUpperCase());

        // Security Restriction: Restricted Super Admins (NL106, S103, AS101) cannot approve leaves
        if (isRestrictedAdmin) {
          l['_canApprove'] = false;
          l['_isActionableByMe'] = false;
        } else {
          l['_canApprove'] = (userRole === 'Super Admin' || userRole === 'HR' || isMyTeamL);

          if (userRole === 'Super Admin' || userRole === 'HR') l['_isActionableByMe'] = (l.Status === 'Pending');
          else if (userRole === 'Manager' || userRole === 'Admin') l['_isActionableByMe'] = isMyTeamL && l.Status === 'Pending';
        }
        return l;
      });

      allIntimations = allIntimations.map(i => {
        i['Employee Name'] = getValidName(i['Employee Name'], i['Employee ID']);
        let isMyTeamI = myTeamIds.includes(String(i['Employee ID']).trim().toUpperCase());

        // Security Restriction: Restricted Super Admins (NL106, S103, AS101) cannot approve intimations
        if (isRestrictedAdmin) {
          i['_canApprove'] = false;
          i['_isActionableByMe'] = false;
        } else {
          i['_canApprove'] = (userRole === 'Super Admin' || userRole === 'HR' || isMyTeamI);

          if (userRole === 'Super Admin' || userRole === 'HR') i['_isActionableByMe'] = (i.Status === 'Submitted');
          else if (userRole === 'Manager' || userRole === 'Admin') i['_isActionableByMe'] = isMyTeamI && i.Status === 'Submitted';
        }
        return i;
      });

      if (['Manager', 'Admin'].includes(userRole)) {
        leaves = allLeaves.filter(l => myTeamIds.includes(String(l['Employee ID']).trim().toUpperCase()));
        intimations = allIntimations.filter(i => myTeamIds.includes(String(i['Employee ID']).trim().toUpperCase()));
      } else if (userRole === 'HR') {
        leaves = allLeaves.filter(l => !superAdminIds.includes(String(l['Employee ID']).trim().toUpperCase()));
        intimations = allIntimations.filter(i => !superAdminIds.includes(String(i['Employee ID']).trim().toUpperCase()));
      } else {
        leaves = allLeaves; intimations = allIntimations;
      }
    }

    // --- 2. TICKET APPROVAL (STRICT "TASK APPROVER" MATCH LOGIC) ---
    const allTickets = getSheetData(SHEET_NAMES.TICKETS);

    if (['Super Admin', 'Manager', 'Admin', 'HR'].includes(userRole)) {
      pendingTickets = allTickets.filter(t => {
        const isPending = (t.Status === 'Pending Approval' || t.Status === 'HR Approved');
        if (!isPending) return false;

        const ticketOwner = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === String(t['Employee ID']).trim().toUpperCase());
        if (!ticketOwner) return false;

        let finalApprover = "";
        const taskApproverVal = String(ticketOwner['Task Approver'] || '').trim();
        const managerIdVal = String(ticketOwner['Manager ID'] || '').trim();

        // Pehli priority 'Task Approver' ko, fallback pehla 'Manager ID'
        if (taskApproverVal !== "") {
          finalApprover = taskApproverVal.split(',')[0].trim().toUpperCase();
        } else if (managerIdVal !== "") {
          finalApprover = managerIdVal.split(',')[0].trim().toUpperCase();
        }

        // Sirf wahi approve karega jo exact Task Approver (ya fallback manager) hai
        // 🟢 RULE: यदि टिकट ट्रांसफर हो चुका है, तो केवल नया मैनेजर ही अप्रूव कर सकता है। पुराना मैनेजर केवल "View Only" देख पाएगा।
        const reassignedToVal = String(t['Reassigned To'] || '').trim().toUpperCase();
        let isDesignatedApprover = false;

        if (reassignedToVal !== "") {
          isDesignatedApprover = (reassignedToVal === adminIdClean);
        } else {
          isDesignatedApprover = (finalApprover === adminIdClean);
        }
        const ticketOwnerIdClean = String(t['Employee ID'] || '').trim().toUpperCase();
        const isMyTeamTicket = myTeamIds.includes(ticketOwnerIdClean);

        // 🟢 NEW RULE: क्या यह टिकट स्वयं लॉग-इन यूज़र का है?
        const isMyOwnTicket = (ticketOwnerIdClean === adminIdClean);

        if (userRole === 'Super Admin') {
          // MS101, AS101, NL106, S103 sabhi Super Admins ke liye:
          // Unke paas approval option tabhi hoga jab wo exact Task Approver hain AUR wo उनका स्वयं का टिकट नहीं है
          t['_canApprove'] = isDesignatedApprover && !isMyOwnTicket;
          t['_isActionableByMe'] = isDesignatedApprover && !isMyOwnTicket;
          return true; // Dikhai sabhi Super Admins ko dega
        } else if (userRole === 'HR') {
          const ownerDept = String(ticketOwner['Department'] || '').trim().toLowerCase();
          const isHrDepartmentTicket = ownerDept === 'hr' || ownerDept.includes('hr intern') || ownerDept.includes('human resource');

          t['_canApprove'] = !!((isDesignatedApprover && !isMyOwnTicket) || (isHrDepartmentTicket && !isMyOwnTicket));
          t['_isActionableByMe'] = !!((isDesignatedApprover && !isMyOwnTicket) || (isHrDepartmentTicket && !isMyOwnTicket));
          return true;
        } else {
          // Baki managers ko bache tickets sirf view mode (Team Tickets) mein dikhenge
          t['_canApprove'] = isDesignatedApprover && !isMyOwnTicket;
          t['_isActionableByMe'] = isDesignatedApprover && !isMyOwnTicket;
          return (isDesignatedApprover || isMyTeamTicket);
        }
      });
    }

    pendingTickets = pendingTickets.map(t => {
      const u = allUsers.find(user => String(user['Employee ID']).trim().toUpperCase() === String(t['Employee ID']).trim().toUpperCase());
      t['Employee Name'] = u ? u['Employee Name'] : t['Employee ID'];
      return t;
    });

    pendingTickets.sort((a, b) => {
      if (a._isActionableByMe !== b._isActionableByMe) return a._isActionableByMe ? -1 : 1;
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });

    // 🟢 सक्रिय कर्मचारियों की लिस्ट तैयार करें
    const activeUsersList = allUsers
      .filter(u => String(u['Status']).trim().toLowerCase() === 'active')
      .map(u => ({ id: u['Employee ID'], name: u['Employee Name'] }));

    return { success: true, leaves, intimations, attendance: attendanceList, tickets: pendingTickets, users: activeUsersList };

  } catch (e) {
    Logger.log("getPendingApprovals Error: " + e.toString());
    return { success: false, message: e.message };
  }
}
// =====================================================================
// 🚀 FIXED: DYNAMIC DASHBOARD DATA FETCH ENGINE (UPDATED PRODUCTIVE & GAP TIME)
// =====================================================================
function getDashboardData(employeeId, filterRange) {
  try {
    const allUsers = getSheetData(SHEET_NAMES.USERS);
    const currentUser = allUsers.find(u => String(u['Employee ID']).trim() === String(employeeId).trim());

    if (!currentUser) return { success: false, message: "User not found. Try logging out and logging in again." };

    const role = String(currentUser.Role).trim();
    const safeEmpId = String(employeeId).trim();

    function getSafeDate(val) {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }

    const isFmsFutureDate = (dateStr) => {
      if (!dateStr || String(dateStr).trim() === '') return false;
      let str = String(dateStr).trim().split(' ')[0];
      let alphaMatch = str.match(/^(\d{1,2})[\/\-\s]+([a-zA-Z]{3,})(?:[\/\-\s]+(\d{2,4}))?/);
      let numMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
      let currYear = new Date().getFullYear();
      let d = null;
      if (alphaMatch) {
        let day = parseInt(alphaMatch[1], 10);
        let mStr = alphaMatch[2].toLowerCase().substring(0, 3);
        let year = alphaMatch[3] ? parseInt(alphaMatch[3], 10) : currYear;
        if (year < 100) year += 2000;
        let mMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        d = new Date(year, mMap[mStr] || 0, day);
      } else if (numMatch) {
        let p1 = parseInt(numMatch[1], 10);
        let p2 = parseInt(numMatch[2], 10);
        let p3 = numMatch[3] ? parseInt(numMatch[3], 10) : currYear;
        let year = p3 < 100 ? p3 + 2000 : p3;
        let day = p1, month = p2 - 1;
        if (p2 > 12) { month = p1 - 1; day = p2; }
        d = new Date(year, month, day);
      } else {
        d = new Date(str);
      }
      if (!d || isNaN(d.getTime())) return false;
      let today = new Date(); today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return d.getTime() > today.getTime();
    };

    const allUserTickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => String(t['Employee ID']).trim() === safeEmpId);
    const allUserExpenses = getSheetData(SHEET_NAMES.EXPENSES).filter(e => String(e['Employee ID']).trim() === safeEmpId);

    let allUserFmsTasks = [];
    try {
      const fmsSheet = getSheet(SHEET_NAMES.FMS);
      const fmsLastRow = fmsSheet.getLastRow();
      const fmsLastCol = fmsSheet.getLastColumn();

      if (fmsLastRow > 1 && fmsLastCol >= 9) {
        const fmsValues = fmsSheet.getRange(2, 1, fmsLastRow - 1, fmsLastCol).getDisplayValues();
        const fmsRichText = fmsSheet.getRange(2, 1, fmsLastRow - 1, fmsLastCol).getRichTextValues();

        const empIdLower = safeEmpId.toLowerCase();
        const empNameLower = String(currentUser['Employee Name'] || '').trim().toLowerCase();

        // 🟢 HELPER: STRICT WORD BOUNDARY MATCHER
        function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
        function matchesUser(tId, tName, rWho, rEmpId) {
          if (tId && rEmpId === tId) return true;
          if (tId && new RegExp('\\b' + escapeRegExp(tId) + '\\b', 'i').test(rWho)) return true;
          if (tName) {
            if (new RegExp('\\b' + escapeRegExp(tName) + '\\b', 'i').test(rWho)) return true;
            const fName = tName.split(' ')[0];
            if (fName && new RegExp('\\b' + escapeRegExp(fName) + '\\b', 'i').test(rWho)) return true;
          }
          return false;
        }

        fmsValues.forEach((row, index) => {
          const rEmpId = String(row[0] || '').trim().toLowerCase();
          const rWho = String(row[4] || '').trim().toLowerCase();
          const rPlanDate = String(row[8] || '').trim();
          const rActualDate = String(row[9] || '').trim();

          // Dashboard mein sirf MY TASKS aate hain
          const isFmsVisible = matchesUser(empIdLower, empNameLower, rWho, rEmpId);

          if (isFmsVisible) {
            let hiddenLink = "";
            try {
              if (fmsLastCol > 10) {
                hiddenLink = fmsRichText[index][10].getLinkUrl();
                if (!hiddenLink && row[10] && row[10].toString().includes("http")) hiddenLink = row[10];
              }
            } catch (err) { }

            let taskStatus = rActualDate !== "" ? 'Completed' : 'Pending';
            if (taskStatus === 'Pending' && isFmsFutureDate(rPlanDate)) {
              taskStatus = 'Future';
            }

            allUserFmsTasks.push({
              'ID': row[5],
              'Task Description': row[6],
              'Plan Date': rPlanDate,
              'Actual Date': rActualDate,
              'Status': taskStatus,
              'Type': 'FMS',
              'Form Link': hiddenLink
            });
          }
        });
      }
    } catch (e) { Logger.log("FMS Fetch Safely Failed: " + e); }

    const allUserTasks = [...allUserTickets, ...allUserFmsTasks];

    let pendingApprovalsCount = 0;
    if (['Admin', 'Super Admin', 'HR', 'Manager'].includes(role)) {
      try {
        const approvalData = getPendingApprovals(safeEmpId);
        if (approvalData && approvalData.success) {
          const actionableTickets = (approvalData.tickets || []).filter(t => t._isActionableByMe === true).length;
          const actionableLeaves = (approvalData.leaves || []).filter(l => l._isActionableByMe === true).length;
          const actionableIntims = (approvalData.intimations || []).filter(i => i._isActionableByMe === true).length;
          const actionableAtt = (approvalData.attendance || []).filter(a => a._isActionableByMe === true).length;

          pendingApprovalsCount = actionableTickets + actionableLeaves + actionableIntims + actionableAtt;
        }
      } catch (e) { }
    }

    let filterStartDate = null;
    let filterEndDate = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filterRange === 'today') {
      filterStartDate = new Date(today);
      filterEndDate = new Date(today);
      filterEndDate.setHours(23, 59, 59, 999);
    }
    else if (filterRange === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      filterStartDate = new Date(yesterday);
      filterEndDate = new Date(yesterday);
      filterEndDate.setHours(23, 59, 59, 999);
    }
    else if (filterRange === 'week') {
      const dayOfWeek = today.getDay();
      filterStartDate = new Date(today);
      const diffToMon = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      filterStartDate.setDate(diffToMon);
      filterStartDate.setHours(0, 0, 0, 0);
      filterEndDate = new Date(filterStartDate);
      filterEndDate.setDate(filterStartDate.getDate() + 6);
      filterEndDate.setHours(23, 59, 59, 999);
    }
    else if (filterRange === 'month') {
      filterStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      filterEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      filterEndDate.setHours(23, 59, 59, 999);
    }
    else if (filterRange === 'last_week') {
      const beforeOneWeek = new Date(today);
      beforeOneWeek.setDate(today.getDate() - 7);
      const dayOfWeek = beforeOneWeek.getDay();
      filterStartDate = new Date(beforeOneWeek);
      const diffToMon = beforeOneWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      filterStartDate.setDate(diffToMon);
      filterStartDate.setHours(0, 0, 0, 0);
      filterEndDate = new Date(filterStartDate);
      filterEndDate.setDate(filterStartDate.getDate() + 6);
      filterEndDate.setHours(23, 59, 59, 999);
    }
    else if (filterRange === 'last_month') {
      filterStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      filterEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
      filterEndDate.setHours(23, 59, 59, 999);
    }
    else if (filterRange === 'all') {
      filterStartDate = new Date(2023, 0, 1);
      filterEndDate = new Date();
    }

    const getWorkingDays = (startDate, endDate) => {
      if (!startDate || !endDate) return 0;
      let count = 0;
      const curDate = new Date(startDate.getTime());
      while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0) count++;
        curDate.setDate(curDate.getDate() + 1);
      }
      return count;
    };

    const workingDaysInPeriod = getWorkingDays(filterStartDate, filterEndDate);
    const totalAssumedMinutes = workingDaysInPeriod * 8 * 60;
    const assumedBandwidthHours = `${Math.floor(totalAssumedMinutes / 60)}h ${totalAssumedMinutes % 60}m`;

    function getPlanDate(task) {
      const d = task['Plan Date'] || task['Planned Post Date'];
      return getSafeDate(d);
    }

    const tasksPlannedInPeriod = allUserTasks.filter(task => {
      const planDate = getPlanDate(task);
      return planDate && planDate >= filterStartDate && planDate <= filterEndDate;
    });
    const totalTatMinutes = tasksPlannedInPeriod.reduce((sum, task) => sum + (Number(task.TAT) || 0), 0);
    const plannedBandwidthHours = `${Math.floor(totalTatMinutes / 60)}h ${totalTatMinutes % 60}m`;

    function getCompletionDate(task) {
      let d = null;
      if (task['Actual Date']) d = getSafeDate(task['Actual Date']);
      else if (task['Close Date']) d = getSafeDate(task['Close Date']);
      else if (task['Last Update Date']) d = getSafeDate(task['Last Update Date']);
      else if (task['Post ID'] && task.Status === 'Posted' && task['Latest Update Date']) d = getSafeDate(task['Latest Update Date']);
      return d;
    }

    // 🟢 सुधारा गया गणना लॉजिक: संचित पॉज़ समय + लाइव चल रहे समय को प्रोडक्टिव टाइम में जोड़ता है
    const activeOrCompletedTasks = allUserTasks.filter(task => {
      const status = (task.Status || '').trim();
      const hasDuration = task['Total Duration'] && task['Total Duration'] !== '';
      const isInProgress = status === 'In Progress';

      if (!hasDuration && !isInProgress && !['Closed', 'Completed', 'Posted', 'Pending Approval'].includes(status)) {
        return false;
      }

      const compDate = getCompletionDate(task) || getSafeDate(task['Last Update Date']) || getSafeDate(task['Timestamp']);
      return compDate && compDate >= filterStartDate && compDate <= filterEndDate;
    });

    const totalActualMinutes = activeOrCompletedTasks.reduce((sum, task) => {
      let duration = 0;

      if (task['Total Duration'] && task['Total Duration'] !== '') {
        duration = durationToMinutes(task['Total Duration']);
      } else if (task['Post ID']) {
        duration = Number(task.TAT) || 0;
      }

      if (task.Status === 'In Progress' && task['Start Time']) {
        try {
          const now = new Date();
          const timeParts = String(task['Start Time']).split(':');
          if (timeParts.length >= 2) {
            const sessionStart = new Date();
            sessionStart.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), parseInt(timeParts[2] || 0, 10));

            if (sessionStart > now) {
              sessionStart.setDate(sessionStart.getDate() - 1);
            }

            const diffMs = now.getTime() - sessionStart.getTime();
            const runningMins = Math.floor(diffMs / (1000 * 60));
            if (runningMins > 0) {
              duration += runningMins;
            }
          }
        } catch (err) {
          Logger.log("Running session calc error: " + err);
        }
      }
      return sum + duration;
    }, 0);

    const actualBandwidthHours = `${Math.floor(totalActualMinutes / 60)}h ${totalActualMinutes % 60}m`;

    let pendingFmsCount = allUserFmsTasks.filter(f => f.Status === 'Pending').length;
    let doneFmsCount = allUserFmsTasks.filter(f => {
      if (f.Status !== 'Completed') return false;
      if (filterRange === 'all') return true;
      const actDate = getSafeDate(f['Actual Date']);
      return actDate && actDate >= filterStartDate && actDate <= filterEndDate;
    }).length;

    const expensesInPeriod = allUserExpenses.filter(e => {
      const expenseDate = getSafeDate(e['Date']);
      return expenseDate && expenseDate >= filterStartDate && expenseDate <= filterEndDate;
    });
    const totalExpenses = expensesInPeriod.reduce((sum, e) => sum + parseFloat(e.Amount || 0), 0);

    const doneTicketsCount = activeOrCompletedTasks.filter(t => t['Ticket ID'] && ['Closed', 'Completed', 'Pending Approval'].includes(t.Status)).length;
    const pendingTicketsCount = allUserTickets.filter(t => ['Open', 'In Progress', 'Client Responded', 'Reassigned', 'Rework', 'Pending Client Response'].includes(t.Status)).length;

    const overdueTasksCount = allUserTasks.filter(task => {
      const planDate = getPlanDate(task);
      const isPending = !['Closed', 'Completed', 'Posted', 'Pending Approval', 'Future'].includes(task.Status);
      return planDate && isPending && planDate < today;
    }).length;

    const bandwidthDifferenceMinutes = totalTatMinutes - totalActualMinutes;
    const absDiff = Math.abs(bandwidthDifferenceMinutes);
    const diffHours = Math.floor(absDiff / 60);
    const diffMinutes = absDiff % 60;
    const sign = bandwidthDifferenceMinutes >= 0 ? '+' : '-';
    const bandwidthDifference = `${sign}${diffHours}h ${diffMinutes}m`;
    const differenceColor = (totalActualMinutes >= totalTatMinutes) ? 'text-green-600' : 'text-red-600';
    const occupiedBandwidth = (totalTatMinutes > 0) ? Math.min(100, Math.round((totalActualMinutes / totalTatMinutes) * 100)) : 0;

    let pendingTodosCount = 0;
    try {
      const todoData = getSheetData(SHEET_NAMES.TODO);
      pendingTodosCount = todoData.filter(t =>
        String(t['Employee ID']).trim().toLowerCase() === safeEmpId.toLowerCase() &&
        String(t.Status).trim().toLowerCase() === 'pending'
      ).length;
    } catch (e) {
      Logger.log("Dashboard To-Do Fetch Error: " + e);
    }

    const kpis = {
      totalExpenses: totalExpenses.toFixed(2),
      assumedBandwidthHours, plannedBandwidthHours, actualBandwidthHours, occupiedBandwidth, bandwidthDifference, differenceColor,
      pendingTickets: pendingTicketsCount, doneTickets: doneTicketsCount,
      pendingFms: pendingFmsCount, doneFms: doneFmsCount,
      overdueTasks: overdueTasksCount, adminPendingApprovals: pendingApprovalsCount,
      pendingTodos: pendingTodosCount
    };

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    let dailyCompletionData = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      dailyCompletionData[Utilities.formatDate(date, "IST", "yyyy-MM-dd")] = 0;
    }

    allUserTasks.forEach(task => {
      if (['Closed', 'Completed', 'Posted', 'Pending Approval'].includes(task.Status)) {
        const completionDate = getCompletionDate(task);
        if (completionDate && completionDate >= sevenDaysAgo && completionDate <= new Date()) {
          const dateKey = Utilities.formatDate(completionDate, "IST", "yyyy-MM-dd");
          if (dailyCompletionData.hasOwnProperty(dateKey)) dailyCompletionData[dateKey]++;
        }
      }
    });

    const chartData = {
      lineChart: { labels: Object.keys(dailyCompletionData).map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })), data: Object.values(dailyCompletionData) },
      barChart: { labels: ['Tickets', 'FMS'], data: [pendingTicketsCount, pendingFmsCount] }
    };

    const todayStr = Utilities.formatDate(new Date(), "IST", "yyyy-MM-dd");
    const reformatDate = (d) => {
      const sd = getSafeDate(d);
      return sd ? Utilities.formatDate(sd, "IST", "yyyy-MM-dd") : null;
    };

    const mapTaskData = (task) => {
      let type = task.Type || (task['Ticket ID'] ? 'Ticket' : (task['Task ID'] ? 'FMS' : 'Task'));
      let id = task.ID || task['Ticket ID'] || task['Task ID'] || task['Post ID'];
      let desc = task.Description || task['Task Description'] || task.Content;
      return { ...task, Type: type, ID: id, Description: desc };
    };

    const todaysTasks = allUserTasks.filter(t => reformatDate(getPlanDate(t)) === todayStr).map(mapTaskData);

    const pendingTasks = allUserTasks.filter(task => {
      const status = (task.Status || '').trim();
      return !['Closed', 'Completed', 'Posted', 'Pending Approval', 'Future'].includes(status);
    }).map(mapTaskData);

    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const upcomingTasks = allUserTasks.filter(t => {
      const pDate = getPlanDate(t);
      return pDate && pDate >= tomorrow && !['Closed', 'Completed', 'Posted', 'Pending Approval'].includes(t.Status);
    }).map(mapTaskData).sort((a, b) => {
      const dateA = getPlanDate(a); const dateB = getPlanDate(b);
      if (!dateA) return 1; if (!dateB) return -1;
      return dateA - dateB;
    });

    // 🟢 सुधारा गया गैप टाइम लॉजिक: काम रीसेट होने पर lastEndTime को साफ़ करता है
    let totalGapMinutes = 0;
    try {
      const historyData = getSheetData(SHEET_NAMES.TICKET_HISTORY);
      const userHistory = historyData.filter(h => {
        const hDate = getSafeDate(h.Timestamp);
        const isMatch = String(h['Action By']).trim() === String(currentUser['Employee Name']).trim();
        return isMatch && hDate && hDate >= filterStartDate && hDate <= filterEndDate;
      }).sort((a, b) => getSafeDate(a.Timestamp) - getSafeDate(b.Timestamp));

      let lastEndTime = null;
      userHistory.forEach((entry) => {
        const currentTime = getSafeDate(entry.Timestamp);
        if (!currentTime) return;

        if (entry['Action Type'].includes('In Progress') || entry['Action Type'].includes('Work Resumed')) {
          if (lastEndTime) {
            const gap = Math.floor((currentTime - lastEndTime) / (1000 * 60));
            if (gap > 0 && gap < 480) { totalGapMinutes += gap; }
            lastEndTime = null; // काम शुरू होने पर रीसेट करें
          }
        } else if (entry['Action Type'].includes('Paused') || entry['Action Type'].includes('Completed') || entry['Action Type'].includes('Closed')) {
          lastEndTime = currentTime;
        }
      });
    } catch (e) { }

    kpis.totalGapTime = `${Math.floor(totalGapMinutes / 60)}h ${totalGapMinutes % 60}m`;

    return { success: true, data: { kpis, todaysTasks, upcomingTasks, chartData, pendingTasks } };
  } catch (e) {
    Logger.log("getDashboardData error: " + e.toString());
    return { success: false, message: "Dashboard Error: " + e.message };
  }
}

function adminTicketAction(ticketId, adminId, action, remarks) {
  try {
    enforceAttendanceGate(adminId);

    const ticketList = getSheetData(SHEET_NAMES.TICKETS);
    const ticketRow = ticketList.find(t => t['Ticket ID'] === ticketId);
    if (!ticketRow) return { success: false, message: 'Ticket not found.' };

    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const adminIdClean = String(adminId || '').trim().toUpperCase();
    const adminUser = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === adminIdClean);
    if (!adminUser) return { success: false, message: 'Admin user not found.' };

    const ticketOwnerIdClean = String(ticketRow['Employee ID'] || '').trim().toUpperCase();
    if (ticketOwnerIdClean === adminIdClean) {
      return { success: false, message: 'Access Denied: Aap apna khud ka ticket approve ya reject nahi kar sakte.' };
    }

    const ticketOwner = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === ticketOwnerIdClean);
    const adminRole = String(adminUser['Role']).trim();
    const myTeamIds = getTeamIds(adminId);

    let finalApprover = "";
    if (ticketOwner) {
      const taskApproverVal = String(ticketOwner['Task Approver'] || '').trim();
      const managerIdVal = String(ticketOwner['Manager ID'] || '').trim();

      if (taskApproverVal !== "") {
        finalApprover = taskApproverVal.split(',')[0].trim().toUpperCase();
      } else if (managerIdVal !== "") {
        finalApprover = managerIdVal.split(',')[0].trim().toUpperCase();
      }
    }

    const reassignedToVal = String(ticketRow['Reassigned To'] || '').trim().toUpperCase();
    let isDesignatedApprover = false;

    if (reassignedToVal !== "") {
      isDesignatedApprover = (reassignedToVal === adminIdClean);
    } else {
      isDesignatedApprover = (finalApprover === adminIdClean);
    }
    let isAuthorized = false;

    if (isDesignatedApprover) {
      isAuthorized = true;
    } else if (adminRole === 'HR') {
      const ownerDept = String(ticketOwner['Department'] || '').trim().toLowerCase();
      if (ownerDept === 'hr' || ownerDept.includes('hr intern') || ownerDept.includes('human resource')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return { success: false, message: 'Access Denied: Aap is ticket ko approve karne ke liye authorized nahi hain.' };
    }

    const update = {};
    const now = new Date();
    const timestamp = Utilities.formatDate(now, "IST", "dd/MM/yyyy HH:mm");
    let statusMsg = '';

    if (action === 'Approve') {
      update['Status'] = 'Closed';
      update['Close Date'] = now;
      update['Completion Date'] = now;
      const actualDateStr = ticketRow['Actual Date'];
      const endTimeStr = ticketRow['End Time'];
      if (actualDateStr && endTimeStr) {
        let submissionTime = new Date(actualDateStr);
        let timeParts = String(endTimeStr).split(':');
        if (timeParts.length >= 2) {
          submissionTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0);
          let diffMs = now.getTime() - submissionTime.getTime();
          if (diffMs > 0) {
            let diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            let diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            update['Admin Approval Duration'] = `${diffHrs}h ${diffMins}m`;
          }
        }
      }
      statusMsg = 'Approved & Closed';
    } else if (action === 'Rework' || action === 'Reject') {
      update['Status'] = 'Rework';
      statusMsg = 'Sent for Rework';
    }

    update['Remarks'] = (ticketRow['Remarks'] || "") + `\n[${adminRole} ${adminUser['Employee Name']} - ${timestamp}]: ${action} - ${remarks}`;
    update['Last Action By'] = adminUser['Employee Name'];

    logTicketHistory(ticketId, adminUser['Employee Name'], statusMsg, remarks, '');
    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, update);

    if (ticketOwner && ticketOwner['Mobile Number']) {
      let msg = '';
      const clientName = ticketRow['Name'] || 'N/A';
      const category = ticketRow['Task Category'] || 'N/A';
      const description = ticketRow['Task Description'] || 'N/A';

      if (action === 'Approve' && adminRole === 'HR') {
        msg = `⏳ *HR APPROVED & VERIFIED* ⏳\n` +
          `---------------------------------\n` +
          `🎫 *Ticket ID:* *${ticketId}*\n` +
          `🏢 *Client Name:* *${clientName}*\n` +
          `📂 *Category:* *${category}*\n` +
          `👤 *HR Evaluator:* *${adminUser['Employee Name']}*\n` +
          `📝 *Task:* ${description}\n\n` +
          `✅ *Status:* Ticket has been successfully verified by HR!\n\n` +
          `~ Work Track System`;
      } else if (action === 'Approve') {
        msg = `🎉 *TICKET APPROVED & CLOSED* 🎉\n` +
          `---------------------------------\n` +
          `🎫 *Ticket ID:* *${ticketId}*\n` +
          `🏢 *Client Name:* *${clientName}*\n` +
          `📂 *Category:* *${category}*\n` +
          `👤 *Approved By:* *${adminUser['Employee Name']}* (${adminRole})\n` +
          `📝 *Task Details:* ${description}\n\n` +
          `💬 *Approver Remarks:* *${remarks || 'No remarks provided.'}*\n\n` +
          `🏆 Great job! Your task is officially closed.\n\n` +
          `~ Work Track System`;
      } else {
        msg = `⚠️ *REWORK REQUIRED ALERT* ⚠️\n` +
          `---------------------------------\n` +
          `🎫 *Ticket ID:* *${ticketId}*\n` +
          `🏢 *Client Name:* *${clientName}*\n` +
          `📂 *Category:* *${category}*\n` +
          `👤 *Returned By:* *${adminUser['Employee Name']}* (${adminRole})\n` +
          `📝 *Task Details:* ${description}\n\n` +
          `💬 *Feedback / Instructions:* *${remarks || 'Please check and fix.'}*\n\n` +
          `📌 Kripya di gayi suggestions ke hisaab se task thik karke dubara submit karein.\n\n` +
          `~ Work Track System`;
      }
      sendWhatsAppMessage(ticketOwner['Mobile Number'], msg);
    }

    return { success: true, message: `Ticket ${statusMsg} successfully.` };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

// ==========================================
// 🚀 WHATSAPP API FUNCTION (EXACT AS PER SHEET)
// ==========================================
const WHATSAPP_API_URL = "https://aiadrika.in/api/send";
const WHATSAPP_INSTANCE_ID = "695A0632072F9";   // 🟢 FIX: Updated from your screenshot
const WHATSAPP_ACCESS_TOKEN = "6878f244d0e8a"; // 🟢 FIX: Updated from your screenshot

// =====================================================
// WORK TRACK SYSTEM LINK + TICKET ASSIGNMENT OWNER
// =====================================================
const WORK_TRACK_APP_URL = "https://script.google.com/macros/s/AKfycbxCAUBf24QVIIf5DHoF-gIqPMv1qjw9mj7ciIRNcfa1WXGK9iPsLrFf9NS7F3PoEnq6RQ/exec";

// Client/unassigned ticket assignment reminder yahan jayega
const TICKET_ASSIGNMENT_OWNER_ID = "MS101";
const TICKET_ASSIGNMENT_OWNER_NAME = "Mitushi Sharma";

function _safeText_(v) {
  return String(v == null ? '' : v).trim();
}

function _normText_(v) {
  return _safeText_(v).toLowerCase();
}

function _appendWorkTrackLinkToMessage_(message) {
  let msg = _safeText_(message);

  // Agar message me pehle se same link hai to duplicate nahi karega
  if (msg.indexOf(WORK_TRACK_APP_URL) !== -1) {
    return msg;
  }

  return `${msg}\n\n🔗 *Work Track System:* ${WORK_TRACK_APP_URL}`;
}

function _getTicketAssignmentOwner_() {
  const users = getCachedSheetData(SHEET_NAMES.USERS);

  // First priority: Employee ID MS101
  let owner = users.find(u =>
    _normText_(u['Employee ID']) === _normText_(TICKET_ASSIGNMENT_OWNER_ID)
  );

  // Fallback: Name search
  if (!owner) {
    owner = users.find(u =>
      _normText_(u['Employee Name']) === _normText_(TICKET_ASSIGNMENT_OWNER_NAME)
    );
  }

  return owner || null;
}

function _isClientCreatedTicket_(ticketData) {
  const sourceText = [
    ticketData.Source,
    ticketData.source,
    ticketData['Created By'],
    ticketData['CreatedBy'],
    ticketData['Creator ID'],
    ticketData['Creator Name'],
    ticketData['Last Action By'],
    ticketData['Submitted By']
  ].map(_safeText_).join(' ').toLowerCase();

  return sourceText.includes('client');
}

function notifyTicketAssignmentOwner_(ticket, ticketData, reason) {
  try {
    const owner = _getTicketAssignmentOwner_();

    if (!owner) {
      Logger.log(`Ticket assignment owner not found: ${TICKET_ASSIGNMENT_OWNER_ID} / ${TICKET_ASSIGNMENT_OWNER_NAME}`);
      return false;
    }

    if (!owner['Mobile Number']) {
      Logger.log(`Ticket assignment owner mobile missing: ${owner['Employee ID']} / ${owner['Employee Name']}`);
      return false;
    }

    const creatorName = _safeText_(ticketData['Creator Name']) || 'Client';
    const currentAssignee = _safeText_(ticket['Employee ID']) || 'Not Assigned';

    const msg =
      `🚨 *Ticket Assignment Required* 🚨\n\n` +
      `Hello *${owner['Employee Name'] || TICKET_ASSIGNMENT_OWNER_NAME}*,\n\n` +
      `Client ne ticket assign/create ki hai. Isko correct user ko assign kar do.\n\n` +
      `🎫 *Ticket ID:* ${ticket['Ticket ID']}\n` +
      `🏢 *Client:* ${ticket['Name'] || 'N/A'}\n` +
      `📂 *Category:* ${ticket['Task Category'] || '-'}\n` +
      `⚡ *Priority:* ${ticket['Priority'] || '-'}\n` +
      `📝 *Description:* ${ticket['Task Description'] || '-'}\n` +
      `👤 *Current Assignee:* ${currentAssignee}\n` +
      `📌 *Reason:* ${reason || 'Client ticket / unassigned ticket'}\n` +
      `🧾 *Created By:* ${creatorName}\n\n` +
      `Please open portal and assign this ticket to the right user.\n\n` +
      `~ Work Track System`;

    return sendWhatsAppMessage(owner['Mobile Number'], msg);

  } catch (e) {
    Logger.log("notifyTicketAssignmentOwner_ Error: " + e.toString());
    return false;
  }
}

// ==========================================
// 🚀 UPDATED WHATSAPP API FUNCTION (WITH LOGGING)
// ==========================================
function sendWhatsAppMessage(number, message, isRetry = false) {
  try {
    if (!number || String(number).trim() === '') return false;

    // अगर री-ट्राई (retry) नहीं हो रहा है, तभी लिंक ऐड करो, ताकि लिंक दो बार ना जुड़ जाए
    if (!isRetry) {
      message = _appendWorkTrackLinkToMessage_(message);
    }

    let cleanNumber = String(number).replace(/\D/g, '');
    if (cleanNumber.length === 10) cleanNumber = "91" + cleanNumber;

    const encodedMessage = encodeURIComponent(message);
    const finalUrl =
      `${WHATSAPP_API_URL}?number=${cleanNumber}` +
      `&type=text` +
      `&message=${encodedMessage}` +
      `&instance_id=${WHATSAPP_INSTANCE_ID}` +
      `&access_token=${WHATSAPP_ACCESS_TOKEN}`;

    const options = {
      method: 'get',
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(finalUrl, options);
    const respText = response.getContentText();
    const respCode = response.getResponseCode();

    Logger.log("WA Sent to " + cleanNumber + " | Resp: " + respText);

    // चेक करें कि मैसेज सच में गया या API ने एरर दिया
    let isSuccess = false;
    if (respCode >= 200 && respCode < 300 && !respText.toLowerCase().includes('"status":"error"') && !respText.toLowerCase().includes('"success":false')) {
      isSuccess = true;
    }

    // अगर फ्रेश मैसेज है, तो WA_Logs शीट में उसका स्टेटस रिकॉर्ड करें
    if (!isRetry) {
      logWhatsApp(cleanNumber, message, isSuccess ? "Sent" : "Failed");
    }

    return isSuccess;

  } catch (e) {
    Logger.log("WA Error: " + e.toString());

    // अगर सिस्टम एरर (Timeout) आया, तो भी फेल मार्क करें
    if (!isRetry) {
      logWhatsApp(number, message, "Failed");
    }
    return false;
  }
}

// --- USER MANAGEMENT: SAVE/UPDATE ---
function saveOrUpdateUser(userData, adminId) {
  try {
    const admin = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === adminId);
    if (!admin || !['Admin', 'Super Admin', 'HR', 'Manager'].includes(admin.Role)) {
      return { success: false, message: 'Unauthorized' };
    }

    const userId = userData['Employee ID'];
    const updateData = {
      'Employee Name': userData['Employee Name'],
      'Role': userData['Role'],
      'Password': userData['Password'],
      'Status': userData['Status'],
      'Mobile Number': userData['Mobile Number'],
      'Email': userData['Email'],
      'Manager ID': userData['Manager ID'] || '',
      'Department': userData['Department'] || '',
      'Task Approver': userData['Task Approver'] || '' // 🟢 NAYA COLUMN ADD KIYA
    };

    const updated = updateRowInSheet(SHEET_NAMES.USERS, 'Employee ID', userId, updateData);
    if (!updated) {
      const newUserRow = { 'Employee ID': userId, ...updateData };
      appendRowToSheet(SHEET_NAMES.USERS, newUserRow);
    }
    syncUserStatusToEmpMaster(userId, userData['Status']);
    return { success: true, message: 'User updated successfully.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function syncUserStatusToEmpMaster(userId, newStatus) {
  try {
    const ss = SpreadsheetApp.openById(EMP_SPREADSHEET_ID); // External HR Sheet
    // 🟢 FIX 3: 'EMP' को रिवर्स सिंक के लिए भी ऐड किया
    const categories = ['EMP', 'Master', 'Freelancer', 'Intern'];

    let foundAndUpdated = false;

    for (const category of categories) {
      const sheet = ss.getSheetByName(category);
      if (!sheet) continue;

      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      const userIdIndex = headers.indexOf('User ID');
      const statusIndex = headers.indexOf('Status');

      if (userIdIndex === -1 || statusIndex === -1) continue;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][userIdIndex]).trim() === String(userId).trim()) {
          sheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
          foundAndUpdated = true;
          Logger.log(`Reverse Sync: Updated ${userId} to ${newStatus} in ${category} sheet.`);
          break;
        }
      }
      if (foundAndUpdated) break;
    }

  } catch (e) {
    Logger.log("syncUserStatusToEmpMaster Error: " + e.toString());
  }
}

// ------------------------------------------------
// --- INITIAL SETUP ---
/**
 * Zaroori sheets ko headers ke saath banata hai agar woh maujood na ho.
 */
function setupInitialSheets() {
  Logger.log("Surakshit setup function shuru ho raha hai.");
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    const headers = {
      [SHEET_NAMES.USERS]: [
        'Employee ID', 'Employee Name', 'Role', 'Password', 'Status',
        'Mobile Number', 'Email', 'Manager ID', 'Department', 'Task Approver'
      ],
      [SHEET_NAMES.TICKETS]: [
        'Timestamp', 'Ticket ID', 'Client_Id', 'Name', 'Task Category',
        'Task Description', 'Attachment', 'Priority', 'Plan Date', 'Close Date',
        'Completion Date', 'Status', 'Employee ID', 'Help Person Name', 'Start Time',
        'End Time', 'Total Duration', 'TAT', 'Remarks', 'Closing Attachment',
        'Target Date', 'Last Update Date', 'Reassigned By', 'Reassigned To',
        'Last Action By', 'HasUnreadAdminMessages', 'HasUnreadMessages',
        'Creator ID', 'Creator Name', 'Source'
      ],
      [SHEET_NAMES.TICKET_HISTORY]: ['History ID', 'Ticket ID', 'Timestamp', 'Action By', 'Action Type', 'Remarks', 'Attachment URL'],
      [SHEET_NAMES.ATTENDANCE]: ['Date', 'Time', 'Employee ID', 'Employee Name', 'Action', 'Photo Url', 'Lattitude', 'Longitude', 'Total Working Hours', 'Status', 'Admin Remarks', 'Punch IN Time', 'Punch OUT Time', 'Duration', 'Admin Approval'],
      [SHEET_NAMES.EXPENSES]: ['Date', 'Expense ID', 'Employee ID', 'Employee Name', 'Type', 'Amount', 'Description', 'Receipt URL', 'Status', 'Approver'],
      [SHEET_NAMES.LEAVE_REQUESTS]: ['Leave ID', 'Timestamp', 'Employee ID', 'Employee Name', 'Leave Type', 'Day Type', 'Start Date', 'End Date', 'Reason', 'Status', 'Admin Remarks'],
      [SHEET_NAMES.INTIMATIONS]: ['Intimation ID', 'Timestamp', 'Employee ID', 'Employee Name', 'Intimation Date', 'Intimation Type', 'Reason', 'Status', 'Admin Remarks'],
      [SHEET_NAMES.MESSAGES]: ['MessageID', 'TaskID', 'Timestamp', 'Sender', 'Message'],
      [SHEET_NAMES.FMS]: ['FMS ID', 'Employee ID', 'Task Name', 'Description', 'Form Link', 'Status', 'Planned Date', 'Latest Update Date', 'Remarks'],
      [SHEET_NAMES.TODO]: ['Task ID', 'Employee ID', 'Task', 'Status', 'Priority', 'Due Date', 'TAT', 'Timestamp'],
      [SHEET_NAMES.FORMS]: ['Department', 'Sheet name', 'For', 'Form link', 'Viewer']
    };

    for (const sheetName in headers) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, headers[sheetName].length).setValues([headers[sheetName]]).setFontWeight('bold');
        Logger.log(`Nayi Sheet "${sheetName}" safaltapoorvak ban gayi hai.`);
      } else {
        Logger.log(`Sheet "${sheetName}" pehle se maujood hai.`);
        const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const requiredHeaders = headers[sheetName];
        const missingHeaders = requiredHeaders.filter(h => !existingHeaders.includes(h));
        if (missingHeaders.length > 0) {
          sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]).setFontWeight('bold');
          Logger.log(`Sheet "${sheetName}" mein yeh columns add kiye gaye: ${missingHeaders.join(', ')}`);
        }
      }
    }

    return { success: true, message: "Sheets safaltapoorvak set up ho gayi hain." };

  } catch (e) {
    Logger.log("setupInitialSheets mein error: " + e.toString());
    return { success: false, message: "Sheets set up karne mein error: " + e.message };
  }
}

// --- UTILITY FUNCTIONS ---
function getSpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function getSheet(sheetName) { const sheet = getSpreadsheet().getSheetByName(sheetName); if (!sheet) { throw new Error(`Sheet "${sheetName}" nahi mili.`); } return sheet; }
function getCachedSheetData(sheetName) { const cache = CacheService.getScriptCache(); const cached = cache.get(sheetName); if (cached != null) { return JSON.parse(cached); } const data = getSheetData(sheetName); cache.put(sheetName, JSON.stringify(data), 600); return data; }

// --- SUPER FAST READ FUNCTION ---
function getSheetData(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1) return [];

    // एक ही बार में सिर्फ काम का डेटा उठाएं
    const data = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = data[0].map(h => String(h).trim());
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // खाली Rows को इग्नोर कर दें ताकि प्रोसेसिंग फ़ास्ट हो
      if (row.join('').trim() === '') continue;

      let obj = {};
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) obj[headers[j]] = row[j];
      }
      result.push(obj);
    }
    return result;
  } catch (e) {
    Logger.log(`getSheetData Error (${sheetName}): ${e.toString()}`);
    return [];
  }
}

// --- 🚀 OPTIMIZED: SUPER FAST APPEND ROW (WITH CACHE) ---
function appendRowToSheet(sheetName, rowData) {
  const sheet = getSheet(sheetName);
  const cache = CacheService.getScriptCache();
  const headerCacheKey = 'HEADERS_' + sheetName;

  let headersStr = cache.get(headerCacheKey);
  let headers = [];

  // अगर Headers पहले से Cache में हैं, तो सीधे वहां से लें (Sheet Read करने का टाइम बचेगा)
  if (headersStr) {
    headers = JSON.parse(headersStr);
  } else {
    // अगर Cache में नहीं हैं, तो शीट से रीड करें और Cache में 6 घंटे के लिए सेव कर दें
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    cache.put(headerCacheKey, JSON.stringify(headers), 21600); // 21600 seconds = 6 hours
  }

  // Row data map karega based on headers
  const newRow = headers.map(header => {
    if (rowData[header] instanceof Date) {
      return rowData[header];
    }
    return rowData[header] === undefined ? '' : rowData[header];
  });

  sheet.appendRow(newRow);
  cache.remove(sheetName); // Data update हुआ है, इसलिए शीट का डेटा कैश डिलीट करें
}

// --- SUPER FAST UPDATE ROW FUNCTION ---
function updateRowInSheet(sheetName, key, value, updateData) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) return false;

  // 1. सारा डेटा एक साथ मेमोरी में लाएं (बहुत फ़ास्ट)
  const dataRange = sheet.getRange(1, 1, lastRow, lastCol);
  const values = dataRange.getValues();
  const headers = values[0];

  const headerMap = {};
  headers.forEach((h, i) => { headerMap[String(h).trim()] = i; });

  const keyIndex = headerMap[key];
  if (keyIndex === undefined) return false;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyIndex]).trim() === String(value).trim()) {
      const rowNumber = i + 1;
      const rowDataToUpdate = values[i]; // मौजूदा row का डेटा

      let isChanged = false;

      // 2. सेल-बाय-सेल शीट में जाने की बजाय, मेमोरी में ही डेटा बदलें
      for (const [colName, colValue] of Object.entries(updateData)) {
        const colIndex = headerMap[String(colName).trim()];
        if (colIndex !== undefined) {
          rowDataToUpdate[colIndex] = colValue;
          isChanged = true;
        }
      }

      // 3. पूरा बदला हुआ Row एक ही बार में शीट में डालें (One API Call = 10x Faster)
      if (isChanged) {
        sheet.getRange(rowNumber, 1, 1, rowDataToUpdate.length).setValues([rowDataToUpdate]);
        CacheService.getScriptCache().remove(sheetName); // सिर्फ कैश डिलीट करें
      }
      return true;
    }
  }
  return false;
}

// --- HELPER: CONVERT DURATION STRING TO MINUTES ---
function durationToMinutes(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;

  // Regex to extract hours and minutes safely
  const hoursMatch = durationStr.match(/(\d+)\s*h/i);
  const minutesMatch = durationStr.match(/(\d+)\s*m/i);

  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;

  return (hours * 60) + minutes;
}

function sendEmailNotification(recipientEmail, subject, htmlBody) { if (!recipientEmail) { Logger.log("Email not sent: recipient address is missing."); return; } try { MailApp.sendEmail({ to: recipientEmail, subject: subject, htmlBody: htmlBody }); Logger.log(`Email sent to ${recipientEmail} with subject "${subject}"`); } catch (e) { Logger.log(`Failed to send email to ${recipientEmail}: ${e.toString()}`); } }

// --- CORE APP SCRIPT & AUTHENTICATION ---
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle("Work_Track_System")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    // 🔥 YE LINE ADD KAREIN: Ye frame restrictions ko hata degi
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- CHAT FUNCTIONS ---
function getTaskMessages(taskId) {
  try {
    const messages = getSheetData(SHEET_NAMES.MESSAGES)
      .filter(m => m.TaskID == taskId)
      .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));

    return { success: true, messages: messages };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function postTaskMessage(taskId, messageText, employeeId) {
  try {
    // 🟢 सुरक्षा गेट: अटेंडेंस जांचें
    enforceAttendanceGate(employeeId);

    const user = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === employeeId);
    const senderName = user ? user['Employee Name'] : employeeId;

    const newMessage = {
      'MessageID': `MSG_${Date.now()}`,
      'TaskID': taskId,
      'Timestamp': new Date().toISOString(),
      'Sender': senderName,
      'Message': messageText
    };
    appendRowToSheet(SHEET_NAMES.MESSAGES, newMessage);

    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', taskId, {
      'HasUnreadMessages': true,
      'Last Update Date': new Date(),
      'Last Action By': senderName
    });

    // 🔔 TICKET CHAT BOX WHATSAPP ALERTS
    try {
      const ticketList = getSheetData(SHEET_NAMES.TICKETS);
      const ticketRow = ticketList.find(t => t['Ticket ID'] === taskId);

      if (ticketRow) {
        const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
        let recipientId = '';

        if (String(employeeId).trim() === String(ticketRow['Employee ID']).trim()) {
          recipientId = ticketRow['Creator ID'] || 'MS101';
        } else {
          recipientId = ticketRow['Employee ID'];
        }

        const recipientObj = allUsers.find(u => String(u['Employee ID']).trim() === String(recipientId).trim());

        if (recipientObj && recipientObj['Mobile Number'] && String(recipientId).trim() !== String(employeeId).trim()) {
          const clientName = ticketRow['Name'] || 'N/A';
          const msg = `💬 *NEW CHAT MESSAGE RECEIVED* 💬\n` +
            `---------------------------------\n` +
            `Hello *${recipientObj['Employee Name']}*,\n\n` +
            `You have received a new message regarding your active *Ticket ID: ${taskId}*:\n\n` +
            `🎫 *Ticket ID:* *${taskId}*\n` +
            `🏢 *Client Name:* *${clientName}*\n` +
            `👤 *Sender:* *${senderName}*\n` +
            `💬 *Message:* "${messageText}"\n\n` +
            `👉 Kripya work track panel me jaakar chat box check karein aur response dein.\n\n` +
            `~ Work Track System`;

          sendWhatsAppMessage(recipientObj['Mobile Number'], msg);
        }
      }
    } catch (err) {
      Logger.log("Chat WA Alert Error: " + err.toString());
    }

    return { success: true, message: newMessage };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function markTicketMessagesAsRead(ticketId) {
  try {
    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, { 'HasUnreadAdminMessages': false });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function reassignTicket(ticketId, reassignToId, reassignById, remarks) {
  try {
    enforceAttendanceGate(reassignById);

    // ... rest of the existing reassignTicket logic ...
    const ticketRow = getSheetData(SHEET_NAMES.TICKETS).find(t => t['Ticket ID'] === ticketId);
    if (!ticketRow) return { success: false, message: 'Ticket not found.' };

    const reassigningUser = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === reassignById);
    const reassignerName = reassigningUser ? reassigningUser['Employee Name'] : reassignById;

    // 1. History Sheet Entry
    logTicketHistory(ticketId, reassignerName, 'Reassignment', remarks, '');

    // 2. Main Sheet Update Object
    const update = {
      'Reassigned By': reassignById,
      'Last Action By': reassignerName,
      'Last Update Date': new Date()
    };

    const oldRemarks = ticketRow['Remarks'] ? ticketRow['Remarks'] + "\n" : "";
    update['Remarks'] = `${oldRemarks}[${new Date().toLocaleDateString()} Reassigned]: ${remarks}`;

    const fullDesc = String(ticketRow['Task Description'] || 'N/A');

    if (reassignToId === 'client') {
      update['Status'] = 'Pending Client Response';
      update['Reassigned To'] = 'Client';
      update['Help Person Name'] = 'Client';

      const client = getCachedSheetData(SHEET_NAMES.CLIENTS).find(c => c['Client_Id'] === ticketRow['Client_Id']);
      if (client && client['Mobile Number']) {
        const message = `🔔 *ACTION REQUIRED: CLIENT CLARIFICATION* 🔔\n` +
          `---------------------------------\n` +
          `Hello Valued Client,\n\n` +
          `We need some clarification regarding *Ticket ID: ${ticketId}* to proceed further.\n\n` +
          `🎫 *Ticket ID:* *${ticketId}*\n` +
          `📝 *Your Task:* ${fullDesc}\n` +
          `👤 *Sent By:* *${reassignerName}*\n\n` +
          `💬 *Clarification Needed:* *${remarks || 'Please review and respond.'}*\n\n` +
          `👉 Kindly open the portal or reply to provide details so we can continue our work quickly.\n\n` +
          `~ Work Track System`;
        sendWhatsAppMessage(client['Mobile Number'], message);
      }
    } else {
      const newUser = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === reassignToId);
      if (!newUser) return { success: false, message: 'User not found.' };

      update['Status'] = `Reassigned`;
      update['Reassigned To'] = reassignToId;
      update['Employee ID'] = reassignToId;
      update['Help Person Name'] = newUser['Employee Name'];

      if (newUser['Mobile Number']) {
        let creatorData = String(ticketRow['Source'] || ticketRow['Creator Name'] || ticketRow['Created By'] || '').toLowerCase();
        let isClientTicket = creatorData.includes('client');
        let assignerText = `👤 *Assigned By:* *${reassignerName}*`;

        if (isClientTicket) {
          assignerText = `👤 *Created By:* *Client*`;
        }

        const clientName = ticketRow['Name'] || ticketRow['Client Name'] || 'N/A';
        const priority = ticketRow['Priority'] || 'Normal';
        const planDateStr = ticketRow['Plan Date'] ? new Date(ticketRow['Plan Date']).toLocaleDateString('en-GB') : 'N/A';
        const tatVal = ticketRow['TAT'] ? `${ticketRow['TAT']} Mins` : 'N/A';

        const message = `🔄 *TICKET REASSIGNED ALERT* 🔄\n` +
          `---------------------------------\n` +
          `Hello *${newUser['Employee Name']}*,\n\n` +
          `A ticket has been reassigned to you. Please review the details:\n\n` +
          `🎫 *Ticket ID:* *${ticketId}*\n` +
          `🏢 *Client Name:* *${clientName}*\n` +
          `📂 *Priority:* *${priority}*\n` +
          `🎯 *Allocated TAT:* *${tatVal}*\n` +
          `📅 *Target / Plan Date:* *${planDateStr}*\n` +
          `📝 *Task Details:* ${fullDesc}\n\n` +
          `${assignerText}\n` +
          `💬 *Instructions/Remarks:* *${remarks || 'None'}*\n\n` +
          `👉 Portal open karein aur jaldi se kaam shuru karein!\n\n` +
          `~ Work Track System`;

        sendWhatsAppMessage(newUser['Mobile Number'], message);
      }
    }

    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, update);
    return { success: true, message: `Ticket ${ticketId} reassigned successfully.` };

  } catch (e) {
    return { success: false, message: e.message };
  }
}

// --- UPDATED CLIENT RESPONSE FUNCTION ---
function processClientResponse(ticketId, clientResponse, newPlanDate, attachment) {
  try {
    const ticketRow = getSheetData(SHEET_NAMES.TICKETS).find(t => t['Ticket ID'] === ticketId);
    if (!ticketRow) return { success: false, message: 'Ticket not found.' };

    const originalAssigneeId = ticketRow['Reassigned By'] || ticketRow['Employee ID']; // Fallback to current employee

    // 1. Attachment Save Logic
    let newAttachmentUrl = '';
    if (attachment) {
      newAttachmentUrl = saveBase64FileToDrive(attachment, 'TaskApp_Tickets_Client');
    }

    // 2. History Sheet mein Entry (Attachment yahan safe rahega)
    logTicketHistory(ticketId, 'Client', 'Client Response', clientResponse, newAttachmentUrl);

    // 3. Main Sheet Update
    const update = {
      'Status': 'Client Responded',
      'Employee ID': originalAssigneeId,
      'Last Action By': 'Client',
      'Last Update Date': new Date(),
      'Reassigned By': '',
      'Reassigned To': ''
    };

    // ❗ APPEND REMARKS
    const oldRemarks = ticketRow['Remarks'] ? ticketRow['Remarks'] + "\n" : "";
    update['Remarks'] = `${oldRemarks}[${new Date().toLocaleDateString()} Client]: ${clientResponse}`;

    // ❗ Closing Attachment Logic: 
    // Agar naya attachment aaya hai to update karo, nahi to purana rehne do
    // (Aur History sheet mein to save ho hi gaya hai)
    if (newAttachmentUrl) {
      update['Closing Attachment'] = newAttachmentUrl;
    }

    if (newPlanDate) {
      update['Plan Date'] = new Date(newPlanDate);
    }

    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, update);

    // Notify User / Assignment Owner
    const userToNotify = getCachedSheetData(SHEET_NAMES.USERS).find(u =>
      _safeText_(u['Employee ID']) === _safeText_(originalAssigneeId)
    );

    // processClientResponse फ़ंक्शन के अंदर WhatsApp नोटिफिकेशन भेजने वाली लॉजिक को इससे बदलें:
    if (userToNotify && userToNotify['Mobile Number']) {
      const fullDesc = String(ticketRow['Task Description'] || 'N/A');
      const clientName = ticketRow['Name'] || ticketRow['Client Name'] || 'N/A';
      const message =
        `✅ *NEW CLIENT RESPONSE RECEIVED* ✅\n` +
        `---------------------------------\n` +
        `Hello *${userToNotify['Employee Name']}*,\n\n` +
        `The client has provided clarification/response for your ticket:\n\n` +
        `🎫 *Ticket ID:* *${ticketId}*\n` +
        `🏢 *Client Name:* *${clientName}*\n` +
        `📝 *Original Task:* ${fullDesc}\n\n` +
        `💬 *Client's Response:* *${clientResponse}*\n\n` +
        `👉 Please check this response and resume your work immediately.\n\n` +
        `~ Work Track System`;

      sendWhatsAppMessage(userToNotify['Mobile Number'], message);
    }
    else {
      const ticketForReminder = {
        ...ticketRow,
        'Ticket ID': ticketId,
        'Name': ticketRow['Name'] || ticketRow['Client Name'] || 'N/A',
        'Task Category': ticketRow['Task Category'] || '-',
        'Task Description': ticketRow['Task Description'] || ticketRow['Description'] || clientResponse,
        'Priority': ticketRow['Priority'] || '-',
        'Employee ID': originalAssigneeId || ''
      };

      notifyTicketAssignmentOwner_(
        ticketForReminder,
        {
          ...ticketRow,
          Source: 'Client',
          'Creator Name': 'Client'
        },
        'Client responded but no valid user is assigned'
      );
    }
    return { success: true, message: 'Client response processed.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// 🟢 FIX 5: Multi-Day Leave को अलग-अलग Rows में स्प्लिट करना
function submitLeaveRequest(leaveData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.LEAVE_REQUESTS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());

    let startDate = new Date(leaveData['Start Date']);
    let endDate = new Date(leaveData['End Date']);

    // Half Day के केस में End Date = Start Date
    if (String(leaveData['Day Type']).includes('Half Day')) {
      endDate = new Date(startDate);
    }

    // Time reset करें ताकि loop सही चले
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    let rowsToAppend = [];
    let currentDate = new Date(startDate);
    let timeStamp = new Date();

    // Start Date से लेकर End Date तक लूप चलाएँ
    while (currentDate <= endDate) {
      // हर दिन के लिए अलग यूनिक ID
      const uniqueId = 'LEAVE_' + Utilities.formatDate(timeStamp, "IST", "yyyyMMddHHmmss") + '_' + Math.floor(Math.random() * 1000);
      const rowDate = new Date(currentDate);

      const dataMap = {
        'Leave ID': uniqueId,
        'Timestamp': timeStamp,
        'Employee ID': leaveData['Employee ID'],
        'Employee Name': leaveData['Employee Name'],
        'Leave Type': leaveData['Leave Type'],
        'Day Type': leaveData['Day Type'],
        'Start Date': rowDate, // यहाँ Start Date उस दिन की तारीख होगी
        'End Date': rowDate,   // End Date भी उसी दिन की तारीख होगी
        'Reason': leaveData['Reason'],
        'Status': 'Pending',
        'Admin Remarks': ''
      };

      // Headers के हिसाब से Array बनाएँ
      const newRow = headers.map(header => {
        return dataMap.hasOwnProperty(header) ? dataMap[header] : '';
      });

      rowsToAppend.push(newRow);

      // तारीख में 1 दिन जोड़ें (Next Day)
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // अगर डेटा है तो शीट में एक साथ सेट करें (ये appendRow से ज्यादा फ़ास्ट है)
    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }
    // 🟢 🔔 NOTIFY HR NIHA (NA105) & ALL ACTIVE SUPER ADMINS ON LEAVE SUBMISSION
    try {
      const allUsers = getCachedSheetData(SHEET_NAMES.USERS);

      // 1. HR Niha को ढूंढें
      const hrNiha = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === 'NA105');

      // 2. सभी एक्टिव Super Admins को ढूंढें
      const superAdmins = allUsers.filter(u =>
        String(u['Role']).trim().toLowerCase() === 'super admin' &&
        String(u['Status']).trim().toLowerCase() === 'active'
      );

      // 3. प्राप्तकर्ताओं (Recipients) की लिस्ट बनाएं
      const recipients = [];
      if (hrNiha && hrNiha['Mobile Number'] && String(hrNiha['Mobile Number']).trim() !== '') {
        recipients.push({ name: hrNiha['Employee Name'], mobile: String(hrNiha['Mobile Number']).trim() });
      }

      superAdmins.forEach(sa => {
        const saMobile = String(sa['Mobile Number'] || '').trim();
        const saId = String(sa['Employee ID']).trim().toUpperCase();
        // Niha को डुप्लीकेट मैसेज न जाए, इसलिए यह चेक लगाया गया है
        if (saMobile !== '' && saId !== 'NA105') {
          recipients.push({ name: sa['Employee Name'], mobile: saMobile });
        }
      });

      // 4. तारीखों को सुंदर फॉर्मेट में बदलें
      const sDateStr = leaveData['Start Date'] ? new Date(leaveData['Start Date']).toLocaleDateString('en-GB') : 'N/A';
      const eDateStr = leaveData['End Date'] ? new Date(leaveData['End Date']).toLocaleDateString('en-GB') : 'N/A';

      // 5. सभी प्राप्तकर्ताओं को मैसेज भेजें
      recipients.forEach(rec => {
        const msg = `⏳ *NEW LEAVE REQUEST SUBMITTED* ⏳\n` +
          `---------------------------------\n` +
          `Hello *${rec.name}*,\n\n` +
          `A new Leave request has been submitted and is waiting for your approval:\n\n` +
          `👤 *Employee Name:* *${leaveData['Employee Name']}* (${leaveData['Employee ID']})\n` +
          `📌 *Leave Type:* *${leaveData['Leave Type']}*\n` +
          `📅 *Duration:* *${sDateStr}* to *${eDateStr}* (${leaveData['Day Type']})\n` +
          `📝 *Reason:* ${leaveData['Reason']}\n\n` +
          `👉 Please check your pending approvals dashboard to review and approve/reject this request.\n\n` +
          `~ Work Track System`;
        sendWhatsAppMessage(rec.mobile, msg);
      });
    } catch (err) {
      Logger.log("Leave WA Notify Error: " + err.toString());
    }

    return { success: true, message: `Leave request for ${rowsToAppend.length} day(s) submitted successfully.` };
  } catch (e) {
    Logger.log("Leave Submit Error: " + e.toString());
    return { success: false, message: "Error: " + e.message };
  }
}

function submitIntimation(intimationData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.INTIMATIONS);

    const uniqueId = 'INT_' + Utilities.formatDate(new Date(), "IST", "yyyyMMddHHmmss");
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = new Array(headers.length).fill('');

    const dataMap = {
      'Intimation ID': uniqueId,
      'Timestamp': new Date(),
      'Employee ID': intimationData['Employee ID'],
      'Employee Name': intimationData['Employee Name'],
      'Intimation Date': new Date(intimationData['Intimation Date']),
      'Intimation Type': intimationData['Intimation Type'],
      'Reason': intimationData['Reason'],
      'Status': 'Submitted',
      'Admin Remarks': ''
    };

    headers.forEach((header, index) => {
      const cleanHeader = String(header).trim();
      if (dataMap.hasOwnProperty(cleanHeader)) {
        newRow[index] = dataMap[cleanHeader];
      }
    });

    // Sirf ek baar append karein
    sheet.appendRow(newRow);

    // NOTIFY HR & SUPER ADMINS ON WORK INTIMATION
    try {
      const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
      const hrNiha = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === 'NA105');
      const superAdmins = allUsers.filter(u =>
        String(u['Role']).trim().toLowerCase() === 'super admin' &&
        String(u['Status']).trim().toLowerCase() === 'active'
      );

      const recipients = [];
      if (hrNiha && hrNiha['Mobile Number'] && String(hrNiha['Mobile Number']).trim() !== '') {
        recipients.push({ name: hrNiha['Employee Name'], mobile: String(hrNiha['Mobile Number']).trim() });
      }

      superAdmins.forEach(sa => {
        const saMobile = String(sa['Mobile Number'] || '').trim();
        const saId = String(sa['Employee ID']).trim().toUpperCase();
        if (saMobile !== '' && saId !== 'NA105') {
          recipients.push({ name: sa['Employee Name'], mobile: saMobile });
        }
      });

      const dateStr = intimationData['Intimation Date'] ? new Date(intimationData['Intimation Date']).toLocaleDateString('en-GB') : 'N/A';

      recipients.forEach(rec => {
        const msg = `📢 *NEW WORK INTIMATION SUBMITTED* 📢\n` +
          `---------------------------------\n` +
          `Hello *${rec.name}*,\n\n` +
          `An employee has submitted a new Work Intimation:\n\n` +
          `👤 *Employee Name:* *${intimationData['Employee Name']}* (${intimationData['Employee ID']})\n` +
          `📌 *Intimation Type:* *${intimationData['Intimation Type']}*\n` +
          `📅 *Date:* *${dateStr}*\n` +
          `📝 *Details/Reason:* ${intimationData['Reason']}\n\n` +
          `👉 Please review the details in your admin panel.\n\n` +
          `~ Work Track System`;
        sendWhatsAppMessage(rec.mobile, msg);
      });
    } catch (err) {
      Logger.log("Intimation WA Notify Error: " + err.toString());
    }

    return { success: true, message: "Intimation submitted successfully." };

  } catch (e) {
    Logger.log("Intimation Submit Error: " + e.toString());
    return { success: false, message: "Error: " + e.message };
  }
}
function processAdminAction(data) {
  try {
    const { adminId, type, id, action, remarks, newPunchIn, newPunchOut } = data;

    enforceAttendanceGate(adminId);

    const admin = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === adminId);
    const role = admin ? String(admin.Role).trim() : '';

    if (!admin || !['Admin', 'Super Admin', 'HR', 'Manager'].includes(role)) {
      return { success: false, message: 'Unauthorized: Admin/HR access required.' };
    }

    // 🟢 Strict Security Check: NL106, S103, AS101 are barred from Attendance/Leaves/Intimations actions
    const restrictedSuperAdmins = ['NL106', 'S103', 'AS101'];
    if (restrictedSuperAdmins.includes(String(adminId).trim().toUpperCase())) {
      return { success: false, message: 'Access Denied: You do not have permission to approve attendance, leaves, or intimations.' };
    }

    // 🟢 HR 2-STEP APPROVAL LOGIC (Status updated for Rejection as well)
    let actualAction = action;
    let attendanceStatus = action === 'Approved' ? 'Present' : 'Rejected';

    if (action === 'Approved' && role === 'HR') {
      actualAction = 'HR Approved';
      attendanceStatus = 'HR Approved';
    }

    // --- ATTENDANCE LOGIC ---
    if (type === 'Attendance') {
      const sheet = getSheet(SHEET_NAMES.ATTENDANCE);
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      if (lastRow < 2) return { success: false, message: 'No records found.' };

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

      const dateIdx = headers.indexOf('Date');
      const timeIdx = headers.indexOf('Time');
      const empIdIdx = headers.indexOf('Employee ID');
      const empNameIdx = headers.indexOf('Employee Name');
      const actionIdx = headers.indexOf('Action');
      const photoIdx = headers.indexOf('Photo Url');
      const latIdx = headers.indexOf('Lattitude');
      const longIdx = headers.indexOf('Longitude');
      const durationIdx = headers.indexOf('Total Working Hours');
      const statusIdx = headers.indexOf('Status');
      const adminApprovalIdx = headers.indexOf('Admin Approval');
      const adminRemarksIdx = headers.indexOf('Admin Remarks');

      const TIME_FORMAT = "M/d/yyyy H:mm:ss";

      const [targetEmpId, targetDateStr] = id.split('|');
      const dataValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      let punchInRowIndex = -1;
      let punchOutRowIndex = -1;
      let empName = '';
      let punchInTimeObj = null;
      let punchOutTimeObj = null;

      let existingPhoto = '';
      let existingLat = '';
      let existingLong = '';

      // 🟢 SAFE DATE PARSER
      const safeParseDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        let d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        let parts = String(val).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (parts) {
          let y = parseInt(parts[3], 10);
          if (y < 100) y += 2000;
          return new Date(y, parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
        }
        return null;
      };

      for (let i = 0; i < dataValues.length; i++) {
        // Space & Case insensitive matching
        const rowEmpId = String(dataValues[i][empIdIdx]).trim().toLowerCase();
        const searchEmpId = String(targetEmpId).trim().toLowerCase();

        let rowDateObj = safeParseDate(dataValues[i][dateIdx]);
        let rowDateStr = rowDateObj ? Utilities.formatDate(rowDateObj, "IST", "yyyy-MM-dd") : '';

        if (rowEmpId === searchEmpId && rowDateStr === targetDateStr) {
          if (!empName) empName = dataValues[i][empNameIdx];

          if (dataValues[i][photoIdx]) existingPhoto = dataValues[i][photoIdx];
          if (dataValues[i][latIdx]) existingLat = dataValues[i][latIdx];
          if (dataValues[i][longIdx]) existingLong = dataValues[i][longIdx];

          const rowAction = String(dataValues[i][actionIdx]).trim();

          if (rowAction === 'Punch In') {
            punchInRowIndex = i + 2;
            punchInTimeObj = safeParseDate(dataValues[i][timeIdx]);
          }
          else if (rowAction === 'Punch Out') {
            punchOutRowIndex = i + 2;
            punchOutTimeObj = safeParseDate(dataValues[i][timeIdx]);
          }
        }
      }

      if (punchInRowIndex === -1 && punchOutRowIndex === -1) {
        return { success: false, message: 'Error: Could not match attendance date in database. Format mismatch.' };
      }

      if (!empName) {
        const userRec = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === targetEmpId);
        empName = userRec ? userRec['Employee Name'] : targetEmpId;
      }

      let finalPunchInTime = punchInTimeObj;
      let finalPunchOutTime = punchOutTimeObj;

      if (newPunchIn) {
        let timePartsIn = newPunchIn.split(':');
        finalPunchInTime = new Date(targetDateStr);
        finalPunchInTime.setHours(parseInt(timePartsIn[0], 10), parseInt(timePartsIn[1], 10), 0, 0);
      }
      if (newPunchOut) {
        let timePartsOut = newPunchOut.split(':');
        finalPunchOutTime = new Date(targetDateStr);
        finalPunchOutTime.setHours(parseInt(timePartsOut[0], 10), parseInt(timePartsOut[1], 10), 0, 0);
      }

      let durationStr = '';
      if (finalPunchInTime && finalPunchOutTime) {
        const diffMs = finalPunchOutTime - finalPunchInTime;
        if (diffMs > 0) {
          const h = Math.floor(diffMs / (1000 * 60 * 60));
          const m = Math.floor((diffMs / (1000 * 60)) % 60);
          durationStr = `${h}h ${m}m`;
        }
      }

      // 🟢 Data Updating (Status will change to 'Rejected' if rejected, effectively removing it)
      if (finalPunchInTime) {
        if (punchInRowIndex !== -1) {
          sheet.getRange(punchInRowIndex, timeIdx + 1).setValue(finalPunchInTime).setNumberFormat(TIME_FORMAT);
          sheet.getRange(punchInRowIndex, dateIdx + 1).setValue(finalPunchInTime).setNumberFormat(TIME_FORMAT);
          sheet.getRange(punchInRowIndex, statusIdx + 1).setValue(attendanceStatus);
          sheet.getRange(punchInRowIndex, adminApprovalIdx + 1).setValue(actualAction);
          if (remarks) sheet.getRange(punchInRowIndex, adminRemarksIdx + 1).setValue(remarks);
        } else if (newPunchIn) {
          const newRow = createNewAttendanceRow(finalPunchInTime, targetEmpId, empName, 'Punch In', attendanceStatus, '', existingPhoto, existingLat, existingLong, remarks);
          appendRowToSheet(SHEET_NAMES.ATTENDANCE, newRow);
          const newRowIdx = sheet.getLastRow();
          sheet.getRange(newRowIdx, dateIdx + 1).setNumberFormat(TIME_FORMAT);
          sheet.getRange(newRowIdx, timeIdx + 1).setNumberFormat(TIME_FORMAT);
          sheet.getRange(newRowIdx, adminApprovalIdx + 1).setValue(actualAction);
        }
      } else if (punchInRowIndex !== -1) {
        sheet.getRange(punchInRowIndex, statusIdx + 1).setValue(attendanceStatus);
        sheet.getRange(punchInRowIndex, adminApprovalIdx + 1).setValue(actualAction);
      }

      if (finalPunchOutTime) {
        if (punchOutRowIndex !== -1) {
          sheet.getRange(punchOutRowIndex, timeIdx + 1).setValue(finalPunchOutTime).setNumberFormat(TIME_FORMAT);
          sheet.getRange(punchOutRowIndex, dateIdx + 1).setValue(finalPunchOutTime).setNumberFormat(TIME_FORMAT);
          sheet.getRange(punchOutRowIndex, durationIdx + 1).setValue(durationStr);
          sheet.getRange(punchOutRowIndex, statusIdx + 1).setValue(attendanceStatus);
          sheet.getRange(punchOutRowIndex, adminApprovalIdx + 1).setValue(actualAction);
          if (remarks) sheet.getRange(punchOutRowIndex, adminRemarksIdx + 1).setValue(remarks);
        } else if (newPunchOut) {
          const newRow = createNewAttendanceRow(finalPunchOutTime, targetEmpId, empName, 'Punch Out', attendanceStatus, durationStr, existingPhoto, existingLat, existingLong, remarks);
          appendRowToSheet(SHEET_NAMES.ATTENDANCE, newRow);
          const newRowIdx = sheet.getLastRow();
          sheet.getRange(newRowIdx, dateIdx + 1).setNumberFormat(TIME_FORMAT);
          sheet.getRange(newRowIdx, timeIdx + 1).setNumberFormat(TIME_FORMAT);
          sheet.getRange(newRowIdx, adminApprovalIdx + 1).setValue(actualAction);
        }
      } else if (punchOutRowIndex !== -1) {
        sheet.getRange(punchOutRowIndex, statusIdx + 1).setValue(attendanceStatus);
        sheet.getRange(punchOutRowIndex, adminApprovalIdx + 1).setValue(actualAction);
      }

      // 🟢 VITAL FIX: Clear the cache so it doesn't reappear on refresh!
      CacheService.getScriptCache().remove(SHEET_NAMES.ATTENDANCE);

      return { success: true, message: `Attendance ${actualAction} successfully.` };

    }
    // --- LEAVE / INTIMATION LOGIC (WITH INSTANT EMPLOYEE WHATSAPP ALERT) ---
    else {
      let sheetName, idColumn;
      if (type === 'Leave') {
        sheetName = SHEET_NAMES.LEAVE_REQUESTS;
        idColumn = 'Leave ID';
      } else {
        sheetName = SHEET_NAMES.INTIMATIONS;
        idColumn = 'Intimation ID';
      }

      // डेटाबेस से एम्प्लॉई की जानकारी निकालें
      const records = getSheetData(sheetName);
      const targetRecord = records.find(r => r[idColumn] === id);

      const success = updateRowInSheet(sheetName, idColumn, id, { 'Status': actualAction, 'Admin Remarks': remarks || '' });

      if (success && targetRecord) {
        const empId = targetRecord['Employee ID'];
        const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
        const employeeObj = allUsers.find(u => u['Employee ID'] === empId);

        if (employeeObj && employeeObj['Mobile Number']) {
          // Check karein ki action Approved ya HR Approved mein se koi ek hai ya nahi
          const isApproved = (actualAction === 'Approved' || actualAction === 'HR Approved');
          let emoji = isApproved ? '✅' : '❌';
          let statusLabel = isApproved ? 'APPROVED' : 'REJECTED';
          let dateStr = type === 'Leave' ?
            (targetRecord['Start Date'] ? new Date(targetRecord['Start Date']).toLocaleDateString('en-GB') : 'N/A') :
            (targetRecord['Intimation Date'] ? new Date(targetRecord['Intimation Date']).toLocaleDateString('en-GB') : 'N/A');

          let subType = type === 'Leave' ? targetRecord['Leave Type'] : targetRecord['Intimation Type'];
          let reason = targetRecord['Reason'] || 'N/A';

          const msg = `${emoji} *YOUR ${type.toUpperCase()} REQUEST HAS BEEN ${statusLabel}* ${emoji}\n` +
            `---------------------------------\n` +
            `Hello *${employeeObj['Employee Name']}*,\n\n` +
            `Your applied ${type} request has been reviewed by the Admin/HR:\n\n` +
            `📌 *Request Type:* *${subType}*\n` +
            `📅 *Date:* *${dateStr}*\n` +
            `📝 *Your Reason:* ${reason}\n\n` +
            `⚙️ *Action Status:* *${statusLabel}*\n` +
            `💬 *Admin Remarks/Feedback:* *${remarks || 'Processed.'}*\n\n` +
            `~ Work Track System`;
          sendWhatsAppMessage(employeeObj['Mobile Number'], msg);
        }
      }
      return success ? { success: true, message: `${type} request ${actualAction}.` } : { success: false, message: "Update failed." };
    }
  } catch (e) {
    Logger.log("processAdminAction Error: " + e.toString());
    return { success: false, message: e.message };
  }
}

// --- UPDATED HELPER FUNCTION (Arguments Fixed for Alignment) ---
function createNewAttendanceRow(timeObj, empId, empName, action, status, duration, photo, lat, long, remarks) {
  // Google Sheets mein Date aur Time aksar same object se format hote hain
  // Isliye hum dono mein 'timeObj' use kar rahe hain
  return {
    'Date': timeObj,
    'Time': timeObj,
    'Employee ID': empId,
    'Employee Name': empName,
    'Action': action,
    'Photo Url': photo || '',
    'Lattitude': lat || '',
    'Longitude': long || '',
    'Total Working Hours': duration || '',
    'Status': status,
    'Admin Approval': 'Approved',
    'Admin Remarks': remarks || ''
  };
}

// --- BACKEND: UPDATE THIS FUNCTION IN Code.gs ---
function getUserRequestStatus(employeeId) {
  try {
    const leaves = getSheetData(SHEET_NAMES.LEAVE_REQUESTS).filter(l => l['Employee ID'] === employeeId);
    const intimations = getSheetData(SHEET_NAMES.INTIMATIONS).filter(i => i['Employee ID'] === employeeId);

    // Attendance Pending logic
    const attPending = getSheetData(SHEET_NAMES.ATTENDANCE)
      .filter(a => a['Employee ID'] === employeeId && (a['Status'] === 'Need Approval' || a['Status'] === 'Pending'))
      .map(a => ({
        Type: 'Attendance',
        SubType: a.Action,
        Date: new Date(a.Date).toLocaleDateString(),
        Reason: 'Punch Approval',
        Status: a['Admin Approval'] || 'Pending',
        Remarks: a['Admin Remarks'] || '-'
      }));

    // 🟢 NEW: Tickets Status Logic (Jo approval ke liye gayi hain ya reject hui hain)
    const tickets = getSheetData(SHEET_NAMES.TICKETS)
      .filter(t => t['Employee ID'] === employeeId && ['Pending Approval', 'Rework', 'Closed'].includes(t.Status));

    const ticketHistory = tickets.map(t => {
      // Extract latest remark logic
      let latestRemark = t.Remarks || '-';
      return {
        Type: 'Ticket',
        SubType: t['Task Category'],
        Date: t['Plan Date'] ? new Date(t['Plan Date']).toLocaleDateString('en-GB') : '-',
        Reason: t['Task Description'],
        Status: t.Status,
        Remarks: latestRemark
      };
    });

    // Combine all history
    const history = [
      ...leaves.map(l => ({ Type: 'Leave', SubType: l['Leave Type'], Date: new Date(l['Start Date']).toLocaleDateString(), Reason: l['Reason'], Status: l['Status'], Remarks: l['Admin Remarks'] || '-' })),
      ...intimations.map(i => ({ Type: 'Intimation', SubType: i['Intimation Type'], Date: new Date(i['Intimation Date']).toLocaleDateString(), Reason: i['Reason'], Status: i['Status'], Remarks: i['Admin Remarks'] || '-' })),
      ...attPending,
      ...ticketHistory // 🟢 Tickets added here
    ];

    // Sort by latest first
    return { success: true, data: history.reverse() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function recordAttendance(attendanceData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.ATTENDANCE);

    const now = new Date();
    const fullTimeStamp = Utilities.formatDate(now, "IST", "M/d/yyyy HH:mm:ss");
    const todayDateStr = Utilities.formatDate(now, "IST", "yyyy-MM-dd");

    // Employee ID को मानकीकृत (Standardize) करें
    const empIdClean = String(attendanceData['Employee ID'] || '').trim();
    const searchId = empIdClean.toUpperCase();

    if (!searchId) {
      return { success: false, message: "Security Error: Employee ID missing hai." };
    }

    // 1. फ़ोटो की मौजूदगी जाँचना
    if (!attendanceData.Photo) {
      return { success: false, message: "Security Error: Bina photo capture kiye punch submit nahi kiya ja sakta." };
    }

    // 2. सटीक लोकेशन जाँचना
    if (!attendanceData.Lattitude || !attendanceData.Longitude || String(attendanceData.Lattitude).trim() === '' || String(attendanceData.Longitude).trim() === '') {
      return { success: false, message: "Security Error: Real-time active GPS coordinates prapt nahi hue." };
    }

    // Photo processing
    let photoUrl = '';
    if (attendanceData.Photo) {
      photoUrl = saveBase64FileToDrive(attendanceData.Photo, 'TaskApp_Attendance');
    }

    const lastRow = sheet.getLastRow();
    let lastAction = null;
    let lastInTimeObj = null;
    let lastActionDateStr = "";

    // एम्प्लोयी का हालिया स्टेटस शीट से ढूंढना
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues(); // Columns A to L
      let latestTimestampMs = 0; // वास्तविक क्रोनोलॉजिकल समय ट्रैक करने के लिए वेरिएबल

      // SAFE DATE PARSER (तारीख पार्स करने के लिए सहायक फंक्शन)
      const safeParseDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        let d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        let parts = String(val).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (parts) {
          let y = parseInt(parts[3], 10);
          if (y < 100) y += 2000;
          return new Date(y, parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
        }
        return null;
      };

      // पूरी शीट का विश्लेषण कर क्रोनोलॉजिकल रूप से वास्तविक नवीनतम रिकॉर्ड का पता लगाएं
      for (let i = 0; i < data.length; i++) {
        const rowEmpId = String(data[i][2] || '').trim().toUpperCase();

        if (rowEmpId === searchId) {
          let rowDateVal = data[i][0]; // Column A: Date
          let rowDateObj = safeParseDate(rowDateVal);

          if (rowDateObj) {
            let rowTimeMs = rowDateObj.getTime();

            // 🟢 यदि यह रिकॉर्ड पिछली बार मिले रिकॉर्ड से नया है, तो इसे ही नवीनतम मानें
            if (rowTimeMs >= latestTimestampMs) {
              latestTimestampMs = rowTimeMs;
              lastAction = String(data[i][4] || '').trim(); // "Punch In" या "Punch Out"
              lastActionDateStr = Utilities.formatDate(rowDateObj, "IST", "yyyy-MM-dd");

              if (lastAction.toLowerCase() === 'punch in') {
                let val = data[i][1]; // Column B: Time
                if (val instanceof Date) {
                  lastInTimeObj = val;
                } else if (typeof val === 'string') {
                  lastInTimeObj = new Date(val);
                  if (isNaN(lastInTimeObj.getTime())) {
                    let datePart = Utilities.formatDate(now, "IST", "M/d/yyyy");
                    lastInTimeObj = new Date(datePart + " " + val);
                  }
                }
              } else {
                lastInTimeObj = null; // यदि अंतिम क्रिया Punch Out थी, तो पुराना InTime हटा दें
              }
            }
          }
        }
      }
    }

    // --- PUNCH IN LOGIC ---
    if (attendanceData.Action === 'Punch In') {
      const lastActionLower = lastAction ? lastAction.toLowerCase() : "";

      if (lastActionLower === 'punch in' && lastActionDateStr === todayDateStr) {
        return { success: false, message: "Aap aaj pehle hi Punch In kar chuke hain." };
      }
      if (lastActionLower === 'punch out' && lastActionDateStr === todayDateStr) {
        return { success: false, message: "Aap aaj ka attendance cycle (Punch In & Out) pura kar chuke hain." };
      }

      const rowData = [
        fullTimeStamp,
        fullTimeStamp,
        empIdClean,
        attendanceData['Employee Name'],
        'Punch In',
        photoUrl,
        attendanceData.Lattitude,
        attendanceData.Longitude,
        '',
        'Need Approval',
        'Pending',
        ''
      ];

      sheet.appendRow(rowData);
      return { success: true, message: "Punch In Submitted (Waiting for Approval)." };
    }
    // --- PUNCH OUT LOGIC ---
    else if (attendanceData.Action === 'Punch Out') {
      const lastActionLower = lastAction ? lastAction.toLowerCase() : "";

      // सुरक्षा जांच: क्रोनोलॉजिकल चेक के कारण अब यह हमेशा सही नवीनतम इन-स्टेटस ढूंढेगा
      if (!lastAction || lastActionLower !== 'punch in') {
        return { success: false, message: "Pehle Punch In karein! Aap bina Punch In kiye Punch Out nahi kar sakte." };
      }

      // Duration Calculation
      let totalDuration = "0h 0m";
      if (lastInTimeObj && !isNaN(lastInTimeObj.getTime())) {
        const diffMs = now.getTime() - lastInTimeObj.getTime();
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
          totalDuration = `${hours}h ${minutes}m`;
        }
      }

      const rowData = [
        fullTimeStamp,
        fullTimeStamp,
        empIdClean,
        attendanceData['Employee Name'],
        'Punch Out',
        photoUrl,
        attendanceData.Lattitude,
        attendanceData.Longitude,
        totalDuration,
        'Need Approval',
        'Pending',
        ''
      ];

      sheet.appendRow(rowData);
      return { success: true, message: `Punch Out Submitted. Duration: ${totalDuration}` };
    }

  } catch (e) {
    Logger.log("recordAttendance error: " + e.toString());
    return { success: false, message: e.message };
  }
}

function recordExpense(expenseData) {
  try {
    // 🟢 सुरक्षा गेट: अटेंडेंस जांचें
    enforceAttendanceGate(expenseData['Employee ID']);

    const uniquePart = Utilities.formatDate(new Date(), "IST", "yyMMddHHmmssS") + Math.floor(Math.random() * 100);
    const expenseId = `EXP_${uniquePart}`;
    let receiptUrl = expenseData.Receipt ? saveBase64FileToDrive(expenseData.Receipt, 'TaskApp_Expenses') : '';
    const newExpense = {
      'Date': new Date(expenseData.Date),
      'Expense ID': expenseId,
      'Employee ID': expenseData['Employee ID'],
      'Employee Name': expenseData['Employee Name'],
      'Type': expenseData.Type,
      'Amount': expenseData.Amount,
      'Description': expenseData.Description,
      'Receipt URL': receiptUrl,
      'Status': 'Pending'
    };
    appendRowToSheet(SHEET_NAMES.EXPENSES, newExpense);

    // 🔔 NOTIFY HR NIHA & SUPER ADMINS ON NEW EXPENSE CLAIM
    try {
      const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
      const hrNiha = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === 'NA105');
      const superAdmins = allUsers.filter(u =>
        String(u['Role']).trim().toLowerCase() === 'super admin' &&
        String(u['Status']).trim().toLowerCase() === 'active'
      );

      const recipients = [];
      if (hrNiha && hrNiha['Mobile Number'] && String(hrNiha['Mobile Number']).trim() !== '') {
        recipients.push({ name: hrNiha['Employee Name'], mobile: String(hrNiha['Mobile Number']).trim() });
      }

      superAdmins.forEach(sa => {
        const saMobile = String(sa['Mobile Number'] || '').trim();
        const saId = String(sa['Employee ID']).trim().toUpperCase();
        if (saMobile !== '' && saId !== 'NA105') {
          recipients.push({ name: sa['Employee Name'], mobile: saMobile });
        }
      });

      recipients.forEach(rec => {
        const msg = `💰 *NEW EXPENSE CLAIM SUBMITTED* 💰\n` +
          `---------------------------------\n` +
          `Hello *${rec.name}*,\n\n` +
          `A new expense claim has been filed and requires your verification:\n\n` +
          `👤 *Claimed By:* *${expenseData['Employee Name']}* (${expenseData['Employee ID']})\n` +
          `📌 *Expense Type:* *${expenseData.Type}*\n` +
          `💵 *Amount:* *₹${parseFloat(expenseData.Amount).toFixed(2)}*\n` +
          `📝 *Description:* ${expenseData.Description}\n\n` +
          `👉 Please review this claim in your admin panel.\n\n` +
          `~ Work Track System`;
        sendWhatsAppMessage(rec.mobile, msg);
      });
    } catch (err) {
      Logger.log("Expense Notify Error: " + err.toString());
    }

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getExpensesForUser(employeeId) { try { const expenses = getSheetData(SHEET_NAMES.EXPENSES).filter(e => e['Employee ID'] === employeeId); return { success: true, data: expenses }; } catch (e) { return { success: false, message: e.message }; } }

// --- UPDATED getAttendanceForUser FUNCTION ---
function getAttendanceForUser(employeeId, startDate, endDate) {
  try {
    // 🟢 FIXED: Secure and robust filtering for attendance, leaves, and intimations
    const cleanEmpId = String(employeeId || '').trim().toUpperCase();

    const punchData = getSheetData(SHEET_NAMES.ATTENDANCE).filter(a =>
      String(a['Employee ID'] || '').trim().toUpperCase() === cleanEmpId
    );
    const leaveData = getSheetData(SHEET_NAMES.LEAVE_REQUESTS).filter(l =>
      String(l['Employee ID'] || '').trim().toUpperCase() === cleanEmpId
    );
    const intimationData = getSheetData(SHEET_NAMES.INTIMATIONS).filter(i =>
      String(i['Employee ID'] || '').trim().toUpperCase() === cleanEmpId
    );
    const combinedData = [
      ...punchData.map(p => ({
        'Date': p.Date,
        'Time': p.Time,
        'Action': p.Action,
        'Lattitude': p['Lattitude'],
        'Longitude': p['Longitude'],
        'Photo Url': p['Photo Url'],
        'Status': p.Status || 'Approved'
      })),
      ...leaveData.map(l => ({
        'Date': l['Start Date'],
        'Time': '',
        'Action': `Leave: ${l['Leave Type']}`,
        'Details': l['Reason'],
        'Status': l['Status']
      })),
      ...intimationData.map(i => ({
        'Date': i['Intimation Date'],
        'Time': '',
        'Action': `Intimation: ${i['Intimation Type']}`,
        'Details': i['Reason'],
        'Status': i['Status']
      }))
    ];

    // --- ROBUST DATE PARSING FUNCTION ---
    const parseDateSafe = (dateStr) => {
      if (!dateStr) return 0;
      if (dateStr instanceof Date) return dateStr.getTime();

      // Agar date string hai, to check karein
      const str = String(dateStr).trim();

      // Try standard parsing first
      let d = new Date(str);
      if (!isNaN(d.getTime())) return d.getTime();

      // Agar fail hua, to manual parsing (Assume DD/MM/YYYY or DD-MM-YYYY)
      // Example: 21/01/2026
      const parts = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (parts) {
        // parts[1] = Day, parts[2] = Month, parts[3] = Year
        d = new Date(parts[3], parts[2] - 1, parts[1]); // Month is 0-indexed
        return d.getTime();
      }

      return 0; // Agar ab bhi parse na ho
    };

    let filteredData = combinedData;

    // Filter by Date Range
    if (startDate && endDate) {
      // Inputs usually YYYY-MM-DD from HTML input type="date"
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      filteredData = combinedData.filter(item => {
        const itemTime = parseDateSafe(item.Date);
        return itemTime >= start.getTime() && itemTime <= end.getTime();
      });
    }

    // Sort Descending (Newest First)
    filteredData.sort((a, b) => {
      const timeA = parseDateSafe(a.Date);
      const timeB = parseDateSafe(b.Date);
      return timeB - timeA;
    });

    return { success: true, data: filteredData };
  } catch (e) {
    Logger.log("getAttendanceForUser mein error: " + e.toString());
    return { success: false, message: e.message };
  }
}

function createTicketInSheet(ticketData) {
  try {
    // Enforce attendance gate for app-created tickets
    if (ticketData['Source'] !== 'Client' && ticketData['Creator ID'] && ticketData['Creator ID'] !== 'Client') {
      enforceAttendanceGate(ticketData['Creator ID']);
    }

    // ... rest of the existing createTicketInSheet logic ...
    const uniquePart = Utilities.formatDate(new Date(), "IST", "yyMMddHHmmssS") + Math.floor(Math.random() * 100);
    const ticketId = `TICKET_${uniquePart}`;
    const client = getCachedSheetData(SHEET_NAMES.CLIENTS).find(c => c['Client_Id'] == ticketData['Client_Id']);
    let attachmentUrl = '';
    if (ticketData.Attachment) {
      attachmentUrl = saveBase64FileToDrive(ticketData.Attachment, 'TaskApp_Tickets');
    }

    let assignedEmpId = ticketData['Employee ID'] || '';
    if (String(assignedEmpId).trim() === '') {
      assignedEmpId = 'MS101';
    }

    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const assignedUser = allUsers.find(u => String(u['Employee ID']).trim() === String(assignedEmpId).trim());
    const empName = assignedUser ? assignedUser['Employee Name'] : '';

    const newTicket = {
      'Timestamp': new Date(),
      'Ticket ID': ticketId,
      'Client_Id': ticketData['Client_Id'],
      'Name': client ? client['Client Name'] : 'N/A',
      'Task Category': ticketData['Task Category'],
      'Task Description': ticketData['Description'],
      'Attachment': attachmentUrl,
      'Priority': ticketData['Priority'],
      'Plan Date': ticketData['Plan Date'] ? new Date(ticketData['Plan Date']) : '',
      'Status': 'Open',
      'Employee ID': assignedEmpId,
      'Help Person Name': empName,
      'TAT': ticketData.TAT || '',
      'Last Update Date': new Date(),
      'Creator ID': ticketData['Creator ID'] || 'Client',
      'Creator Name': ticketData['Creator Name'] || 'Client',
      'Source': ticketData['Source'] || 'Client'
    };
    appendRowToSheet(SHEET_NAMES.TICKETS, newTicket);

    // --- 🔔 ATRACTIVE NOTIFICATION LOGIC ---
    const allUsersForTicketNotify = getCachedSheetData(SHEET_NAMES.USERS);
    const assignedUserNotify = allUsersForTicketNotify.find(u => _safeText_(u['Employee ID']) === assignedEmpId);

    if (assignedUserNotify) {
      let creatorId = _safeText_(ticketData['Creator ID']);
      let creatorName = _safeText_(ticketData['Creator Name']) || 'Client';

      let assignContext = "";
      if (creatorId && creatorId === _safeText_(assignedUserNotify['Employee ID'])) {
        assignContext = "👤 *Created By:* *Self (Self-Created)*";
      } else {
        let isClient = String(ticketData['Source']).toLowerCase().includes('client') || creatorName.toLowerCase().includes('client');
        assignContext = isClient ? `👤 *Created By:* *Client (Direct Portal)*` : `👤 *Assigned By:* *${creatorName}*`;
      }

      const planDateStr = newTicket['Plan Date'] ? new Date(newTicket['Plan Date']).toLocaleDateString('en-GB') : 'N/A';
      const tatVal = newTicket['TAT'] ? `${newTicket['TAT']} Mins` : 'N/A';

      const message = `🚨 *NEW TICKET ASSIGNED ALERT* 🚨\n` +
        `---------------------------------\n` +
        `Hello *${assignedUserNotify['Employee Name']}*,\n\n` +
        `A brand new ticket has been assigned to you. Please check the details:\n\n` +
        `🎫 *Ticket ID:* *${newTicket['Ticket ID']}*\n` +
        `🏢 *Client Name:* *${newTicket.Name}*\n` +
        `📂 *Category:* *${newTicket['Task Category'] || 'N/A'}*\n` +
        `⚡ *Priority:* *${newTicket.Priority}*\n` +
        `🎯 *Allocated TAT:* *${tatVal}*\n` +
        `📅 *Planned / Target Date:* *${planDateStr}*\n` +
        `📝 *Task Description:* ${newTicket['Task Description']}\n\n` +
        `${assignContext}\n\n` +
        `👉 Kindly open the portal and start the timer when you begin working.\n\n` +
        `~ Work Track System`;

      if (assignedUserNotify['Mobile Number']) {
        sendWhatsAppMessage(assignedUserNotify['Mobile Number'], message);
      }
    }

    return { success: true };
  } catch (e) {
    Logger.log("createTicketInSheet error: " + e.toString());
    return { success: false, message: e.message };
  }
}

function getTicketSystemData(employeeId, role) {
  try {
    const allTickets = getSheetData(SHEET_NAMES.TICKETS);
    let tickets = [];

    // --- NEW LOGIC START ---
    if (role === 'Super Admin') {
      // Super Admin sab dekhega
      tickets = allTickets;
    }
    else if (role === 'Manager' || role === 'Admin') {
      // Manager: Apne Tickets + Meri Team ke Tickets
      const myTeamIds = getTeamIds(employeeId);
      tickets = allTickets.filter(t =>
        t['Employee ID'] === employeeId ||         // Mere khud ke
        myTeamIds.includes(t['Employee ID']) ||    // Meri team ke
        t['Reassigned By'] === employeeId          // Jo maine reassign kiye
      );
    }
    else {
      // Normal User: Sirf apne tickets
      tickets = allTickets.filter(t => t['Employee ID'] === employeeId || t['Reassigned By'] === employeeId);
    }
    // --- NEW LOGIC END ---

    // Dropdowns logic same rahega...
    const dropdowns = {
      clients: getSheetData(SHEET_NAMES.CLIENTS).map(c => ({
        'Client_Id': c['Client_Id'],
        'Client Name': c['Client Name'],
        'Services': c['Services'] || '' // 🟢 getSheetData का उपयोग कैश बाईपास करेगा
      })),
      // Users list mein sirf Active users bhejein
      users: getCachedSheetData(SHEET_NAMES.USERS)
        .filter(u => u.Status === 'Active')
        .map(u => ({
          'Employee ID': u['Employee ID'],
          'Employee Name': u['Employee Name']
        })),
      categories: ['Google Sheet', 'Digital Marketing', 'Recruitment', 'Graphic Design', 'Development'],
      allUsers: getCachedSheetData(SHEET_NAMES.USERS).map(u => ({
        'Employee ID': u['Employee ID'],
        'Employee Name': u['Employee Name']
      }))
    };

    // Attachments link fix (Same as existing)
    const ticketsWithFixes = tickets.map(t => {
      // ... (Purana formatting code same rakhein) ...
      let attHtml = '';
      if (t.Attachment) {
        const urls = t.Attachment.split(',').map(u => u.trim()).filter(u => u);
        if (urls.length === 1) {
          attHtml = `<a href="${urls[0]}" target="_blank">📎 View</a>`;
        } else {
          attHtml = `<span title="${urls.length} files">📎 ${urls.length} Files</span>`;
        }
      }
      return {
        ...t,
        'Plan Date': t['Plan Date'] || t['Timestamp'],
        'HasUnreadAdminMessages': (t['HasUnreadAdminMessages'] === true || t['HasUnreadAdminMessages'] === 'true'),
        AttachmentLink: attHtml,
        ClosingAttachmentLink: t['Closing Attachment'] ? `<a href="${t['Closing Attachment']}" target="_blank">📎 View</a>` : ''
      };
    });

    ticketsWithFixes.sort((a, b) => new Date(b['Last Update Date']) - new Date(a['Last Update Date']));

    return { success: true, tickets: ticketsWithFixes, dropdowns };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getTicketDetails(ticketId) {
  try {
    const ticket = getSheetData(SHEET_NAMES.TICKETS).find(t => t['Ticket ID'] == ticketId);
    if (!ticket) return { success: false, message: "Ticket not found." };
    return { success: true, data: ticket };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function updateTicketInSheet(ticketId, updateData) {
  try {
    const ticketRow = getSheetData(SHEET_NAMES.TICKETS).find(t => t['Ticket ID'] === ticketId);
    if (!ticketRow) return { success: false, message: 'Ticket not found.' };

    // Enforce attendance gate if moving to "In Progress"
    if (updateData.newStatus === 'In Progress' || updateData.Status === 'In Progress') {
      enforceAttendanceGate(updateData.updatedBy);
    }

    // ... rest of the existing updateTicketInSheet logic ...
    const update = {};
    const now = new Date();
    const timestamp = Utilities.formatDate(now, "IST", "dd/MM/yyyy HH:mm");
    update['Last Update Date'] = now;

    let actionBy = updateData.updatedBy || 'System';
    let userRole = 'User';

    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    if (updateData.updatedBy) {
      const currentUserObj = allUsers.find(u => String(u['Employee ID']).trim() === String(updateData.updatedBy).trim());
      if (currentUserObj) {
        actionBy = currentUserObj['Employee Name'];
        userRole = String(currentUserObj['Role']).trim();
        update['Last Action By'] = actionBy;
      }
    }

    const ticketOwnerId = ticketRow['Employee ID'];
    const ticketOwner = allUsers.find(u => u['Employee ID'] === ticketOwnerId);

    let finalApprover = "";
    if (ticketOwner) {
      const app = ticketOwner['Task Approver'] ? String(ticketOwner['Task Approver']).trim() : '';
      if (app !== "") finalApprover = app.split(',')[0].trim();
      else {
        const mgr = ticketOwner['Manager ID'] ? String(ticketOwner['Manager ID']).trim() : '';
        if (mgr !== "") finalApprover = mgr.split(',')[0].trim();
      }
    }
    const hasApprover = finalApprover !== "";

    let newStatus = updateData.newStatus || updateData.Status;
    let approvalNeeded = false;
    let systemRemark = "";

    if (newStatus) {
      if (newStatus === 'In Progress') {
        // 🚀 सुरक्षा नियम: चेक करें कि क्या इस कर्मचारी का कोई और टिकट पहले से चालू तो नहीं है
        const ticketList = getSheetData(SHEET_NAMES.TICKETS);
        // backend logic in updateTicketInSheet
        const runningTicket = ticketList.find(t =>
          String(t['Employee ID']).trim().toUpperCase() === String(updateData.updatedBy).trim().toUpperCase() &&
          t.Status === 'In Progress' &&
          String(t['Ticket ID']).trim() !== String(ticketId).trim()
        );

        if (runningTicket) {
          return {
            success: false,
            message: `Aapka ek ticket already chal raha hai: [ID: ${runningTicket['Ticket ID']}]. Pehle use Pause ya Complete karein!`
          };
        }

        update['Status'] = 'In Progress';
        update['Start Time'] = Utilities.formatDate(now, "IST", "HH:mm:ss");
        systemRemark = `\n[System]: Work Resumed at ${update['Start Time']}.`;

        // 🚀 REMINDER 1: Instant Start Notification on WhatsApp (Disabled as requested)
        // sendTicketStartReminder(ticketId, ticketRow, now);
      }
      else if (newStatus === 'Paused') {
        update['Status'] = 'Paused';
        if (ticketRow['Start Time']) {
          const result = calculateSessionAndTotal(ticketRow['Total Duration'], ticketRow['Start Time'], now);
          update['Total Duration'] = result.totalStr;
          systemRemark = `\n[System]: Paused. Session: ${result.sessionMins} mins added.`;
        }
      }
      else if (newStatus === 'Completed') {
        if (ticketRow['Start Time']) {
          const result = calculateSessionAndTotal(ticketRow['Total Duration'], ticketRow['Start Time'], now);
          update['Total Duration'] = result.totalStr;
          systemRemark = `\n[System]: Completed. Final Session: ${result.sessionMins} mins.`;
        }
        update['End Time'] = Utilities.formatDate(now, "IST", "HH:mm:ss");
        update['Actual Date'] = Utilities.formatDate(now, "IST", "yyyy-MM-dd");

        // AUTO-APPROVE LOGIC
        let isSelfApprover = (finalApprover === String(updateData.updatedBy).trim());
        let isNoApprover = !hasApprover;

        if (isNoApprover || isSelfApprover) {
          update['Status'] = 'Closed';
          update['Close Date'] = now;
          newStatus = 'Closed';
          if (isNoApprover) systemRemark += `\n[System]: Auto-Approved & Closed (No Approver assigned).`;
          else systemRemark += `\n[System]: Auto-Approved & Closed (Action by Approver).`;
        } else {
          update['Status'] = 'Pending Approval';
          approvalNeeded = true;
          newStatus = 'Pending Approval';
        }
      }
    }

    let finalNewRemark = "";
    if (updateData.newRemarks || updateData.Remarks) {
      finalNewRemark += `\n[${actionBy} - ${timestamp}]: ${updateData.newRemarks || updateData.Remarks}`;
    }

    // [System] लॉग्स को मुख्य 'Tickets' शीट में दर्ज नहीं करेंगे, केवल यूजर का रिमार्क सेव होगा
    if (finalNewRemark) {
      update['Remarks'] = (ticketRow['Remarks'] || "") + finalNewRemark;
    }
    if (updateData.attachment) update['Closing Attachment'] = saveBase64FileToDrive(updateData.attachment, 'TaskApp_Tickets');

    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, update);

    // NOTIFICATION LOGIC FOR APPROVER
    if (approvalNeeded && hasApprover) {
      const approverUser = allUsers.find(u => u['Employee ID'] === finalApprover);
      if (approverUser && approverUser['Mobile Number']) {
        const fullDesc = String(ticketRow['Task Description'] || 'N/A');
        const assignedTAT = ticketRow['TAT'] ? `${ticketRow['TAT']} mins` : 'Not Set';
        const actualTimeTaken = update['Total Duration'] || ticketRow['Total Duration'] || 'Unknown';
        const userRemarks = updateData.newRemarks || updateData.Remarks || 'No remarks provided.';
        const category = ticketRow['Task Category'] || 'N/A';

        const msg = `⏳ *APPROVAL REQUIRED: TASK COMPLETED* ⏳\n` +
          `---------------------------------\n` +
          `Hello *${approverUser['Employee Name']}*,\n\n` +
          `One of your team member's tasks is waiting for your verification & approval:\n\n` +
          `🎫 *Ticket ID:* *${ticketId}*\n` +
          `🏢 *Client Name:* *${ticketRow['Name']}*\n` +
          `📂 *Category:* *${category}*\n` +
          `👤 *Completed By:* *${actionBy}*\n` +
          `📝 *Task Details:* ${fullDesc}\n\n` +
          `🎯 *Assigned TAT:* *${assignedTAT}*\n` +
          `⏱️ *Actual Time Taken:* *${actualTimeTaken}*\n` +
          `💬 *User Remarks / Notes:* *${userRemarks}*\n\n` +
          `👉 Kripya apne admin dashboard me jaakar is ticket ko verify aur close/rework karein.\n\n` +
          `~ Work Track System`;

        sendWhatsAppMessage(approverUser['Mobile Number'], msg);
      }
    }

    // ऑडिट ट्रेल के लिए बैकएंड की 'Ticket_History' शीट में दोनों (User Remark + System Log) सेव रहेंगे
    let historyLogRemark = finalNewRemark;
    if (systemRemark) {
      historyLogRemark += systemRemark;
    }
    if (historyLogRemark || updateData.newStatus) {
      logTicketHistory(ticketId, actionBy, newStatus || 'Update', historyLogRemark, '');
    }

    return { success: true, finalStatus: update['Status'] || newStatus };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function exportReportForWeb(format, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, message: `Sheet '${sheetName}' not found.` };
    }
    const spreadsheetId = ss.getId();

    let exportUrl;
    let extension;
    if (format === 'pdf') {
      exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf&portrait=true&gid=${sheet.getSheetId()}`;
      extension = 'pdf';
    } else if (format === 'xlsx') {
      exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&gid=${sheet.getSheetId()}`;
      extension = 'xlsx';
    } else {
      throw new Error("Unsupported format");
    }

    const blob = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    }).getBlob();

    const base64Data = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();
    const fileName = `${sheetName}_${new Date().toISOString()}.${extension}`;

    return { success: true, base64Data, mimeType, fileName };
  } catch (e) {
    Logger.log("exportReportForWeb error: " + e.toString());
    return { success: false, message: e.message };
  }
}

function getKpiDetails(employeeId, kpiType, filterRange) {
  try {
    const allUsers = getSheetData(SHEET_NAMES.USERS);
    const currentUser = allUsers.find(u => String(u['Employee ID']).trim() === String(employeeId).trim());
    if (!currentUser) return { success: false, message: "User not found" };

    const safeEmpId = String(employeeId).trim();

    function getSafeDate(val) {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }

    const allUserTickets = getSheetData(SHEET_NAMES.TICKETS).filter(t => String(t['Employee ID']).trim() === safeEmpId);
    const allUserExpenses = getSheetData(SHEET_NAMES.EXPENSES).filter(e => String(e['Employee ID']).trim() === safeEmpId);

    let data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 🟢 NAYA HELPER YAHAN BHI
    const isFmsFutureDate = (dateStr) => {
      if (!dateStr || String(dateStr).trim() === '') return false;
      let str = String(dateStr).trim().split(' ')[0];
      let alphaMatch = str.match(/^(\d{1,2})[\/\-\s]+([a-zA-Z]{3,})(?:[\/\-\s]+(\d{2,4}))?/);
      let numMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
      let currYear = new Date().getFullYear();
      let d = null;
      if (alphaMatch) {
        let day = parseInt(alphaMatch[1], 10);
        let mStr = alphaMatch[2].toLowerCase().substring(0, 3);
        let year = alphaMatch[3] ? parseInt(alphaMatch[3], 10) : currYear;
        if (year < 100) year += 2000;
        let mMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        d = new Date(year, mMap[mStr] || 0, day);
      } else if (numMatch) {
        let p1 = parseInt(numMatch[1], 10);
        let p2 = parseInt(numMatch[2], 10);
        let p3 = numMatch[3] ? parseInt(numMatch[3], 10) : currYear;
        let year = p3 < 100 ? p3 + 2000 : p3;
        let day = p1, month = p2 - 1;
        if (p2 > 12) { month = p1 - 1; day = p2; }
        d = new Date(year, month, day);
      } else {
        d = new Date(str);
      }
      if (!d || isNaN(d.getTime())) return false;
      let todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return d.getTime() > todayCheck.getTime();
    };

    let filterStartDate = null;
    let filterEndDate = new Date();

    if (filterRange === 'today') {
      filterStartDate = new Date(today);
      filterEndDate.setHours(23, 59, 59, 999);
    } else if (filterRange === 'week') {
      const dayOfWeek = today.getDay();
      filterStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
      filterEndDate.setHours(23, 59, 59, 999);
    } else if (filterRange === 'month') {
      filterStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      filterEndDate.setHours(23, 59, 59, 999);
    } else if (filterRange === 'last_week') {
      const beforeOneWeek = new Date();
      beforeOneWeek.setDate(today.getDate() - 7);
      const dayOfWeek = beforeOneWeek.getDay();
      filterStartDate = new Date(beforeOneWeek.getFullYear(), beforeOneWeek.getMonth(), beforeOneWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
      filterEndDate = new Date(filterStartDate);
      filterEndDate.setDate(filterStartDate.getDate() + 6);
      filterEndDate.setHours(23, 59, 59, 999);
    } else if (filterRange === 'last_month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      filterStartDate = new Date(lastMonth);
      filterEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
      filterEndDate.setHours(23, 59, 59, 999);
    } else if (filterRange === 'all') {
      filterStartDate = null;
    }

    const getCompletionDate = (task) => {
      if (task['Actual Date']) return getSafeDate(task['Actual Date']);
      if (task['Close Date']) return getSafeDate(task['Close Date']);
      if (task['Last Update Date']) return getSafeDate(task['Last Update Date']);
      return null;
    };

    let allUserFmsTasks = [];
    try {
      const fmsSheet = getSheet(SHEET_NAMES.FMS);
      if (fmsSheet.getLastRow() > 1) {
        const fmsValues = fmsSheet.getRange(2, 1, fmsSheet.getLastRow() - 1, 10).getDisplayValues();
        const empIdLower = safeEmpId.toLowerCase();
        const empNameLower = String(currentUser['Employee Name']).trim().toLowerCase();
        const empFirstName = empNameLower ? empNameLower.split(' ')[0] : '';

        fmsValues.forEach(row => {
          const rEmpId = String(row[0]).trim().toLowerCase();
          const rWho = String(row[4]).trim().toLowerCase();
          const isMatch = (rEmpId === empIdLower || rEmpId.includes(empIdLower) || rWho.includes(empIdLower) || rWho.includes(empNameLower) || rWho.includes(empFirstName));

          if (isMatch) {
            // 🟢 Future tasks hide logic applied
            let taskStatus = (row[9] && String(row[9]).trim() !== "") ? 'Completed' : 'Pending';
            if (taskStatus === 'Pending' && isFmsFutureDate(row[8])) {
              taskStatus = 'Future';
            }

            allUserFmsTasks.push({
              'Task ID': row[5],
              'Task Description': row[6],
              'Plan Date': row[8],
              'Actual Date': row[9],
              'Status': taskStatus
            });
          }
        });
      }
    } catch (e) { Logger.log("KPI FMS Fetch Error: " + e); }

    switch (kpiType) {
      case 'pendingTickets':
        data = allUserTickets.filter(t => ['Open', 'In Progress', 'Pending Approval', 'Client Responded', 'Reassigned'].includes(t.Status));
        break;
      case 'doneTickets':
        data = allUserTickets.filter(t => {
          if (t.Status !== 'Closed') return false;
          if (!filterStartDate) return true;
          const completionDate = getCompletionDate(t);
          return completionDate && completionDate >= filterStartDate && completionDate <= filterEndDate;
        });
        break;
      case 'pendingFms':
        data = allUserFmsTasks.filter(f => f.Status === 'Pending'); // 🟢 'Future' automatic filter ho gaya
        break;
      case 'doneFms':
        data = allUserFmsTasks.filter(f => {
          if (f.Status !== 'Completed') return false;
          if (!filterStartDate) return true;
          const actDate = getSafeDate(f['Actual Date']);
          return actDate && actDate >= filterStartDate && actDate <= filterEndDate;
        });
        break;
      case 'overdueTasks':
        const mappedTickets = allUserTickets.map(t => ({ ...t, 'Task Type': 'Ticket' }));
        const mappedFms = allUserFmsTasks.map(f => ({ ...f, 'Task Type': 'FMS' }));

        data = [...mappedTickets, ...mappedFms].filter(task => {
          const planDateStr = task['Plan Date'];
          if (!planDateStr || ['Closed', 'Completed', 'Pending Approval', 'Future'].includes(task.Status)) return false;
          const planDate = getSafeDate(planDateStr);
          if (planDate) planDate.setHours(0, 0, 0, 0);
          return planDate && planDate < today;
        });
        break;
      case 'expenses':
        data = allUserExpenses.filter(e => {
          if (!filterStartDate) return true;
          const expenseDate = getSafeDate(e.Date);
          return expenseDate && expenseDate >= filterStartDate && expenseDate <= filterEndDate;
        });
        break;
      default:
        return { success: false, message: 'Invalid KPI type' };
    }
    return { success: true, data: data };
  } catch (e) {
    Logger.log("getKpiDetails error: " + e.toString());
    return { success: false, message: e.message };
  }
}

// --- REPORTS: TICKETS ---
function getTicketReportData(employeeId, startDate, endDate) {
  try {
    const currentUser = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === employeeId);
    const role = currentUser ? currentUser.Role : 'User';
    let allTickets = getSheetData(SHEET_NAMES.TICKETS);

    // 1. Filter Logic
    if (role === 'Super Admin') {
      // No filter
    } else if (['Admin', 'Manager', 'HR'].includes(role)) {
      // Team + Own tickets
      const teamIds = getTeamIds(employeeId);
      allTickets = allTickets.filter(t => teamIds.includes(t['Employee ID']) || t['Employee ID'] === employeeId);
    } else {
      // User: Only Own
      allTickets = allTickets.filter(t => t['Employee ID'] === employeeId);
    }

    // 2. Date Filter
    if (startDate && endDate) {
      const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      allTickets = allTickets.filter(t => {
        if (!t['Timestamp']) return false;
        const d = t['Close Date'] ? new Date(t['Close Date']) : new Date(t['Timestamp']);
        return d >= start && d <= end;
      });
    }
    return { success: true, data: allTickets };
  } catch (e) { return { success: false, message: e.message }; }
}

// --- REPORTS: FMS ---
function getFmsReportData(employeeId, role, startDate, endDate) {
  try {
    const sheet = getSheet(SHEET_NAMES.FMS);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1) return { success: true, data: [] };

    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);

    const userLower = String(employeeId).trim().toLowerCase();
    const currentUserObj = allUsers.find(u => String(u['Employee ID']).trim().toLowerCase() === userLower);
    const userNameLower = currentUserObj ? String(currentUserObj['Employee Name']).trim().toLowerCase() : '';

    // 🟢 HELPER: STRICT WORD BOUNDARY MATCHER
    function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function matchesUser(tId, tName, rWho, rEmpId) {
      if (tId && rEmpId === tId) return true;
      if (tId && new RegExp('\\b' + escapeRegExp(tId) + '\\b', 'i').test(rWho)) return true;
      if (tName) {
        if (new RegExp('\\b' + escapeRegExp(tName) + '\\b', 'i').test(rWho)) return true;
        const fName = tName.split(' ')[0];
        if (fName && new RegExp('\\b' + escapeRegExp(fName) + '\\b', 'i').test(rWho)) return true;
      }
      return false;
    }

    let myTeamMembers = [];
    if (['Manager', 'Admin'].includes(role)) {
      myTeamMembers = allUsers.filter(u => {
        const assignedManagers = String(u['Manager ID'] || '').toLowerCase().split(',').map(id => id.trim());
        return assignedManagers.includes(userLower);
      });
    }

    const isSuperAdminOrHR = ['Super Admin', 'HR'].includes(role);
    let reportData = [];

    values.forEach(row => {
      if (!row[5] || String(row[0]).trim() === '') return;

      const rowEmpId = String(row[0]).trim().toLowerCase();
      const rowWho = String(row[4]).trim().toLowerCase();

      let isVisible = false;

      if (isSuperAdminOrHR) {
        isVisible = true;
      } else {
        const isMyTask = matchesUser(userLower, userNameLower, rowWho, rowEmpId);
        let isTeamTask = false;

        if (['Manager', 'Admin'].includes(role) && !isMyTask) {
          isTeamTask = myTeamMembers.some(tm => {
            const tmId = String(tm['Employee ID']).trim().toLowerCase();
            const tmName = String(tm['Employee Name']).trim().toLowerCase();
            return matchesUser(tmId, tmName, rowWho, rowEmpId);
          });
        }

        if (isMyTask || isTeamTask) isVisible = true;
      }

      if (isVisible) {
        let isDone = (row[9] && String(row[9]).trim() !== "");
        reportData.push({
          'Emp ID': row[0],
          'Who': row[4],
          'FMS Name': row[5],
          'Task Name': row[6],
          'Plan Date': row[8],
          'Actual Date': row[9],
          'Status': isDone ? 'Completed' : 'Pending'
        });
      }
    });

    if (startDate && endDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      reportData = reportData.filter(t => {
        if (!t['Plan Date']) return false;
        let d = new Date(t['Plan Date']);
        if (isNaN(d.getTime())) {
          const parts = String(t['Plan Date']).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
          if (parts) d = new Date(parts[3], parts[1] - 1, parts[2]);
        }
        return d >= start && d <= end;
      });
    }

    return { success: true, data: reportData };
  } catch (e) { return { success: false, message: e.message }; }
}

function checkForNewNotifications(employeeId, lastCheckTimestamp) {
  try {
    const now = Date.now(); // Server का Current Time

    // अगर पहली बार ऐप लोड हो रहा है, तो पुरानी टिकट्स का पॉपअप मत दिखाओ
    if (!lastCheckTimestamp || lastCheckTimestamp == 0 || lastCheckTimestamp === 'undefined') {
      return { success: true, notifications: [], serverTime: now };
    }

    const allTickets = getSheetData(SHEET_NAMES.TICKETS);
    const lastCheckDate = new Date(Number(lastCheckTimestamp));

    const currentUserObj = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === employeeId);
    const currentUserName = currentUserObj ? currentUserObj['Employee Name'] : employeeId;

    const notifications = allTickets.filter(t => {
      const isAssignedToMe = t['Employee ID'] === employeeId;
      if (!isAssignedToMe) return false;

      const createdDate = t['Timestamp'] ? new Date(t['Timestamp']) : new Date(0);
      const lastUpdateDate = t['Last Update Date'] ? new Date(t['Last Update Date']) : createdDate;

      const isNewTicket = createdDate > lastCheckDate;
      const isUpdatedRecently = lastUpdateDate > lastCheckDate;
      const isActionBySomeoneElse = t['Last Action By'] && t['Last Action By'] !== currentUserName;
      const isClientResponded = t['Status'] === 'Client Responded' && isUpdatedRecently;

      return isNewTicket || (isUpdatedRecently && isActionBySomeoneElse) || isClientResponded;
    });

    const uniqueNotifications = notifications.filter((v, i, a) => a.findIndex(t => (t['Ticket ID'] === v['Ticket ID'])) === i);

    // यहाँ हम सर्वर का टाइम (serverTime) वापस भेज रहे हैं
    return { success: true, notifications: uniqueNotifications, serverTime: now };

  } catch (e) {
    Logger.log("checkForNewNotifications error: " + e.toString());
    return { success: false, message: e.message, notifications: [], serverTime: Date.now() };
  }
}

// --- IS FUNCTION KO EK BAAR RUN KAREIN ---
function fixMissingLeaveIds() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.LEAVE_REQUESTS);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];

  // 'Leave ID' wala column dhoondhein
  const idColIndex = headers.indexOf('Leave ID');
  const timestampColIndex = headers.indexOf('Timestamp');

  if (idColIndex === -1) {
    Logger.log("Error: 'Leave ID' header nahi mila. Spelling check karein.");
    return;
  }

  // Row 2 se data check karna shuru karein
  for (let i = 1; i < values.length; i++) {
    const currentRow = i + 1;
    const currentId = values[i][idColIndex];

    // Agar Leave ID khaali hai, to nayi generate karein
    if (!currentId || currentId === '') {
      const timestamp = values[i][timestampColIndex] ? new Date(values[i][timestampColIndex]) : new Date();
      const uniquePart = Utilities.formatDate(timestamp, "IST", "yyyyMMddHHmmss");
      // Thoda random number add karein taki duplicate na ho
      const newId = 'LEAVE_' + uniquePart + '_' + Math.floor(Math.random() * 1000);

      sheet.getRange(currentRow, idColIndex + 1).setValue(newId);
      Logger.log(`Row ${currentRow} fixed with ID: ${newId}`);
    }
  }
  Logger.log("Fixing complete.");
}

// --- IS FUNCTION KO EK BAAR RUN KAREIN (Intimations Fix Karne Ke Liye) ---
function fixMissingIntimationIds() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Sheet ka naam global config se le rahe hain
  const sheet = ss.getSheetByName(SHEET_NAMES.INTIMATIONS);

  if (!sheet) {
    Logger.log("Error: '" + SHEET_NAMES.INTIMATIONS + "' sheet nahi mili.");
    return;
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];

  // 'Intimation ID' wala column dhoondhein
  const idColIndex = headers.indexOf('Intimation ID');
  const timestampColIndex = headers.indexOf('Timestamp');

  if (idColIndex === -1) {
    Logger.log("Error: 'Intimation ID' header nahi mila. Spelling check karein.");
    return;
  }

  // Row 2 se data check karna shuru karein
  for (let i = 1; i < values.length; i++) {
    const currentRow = i + 1;
    const currentId = values[i][idColIndex];

    // Agar Intimation ID khaali hai, to nayi generate karein
    if (!currentId || currentId === '') {
      // Row ka timestamp lein, agar blank hai to abhi ka time lein
      const timestamp = values[i][timestampColIndex] ? new Date(values[i][timestampColIndex]) : new Date();

      const uniquePart = Utilities.formatDate(timestamp, "IST", "yyyyMMddHHmmss");

      // 'INT_' prefix ke saath ID banayein
      const newId = 'INT_' + uniquePart + '_' + Math.floor(Math.random() * 1000);

      // Sheet mein value update karein
      sheet.getRange(currentRow, idColIndex + 1).setValue(newId);
      Logger.log(`Row ${currentRow} fixed with Intimation ID: ${newId}`);
    }
  }
  Logger.log("Intimations Fixing complete.");
}

// =====================================================
// SUPER ADMIN TO-DO AUDIT SETTINGS
// =====================================================

// Akash ko Super Admin To-Do audit jayega.
// Agar Akash ka Employee ID pata hai to yahan daal do, warna name se find hoga.
const SUPER_ADMIN_TODO_AUDITOR_ID = "AS101";
const SUPER_ADMIN_TODO_AUDITOR_NAME = "Akash Sablaniya";

function _todoSafe_(v) {
  return String(v == null ? "" : v).trim();
}

function _todoNorm_(v) {
  return _todoSafe_(v).toLowerCase();
}

function _isActiveUser_(u) {
  return _todoNorm_(u.Status) === "active";
}

function _isPendingTodo_(todo) {
  const status = _todoNorm_(todo.Status);
  return status !== "completed" && status !== "deleted";
}

function _isSameDateIST_(value, dateObj) {
  if (!value) return false;

  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return false;

  const a = Utilities.formatDate(d, "IST", "yyyy-MM-dd");
  const b = Utilities.formatDate(dateObj, "IST", "yyyy-MM-dd");

  return a === b;
}

function _formatTodoDate_(value) {
  if (!value) return "-";

  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return _todoSafe_(value);

  return Utilities.formatDate(d, "IST", "dd/MM/yyyy");
}

function _getUserNameById_(users, empId) {
  const u = users.find(x => _todoSafe_(x["Employee ID"]) === _todoSafe_(empId));
  return u ? _todoSafe_(u["Employee Name"]) : _todoSafe_(empId);
}

function _getAkashTodoAuditor_(users) {
  let auditor = null;

  if (_todoSafe_(SUPER_ADMIN_TODO_AUDITOR_ID)) {
    auditor = users.find(u =>
      _todoNorm_(u["Employee ID"]) === _todoNorm_(SUPER_ADMIN_TODO_AUDITOR_ID)
    );
  }

  if (!auditor) {
    // Prefer active Super Admin named Akash
    auditor = users.find(u =>
      _isActiveUser_(u) &&
      _todoNorm_(u.Role) === "super admin" &&
      _todoNorm_(u["Employee Name"]).includes(_todoNorm_(SUPER_ADMIN_TODO_AUDITOR_NAME))
    );
  }

  if (!auditor) {
    // Fallback: any active Akash
    auditor = users.find(u =>
      _isActiveUser_(u) &&
      _todoNorm_(u["Employee Name"]).includes(_todoNorm_(SUPER_ADMIN_TODO_AUDITOR_NAME))
    );
  }

  return auditor || null;
}

// =====================================================
// SUPER ADMIN TO-DO AUDIT MESSAGE (100% ENGLISH)
// =====================================================

function _buildSuperAdminTodoAuditMessage_(users, todos) {
  const today = new Date();

  const activeSuperAdmins = users.filter(u =>
    _isActiveUser_(u) &&
    _todoNorm_(u.Role) === "super admin"
  );

  let message = ``;

  if (activeSuperAdmins.length === 0) {
    message += `No active Super Admin users found.\n`;
    return message;
  }

  activeSuperAdmins.forEach(sa => {
    const empId = _todoSafe_(sa["Employee ID"]);
    const name = _todoSafe_(sa["Employee Name"]) || empId;

    const todaysTodos = todos.filter(t =>
      _todoSafe_(t["Employee ID"]) === empId &&
      _isSameDateIST_(t.Timestamp, today) &&
      _todoNorm_(t.Status) !== "deleted"
    );

    const pendingTodos = todos.filter(t =>
      _todoSafe_(t["Employee ID"]) === empId &&
      _isPendingTodo_(t)
    );

    message += `👤 *${name}* (${empId})\n`;

    // 🟢 HINGLISH TO ENGLISH FIX
    if (todaysTodos.length === 0) {
      message += `❌ *ALERT: Today's To-Do list not submitted yet!* ❌\n`;
    } else {
      message += `✅ Today's To-Do Submitted: *${todaysTodos.length}*\n`;

      todaysTodos.slice(0, 5).forEach((todo, i) => {
        message += `${i + 1}. ${_todoSafe_(todo.Task) || "-"} | ${_todoSafe_(todo.Priority) || "Medium"} | Due: ${_formatTodoDate_(todo["Due Date"])}\n`;
      });

      if (todaysTodos.length > 5) {
        message += `…and ${todaysTodos.length - 5} more.\n`;
      }
    }

    message += `Total Pending: *${pendingTodos.length}*\n\n`;
  });

  return message;
}

function notifyAkashForNewSuperAdminTodo_(todoOwnerId, newTodo) {
  try {
    const users = getSheetData(SHEET_NAMES.USERS);
    const todos = getSheetData(SHEET_NAMES.TODO);

    const owner = users.find(u =>
      _todoSafe_(u["Employee ID"]) === _todoSafe_(todoOwnerId)
    );

    if (!owner || _todoNorm_(owner.Role) !== "super admin") {
      return false;
    }

    const auditor = _getAkashTodoAuditor_(users);

    if (!auditor || !auditor["Mobile Number"]) {
      Logger.log("Akash auditor not found or mobile missing.");
      return false;
    }

    const ownerName = _todoSafe_(owner["Employee Name"]) || todoOwnerId;

    const message =
      `🆕 *New Super Admin To-Do Added* 🆕\n\n` +
      `👤 *By:* ${ownerName} (${todoOwnerId})\n` +
      `📝 *Task:* ${_todoSafe_(newTodo.Task)}\n` +
      `⚡ *Priority:* ${_todoSafe_(newTodo.Priority) || "Medium"}\n` +
      `📅 *Due Date:* ${_formatTodoDate_(newTodo["Due Date"])}\n` +
      `🕒 *Added At:* ${Utilities.formatDate(new Date(), "IST", "dd/MM/yyyy HH:mm")}\n\n` +
      `Pending To-Do of ${ownerName}: *${todos.filter(t =>
        _todoSafe_(t["Employee ID"]) === _todoSafe_(todoOwnerId) &&
        _isPendingTodo_(t)
      ).length
      }*\n\n` +
      `~ Work Track System`;

    return sendWhatsAppMessage(auditor["Mobile Number"], message);

  } catch (e) {
    Logger.log("notifyAkashForNewSuperAdminTodo_ Error: " + e.toString());
    return false;
  }
}

// =====================================================
// NOTIFICATION MODULES (SPLIT INTO 3 FUNCTIONS)
// =====================================================

// Helper Function For Dates
function parseStrictDateOnly(val) {
  if (!val) return null;
  let d;
  if (val instanceof Date) d = new Date(val.getTime());
  else d = new Date(val);

  if (isNaN(d.getTime())) {
    const parts = String(val).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (parts) {
      let y = parseInt(parts[3], 10); if (y < 100) y += 2000;
      let m = parseInt(parts[2], 10) - 1; let day = parseInt(parts[1], 10);
      if (day > 12) { } else if (m + 1 > 12) { day = parseInt(parts[2], 10); m = parseInt(parts[1], 10) - 1; }
      d = new Date(y, m, day);
    }
  }
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// =====================================================
// NOTIFICATION MODULES (DATE PARSER 100% FIXED)
// =====================================================

function safeText(v) { return String(v == null ? "" : v).trim(); }

// 🟢 SMART DATE PARSER: Sheet ke kisi bhi date format ko perfectly padhega
const IST_DATE_STR = Utilities.formatDate(new Date(), "IST", "yyyy-MM-dd");
const [T_YEAR, T_MONTH_1, T_DATE] = IST_DATE_STR.split('-').map(Number);
const T_MONTH = T_MONTH_1 - 1;
const TODAY_MIDNIGHT = new Date(T_YEAR, T_MONTH, T_DATE).getTime();

function parseFMSDate(val) {
  if (!val || String(val).trim() === '' || String(val).trim() === '-') return null;

  if (val instanceof Date) {
    let d = new Date(val.getTime());
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d.getTime(); }
  }

  let str = String(val).trim().split(' ')[0]; // Gets "15-May"

  // 1. Alpha Format (15-May or 15-May-2024)
  // FIX: इसे सबसे पहले रन करना है ताकि 2001 वाला बग ना आये
  let alphaMatch = str.match(/^(\d{1,2})[\/\-\s]+([a-zA-Z]{3,})(?:[\/\-\s]+(\d{2,4}))?/);
  if (alphaMatch) {
    let day = parseInt(alphaMatch[1], 10);
    let monthStr = alphaMatch[2].toLowerCase().substring(0, 3);
    let year = alphaMatch[3] ? parseInt(alphaMatch[3], 10) : T_YEAR; // अगर साल नहीं है तो इसी साल का मानेगा
    if (year < 100) year += 2000;
    const months = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
    let parsed = new Date(year, months[monthStr] || 0, day);
    return parsed.getTime();
  }

  // 2. Numeric Format (15/05/2024)
  let numMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (numMatch) {
    let p1 = parseInt(numMatch[1], 10);
    let p2 = parseInt(numMatch[2], 10);
    let p3 = numMatch[3] ? parseInt(numMatch[3], 10) : T_YEAR;
    if (p3 < 100) p3 += 2000;

    let day = p1, month = p2 - 1;
    if (p1 > 12) { day = p1; month = p2 - 1; }
    else if (p2 > 12) { day = p2; month = p1 - 1; }

    let parsed = new Date(p3, month, day);
    return parsed.getTime();
  }

  // 3. Native JS Check (Fallback)
  let d = new Date(str);
  if (!isNaN(d.getTime())) {
    // अगर JS गलती से 2001 साल दे दे, तो उसे केंट साल से बदल दो
    if (d.getFullYear() < 2010) d.setFullYear(T_YEAR);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  return null;
}

function isDateToday(val) { return parseFMSDate(val) === TODAY_MIDNIGHT; }
function isDateOverdue(val) { let t = parseFMSDate(val); return t !== null && t < TODAY_MIDNIGHT; }

// ----------------------------------------------------
// 1. SEND DAILY PENDING REMINDERS (10:00, 14:30, 17:00)
// ----------------------------------------------------
function sendDailyPendingReminders() {
  try {
    const users = getSheetData(SHEET_NAMES.USERS).filter(u => safeText(u.Status).toLowerCase() === "active");
    const tickets = getSheetData(SHEET_NAMES.TICKETS);
    const todos = getSheetData(SHEET_NAMES.TODO);
    const attendance = getSheetData(SHEET_NAMES.ATTENDANCE);

    const APP_URL = "https://script.google.com/macros/s/AKfycbxCAUBf24QVIIf5DHoF-gIqPMv1qjw9mj7ciIRNcfa1WXGK9iPsLrFf9NS7F3PoEnq6RQ/exec";

    // 🟢 FIX: Force strictly to Indian Standard Time (IST)
    const currentHour = parseInt(Utilities.formatDate(new Date(), "IST", "HH"), 10);
    let greeting = currentHour < 12 ? "🌅 *Good Morning*" : (currentHour < 17 ? "☀️ *Good Afternoon*" : "🌆 *Good Evening*");

    const todayStrIST = Utilities.formatDate(new Date(), "IST", "yyyy-MM-dd");

    users.forEach(user => {
      if (!user["Mobile Number"]) return;
      const empId = safeText(user["Employee ID"]);

      const myTickets = tickets.filter(t => safeText(t["Employee ID"]) === empId && !["Closed", "Pending Approval", "Approved by Client", "Completed"].includes(safeText(t.Status))).length;
      const myTodos = todos.filter(t => safeText(t["Employee ID"]) === empId && safeText(t.Status).toLowerCase() !== "completed" && safeText(t.Status).toLowerCase() !== "deleted").length;

      let myApprovals = tickets.filter(t => {
        if (safeText(t.Status) !== "Pending Approval") return false;
        const owner = users.find(u => safeText(u["Employee ID"]) === safeText(t["Employee ID"]));
        if (!owner) return false;
        const apps = safeText(owner["Task Approver"]).split(",").map(m => m.trim()).filter(Boolean);
        const mgrs = safeText(owner["Manager ID"]).split(",").map(m => m.trim()).filter(Boolean);
        return (apps.length > 0 ? apps[0] : mgrs[0]) === empId;
      }).length;

      // --- 🟢 ATTENDANCE LOGIC ---
      let hasPunchedIn = false;
      let isLate = false;
      let punchInTimeStr = "";
      let hasPunchedOut = false;

      attendance.forEach(a => {
        if (safeText(a["Employee ID"]) === empId) {
          let rowDateStr = "";
          if (a["Date"]) {
            let d = new Date(a["Date"]);
            if (!isNaN(d.getTime())) {
              rowDateStr = Utilities.formatDate(d, "IST", "yyyy-MM-dd");
            }
          }

          if (rowDateStr === todayStrIST) {
            if (a.Action === "Punch In") {
              hasPunchedIn = true;
              let pTime = new Date(a.Time);

              let shiftStartH = 10, shiftStartM = 15;
              let pTimeH = parseInt(Utilities.formatDate(pTime, "IST", "HH"), 10);
              let pTimeM = parseInt(Utilities.formatDate(pTime, "IST", "mm"), 10);

              if (pTimeH > shiftStartH || (pTimeH === shiftStartH && pTimeM > shiftStartM)) {
                isLate = true;
                punchInTimeStr = Utilities.formatDate(pTime, "IST", "hh:mm a");
              }
            }
            if (a.Action === "Punch Out") {
              hasPunchedOut = true;
            }
          }
        }
      });

      let attStatusMsg = "";

      // Morning & Day (Before 5 PM)
      if (currentHour < 17) {
        if (!hasPunchedIn) {
          attStatusMsg = "⏳ *Attendance Alert:* You haven't *Punched IN* today. Please mark your attendance ASAP!";
        } else if (isLate) {
          attStatusMsg = `⚠️ *Attendance Alert:* You Punched IN *Late* today at ${punchInTimeStr}.`;
        } else {
          attStatusMsg = "✅ *Attendance:* You have successfully Punched IN on time.";
        }
      }
      // Evening (After 5 PM)
      else {
        if (!hasPunchedIn) {
          attStatusMsg = "❌ *Attendance Alert:* You missed your Punch IN today.";
        } else if (!hasPunchedOut) {
          attStatusMsg = "⏳ *Attendance Alert:* You haven't *Punched OUT* yet. Don't forget to mark it before leaving!";
        } else {
          attStatusMsg = "✅ *Attendance:* You have successfully Punched OUT. Have a great evening!";
        }
      }

      // --- 🟢 MESSAGE BUILDING ---
      let msg = `${greeting} *${user["Employee Name"]}*,\n\n`;
      msg += `${attStatusMsg}\n\n`; // Add Attendance Status Here

      if (myTickets > 0 || myTodos > 0) {
        msg += `*📌 Your Pending Workload:*\n`;
        if (myTickets > 0) msg += `🎫 Tickets: ${myTickets}\n`;
        if (myTodos > 0) msg += `📝 To-Do Tasks: ${myTodos}\n\n`;
      } else {
        msg += `🎉 *0 Pending Personal Tasks*\n\n`;
      }

      if (myApprovals > 0) msg += `*🔔 Action Required:*\nYou have *${myApprovals} Tickets* waiting for your Approval.\n\n`;
      msg += `🔗 *Open Portal:* ${APP_URL}\n~ Work Track System`;

      sendWhatsAppMessage(user["Mobile Number"], msg);
    });
  } catch (e) { Logger.log("Daily Reminder Error: " + e); }
}

// ----------------------------------------------------
// 2. SEND SUPER ADMIN AUDIT (AKASH - 11:00, 15:00)
// ----------------------------------------------------
function sendSuperAdminAudit() {
  try {
    const users = getSheetData(SHEET_NAMES.USERS);
    const todos = getSheetData(SHEET_NAMES.TODO);
    const akash = _getAkashTodoAuditor_(users);
    if (!akash || !akash["Mobile Number"]) return;

    const allPendingTodos = todos.filter(t => {
      let st = safeText(t.Status).toLowerCase();
      return st !== "completed" && st !== "deleted";
    });

    let auditMsg = `*👑 SUPER ADMIN AUDIT REPORT*\n\n`;
    if (allPendingTodos.length <= 0) auditMsg += `✅ No pending To-Do tasks in the system.\n`;
    else auditMsg += `*Overall Company Pending To-Do: ${allPendingTodos.length}*\n\n`;

    auditMsg += _buildSuperAdminTodoAuditMessage_(users, todos);
    sendWhatsAppMessage(akash["Mobile Number"], auditMsg);
  } catch (e) { Logger.log("Akash Audit Error: " + e); }
}

// ----------------------------------------------------
// 3. SEND COMPANY SUMMARY (MITUSHI)
// ----------------------------------------------------
function sendCompanySummary() {
  try {
    const users = getSheetData(SHEET_NAMES.USERS);
    const tickets = getSheetData(SHEET_NAMES.TICKETS);
    let fms = []; try { fms = getSheetData(SHEET_NAMES.FMS); } catch (e) { }
    const attendance = getSheetData(SHEET_NAMES.ATTENDANCE);

    let mitushiUser = users.find(u => safeText(u["Employee ID"]).toUpperCase() === "MS101");
    if (!mitushiUser) mitushiUser = users.find(u => safeText(u["Employee Name"]).toLowerCase().includes("mitushi"));
    if (!mitushiUser || !mitushiUser["Mobile Number"]) return;

    const activeEmployees = users.filter(u => safeText(u.Status).toLowerCase() === "active");
    const companyStats = {};
    activeEmployees.forEach(u => {
      companyStats[safeText(u['Employee ID'])] = {
        name: safeText(u['Employee Name']).split(' ')[0],
        present: false, ticketsCreated: 0, pendingApprovals: 0,
        pendingTix: 0, overdueTix: 0, pendingFms: 0, overdueFms: 0
      };
    });

    // 1. Attendance Check
    attendance.forEach(a => {
      if (isDateToday(a["Date"])) {
        let empId = safeText(a["Employee ID"]);
        if (a.Action === "Punch In" && companyStats[empId]) companyStats[empId].present = true;
      }
    });

    // 2. Ticket Check
    tickets.forEach(t => {
      let empId = safeText(t['Employee ID']);
      let creatorId = safeText(t['Creator ID']) || empId;
      const status = safeText(t.Status);

      // A) Created Today
      if (isDateToday(t.Timestamp) && companyStats[creatorId]) {
        companyStats[creatorId].ticketsCreated++;
      }

      // B) Manager Approvals
      if (status === "Pending Approval") {
        let ownerId = safeText(t['Employee ID']);
        let owner = activeEmployees.find(u => safeText(u['Employee ID']) === ownerId);
        if (owner) {
          let finalApprover = "";
          const apps = safeText(owner["Task Approver"]).split(",").map(m => m.trim()).filter(Boolean);
          const mgrs = safeText(owner["Manager ID"]).split(",").map(m => m.trim()).filter(Boolean);
          if (apps.length > 0) finalApprover = apps[0]; else if (mgrs.length > 0) finalApprover = mgrs[0];
          if (finalApprover && companyStats[finalApprover]) companyStats[finalApprover].pendingApprovals++;
        }
      }

      // C) Ticket Workload (Overdue / Pending)
      if (!["Closed", "Pending Approval", "Approved by Client", "Completed"].includes(status)) {
        if (companyStats[empId]) {
          let planDateStr = t['Plan Date'];
          if (planDateStr) {
            if (isDateOverdue(planDateStr)) companyStats[empId].overdueTix++;
            else if (isDateToday(planDateStr)) companyStats[empId].pendingTix++;
          } else {
            companyStats[empId].pendingTix++;
          }
        }
      }
    });

    // 3. FMS Check (Strict Logic)
    fms.forEach(f => {
      // अगर FMS में खाली row है तो उसे इग्नोर करें
      let fmsNameKey = Object.keys(f).find(k => safeText(k).toLowerCase().includes('fms name')) || 'FMS Name';
      if (!f[fmsNameKey] || safeText(f[fmsNameKey]) === '') return;

      let status = safeText(f.Status).toLowerCase();
      let actualKey = Object.keys(f).find(k => safeText(k).toLowerCase().includes('actual')) || 'Actual Date';
      let isDone = (f[actualKey] && safeText(f[actualKey]) !== "");

      if (!isDone && status !== 'completed' && status !== 'done') {
        let whoKey = Object.keys(f).find(k => safeText(k).toLowerCase() === 'who' || safeText(k).toLowerCase().includes('assigned')) || 'Who';
        let who = safeText(f[whoKey]).toLowerCase();
        let empIdCol = safeText(f['Employee ID'] || '').toLowerCase();

        let matchedUser = activeEmployees.find(u =>
          (empIdCol !== '' && empIdCol === safeText(u['Employee ID']).toLowerCase()) ||
          (who !== '' && who.includes(safeText(u['Employee ID']).toLowerCase())) ||
          (who !== '' && who.includes(safeText(u['Employee Name']).toLowerCase().split(' ')[0]))
        );

        if (matchedUser && companyStats[safeText(matchedUser['Employee ID'])]) {
          let planKey = Object.keys(f).find(k => safeText(k).toLowerCase().includes('plan')) || 'Planned date'; // Match your sheet header
          let pDateStr = f[planKey];

          if (pDateStr && String(pDateStr).trim() !== '') {
            // सिर्फ आज का Pending में जायेगा और पुराना Overdue में। 
            // Future Date वाला इग्नोर हो जाएगा!
            if (isDateOverdue(pDateStr)) {
              companyStats[safeText(matchedUser['Employee ID'])].overdueFms++;
            } else if (isDateToday(pDateStr)) {
              companyStats[safeText(matchedUser['Employee ID'])].pendingFms++;
            }
          } else {
            companyStats[safeText(matchedUser['Employee ID'])].pendingFms++; // Blank dates = Pending
          }
        }
      }
    });

    // --- PREPARE LISTS ---
    let presentCount = 0; let absentNames = []; let creatorsList = []; let approversList = [];
    let workloadList = [];

    Object.values(companyStats).forEach(s => {
      if (s.present) presentCount++; else absentNames.push(s.name);
      if (s.ticketsCreated > 0) creatorsList.push(s);
      if (s.pendingApprovals > 0) approversList.push(s);
      if (s.pendingTix > 0 || s.overdueTix > 0 || s.pendingFms > 0 || s.overdueFms > 0) workloadList.push(s);
    });

    creatorsList.sort((a, b) => b.ticketsCreated - a.ticketsCreated);
    approversList.sort((a, b) => b.pendingApprovals - a.pendingApprovals);
    workloadList.sort((a, b) => (b.pendingTix + b.overdueTix + b.pendingFms + b.overdueFms) - (a.pendingTix + a.overdueTix + a.pendingFms + a.overdueFms));

    // ==============================================================
    // 📩 MESSAGE 1: ATTENDANCE & APPROVALS
    // ==============================================================
    let msg1 = `📊 *COMPANY SUMMARY (1/2)* 📊\nDate: ${Utilities.formatDate(new Date(), "IST", "dd/MM/yyyy")}\n\n`;

    msg1 += `👥 *ATTENDANCE (${presentCount} Present)*\n`;
    if (absentNames.length > 0) msg1 += `❌ *Absent:* ${absentNames.join(', ')}\n`; else msg1 += `✅ All Present!\n`;

    msg1 += `\n🎫 *TICKETS CREATED TODAY*\n`;
    if (creatorsList.length > 0) msg1 += creatorsList.map(c => `${c.name}: ${c.ticketsCreated}`).join(' | ') + `\n`; else msg1 += `No tickets created today.\n`;

    msg1 += `\n🔔 *MANAGER APPROVALS PENDING*\n`;
    if (approversList.length > 0) msg1 += approversList.map(a => `${a.name}: ${a.pendingApprovals}`).join(' | ') + `\n`; else msg1 += `✅ All approvals cleared!\n`;

    sendWhatsAppMessage(mitushiUser["Mobile Number"], msg1);
    Utilities.sleep(3000);

    // ==============================================================
    // 📩 MESSAGE 2: WORKLOAD 
    // ==============================================================
    if (workloadList.length > 0) {
      const chunkSize = 20;
      for (let i = 0; i < workloadList.length; i += chunkSize) {
        let chunk = workloadList.slice(i, i + chunkSize);
        let title = i === 0 ? `🔥 *PENDING WORKLOAD (2/2)* 🔥\n\n` : `🔥 *PENDING WORKLOAD (Cont.)* 🔥\n\n`;
        let msg2 = title;

        chunk.forEach(w => {
          msg2 += `👤 *${w.name}* ➔ Tix: ${w.pendingTix} (${w.overdueTix} Ovd) | FMS: ${w.pendingFms} (${w.overdueFms} Ovd)\n`;
        });

        if (i + chunkSize >= workloadList.length) msg2 += `\n~ Work Track System`;

        sendWhatsAppMessage(mitushiUser["Mobile Number"], msg2);
        Utilities.sleep(3000);
      }
    } else {
      sendWhatsAppMessage(mitushiUser["Mobile Number"], `🔥 *PENDING WORKLOAD (2/2)* 🔥\n\n✅ All clear! No pending tasks.\n\n~ Work Track System`);
    }

  } catch (e) { Logger.log("Company Summary Error: " + e); }
}

// =====================================================
// DAILY REMINDER TRIGGER SETUP - FIXED PERMISSION SAFE
// =====================================================

const DAILY_REMINDER_HANDLER = 'sendDailyPendingReminders';

// Reminder timings.
// 9 = 9 AM, 14 = 2 PM, 18 = 6 PM
// Agar sirf morning + evening chahiye to [9, 18] rakho.
const DAILY_REMINDER_HOURS = [9, 14, 18];

// =====================================================
// EXACT DAILY REMINDER TRIGGER SETUP (NEW TIMINGS)
// =====================================================

function _deleteTriggersByHandler_(handlerName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// =====================================================
// 🚀 100% RELIABLE CRON-JOB TRIGGER SYSTEM (EXACT TIMINGS)
// =====================================================

function setupReliableTriggers() {
  try {
    // 1. पुराने सारे बेकार ट्रिगर्स हटा दें
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

    // 2. सिर्फ एक मास्टर ट्रिगर सेट करें जो अब हर 5 मिनट में चलेगा (Increased precision for TAT reminders)
    ScriptApp.newTrigger('checkAndSendReminders')
      .timeBased()
      .everyMinutes(5) // 5 मिनट के अंतराल पर सेट किया गया
      .create();

    Logger.log("✅ Reliable Master Trigger Set Successfully!");
    return { success: true, message: "Triggers Updated!" };
  } catch (e) {
    Logger.log("Trigger setup failed: " + e.message);
    return { success: false, message: e.message };
  }
}

// यह फंक्शन हर 15 मिनट में चलेगा और सटीक टाइम मैच करेगा
function checkAndSendReminders() {
  const now = new Date();
  checkTicketTatReminders();

  // IST (Indian Standard Time) के हिसाब से घंटे और मिनट निकालें
  const timeStr = Utilities.formatDate(now, "IST", "HH:mm");
  const todayStr = Utilities.formatDate(now, "IST", "yyyy-MM-dd");

  const h = parseInt(timeStr.split(':')[0], 10);
  const m = parseInt(timeStr.split(':')[1], 10);

  // 🟢 NAYA FIX: IST के हिसाब से आज का दिन निकालें (0 = Sunday, 1 = Monday...)
  const istDateString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istDateString);
  const dayOfWeek = istDate.getDay();

  // --- 🟢 NEW: RETRY FAILED WHATSAPP MESSAGES EVERY 15 MINS ---
  // ट्रिगर चलते ही सबसे पहले यह चेक करेगा कि कोई पुराना मैसेज फेल तो नहीं हुआ था
  retryFailedWhatsAppMessages();

  // Script Properties (ताकि एक मैसेज दिन में दो बार ना जाए)
  const props = PropertiesService.getScriptProperties();

  // Storage Cleanup (ताकि Properties Full ना हो जाएं)
  const allKeys = props.getKeys();
  allKeys.forEach(key => {
    // 🟢 सुधार: T_OVD से शुरू होने वाली कीज को डिलीट होने से बचाएं ताकि अगले दिन का रिमाइंडर सही समय पर जा सके
    if (key.indexOf('T_OVD') === 0) {
      return;
    }
    if (!key.includes(todayStr)) {
      props.deleteProperty(key);
    }
  });

  // 🛑 SUNDAY CHECK: अगर आज रविवार (Sunday) है, तो कोई भी रिमाइंडर नहीं जायेगा!
  if (dayOfWeek === 0) {
    Logger.log("Today is Sunday (IST). Skipping all reminders.");
    return; // फंक्शन यहीं से वापस लौट जायेगा और नीचे के रिमाइंडर्स नहीं चलेंगे
  }

  // Bulletproof Time Logic (अगर ट्रिगर लेट भी हुआ तो मिस नहीं होगा)
  const shouldRun = (targetHour, targetMin, jobName) => {
    const currentTotalMins = (h * 60) + m;
    const targetTotalMins = (targetHour * 60) + targetMin;

    const isTimePassed = currentTotalMins >= targetTotalMins;
    const jobKey = jobName + "_" + todayStr;
    const isAlreadySent = props.getProperty(jobKey) === 'done';

    if (isTimePassed && !isAlreadySent) {
      props.setProperty(jobKey, 'done');
      return true;
    }
    return false;
  };

  try {
    fixBlankClientTickets();
    // ----------------------------------------------------
    // 1. EMPLOYEE DAILY REMINDERS (10:00 AM, 2:30 PM, 5:25 PM, 5:55 PM)
    // ----------------------------------------------------
    if (shouldRun(10, 0, "emp_morning")) sendDailyPendingReminders();
    if (shouldRun(14, 30, "emp_afternoon")) sendDailyPendingReminders();

    // 🟢 शाम के रिमाइंडर्स की सटीक टाइमिंग अपडेट (5:25 PM और 5:55 PM)
    if (shouldRun(17, 25, "emp_evening_early")) sendDailyPendingReminders(); // 5:25 PM पर जाएगा
    if (shouldRun(17, 55, "emp_evening_late")) sendDailyPendingReminders();  // 5:55 PM पर जाएगा

    // ----------------------------------------------------
    // 2. SUPER ADMIN AUDIT - AKASH (11:00 AM, 3:00 PM)
    // ----------------------------------------------------
    if (shouldRun(11, 0, "akash_morning")) sendSuperAdminAudit();
    if (shouldRun(15, 0, "akash_afternoon")) sendSuperAdminAudit();

    // ----------------------------------------------------
    // 3. COMPANY SUMMARY - MITUSHI (12:00 PM, 7:00 PM)
    // ----------------------------------------------------
    if (shouldRun(12, 0, "mitushi_morning")) sendCompanySummary();
    if (shouldRun(19, 0, "mitushi_evening")) sendCompanySummary();

  } catch (e) {
    Logger.log("Cron Job Error: " + e.toString());
  }
}

// यह फंक्शन महीने में एक बार फालतू Properties डिलीट करेगा ताकि स्टोरेज फुल न हो
function cleanupOldProperties() {
  const props = PropertiesService.getScriptProperties();
  props.deleteAllProperties();
}

// --- HELPER: LOG TICKET HISTORY ---
function logTicketHistory(ticketId, actionBy, actionType, remarks, attachmentUrl) {
  try {
    const uniqueId = 'HIST_' + Utilities.formatDate(new Date(), "IST", "yyyyMMddHHmmssS");
    const historyRow = {
      'History ID': uniqueId,
      'Ticket ID': ticketId,
      'Timestamp': new Date(),
      'Action By': actionBy,
      'Action Type': actionType,
      'Remarks': remarks,
      'Attachment URL': attachmentUrl || ''
    };
    appendRowToSheet(SHEET_NAMES.TICKET_HISTORY, historyRow);
  } catch (e) {
    Logger.log("History Log Error: " + e.message);
  }
}
function createBulkTicketsInSheet(ticketsList) {
  try {
    if (ticketsList && ticketsList.length > 0) {
      const creatorId = ticketsList[0]['Creator ID'];
      if (creatorId && creatorId !== 'Client') {
        enforceAttendanceGate(creatorId);
      }
    }

    // ... rest of the existing createBulkTicketsInSheet logic ...
    let successCount = 0;

    // Loop through list
    ticketsList.forEach(ticketData => {
      // Existing single ticket function ko reuse karenge
      createTicketInSheet(ticketData);
      successCount++;
    });

    return { success: true, message: `${successCount} tickets created successfully.` };

  } catch (e) {
    Logger.log("Bulk Ticket Error: " + e.toString());
    return { success: false, message: e.message };
  }
}

// --- HELPER: ACCURATE DURATION CALCULATOR (FIXED TIMEZONE BUG) ---
function calculateSessionAndTotal(oldTotalStr, startTimeStr, endTimeDate) {
  try {
    // 1. Purana Total Minutes nikalo
    let totalMinutes = 0;
    if (oldTotalStr && typeof oldTotalStr === 'string') {
      const hMatch = oldTotalStr.match(/(\d+)h/i);
      const mMatch = oldTotalStr.match(/(\d+)m/i);
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      totalMinutes = (h * 60) + m;
    }

    // 2. Current Session ke Minutes nikalo
    let sessionMinutes = 0;
    if (startTimeStr) {
      // endTimeDate ko directly IST String mein convert karein taaki Timezone mix na ho
      const endStr = Utilities.formatDate(endTimeDate, "IST", "HH:mm:ss");

      const startParts = String(startTimeStr).split(':');
      const endParts = endStr.split(':');

      const startH = parseInt(startParts[0] || 0, 10);
      const startM = parseInt(startParts[1] || 0, 10);
      const endH = parseInt(endParts[0], 10);
      const endM = parseInt(endParts[1], 10);

      // Hours aur Minutes ko total minutes mein badalna
      let startTotalMins = (startH * 60) + startM;
      let endTotalMins = (endH * 60) + endM;

      // Agar End Time Start Time se chhota hai, matlab Task agle din pause/khatam hua (Midnight Cross)
      if (startTotalMins > endTotalMins) {
        endTotalMins += (24 * 60);
      }

      sessionMinutes = endTotalMins - startTotalMins;
    }

    if (sessionMinutes < 0) sessionMinutes = 0; // Safety check

    // 3. Naya Total Calculate karo
    const newTotalMinutes = totalMinutes + sessionMinutes;
    const finalH = Math.floor(newTotalMinutes / 60);
    const finalM = newTotalMinutes % 60;

    return {
      totalStr: `${finalH}h ${finalM}m`,
      sessionMins: sessionMinutes
    };

  } catch (e) {
    Logger.log("Calc Error: " + e.toString());
    return { totalStr: oldTotalStr || "0h 0m", sessionMins: 0 };
  }
}

// --- UPDATE TAT & PLAN DATE (FIXED) ---
function updateTicketSchedule(ticketId, newTAT, newPlanDate, reason, empId) {
  try {
    const ticketRow = getSheetData(SHEET_NAMES.TICKETS).find(t => t['Ticket ID'] === ticketId);
    if (!ticketRow) return { success: false, message: 'Ticket not found.' };

    const update = {};
    const now = new Date();

    // 1. Update TAT
    if (newTAT) {
      update['TAT'] = newTAT;
    }

    // 2. Update Plan Date (Column I Fix)
    if (newPlanDate) {
      // YYYY-MM-DD string ko Date Object banayenge.
      // Google Sheet isse Date format m lega aur IST hone par 5:30:00 time khud lag jayega.
      update['Plan Date'] = new Date(newPlanDate);
    }

    update['Last Update Date'] = now;

    // User Info Fetch
    const user = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === empId);
    const actionBy = user ? user['Employee Name'] : empId;
    update['Last Action By'] = actionBy;

    // 3. Update Remarks (History Log)
    const oldRemarks = ticketRow['Remarks'] ? ticketRow['Remarks'] : "";
    const formattedRemark = `\n[${actionBy} - ${Utilities.formatDate(now, "IST", "dd/MM HH:mm")}]: 🕒 Schedule Updated. TAT: ${newTAT}, Plan: ${newPlanDate}. Reason: ${reason}`;
    update['Remarks'] = oldRemarks + formattedRemark;

    // 4. Log in Ticket History Sheet
    logTicketHistory(ticketId, actionBy, 'Schedule Update', `TAT: ${newTAT}, Date: ${newPlanDate}\nReason: ${reason}`, '');

    // 5. Update Main Sheet
    // Yeh line ensure karegi ki Column 'Plan Date' aur 'TAT' update hon.
    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, update);

    return { success: true, message: 'Schedule updated successfully.' };

  } catch (e) {
    Logger.log("Update Schedule Error: " + e.toString());
    return { success: false, message: e.message };
  }
}

// --- HELPER: SAVE FILE TO GOOGLE DRIVE (UPDATED FOR MULTIPLE FILES SUPPORT) ---
function saveBase64FileToDrive(dataObj, folderName) {
  try {
    if (!dataObj) return '';

    // यदि मल्टीपल फाइलें भेजी गई हैं (Array format), तो लूप चलाकर सेव करें
    if (Array.isArray(dataObj)) {
      var urls = [];
      for (var i = 0; i < dataObj.length; i++) {
        var url = saveBase64FileToDrive(dataObj[i], folderName);
        if (url) urls.push(url);
      }
      return urls.join(', '); // सभी लिंक्स को कॉमा से जोड़कर भेजें
    }

    // 🟢 फोल्डर ID मैपिंग लॉजिक
    var folderId = '1_su_xUngw2_4lsnE4sEAoOdRp_CdiKWW'; // डिफ़ॉल्ट सामान्य फोल्डर (Tickets / Expenses)
    if (folderName === 'TaskApp_Attendance') {
      folderId = '14aJqxwVxH5qI5EgSyB2ibqO1VsIpdT9w'; // अटेंडेंस फोटो फोल्डर
    }

    // ID द्वारा सीधे फोल्डर प्राप्त करें
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      // फॉलबैक: यदि कभी ID न मिले, तो नाम से सर्च करें
      var folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
    }

    // डेटा को हैंडल करें
    var base64Data = dataObj.base64 || dataObj;
    var contentType = dataObj.mimeType || 'image/png';
    var fileName = dataObj.fileName || ('File_' + Utilities.formatDate(new Date(), "IST", "yyyyMMdd_HHmmss"));

    // Base64 डिकोड करके Blob बनाएं
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, contentType, fileName);

    // फाइल सेव करें
    var file = folder.createFile(blob);

    // फाइल की शेयरिंग सेटिंग्स को पब्लिक करें
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // प्रीव्यू के लिए .getUrl() का उपयोग करें
    return file.getUrl();

  } catch (e) {
    Logger.log("saveBase64FileToDrive Error: " + e.toString());
    return ''; // एरर आने पर प्रोसेस न रुके
  }
}

// --- HELPER: GET TEAM MEMBERS (CASE-INSENSITIVE & ROBUST) ---
function getTeamIds(managerId) {
  const cleanManagerId = String(managerId || '').trim().toLowerCase();
  const allUsers = getCachedSheetData(SHEET_NAMES.USERS);

  // Aise users dhundo jinke 'Manager ID' ya 'Task Approver' mein meri ID likhi hai
  const team = allUsers.filter(u => {
    const assignedManagers = String(u['Manager ID'] || '').toLowerCase().split(',').map(id => id.trim());
    const assignedApprovers = String(u['Task Approver'] || '').toLowerCase().split(',').map(id => id.trim());
    return assignedManagers.includes(cleanManagerId) || assignedApprovers.includes(cleanManagerId);
  });

  // Un users ki Employee ID return karein (humesha clean uppercase mein)
  return team.map(u => String(u['Employee ID'] || '').trim().toUpperCase());
}

function getNextEmpCode(category) {
  try {
    const ss = SpreadsheetApp.openById(EMP_SPREADSHEET_ID); // External HR Sheet

    // Category के हिसाब से रेंज सेट करें
    let minId = 1;
    let maxLimit = 100;

    if (category === 'Intern') {
      minId = 101;
      maxLimit = 200;
    } else if (category === 'Freelancer') {
      minId = 201;
      maxLimit = 300;
    } else if (category === 'EMP') {
      minId = 1;
      maxLimit = 100;
    } else {
      // Default (Users/Master tab fallback)
      minId = 1;
      maxLimit = 100;
    }

    let maxFound = minId - 1; // शुरुआत पिछली आईडी से होगी (जैसे Intern के लिए 100 से)

    // सिर्फ उसी शीट को चेक करेंगे जिसमें डेटा सेव हो रहा है
    const sheet = ss.getSheetByName(category);

    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();

      data.forEach(row => {
        const code = String(row[0]).trim();
        const match = code.match(/^KRIS_(\d+)$/i);

        if (match) {
          const num = parseInt(match[1], 10);
          // सिर्फ उसी रेंज के नंबर्स को चेक करेगा
          if (num >= minId && num <= maxLimit) {
            if (num > maxFound) {
              maxFound = num;
            }
          }
        }
      });
    }

    const nextNum = maxFound + 1;

    // अगर लिमिट पार हो गई हो (उदा: 100 से ज्यादा EMP)
    if (nextNum > maxLimit) {
      return { success: false, message: `Limit reached for ${category} (Max allowed: KRIS_${maxLimit})` };
    }

    const paddedNum = String(nextNum).padStart(3, '0');
    return { success: true, code: `KRIS_${paddedNum}` };

  } catch (e) {
    Logger.log("ID Gen Error: " + e.toString());
    return { success: false, message: e.message };
  }
}


// --- 1. LOGIN FIX (Trim Spaces & Bypass Cache) ---
function authenticateUser(employeeId, password) {
  try {
    // 🚨 FIX 1: Login के लिए कभी Cache का इस्तेमाल न करें। हमेशा फ्रेश डेटा लें।
    const usersData = getSheetData(SHEET_NAMES.USERS);

    // 🟢 FIX 2: Sheet में अगर गलती से Space रह गया हो, तो .trim() उसे ठीक कर देगा
    const user = usersData.find(u =>
      String(u['Employee ID']).trim() === String(employeeId).trim() &&
      String(u['Password']).trim() === String(password).trim()
    );

    if (user) {
      // 🟢 FIX 3: Status को case-insensitive (छोटा-बड़ा अक्षर दोनों चलेगा) बनाया
      const userStatus = String(user['Status']).trim().toLowerCase();

      if (userStatus === 'active') {
        // Role में मौजूद फालतू Spaces को हटा दिया 
        user.Role = String(user.Role).trim();
        return { success: true, user: user };
      } else {
        return { success: false, message: 'Your account is inactive or blocked.' };
      }
    } else {
      return { success: false, message: 'Galat credentials. Kripya ID aur Password check karein.' };
    }
  } catch (e) {
    return { success: false, message: "Server Error: " + e.message };
  }
}

// --- 2. GET TEAM FIX (Case & Space Insensitive) ---
function getMyTeamMembers(managerId) {
  try {
    const cleanManagerId = String(managerId).trim().toLowerCase(); // 🟢 Safe Parsing
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const currentUser = allUsers.find(u => String(u['Employee ID']).trim().toLowerCase() === cleanManagerId);

    if (!currentUser) return [];
    const role = String(currentUser.Role).trim();

    if (role === 'Super Admin' || role === 'HR') {
      return allUsers.filter(u => u.Status === 'Active').map(u => ({ 'Employee ID': u['Employee ID'], 'Employee Name': u['Employee Name'] }));
    }

    // 🟢 Manager/Admin Team Logic
    const team = allUsers.filter(u => {
      if (u.Status !== 'Active') return false;
      if (String(u['Employee ID']).trim().toLowerCase() === cleanManagerId) return true; // Khud ko assign karna

      // Comma separated list ko properly split aur clean karna
      const assignedManagers = String(u['Manager ID'] || '').toLowerCase().split(',').map(id => id.trim());
      return assignedManagers.includes(cleanManagerId);
    });

    return team.map(u => ({ 'Employee ID': u['Employee ID'], 'Employee Name': u['Employee Name'] }));
  } catch (e) {
    return [];
  }
}

// --- GET ALL POTENTIAL MANAGERS (FOR SUPER ADMIN DROPDOWN) ---
function getAllManagersList() {
  try {
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    // Sirf wahi log jo Manager ya Admin role mein hain
    return allUsers
      .filter(u => ['Manager', 'Admin', 'Super Admin', 'HR'].includes(u.Role))
      .map(u => ({ id: u['Employee ID'], name: u['Employee Name'] }));
  } catch (e) {
    return [];
  }
}

// =====================================================
// FMS SECURITY + HIERARCHY HELPERS
// =====================================================
function _fmsSafe_(v) {
  return String(v == null ? '' : v).trim();
}

function _fmsNorm_(v) {
  return _fmsSafe_(v).toLowerCase();
}

function _fmsSplitIds_(v) {
  return _fmsSafe_(v)
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
}

function _fmsEscapeRegExp_(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-token match: "KRIS_001" KRIS_001 se match hoga, KRIS_0011 se nahi
function _fmsHasWholeToken_(haystack, needle) {
  haystack = _fmsNorm_(haystack);
  needle = _fmsNorm_(needle);
  if (!haystack || !needle) return false;

  const re = new RegExp('(^|[^a-z0-9_])' + _fmsEscapeRegExp_(needle) + '([^a-z0-9_]|$)', 'i');
  return re.test(haystack);
}

function _buildFmsVisibilityContext_(employeeId) {
  const userId = _fmsNorm_(employeeId);
  const allUsers = getCachedSheetData(SHEET_NAMES.USERS);

  const currentUser = allUsers.find(u =>
    _fmsNorm_(u['Employee ID']) === userId
  );

  if (!currentUser) {
    return {
      valid: false,
      allUsers,
      currentUser: null,
      role: 'User',
      userId,
      userName: '',
      teamMembers: [],
      firstNameCount: {}
    };
  }

  const role = _fmsSafe_(currentUser['Role'] || 'User');
  const userName = _fmsSafe_(currentUser['Employee Name']);

  // Unique first-name fallback ke liye count, taki Rahul/Rahul duplicate leak na kare
  const firstNameCount = {};
  allUsers.forEach(u => {
    if (_fmsNorm_(u['Status']) !== 'active') return;
    const first = _fmsNorm_(u['Employee Name']).split(/\s+/)[0];
    if (first) firstNameCount[first] = (firstNameCount[first] || 0) + 1;
  });

  // Ticket hierarchy jaisa:
  // Manager ID me current user ho OR Task Approver me current user ho => team member
  const teamMembers = allUsers.filter(u => {
    if (_fmsNorm_(u['Status']) !== 'active') return false;

    const empId = _fmsNorm_(u['Employee ID']);
    if (!empId || empId === userId) return false;

    const managerIds = _fmsSplitIds_(u['Manager ID']);
    const approverIds = _fmsSplitIds_(u['Task Approver']);

    return managerIds.includes(userId) || approverIds.includes(userId);
  });

  return {
    valid: true,
    allUsers,
    currentUser,
    role,
    userId,
    userName,
    teamMembers,
    firstNameCount
  };
}

function _fmsMatchesUser_(targetId, targetName, rowWho, rowEmpId, firstNameCount) {
  const id = _fmsNorm_(targetId);
  const name = _fmsNorm_(targetName);
  const who = _fmsNorm_(rowWho);
  const empId = _fmsNorm_(rowEmpId);

  if (!id && !name) return false;

  // Best match: FMS col A / Employee ID exact match
  if (id && empId === id) return true;

  // If Who column me ID likha hai
  if (id && _fmsHasWholeToken_(who, id)) return true;

  // Full name exact/whole-token match
  if (name && _fmsHasWholeToken_(who, name)) return true;

  // First-name fallback only when first name unique hai
  const firstName = name.split(/\s+/)[0];
  if (
    firstName &&
    firstNameCount &&
    firstNameCount[firstName] === 1 &&
    _fmsHasWholeToken_(who, firstName)
  ) {
    return true;
  }

  return false;
}

function _getFmsRowDecision_(ctx, row) {
  const rowEmpId = row[0]; // Col A
  const rowWho = row[4];   // Col E

  const isMyTask = _fmsMatchesUser_(
    ctx.userId,
    ctx.userName,
    rowWho,
    rowEmpId,
    ctx.firstNameCount
  );

  let isTeamTask = false;

  if (['Super Admin', 'HR'].includes(ctx.role)) {
    // Super Admin / HR ke liye "Team" ka matlab: meri task ke alawa baaki company tasks
    isTeamTask = !isMyTask;
  } else if (['Manager', 'Admin'].includes(ctx.role)) {
    isTeamTask = ctx.teamMembers.some(member =>
      _fmsMatchesUser_(
        member['Employee ID'],
        member['Employee Name'],
        rowWho,
        rowEmpId,
        ctx.firstNameCount
      )
    );
  }

  const canSee =
    ['Super Admin', 'HR'].includes(ctx.role) ||
    isMyTask ||
    isTeamTask;

  return { canSee, isMyTask, isTeamTask };
}

// =====================================================
// REPLACE OLD getFmsTasksForApp WITH THIS
// =====================================================
function getFmsTasksForApp(employeeId) {
  try {
    const ctx = _buildFmsVisibilityContext_(employeeId);
    if (!ctx.valid) {
      return { success: false, message: 'Access denied: user not found.' };
    }

    const sheet = getSheet(SHEET_NAMES.FMS);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1) {
      return {
        success: true,
        data: [],
        meta: { role: ctx.role, teamCount: ctx.teamMembers.length }
      };
    }

    const readCols = Math.max(lastCol, 13);
    const range = sheet.getRange(2, 1, lastRow - 1, readCols);
    const displayValues = range.getDisplayValues();
    const richTextValues = range.getRichTextValues();

    const tasks = [];

    displayValues.forEach((row, index) => {
      const rowEmpId = _fmsSafe_(row[0]);   // Col A
      const rowWho = _fmsSafe_(row[4]);     // Col E
      const fmsName = _fmsSafe_(row[5]);    // Col F
      const taskName = _fmsSafe_(row[6]);   // Col G

      // Empty / invalid rows skip
      if (!fmsName || !taskName) return;
      if (!rowEmpId && !rowWho) return;

      const decision = _getFmsRowDecision_(ctx, row);
      if (!decision.canSee) return;

      // Col K: Form Link. Rich text link bhi support karega.
      let hiddenLink = '';
      try {
        if (richTextValues[index] && richTextValues[index][10]) {
          hiddenLink = richTextValues[index][10].getLinkUrl() || '';
        }
      } catch (err) { }

      if (!hiddenLink && row[10] && String(row[10]).includes('http')) {
        hiddenLink = row[10];
      }

      tasks.push({
        rowId: index + 2,
        empId: row[0],
        what: row[1],
        when: row[2],
        how: row[3],
        who: row[4],
        fmsName: row[5],
        taskName: row[6],
        stepNo: row[7],
        planDate: row[8],
        actualDate: row[9],
        formLink: hiddenLink,
        delayDays: row[11] || '',
        onTimeStatus: row[12] || '',

        // Frontend filtering flags
        _isMyTask: decision.isMyTask,
        _isTeamTask: decision.isTeamTask,
        _role: ctx.role
      });
    });

    return {
      success: true,
      data: tasks,
      meta: {
        role: ctx.role,
        teamCount: ctx.teamMembers.length
      }
    };

  } catch (e) {
    Logger.log('getFmsTasksForApp Error: ' + e.toString());
    return { success: false, message: 'Backend Error: ' + e.message };
  }
}
function markFmsTaskDoneInApp(rowId, remarks, employeeId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // Enforce attendance gate
    enforceAttendanceGate(employeeId);

    // ... rest of the existing markFmsTaskDoneInApp logic ...
    lock.waitLock(10000);

    rowId = Number(rowId);
    if (!rowId || rowId < 2) {
      return { success: false, message: 'Invalid FMS row.' };
    }

    const visible = getFmsTasksForApp(employeeId);
    if (!visible.success) return visible;

    const task = (visible.data || []).find(t => Number(t.rowId) === rowId);

    if (!task) {
      return {
        success: false,
        message: 'Access denied: this FMS task is not assigned to you or your hierarchy.'
      };
    }

    if (!task._isMyTask) {
      return {
        success: false,
        message: 'View only: manager/team FMS tasks can be viewed, but only assigned user can complete them.'
      };
    }

    const sheet = getSheet(SHEET_NAMES.FMS);

    if (rowId > sheet.getLastRow()) {
      return { success: false, message: 'Invalid row in FMS sheet.' };
    }

    const currentActual = sheet.getRange(rowId, 10).getValue(); // Col J: Actual Date
    if (currentActual) {
      return { success: false, message: 'Task is already completed.' };
    }

    const today = new Date();

    // Actual Date
    sheet.getRange(rowId, 10).setValue(today);

    // Delay Days + On Time Status
    const planDate = sheet.getRange(rowId, 9).getValue(); // Col I: Plan Date
    let delay = 0;
    let status = 'On Time';

    if (planDate instanceof Date || (typeof planDate === 'string' && planDate.trim() !== '')) {
      const target = new Date(planDate);
      target.setHours(0, 0, 0, 0);

      const actual = new Date(today);
      actual.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((actual - target) / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        delay = diffDays;
        status = 'Late';
      }
    }

    sheet.getRange(rowId, 12).setValue(delay);  // Col L
    sheet.getRange(rowId, 13).setValue(status); // Col M

    CacheService.getScriptCache().remove(SHEET_NAMES.FMS);

    return { success: true, message: 'Task marked as done successfully!' };

  } catch (e) {
    Logger.log('markFmsTaskDoneInApp Error: ' + e.toString());
    return { success: false, message: e.message };

  } finally {
    try { lock.releaseLock(); } catch (err) { }
  }
}

function saveEmpMasterData(category, formData) {
  try {
    let ss;
    let sheet;

    // 'Users' के लिए Internal Sheet, बाकी EMP/Intern/Freelancer के लिए External Sheet
    if (category === 'Users') {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = ss.getSheetByName('Users');
    } else {
      ss = SpreadsheetApp.openById(EMP_SPREADSHEET_ID);
      sheet = ss.getSheetByName(category);
    }

    if (!sheet) return { success: false, message: `Sheet "${category}" not found.` };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());

    // ID Column ढूंढना
    let empCodeIndex = headers.indexOf('EMP Code');
    if (empCodeIndex === -1) empCodeIndex = headers.indexOf('Employee ID');
    if (empCodeIndex === -1) empCodeIndex = headers.indexOf('User ID');

    const empCode = formData['EMP Code'] || formData['User ID'] || formData['Employee ID'];
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    let rowIndex = -1;

    // Check if Edit (ID Match)
    if (empCodeIndex !== -1 && empCode) {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][empCodeIndex]).trim() === String(empCode).trim()) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    // 🟢 Map Form Data with Strict Formatting and Manual Entry Protection
    const rowData = headers.map((header, index) => {
      // केस-इंसेंसिटिव और स्पेस-ट्रिम्ड मिलान (जैसे 'Gender ' और 'Gender' का सही मिलान करने के लिए)
      let formKey = Object.keys(formData).find(k => k.trim().toLowerCase() === header.toLowerCase());
      let hasFormKey = formKey !== undefined;
      let formVal = hasFormKey ? formData[formKey] : undefined;

      // Google Sheet में पहले से मौजूद वैल्यू (यदि Edit मोड है)
      let existingVal = rowIndex > -1 ? values[rowIndex - 1][index] : undefined;

      // 🔒 डेटा प्रिजर्वेशन लॉजिक (सुरक्षा चक्र)
      if (rowIndex > -1) {
        // स्थिति 1: फ़ॉर्म में यह फ़ील्ड है ही नहीं (जैसे शीट में सीधे दर्ज किए गए मैनुअल कॉलम)
        if (!hasFormKey) {
          return existingVal !== undefined ? existingVal : '';
        }
        // स्थिति 2: फ़ॉर्म में फ़ील्ड है लेकिन उसे सबमिट करते समय खाली/ब्लैंक छोड़ा गया है
        if (formVal === undefined || formVal === null || String(formVal).trim() === '') {
          // यदि शीट में पहले से डेटा मौजूद है, तो उसे ही रहने दें (डिलीट या ब्लैंक न करें)
          if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '') {
            return existingVal;
          }
        }
      }

      // नई एंट्रीज़ या संशोधित वैल्यूज़ के लिए फॉलबैक
      let val = formVal;
      if (val === undefined || val === null || String(val).trim() === '') {
        if (header === 'Employee ID' || header === 'EMP Code' || header === 'User ID') {
          val = formData['EMP Code'] || formData['User ID'] || formData['Employee ID'] || '';
        } else if (header === 'Employee Name' || header === 'Name') {
          val = formData['Name'] || formData['Employee Name'] || '';
        } else if (header === 'Role' || header === 'Designation') {
          val = formData['Designation'] || formData['Role'] || '';
        } else if (header === 'Joining Date' || header === 'Date of Joining') {
          val = formData['Date of Joining'] || formData['Joining Date'] || '';
        } else if (header === 'Mobile Number' || header === 'Phone No') {
          val = formData['Phone No'] || formData['Mobile Number'] || '';
        } else if (header === 'Email') {
          val = formData['Official mail id if any'] || formData['Personal Email ID'] || formData['Email'] || '';
        } else if (header === 'Password') {
          val = '123456';
        } else if (header === 'Status') {
          val = formData['Status'] || 'Active';
        }
      }

      // तारीखों (Dates) को Sheets के मूल फ़ॉर्मेट में सेव करना
      if (['Date of Joining', 'Joining Date', 'Date of Birth', 'Anniversary Date', 'DOE'].includes(header) && val) {
        if (val instanceof Date) return val;
        let parsedDate = new Date(val);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate; // Sheets इसे अपने फ़ॉर्मेट में कनवर्ट कर लेगा
        }
      }

      return val === undefined ? '' : val;
    });

    // डेटा सुरक्षित रूप से सेव करें
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    // यदि अन्य शीटों (EMP, Freelancer, Intern) में बदलाव हुआ है, तो Users शीट को अपडेट करें
    if (category !== 'Users') {
      syncToAppUsers(formData, category);
    }

    return { success: true, message: `Employee ${empCode} saved successfully.` };

  } catch (e) {
    Logger.log("Save Error: " + e.toString());
    return { success: false, message: e.message };
  }
}

function saveEmpMasterDataWithFiles(category, formData, filePayloads) {
  try {
    if (filePayloads) {
      const empFolderId = '13Pa0LQCfgbBaimKdMJeIGNPOFGVlevHM'; // एम्प्लोयी डाक्यूमेंट्स फोल्डर ID
      let folder;
      try {
        folder = DriveApp.getFolderById(empFolderId);
      } catch (err) {
        // फॉलबैक: यदि ID न मिले
        const folderIterator = DriveApp.getFoldersByName("EMP_Documents");
        folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.createFolder("EMP_Documents");
      }

      if (filePayloads.offer) {
        formData['OFFER LETTER LINK'] = saveFileToFolder(filePayloads.offer, folder);
      }
      if (filePayloads.appointment) {
        formData['APPOINTMENT LETTER LINK'] = saveFileToFolder(filePayloads.appointment, folder);
      }
      if (filePayloads.bunch && filePayloads.bunch.length > 0) {
        const links = filePayloads.bunch.map(f => saveFileToFolder(f, folder));
        formData['Documents of Employee'] = links.join(', ');
      }
    }
    return saveEmpMasterData(category, formData);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function fixDrivePermissions() {
  DriveApp.getFoldersByName("TestFolder");
}

function FORCE_CLEAR_CACHE() {
  CacheService.getScriptCache().removeAll([
    'Users', 'Tickets', 'Attendance', 'FMS'
  ]);
  Logger.log("All Cache Cleared Successfully!");
}

// =======================================================
// 🚀 AUTO-CLOSE PENDING TICKETS (HIERARCHY TIMERS)
// =======================================================
function autoClosePendingTickets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.TICKETS);
    if (!sheet) return;

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];

    // Column Indexes
    const statusIdx = headers.indexOf('Status');
    const ticketIdIdx = headers.indexOf('Ticket ID');
    const lastUpdateIdx = headers.indexOf('Last Update Date');
    const closeDateIdx = headers.indexOf('Close Date');
    const remarksIdx = headers.indexOf('Remarks');
    const lastActionByIdx = headers.indexOf('Last Action By');
    const empIdIdx = headers.indexOf('Employee ID');

    if (statusIdx === -1 || lastUpdateIdx === -1) return;

    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const now = new Date();
    const timestamp = Utilities.formatDate(now, "IST", "dd/MM/yyyy HH:mm");
    let isUpdated = false;

    // Check every row (Skip Header)
    for (let i = 1; i < values.length; i++) {
      if (values[i][statusIdx] === 'Pending Approval') {
        const lastUpdate = new Date(values[i][lastUpdateIdx]);
        if (isNaN(lastUpdate.getTime())) continue;

        const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        let timeLimit = 72; // 🟢 डिफ़ॉल्ट: सामान्य यूज़र/मैनेजर्स के लिए 72 घंटे

        // 🟢 24 HOURS LOGIC FOR ALL SUPER ADMINS (Mitushi, Sunny, Nandlal, etc.)
        const ownerId = values[i][empIdIdx];
        const owner = allUsers.find(u => u['Employee ID'] === ownerId);

        // यदि टिकट किसी 'Super Admin' का है, तो बिना किसी अन्य कंडीशन के लिमिट सीधे 24 घंटे होगी
        if (owner && String(owner.Role).trim() === 'Super Admin') {
          timeLimit = 24;
        }

        // Timer Check
        if (diffHours >= timeLimit) {
          values[i][statusIdx] = 'Closed';
          if (closeDateIdx !== -1) values[i][closeDateIdx] = now;
          if (lastActionByIdx !== -1) values[i][lastActionByIdx] = 'System';

          const sysRemark = `\n[System - ${timestamp}]: Auto-Approved & Closed (Manager did not respond within ${timeLimit} hours).`;

          if (remarksIdx !== -1) {
            values[i][remarksIdx] = (values[i][remarksIdx] || "") + sysRemark;
          }

          logTicketHistory(values[i][ticketIdIdx], 'System', 'Auto-Approve', `Auto-Approved after ${timeLimit} hours`, '');
          isUpdated = true;
        }
      }
    }

    if (isUpdated) {
      dataRange.setValues(values);
      CacheService.getScriptCache().remove(SHEET_NAMES.TICKETS);
    }

  } catch (e) {
    Logger.log("autoClosePendingTickets Error: " + e.toString());
  }
}

// ==========================================
// 🚀 DIRECTOR TO-DO LIST FUNCTIONS (ADVANCED)
// ==========================================
function setupTodoSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = 'To-Do';
  let sheet = ss.getSheetByName(sheetName);

  // 🟢 TAT Column is now included in the headers
  const headers = ['Task ID', 'Employee ID', 'Task', 'Status', 'Priority', 'Due Date', 'TAT', 'Timestamp'];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setRowHeight(1, 30);
    sheet.getRange("1:1").setBackground("#f3f4f6");
    Logger.log("✅ To-Do sheet created!");
  } else {
    // Check if new columns exist, if not append them safely
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const missingHeaders = headers.filter(h => !existingHeaders.includes(h));
    if (missingHeaders.length > 0) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]).setFontWeight('bold');
      Logger.log("Added missing headers in To-Do: " + missingHeaders.join(', '));
    }
  }
}

function getTodos(employeeId) {
  try {
    const cleanId = String(employeeId).trim().toLowerCase();
    const todos = getSheetData(SHEET_NAMES.TODO).filter(t => {
      return String(t['Employee ID'] || '').trim().toLowerCase() === cleanId;
    });
    return { success: true, data: todos };
  } catch (e) { return { success: false, message: e.message }; }
}

function addTodo(employeeId, task, priority, dueDate) {
  try {
    enforceAttendanceGate(employeeId);

    // ... rest of the existing addTodo logic ...
    const taskId = 'TODO_' + new Date().getTime();

    const newTodo = {
      'Task ID': taskId,
      'Employee ID': employeeId,
      'Task': task,
      'Status': 'Pending',
      'Priority': priority || 'Medium',
      'Due Date': dueDate ? new Date(dueDate) : '',
      'Timestamp': new Date()
    };

    appendRowToSheet(SHEET_NAMES.TODO, newTodo);
    CacheService.getScriptCache().remove(SHEET_NAMES.TODO);

    // Agar Super Admin ne notification ke baad bhi To-Do add kiya,
    // to Akash ko instant WhatsApp jayega.
    notifyAkashForNewSuperAdminTodo_(employeeId, newTodo);

    return {
      success: true,
      message: 'To-Do added successfully.',
      taskId: taskId
    };

  } catch (e) {
    Logger.log("addTodo Error: " + e.toString());
    return {
      success: false,
      message: e.message
    };
  }
}

function toggleTodoStatus(taskId, currentStatus) {
  try {
    const todoData = getSheetData(SHEET_NAMES.TODO);
    const todoRow = todoData.find(t => t['Task ID'] === taskId);
    if (todoRow) {
      enforceAttendanceGate(todoRow['Employee ID']);
    }

    // ... rest of the existing toggleTodoStatus logic ...
    const newStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    updateRowInSheet(SHEET_NAMES.TODO, 'Task ID', taskId, { 'Status': newStatus });
    return { success: true, newStatus: newStatus };
  } catch (e) { return { success: false, message: e.message }; }
}

function editTodoItem(taskId, newTask, newPriority, newDueDate, newTAT) {
  try {
    const todoData = getSheetData(SHEET_NAMES.TODO);
    const todoRow = todoData.find(t => t['Task ID'] === taskId);
    if (todoRow) {
      enforceAttendanceGate(todoRow['Employee ID']);
    }

    // ... rest of the existing editTodoItem logic ...
    updateRowInSheet(SHEET_NAMES.TODO, 'Task ID', taskId, {
      'Task': newTask,
      'Priority': newPriority,
      'Due Date': newDueDate ? new Date(newDueDate) : '',
      'TAT': newTAT || '' // 🟢 Updates TAT column
    });
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

function deleteTodoItem(taskId) {
  try {
    const todoData = getSheetData(SHEET_NAMES.TODO);
    const todoRow = todoData.find(t => t['Task ID'] === taskId);
    if (todoRow) {
      enforceAttendanceGate(todoRow['Employee ID']);
    }

    // ... rest of the existing deleteTodoItem logic ...
    updateRowInSheet(SHEET_NAMES.TODO, 'Task ID', taskId, { 'Status': 'Deleted' });
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// 🚀 ADD BULK TODOS WITH TAT SUPPORT
// ==========================================
function addBulkTodos(employeeId, todosList) {
  try {
    enforceAttendanceGate(employeeId);

    // ... rest of the existing addBulkTodos logic ...
    const timestamp = new Date();

    // Har To-Do row ko process aur save karein
    todosList.forEach((todo, idx) => {
      // Avoid identical timestamps for unique Task ID generation
      const taskId = 'TODO_' + (timestamp.getTime() + idx);

      const newTodo = {
        'Task ID': taskId,
        'Employee ID': employeeId,
        'Task': todo.task,
        'Status': 'Pending',
        'Priority': todo.priority || 'Medium',
        'Due Date': todo.dueDate ? new Date(todo.dueDate) : '',
        'TAT': todo.tat || '', // 🟢 Save TAT to the Sheet
        'Timestamp': timestamp
      };

      appendRowToSheet(SHEET_NAMES.TODO, newTodo);

      // Super admin notifications (Akash reminder trigger)
      notifyAkashForNewSuperAdminTodo_(employeeId, newTodo);
    });

    CacheService.getScriptCache().remove(SHEET_NAMES.TODO);
    return { success: true, message: `${todosList.length} tasks added successfully.` };
  } catch (e) {
    Logger.log("addBulkTodos Error: " + e.toString());
    return { success: false, message: e.message };
  }
}

function fixBlankClientTickets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAMES.TICKETS);
    if (!sheet) return;

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];

    const empIdIdx = headers.indexOf('Employee ID');
    const statusIdx = headers.indexOf('Status');
    const ticketIdIdx = headers.indexOf('Ticket ID');
    const clientNameIdx = headers.indexOf('Name');
    const helpNameIdx = headers.indexOf('Help Person Name'); // 🟢 Index fetched

    if (empIdIdx === -1 || statusIdx === -1) return;

    let isUpdated = false;
    let newTicketsAssigned = 0;
    let latestTicketDetails = "";

    const ownerId = "MS101"; // Mitushi's ID

    for (let i = 1; i < values.length; i++) {
      let status = String(values[i][statusIdx]).trim();
      let empId = String(values[i][empIdIdx]).trim();

      if (status !== 'Closed' && status !== 'Completed' && status !== 'Approved by Client') {
        if (empId === '') {
          values[i][empIdIdx] = ownerId;
          if (helpNameIdx !== -1) {
            values[i][helpNameIdx] = 'Mitushi Sharma'; // 🟢 Update Help Person Name
          }
          isUpdated = true;
          newTicketsAssigned++;

          let tId = values[i][ticketIdIdx];
          let cName = values[i][clientNameIdx];
          latestTicketDetails += `🎫 ${tId} (${cName})\n`;
        }
      }
    }

    if (isUpdated) {
      dataRange.setValues(values);
      CacheService.getScriptCache().remove(SHEET_NAMES.TICKETS);

      const users = getCachedSheetData(SHEET_NAMES.USERS);
      let mitushiUser = users.find(u => String(u["Employee ID"]).toUpperCase() === ownerId);

      if (mitushiUser && mitushiUser["Mobile Number"]) {
        const msg = `🚨 *Client Ticket Alert* 🚨\n\nClient portal se ${newTicketsAssigned} nayi ticket(s) aayi hain jo kisi ko assign nahi thi.\n\nSystem ne automatically inhe aapke (MS101) account me daal diya hai:\n\n${latestTicketDetails}\nKripya portal open karein aur sahi user ko transfer karein.`;

        sendWhatsAppMessage(mitushiUser["Mobile Number"], msg);
      }
      Logger.log(`${newTicketsAssigned} blank tickets fixed & assigned to MS101.`);
    }
  } catch (e) {
    Logger.log("fixBlankClientTickets Error: " + e.toString());
  }
}

// =====================================================
// 🚀 WHATSAPP LOGGING & AUTO-RETRY SYSTEM
// =====================================================

// 1. यह फंक्शन पहली बार रन करने पर WA_Logs नाम की शीट बना देगा
function setupWaLogsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('WA_Logs');
  if (!sheet) {
    sheet = ss.insertSheet('WA_Logs');
    sheet.appendRow(['Log ID', 'Timestamp', 'Mobile Number', 'Message', 'Status', 'Retry Count', 'Last Retry']);
    sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#f3f4f6");
    Logger.log("WA_Logs Sheet Created!");
  }
  return sheet;
}

// 2. हर मैसेज का रिकॉर्ड WA_Logs शीट में सेव करने का फंक्शन
function logWhatsApp(number, message, status) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('WA_Logs');
    if (!sheet) sheet = setupWaLogsSheet(); // अगर शीट डिलीट हो गई हो तो बना देगा

    const logId = "WA_" + new Date().getTime() + Math.floor(Math.random() * 1000);
    sheet.appendRow([logId, new Date(), number, message, status, 0, ""]);
  } catch (e) {
    Logger.log("WA Log Error: " + e.message);
  }
}

function retryFailedWhatsAppMessages() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('WA_Logs');
    if (!sheet) return;

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (values.length <= 1) return;

    // 🟢 सक्रिय टिकट्स और उनके वर्तमान स्टेटस को लोड करें
    const tickets = getSheetData(SHEET_NAMES.TICKETS);
    const ticketStatusMap = {};
    tickets.forEach(t => {
      if (t['Ticket ID']) {
        ticketStatusMap[String(t['Ticket ID']).trim()] = String(t.Status || '').trim().toLowerCase();
      }
    });

    let isUpdated = false;

    // Header: [Log ID, Timestamp, Mobile Number, Message, Status, Retry Count, Last Retry]
    for (let i = 1; i < values.length; i++) {
      const status = values[i][4];

      if (status === "Failed") {
        const originalTimestamp = values[i][1]; // असली टाइमस्टैम्प
        const number = values[i][2];
        let message = values[i][3];
        let retryCount = parseInt(values[i][5]) || 0;

        // सुरक्षा: यदि री-ट्राई लिमिट (24 बार) पार हो चुकी है
        if (retryCount >= 24) continue;

        // 🟢 टिकट आईडी निकालें और उसका वर्तमान स्टेटस चेक करें
        const ticketIdMatch = message.match(/TICKET_[a-zA-Z0-9_]+/);
        if (ticketIdMatch) {
          const tId = ticketIdMatch[0].trim();
          const currentStatus = ticketStatusMap[tId];

          // यदि टिकट अब इनएक्टिव (Closed, Completed, Pending Approval, Approved by Client) है, तो री-ट्राई कैंसिल करें
          if (currentStatus && ['closed', 'completed', 'pending approval', 'approved by client'].includes(currentStatus)) {
            values[i][4] = "Cancelled (Ticket Inactive)";
            isUpdated = true;
            continue; // इस मैसेज को भेजने से रोकें और अगले मैसेज पर बढ़ें
          }
        }

        // Retry वाले मैसेज में असली Date/Time प्रदर्शित करने का लॉजिक
        if (!message.includes("[Delayed Message")) {
          const origDate = new Date(originalTimestamp);
          if (!isNaN(origDate.getTime())) {
            const origDateStr = Utilities.formatDate(origDate, "IST", "dd/MM/yyyy hh:mm a");
            message = `⚠️ *[Delayed Message | Origin: ${origDateStr}]*\n\n` + message;
            values[i][3] = message;
          }
        }

        // दोबारा भेजने का प्रयास करें
        let isSuccess = sendWhatsAppMessage(number, message, true);

        if (isSuccess) {
          values[i][4] = "Sent";
        } else {
          values[i][5] = retryCount + 1;
        }
        values[i][6] = new Date();
        isUpdated = true;
      }
    }

    if (isUpdated) {
      dataRange.setValues(values);
    }
  } catch (e) {
    Logger.log("Retry WA Error: " + e.toString());
  }
}
function forceApproveAllPendingTickets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // यह सीधे आपकी "Tickets" शीट को ही टारगेट करेगा
    const sheet = ss.getSheetByName('Tickets');

    if (!sheet) {
      Logger.log("Error: Tickets sheet not found.");
      return;
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];

    const statusIdx = headers.indexOf('Status');
    const ticketIdIdx = headers.indexOf('Ticket ID');
    const closeDateIdx = headers.indexOf('Close Date');
    const remarksIdx = headers.indexOf('Remarks');
    const lastActionByIdx = headers.indexOf('Last Action By');

    let isUpdated = false;
    const now = new Date();
    const timestamp = Utilities.formatDate(now, "IST", "dd/MM/yyyy HH:mm");
    let count = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i][statusIdx] === 'Pending Approval') {

        values[i][statusIdx] = 'Closed';
        if (closeDateIdx !== -1) values[i][closeDateIdx] = now;
        if (lastActionByIdx !== -1) values[i][lastActionByIdx] = 'System';

        const sysRemark = `\n[System - ${timestamp}]: Auto-Approved & Closed to clear old backlog.`;
        if (remarksIdx !== -1) values[i][remarksIdx] = (values[i][remarksIdx] || "") + sysRemark;

        // History sheet mein log
        logTicketHistory(values[i][ticketIdIdx], 'System', 'Auto-Approve', 'Old Backlog cleared by Admin', '');

        isUpdated = true;
        count++;
      }
    }

    if (isUpdated) {
      dataRange.setValues(values);
      CacheService.getScriptCache().remove('Tickets');
      Logger.log(`✅ Success! ${count} old pending tickets successfully approved & closed in Tickets sheet!`);
    } else {
      Logger.log("ℹ️ No pending tickets found in the system.");
    }

  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

// ==========================================
// 🚀 FIX: GET ALL USERS FOR ADMIN FUNCTION
// ==========================================
function getAllUsersForAdmin(adminId) {
  try {
    // 1. Fetch all users from cache/sheet
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);

    // 2. Return data
    return { success: true, data: allUsers };
  } catch (e) {
    Logger.log("Error in getAllUsersForAdmin: " + e.message);
    return { success: false, message: e.message };
  }
}

// =====================================================
// 🚀 TICKET TAT REMINDERS ENGINE (100% ENGLISH)
// =====================================================

function sendTicketStartReminder(ticketId, ticketRow, now) {
  try {
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const user = allUsers.find(u => String(u['Employee ID']).trim() === String(ticketRow['Employee ID']).trim());

    if (user && user['Mobile Number']) {
      const tat = ticketRow['TAT'] || '0';
      const clientName = ticketRow['Name'] || 'N/A';
      const category = ticketRow['Task Category'] || 'N/A';
      const description = ticketRow['Task Description'] || 'No Description';
      const priority = ticketRow['Priority'] || 'Normal';

      const message = `⏱️ *TASK TIMER STARTED (COUNTDOWN)* ⏱️\n` +
        `---------------------------------\n` +
        `Hello *${user['Employee Name']}*,\n\n` +
        `Your countdown timer is now live for *Ticket ID: ${ticketId}*:\n\n` +
        `🎫 *Ticket ID:* *${ticketId}*\n` +
        `🏢 *Client Name:* *${clientName}*\n` +
        `📂 *Category:* *${category}*\n` +
        `⚡ *Priority:* *${priority}*\n` +
        `🎯 *Allocated TAT:* *${tat} Minutes*\n` +
        `📝 *Task Description:* ${description}\n\n` +
        `📌 Please focus on completing this task safely within your target TAT limits!\n\n` +
        `~ Work Track System`;

      sendWhatsAppMessage(user['Mobile Number'], message);
    }
  } catch (e) {
    Logger.log("Error sending ticket start reminder: " + e.toString());
  }
}
function checkTicketTatReminders() {
  try {
    const tickets = getSheetData(SHEET_NAMES.TICKETS);
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const props = PropertiesService.getScriptProperties();
    const now = new Date();

    tickets.forEach(t => {
      // केस-इंसेंसिटिव स्टेटस चेक करने के लिए कनवर्ट करें
      const statusClean = String(t.Status || '').trim().toLowerCase();
      const ticketId = t['Ticket ID'];

      if (!ticketId) return;

      // 🧹 ऑटो-क्लीन: यदि टिकट क्लोज/कम्प्लीट हो गया है तो उसकी कीज तुरंत डिलीट करें
      if (['closed', 'completed', 'pending approval', 'approved by client'].includes(statusClean)) {
        props.deleteProperty(`T_OVDWARN_${ticketId}`);
        props.deleteProperty(`T_OVDBREACH_${ticketId}`);
        props.deleteProperty(`T_OVD10_${ticketId}`);
        props.deleteProperty(`T_OVD1H_${ticketId}`);
        props.deleteProperty(`T_OVDNEXT_${ticketId}`);
        return;
      }

      // केवल 'In Progress' एक्टिव टिकट्स ही आगे प्रोसेस होंगे
      if (statusClean !== 'in-progress' && statusClean !== 'in progress') return;

      const tatMinutes = Number(t['TAT']) || 0;
      if (tatMinutes <= 0) return;

      // 'Last Update Date' से समय की गणना करें
      let lastUpdateStr = t['Last Update Date'];
      if (!lastUpdateStr) return;

      let startTime = parseDateTimeSafe(lastUpdateStr);
      if (!startTime) {
        Logger.log(`Skipping ticket ${ticketId} due to unparseable Last Update Date: ${lastUpdateStr}`);
        return;
      }

      // Logging for Debugging (Execution Log में देखने के लिए)
      Logger.log(`Ticket ID: ${ticketId} | Parsed Start (IST): ${startTime} | Now (IST): ${now}`);

      // 🕒 Start Time को "hh:mm a" प्रारूप में बदलें (जैसे 10:15 AM)
      const startTimeStrFormatted = Utilities.formatDate(startTime, "IST", "hh:mm a");

      const endTime = new Date(startTime.getTime() + tatMinutes * 60 * 1000);
      const remainingMs = endTime.getTime() - now.getTime();
      const remainingMinutes = remainingMs / (60 * 1000);
      const overdueMinutes = (now.getTime() - endTime.getTime()) / (60 * 1000);

      const user = allUsers.find(u => String(u['Employee ID']).trim() === String(t['Employee ID']).trim());
      if (!user || !user['Mobile Number']) return;

      const clientName = t['Name'] || 'N/A';
      const category = t['Task Category'] || 'N/A';
      const description = t['Task Description'] || 'No Description';
      const priority = t['Priority'] || 'Normal';

      // --- 🚨 REMINDER 1: TAT पूरा होने से 5 मिनट पहले ---
      if (remainingMinutes <= 5 && remainingMinutes > 0) {
        const warnKey = `T_OVDWARN_${ticketId}`;
        if (props.getProperty(warnKey) !== 'done') {
          const message = `⚠️ *CRITICAL WARNING: 5 MINS REMAINING* ⚠️\n` +
            `---------------------------------\n` +
            `Hello *${user['Employee Name']}*,\n\n` +
            `This is an urgent alert. You have only *5 minutes remaining* to finish your task before a TAT breach!\n\n` +
            `🎫 *Ticket ID:* *${ticketId}*\n` +
            `🏢 *Client Name:* *${clientName}*\n` +
            `📂 *Category:* *${category}*\n` +
            `⚡ *Priority:* *${priority}*\n` +
            `🕒 *Start Time:* *${startTimeStrFormatted}*\n` +
            `🎯 *Total TAT Allowed:* *${tatMinutes} Minutes*\n` +
            `📝 *Task Description:* ${description}\n\n` +
            `👉 Kripya task ko jald se jald khatam karke close/pause karein taaki active breach na ho!\n\n` +
            `~ Work Track System`;

          const success = sendWhatsAppMessage(user['Mobile Number'], message);
          if (success) props.setProperty(warnKey, 'done');
        }
      }

      // --- 🚨 REMINDER 2: TAT पूरा होने पर (Immediate Breach) ---
      if (overdueMinutes >= 0) {
        const breachKey = `T_OVDBREACH_${ticketId}`;
        if (props.getProperty(breachKey) !== 'done') {
          const message = `🚨 *ALERT: TAT BREACH OCCURRED* 🚨\n` +
            `---------------------------------\n` +
            `Hello *${user['Employee Name']}*,\n\n` +
            `Attention! *Ticket ID: ${ticketId}* has just breached its allocated Turnaround Time (TAT) limit!\n\n` +
            `🎫 *Ticket ID:* *${ticketId}*\n` +
            `🏢 *Client Name:* *${clientName}*\n` +
            `📂 *Category:* *${category}*\n` +
            `⚡ *Priority:* *${priority}*\n` +
            `🕒 *Start Time:* *${startTimeStrFormatted}*\n` +
            `🎯 *Allocated TAT:* *${tatMinutes} Minutes*\n` +
            `📝 *Task Description:* ${description}\n\n` +
            `👉 Please prioritize, complete, and submit this ticket immediately to resolve the backlog!\n\n` +
            `~ Work Track System`;

          const success = sendWhatsAppMessage(user['Mobile Number'], message);
          if (success) props.setProperty(breachKey, 'done');
        }
      }

      // --- 🚨 REMINDER 3: TAT पूरा होने के 10 मिनट बाद ---
      if (overdueMinutes >= 10) {
        const overdue10Key = `T_OVD10_${ticketId}`;
        if (props.getProperty(overdue10Key) !== 'done') {
          const message = `🚨 *ALERT: TASK 10 MINS OVERDUE* 🚨\n` +
            `---------------------------------\n` +
            `Hello *${user['Employee Name']}*,\n\n` +
            `This is an escalation notice. *Ticket ID: ${ticketId}* is now *10+ minutes overdue*!\n\n` +
            `🎫 *Ticket ID:* *${ticketId}*\n` +
            `🏢 *Client Name:* *${clientName}*\n` +
            `📂 *Category:* *${category}*\n` +
            `⚡ *Priority:* *${priority}*\n` +
            `🕒 *Start Time:* *${startTimeStrFormatted}*\n` +
            `📝 *Task Description:* ${description}\n\n` +
            `👉 Kindly focus and resolve this task without further delays!\n\n` +
            `~ Work Track System`;

          const success = sendWhatsAppMessage(user['Mobile Number'], message);
          if (success) props.setProperty(overdue10Key, 'done');
        }
      }

      // --- 🚨 REMINDER 4: TAT पूरा होने के 1 घंटे बाद (60+ minutes) ---
      if (overdueMinutes >= 60) {
        const overdue1HKey = `T_OVD1H_${ticketId}`;
        if (props.getProperty(overdue1HKey) !== 'done') {
          const message = `🚨 *CRITICAL ALERT: 1 HOUR OVERDUE* 🚨\n` +
            `---------------------------------\n` +
            `Hello *${user['Employee Name']}*,\n\n` +
            `This is a severe delay notice. It has been *1 hour* since your Turnaround Time (TAT) expired, and *Ticket ID: ${ticketId}* is still open!\n\n` +
            `🎫 *Ticket ID:* *${ticketId}*\n` +
            `🏢 *Client Name:* *${clientName}*\n` +
            `📂 *Category:* *${category}*\n` +
            `⚡ *Priority:* *${priority}*\n` +
            `🕒 *Start Time:* *${startTimeStrFormatted}*\n` +
            `📝 *Task Description:* ${description}\n\n` +
            `👉 This delay is being tracked. Kindly complete and close this critical task immediately.\n\n` +
            `~ Work Track System`;

          const success = sendWhatsAppMessage(user['Mobile Number'], message);
          if (success) props.setProperty(overdue1HKey, 'done');
        }
      }

      // --- 🚨 REMINDER 5: अगले दिन सुबह 9:30 AM पर अंतिम चेतावनी ---
      if (overdueMinutes >= 60) {
        const overdueNextKey = `T_OVDNEXT_${ticketId}`;
        if (props.getProperty(overdueNextKey) !== 'done') {
          const todayStr = Utilities.formatDate(now, "IST", "yyyy-MM-dd");
          const startTimeStr = Utilities.formatDate(startTime, "IST", "yyyy-MM-dd");

          if (todayStr !== startTimeStr) {
            const currentHour = parseInt(Utilities.formatDate(now, "IST", "HH"), 10);
            const currentMin = parseInt(Utilities.formatDate(now, "IST", "mm"), 10);
            const currentTotalMins = (currentHour * 60) + currentMin;
            const targetTotalMins = (9 * 60) + 30; // 9:30 AM IST

            if (currentTotalMins >= targetTotalMins) {
              const message = `🚨 *FINAL WARNING: BACKLOG OVERDUE TASK* 🚨\n` +
                `---------------------------------\n` +
                `Hello *${user['Employee Name']}*,\n\n` +
                `This is your next-day final warning. *Ticket ID: ${ticketId}* from yesterday is *still open* and unresolved!\n\n` +
                `🎫 *Ticket ID:* *${ticketId}*\n` +
                `🏢 *Client Name:* *${clientName}*\n` +
                `📂 *Category:* *${category}*\n` +
                `🕒 *Start Time:* *${startTimeStrFormatted}*\n` +
                `📝 *Task Description:* ${description}\n\n` +
                `👉 Kripya aaj morning me sabse pehle is task ko poora karke submit karein taaki backlog clear ho sake.\n\n` +
                `~ Work Track System`;

              const success = sendWhatsAppMessage(user['Mobile Number'], message);
              if (success) props.setProperty(overdueNextKey, 'done');
            }
          }
        }
      }
    });
  } catch (e) {
    Logger.log("Error in checkTicketTatReminders: " + e.toString());
  }
}
/**
 * भारतीय और वैश्विक प्रारूपों में तारीख और समय को सुरक्षित और सटीक रूप से पार्स करता है।
 * टाइमज़ोन की गड़बड़ी को रोकने के लिए यह हमेशा IST (+05:30) ऑफ़सेट लागू करता है।
 */
function parseDateTimeSafe(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  try {
    let str = String(val).trim();

    // स्लैश (/) और डॉट्स (.) को डैश (-) में बदलें ताकि पार्सिंग आसान हो
    let cleanStr = str.replace(/[\/\-\.]/g, '-');

    // समय (HH:mm:ss) और AM/PM को अलग निकालें
    let timeMatch = cleanStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?/i);
    let hour = 0, min = 0, sec = 0;
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      min = parseInt(timeMatch[2], 10);
      sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      let ampm = timeMatch[4];
      if (ampm) {
        ampm = ampm.toUpperCase();
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
      }
    }

    // तारीख वाले हिस्से को निकालें (e.g. "25-01-2026")
    let datePart = cleanStr.split(/\s+/)[0];
    let dateParts = datePart.split('-');

    if (dateParts.length !== 3) return null;

    let year = 0, month = 0, day = 0;

    // यदि वर्ष पहले स्थान पर है (YYYY-MM-DD)
    if (dateParts[0].length === 4) {
      year = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10);
      day = parseInt(dateParts[2], 10);
    }
    // यदि वर्ष आखिरी स्थान पर है (DD-MM-YYYY या MM-DD-YYYY)
    else if (dateParts[2].length === 4 || dateParts[2].length === 2) {
      year = parseInt(dateParts[2], 10);
      if (year < 100) year += 2000;

      let part1 = parseInt(dateParts[0], 10);
      let part2 = parseInt(dateParts[1], 10);

      // भारतीय मानक (DD-MM-YYYY) को प्राथमिकता दें, लेकिन यदि दूसरा हिस्सा 12 से बड़ा है तो MM-DD-YYYY मानें
      if (part2 > 12) {
        month = part1;
        day = part2;
      } else {
        day = part1;
        month = part2;
      }
    } else {
      return null;
    }

    // तारीख की वैधता जांचें
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    // ISO-8601 प्रारूप तैयार करें और अंत में IST का टाइमज़ोन (+05:30) जोड़ें
    let yyyy = String(year);
    let mm = String(month).padStart(2, '0');
    let dd = String(day).padStart(2, '0');
    let hh = String(hour).padStart(2, '0');
    let minStr = String(min).padStart(2, '0');
    let ss = String(sec).padStart(2, '0');

    let isoStr = `${yyyy}-${mm}-${dd}T${hh}:${minStr}:${ss}+05:30`;
    let parsedDate = new Date(isoStr);

    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  } catch (e) {
    Logger.log("Error in parseDateTimeSafe: " + e.toString());
  }
  return null;
}
function processExpenseApproval(expenseId, status, remarks, adminId) {
  try {
    enforceAttendanceGate(adminId);

    // ... rest of the existing processExpenseApproval logic ...
    const expenseList = getSheetData(SHEET_NAMES.EXPENSES);
    const expenseRow = expenseList.find(e => e['Expense ID'] === expenseId);
    if (!expenseRow) return { success: false, message: 'Expense record not found.' };

    const admin = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === adminId);
    if (!admin || !['Admin', 'Super Admin', 'HR'].includes(admin.Role)) {
      return { success: false, message: 'Unauthorized access.' };
    }

    const update = {
      'Status': status,
      'Approver': admin['Employee Name']
    };

    const success = updateRowInSheet(SHEET_NAMES.EXPENSES, 'Expense ID', expenseId, update);

    if (success) {
      const employee = getCachedSheetData(SHEET_NAMES.USERS).find(u => u['Employee ID'] === expenseRow['Employee ID']);
      if (employee && employee['Mobile Number']) {
        const emoji = status === 'Approved' ? '✅' : '❌';
        const msg = `${emoji} *EXPENSE CLAIM ${status.toUpperCase()}* ${emoji}\n` +
          `---------------------------------\n` +
          `Hello *${employee['Employee Name']}*,\n\n` +
          `Your submitted expense claim has been processed by the Admin:\n\n` +
          `🎫 *Expense ID:* *${expenseId}*\n` +
          `📌 *Type:* *${expenseRow.Type}*\n` +
          `💵 *Amount:* *₹${parseFloat(expenseRow.Amount).toFixed(2)}*\n` +
          `📝 *Description:* ${expenseRow.Description}\n\n` +
          `⚙ *Action:* *${status.toUpperCase()}*\n` +
          `👤 *Approver:* *${admin['Employee Name']}*\n` +
          `💬 *Admin Remarks:* *${remarks || 'No remarks provided.'}*\n\n` +
          `~ Work Track System`;
        sendWhatsAppMessage(employee['Mobile Number'], msg);
      }
    }
    return { success: true, message: `Expense claim ${status} successfully.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// 🟢 ADDED: Secure Password Change Handler
function changeUserPassword(employeeId, oldPassword, newPassword) {
  try {
    const sheetName = SHEET_NAMES.USERS;
    const users = getSheetData(sheetName);

    // पुराना पासवर्ड वेरीफाई करें
    const userIndex = users.findIndex(u =>
      String(u['Employee ID']).trim() === String(employeeId).trim() &&
      String(u['Password']).trim() === String(oldPassword).trim()
    );

    if (userIndex === -1) {
      return { success: false, message: 'Galat purana password! Kripya sahi password enter karein.' };
    }

    // नया पासवर्ड अपडेट करें
    const success = updateRowInSheet(sheetName, 'Employee ID', employeeId, { 'Password': newPassword });
    if (success) {
      return { success: true, message: 'Aapka password safaltapoorvak badal diya gaya hai.' };
    } else {
      return { success: false, message: 'Password update karne me takneeki samasya aayi.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// --- 🔄 FIXED: TRANSFER TICKET APPROVAL AUTHORITY ---
function transferTicketApproval(ticketId, targetManagerId, currentManagerId, remarks) {
  try {
    enforceAttendanceGate(currentManagerId);

    // ... rest of the existing transferTicketApproval logic ...
    const ticketList = getSheetData(SHEET_NAMES.TICKETS);
    const ticketRow = ticketList.find(t => t['Ticket ID'] === ticketId);
    if (!ticketRow) return { success: false, message: 'Ticket not found.' };

    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const currentManager = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === String(currentManagerId).trim().toUpperCase());
    const targetManager = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === String(targetManagerId).trim().toUpperCase());

    if (!currentManager || !targetManager) {
      return { success: false, message: 'Manager details not found.' };
    }

    const update = {
      'Reassigned To': targetManagerId,
      'Reassigned By': currentManagerId,
      'Last Action By': currentManager['Employee Name'],
      'Last Update Date': new Date()
    };

    const oldRemarks = ticketRow['Remarks'] ? ticketRow['Remarks'] + "\n" : "";
    update['Remarks'] = `${oldRemarks}[${new Date().toLocaleDateString()} Approval Transferred to ${targetManager['Employee Name']}]: ${remarks}`;

    updateRowInSheet(SHEET_NAMES.TICKETS, 'Ticket ID', ticketId, update);

    // Log ticket history
    logTicketHistory(ticketId, currentManager['Employee Name'], 'Approval Transferred', `Transferred to ${targetManager['Employee Name']}. Remarks: ${remarks}`, '');

    // Target Manager को व्हाट्सऐप अलर्ट भेजें
    if (targetManager['Mobile Number']) {
      const clientName = ticketRow['Name'] || 'N/A';
      const category = ticketRow['Task Category'] || 'N/A';
      const description = ticketRow['Task Description'] || 'N/A';
      const completedBy = ticketRow['Employee ID'];

      // 🟢 FIX: 'getUserName' एरर को बाईपास करने के लिए बैकएंड यूज़र लिस्ट से नाम निकालें
      const completedByRow = allUsers.find(u => String(u['Employee ID']).trim().toUpperCase() === String(completedBy).trim().toUpperCase());
      const completedByName = completedByRow ? completedByRow['Employee Name'] : completedBy;

      const msg = `🔄 *APPROVAL AUTHORITY TRANSFERRED* 🔄\n` +
        `---------------------------------\n` +
        `Hello *${targetManager['Employee Name']}*,\n\n` +
        `An approval authority has been transferred to you by *${currentManager['Employee Name']}*:\n\n` +
        `🎫 *Ticket ID:* *${ticketId}*\n` +
        `🏢 *Client Name:* *${clientName}*\n` +
        `📂 *Category:* *${category}*\n` +
        `👤 *Completed By:* *${completedByName}* (${completedBy})\n` +
        `📝 *Task Details:* ${description}\n\n` +
        `💬 *Transfer Reason/Remarks:* *${remarks || 'No remarks provided.'}*\n\n` +
        `👉 Kindly log in to your Pending Approvals dashboard to review and approve/reject this ticket.\n\n` +
        `~ Work Track System`;
      sendWhatsAppMessage(targetManager['Mobile Number'], msg);
    }

    return { success: true, message: `Approval authority successfully transferred to ${targetManager['Employee Name']}.` };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}
// --- 👥 GET ONLY REGISTERED TASK APPROVERS ---
function getTaskApproversList() {
  try {
    const allUsers = getCachedSheetData(SHEET_NAMES.USERS);
    const approverIds = new Set();

    // सभी यूज़र्स के 'Task Approver' कॉलम से यूनिक आईडी कलेक्ट करें
    allUsers.forEach(u => {
      const approverVal = String(u['Task Approver'] || '').trim();
      if (approverVal !== "") {
        // यदि कॉमा-सेपरेटेड लिस्ट है तो उसे स्प्लिट करें
        approverVal.split(',').forEach(id => {
          const cleanId = id.trim().toUpperCase();
          if (cleanId) {
            approverIds.add(cleanId);
          }
        });
      }
    });

    // कलेक्ट की गई आईडी को यूज़र्स डेटा से मैच करके केवल एक्टिव अप्रूवर्स की लिस्ट भेजें
    return allUsers
      .filter(u => approverIds.has(String(u['Employee ID']).trim().toUpperCase()) && String(u['Status']).trim().toLowerCase() === 'active')
      .map(u => ({ id: u['Employee ID'], name: u['Employee Name'] }));
  } catch (e) {
    Logger.log("Error in getTaskApproversList: " + e.toString());
    return [];
  }
}
// 🟢 संशोधित सुरक्षित फ़ंक्शन: आईडी-आधारित एक्सेस कंट्रोल के साथ
function getFormsData(employeeId) {
  try {
    const data = getSheetData(SHEET_NAMES.FORMS);
    if (!employeeId) {
      return { success: true, data: [] }; // सुरक्षा फ़ॉल-बैक
    }

    const cleanEmpId = String(employeeId).trim().toUpperCase();

    // केवल वही फॉर्म भेजें जिन्हें देखने की अनुमति लॉग-इन यूजर को है
    const filteredData = data.filter(row => {
      const viewerVal = String(row['Viewer'] || '').trim().toUpperCase();

      // यदि Viewer खाली है, '-' है या 'ALL' लिखा है, तो सभी देख सकते हैं
      if (viewerVal === '' || viewerVal === 'ALL' || viewerVal === '-') {
        return true;
      }

      // कॉमा-सेपरेटेड लिस्ट को विभाजित कर चेक करें कि यूजर आईडी शामिल है या नहीं
      const allowedViewers = viewerVal.split(',').map(id => id.trim());
      return allowedViewers.includes(cleanEmpId);
    });

    return { success: true, data: filteredData };
  } catch (e) {
    Logger.log("getFormsData Error: " + e.toString());
    return { success: false, message: e.message };
  }
}
// =====================================================================
// 🚀 CLIENTS & FORMS - SECURE ADMIN OPERATIONS (STRICT MS101 ACCESS ONLY)
// =====================================================================

// 1. क्लाइंट डेटा अपडेट / सेव करना
function saveClientPortalData(clientData, adminId) {
  try {
    if (String(adminId).trim().toUpperCase() !== 'MS101') {
      return { success: false, message: 'Access Denied: Only MS101 has rights to update Clients.' };
    }

    const sheet = getSheet(SHEET_NAMES.CLIENTS);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'No client records found.' };

    const updateObj = {
      'Client Name': clientData['Client Name'],
      'Mobile Number': clientData['Mobile Number'],
      'Address': clientData['Address'],
      'Status': clientData['Status'],
      'Password': clientData['Password'],
      'Detail Shared': clientData['Detail Shared'],
      'Services': clientData['Services'],
      'Client Email ID': clientData['Client Email ID']
    };

    const updated = updateRowInSheet(SHEET_NAMES.CLIENTS, 'Client_Id', clientData['Client_Id'], updateObj);
    return { success: updated, message: updated ? 'Client details updated successfully.' : 'Update failed.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// 2. फॉर्म डेटा अपडेट / सेव करना
function saveFormsPortalData(formData, adminId) {
  try {
    if (String(adminId).trim().toUpperCase() !== 'MS101') {
      return { success: false, message: 'Access Denied: Only MS101 has rights to update Forms.' };
    }

    const updateObj = {
      'Department': formData['Department'],
      'For': formData['For'],
      'Form link': formData['Form link'],
      'Viewer': formData['Viewer']
    };

    const updated = updateRowInSheet(SHEET_NAMES.FORMS, 'Sheet name', formData['Sheet name'], updateObj);
    return { success: updated, message: updated ? 'Form details updated successfully.' : 'Update failed.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// 3. क्लाइंट डिलीट (Status: In-Active / Delete)
function deleteClientPortalData(clientId, adminId) {
  try {
    if (String(adminId).trim().toUpperCase() !== 'MS101') {
      return { success: false, message: 'Access Denied: Only MS101 can delete records.' };
    }
    const success = updateRowInSheet(SHEET_NAMES.CLIENTS, 'Client_Id', clientId, { 'Status': 'In-Active' });
    return { success: success, message: success ? 'Client status set to In-Active.' : 'Deletion failed.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// 4. फॉर्म डिलीट करना (Row Remove)
function deleteFormsPortalData(sheetName, adminId) {
  try {
    if (String(adminId).trim().toUpperCase() !== 'MS101') {
      return { success: false, message: 'Access Denied: Only MS101 can delete records.' };
    }
    const sheet = getSheet(SHEET_NAMES.FORMS);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(sheetName).trim()) {
        sheet.deleteRow(i + 1);
        CacheService.getScriptCache().remove(SHEET_NAMES.FORMS);
        return { success: true, message: 'Form deleted successfully.' };
      }
    }
    return { success: false, message: 'Form record not found.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
// 🟢 नया फ़ंक्शन: क्लाइंट्स शीट का संपूर्ण डेटा प्राप्त करने के लिए (Data Missing Gap सुलझाएगा)
function getClientsPortalData() {
  try {
    const data = getSheetData(SHEET_NAMES.CLIENTS);
    return { success: true, data: data };
  } catch (e) {
    Logger.log("getClientsPortalData Error: " + e.toString());
    return { success: false, message: e.message };
  }
}

// 🟢 नया फ़ंक्शन: पोर्टल से सीधे नया फॉर्म जोड़ने के लिए (Forms Portal Addition)
function addFormsPortalData(formData, adminId) {
  try {
    if (String(adminId).trim().toUpperCase() !== 'MS101') {
      return { success: false, message: 'Access Denied: Only MS101 can add forms.' };
    }
    const newRow = {
      'Department': formData['Department'],
      'Sheet name': formData['Sheet name'],
      'For': formData['For'],
      'Form link': formData['Form link'],
      'Viewer': formData['Viewer']
    };
    appendRowToSheet(SHEET_NAMES.FORMS, newRow);
    return { success: true, message: 'New form record added successfully.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
/**
 * Helper to check if a user has an active Punch In record for today.
 * Returns true if the user is currently Punched In and has not Punched Out.
 */
function checkUserAttendanceActive(employeeId) {
  try {
    const sheet = getSheet(SHEET_NAMES.ATTENDANCE);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;

    const todayStr = Utilities.formatDate(new Date(), "IST", "yyyy-MM-dd");
    // Read relevant columns (A to E: Date, Time, Employee ID, Employee Name, Action)
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const searchId = String(employeeId).trim().toUpperCase();

    let latestTime = 0;
    let latestAction = null;

    for (let i = 0; i < data.length; i++) {
      const rowEmpId = String(data[i][2] || '').trim().toUpperCase();
      if (rowEmpId === searchId) {
        const rowDateObj = parseDateTimeSafe(data[i][0]);
        if (rowDateObj) {
          const rowDateStr = Utilities.formatDate(rowDateObj, "IST", "yyyy-MM-dd");
          if (rowDateStr === todayStr) {
            const rowTimeMs = rowDateObj.getTime();
            if (rowTimeMs >= latestTime) {
              latestTime = rowTimeMs;
              latestAction = String(data[i][4] || '').trim(); // "Punch In" or "Punch Out"
            }
          }
        }
      }
    }
    return (latestAction === 'Punch In');
  } catch (e) {
    Logger.log("Error in checkUserAttendanceActive: " + e.toString());
    return false;
  }
}

/**
 * Gatekeeper function to prevent actions if attendance is not active.
 */
function enforceAttendanceGate(employeeId) {
  if (!employeeId || String(employeeId).trim() === "" || String(employeeId).trim().toLowerCase() === "client") {
    return; // Do not block direct client actions
  }
  if (!checkUserAttendanceActive(employeeId)) {
    throw new Error("Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!");
  }
}
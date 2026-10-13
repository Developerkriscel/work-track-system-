import { insertRow, upsertRow, findRowsByFilter, listRows } from './legacyStore.service.js';
import { sendWhatsAppText } from './aknexusWhatsApp.service.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

export function canManageAssets(role = '') {
  return /^(super admin|admin|hr)$/i.test(String(role || '').trim());
}

export function getActorLabel(authUser = {}, userList = []) {
  const empId = String(authUser?.sub || authUser?.id || '').trim();
  if (!empId) return authUser?.name || 'HR / Admin';
  const match = Array.isArray(userList)
    ? userList.find(
        (u) => String(u['Employee ID'] || u['User ID'] || u.employeeId || u.id || '').trim().toLowerCase() === empId.toLowerCase()
      )
    : null;
  const name = authUser?.name || match?.['Employee Name'] || match?.Name || match?.name || '';
  if (name) return `${name} (${empId})`;
  return empId;
}

export async function getAssetsOverview(authUser) {
  const isManager = canManageAssets(authUser.role);
  const users = await listRows('User');
  const activeEmployees = users
    .filter((u) => !/^(inactive|disabled|terminated|deleted)$/i.test(u.Status || u.status || ''))
    .map((u) => ({
      id: u['Employee ID'] || u['User ID'] || u.employeeId || u.id,
      name: u['Employee Name'] || u.Name || u.name,
      department: u.Department || u.department || '',
      role: u.Role || u.role || 'User'
    }));

  function enrichAssetRecord(asset) {
    if (!asset) return asset;
    let assignedBy = asset['Assigned By'];
    if (!assignedBy || assignedBy === 'HR / Admin' || assignedBy === 'null') {
      const history = Array.isArray(asset.History) ? asset.History : [];
      const assignEntry = history.slice().reverse().find(h => h.action === 'Assigned' && h.assignedBy);
      if (assignEntry && assignEntry.assignedBy) {
        assignedBy = assignEntry.assignedBy;
      } else if (asset['Last Updated By'] && asset['Last Updated By'] !== 'null') {
        assignedBy = asset['Last Updated By'];
      } else if (asset['Created By'] && asset['Created By'] !== 'null') {
        assignedBy = asset['Created By'];
      }
    }
    if (assignedBy && !String(assignedBy).includes('(')) {
      const match = users.find(u => String(u['Employee ID'] || u['User ID'] || u.employeeId || u.id || '').trim().toLowerCase() === String(assignedBy).trim().toLowerCase());
      if (match) {
        const name = match['Employee Name'] || match.Name || match.name || '';
        if (name) assignedBy = `${name} (${assignedBy})`;
      }
    }
    return {
      ...asset,
      'Assigned By': assignedBy || (String(asset.Status).toLowerCase() === 'assigned' ? 'Akash Sablaniya (KRIS_007)' : '')
    };
  }

  const myEmpId = String(authUser.sub || authUser.id || '').trim();

  if (isManager) {
    const [allAssets, allRequests] = await Promise.all([
      findRowsByFilter('Asset', {}),
      findRowsByFilter('AssetRequest', {})
    ]);

    const enrichedAll = allAssets.map(enrichAssetRecord);

    const myAssignedAssets = enrichedAll.filter((a) => {
      const assignedId = String(a['Assigned To ID'] || a.assignedToId || a['Employee ID'] || '').trim().toLowerCase();
      return Boolean(assignedId && myEmpId && assignedId === myEmpId.toLowerCase());
    });

    const stats = {
      total: enrichedAll.length,
      assigned: enrichedAll.filter((a) => String(a.Status || a.status).toLowerCase() === 'assigned').length,
      available: enrichedAll.filter((a) => String(a.Status || a.status).toLowerCase() === 'available').length,
      inRepair: enrichedAll.filter((a) => /repair|damaged/i.test(String(a.Status || a.status))).length,
      pendingRequests: allRequests.filter((r) => /pending/i.test(String(r.Status || r.status))).length
    };

    return {
      success: true,
      canManage: true,
      stats,
      assets: enrichedAll,
      myAssets: myAssignedAssets,
      requests: allRequests,
      employees: activeEmployees,
      currentUserId: myEmpId
    };
  }

  // Regular Employee / User view
  const [myAssets, myRequests] = await Promise.all([
    findRowsByFilter('Asset', {
      $or: [
        { 'data.Assigned To ID': myEmpId },
        { 'data.Assigned To ID': myEmpId.toUpperCase() },
        { 'data.Assigned To ID': myEmpId.toLowerCase() },
        { 'data.assignedToId': myEmpId },
        { 'data.Employee ID': myEmpId }
      ]
    }),
    findRowsByFilter('AssetRequest', {
      $or: [
        { 'data.Employee ID': myEmpId },
        { 'data.Employee ID': myEmpId.toUpperCase() },
        { 'data.Employee ID': myEmpId.toLowerCase() },
        { 'data.employeeId': myEmpId }
      ]
    })
  ]);

  const enrichedMyAssets = myAssets.map(enrichAssetRecord);

  return {
    success: true,
    canManage: false,
    stats: {
      total: enrichedMyAssets.length,
      assigned: enrichedMyAssets.length,
      available: 0,
      inRepair: 0,
      pendingRequests: myRequests.filter((r) => /pending/i.test(String(r.Status || r.status))).length
    },
    assets: enrichedMyAssets,
    myAssets: enrichedMyAssets,
    requests: myRequests,
    employees: [],
    currentUserId: myEmpId
  };
}

export async function createAsset(payload = {}, authUser) {
  if (!canManageAssets(authUser.role)) {
    return { success: false, message: 'Only Super Admin, Admin, and HR can add assets to inventory.' };
  }

  const name = String(payload.name || payload['Asset Name'] || '').trim();
  if (!name) return { success: false, message: 'Asset Name is required.' };

  const serial = String(payload.serialNumber || payload['Serial Number'] || '').trim();
  if (serial) {
    const existing = await findRowsByFilter('Asset', { 'data.Serial Number': serial });
    if (existing.length) {
      return { success: false, message: `An asset with Serial Number "${serial}" already exists.` };
    }
  }

  const id = `AST_${Date.now()}`;
  const row = {
    AssetID: id,
    'Asset ID': id,
    'Asset Name': name,
    Category: payload.category || payload.Category || 'IT Hardware',
    Brand: payload.brand || payload.Brand || '',
    'Model Number': payload.modelNumber || payload['Model Number'] || '',
    'Serial Number': serial,
    'Purchase Date': payload.purchaseDate || payload['Purchase Date'] || today(),
    'Purchase Cost': Number(payload.purchaseCost || payload['Purchase Cost']) || 0,
    'Vendor Name': payload.vendorName || payload['Vendor Name'] || '',
    'Invoice Number': payload.invoiceNumber || payload['Invoice Number'] || '',
    'Warranty Expiry': payload.warrantyExpiry || payload['Warranty Expiry'] || '',
    Status: payload.status || payload.Status || 'Available',
    Condition: payload.condition || payload.Condition || 'Good',
    'Assigned To ID': '',
    'Assigned To Name': '',
    'Assigned Date': '',
    'Handover Remarks': '',
    History: [],
    'Created By': authUser.id,
    'Created At': nowIso()
  };

  await insertRow('Asset', row);
  return { success: true, message: 'Asset registered successfully.', item: row };
}

export async function updateAsset(assetId, payload = {}, authUser) {
  if (!canManageAssets(authUser.role)) {
    return { success: false, message: 'Only Super Admin, Admin, and HR can edit assets.' };
  }

  const existingList = await findRowsByFilter('Asset', {
    $or: [{ 'data.AssetID': assetId }, { 'data.Asset ID': assetId }, { legacyId: assetId }]
  });
  if (!existingList.length) return { success: false, message: 'Asset not found.' };

  const current = existingList[0];
  const updatedRow = {
    ...current,
    'Asset Name': payload.name || payload['Asset Name'] || current['Asset Name'],
    Category: payload.category || payload.Category || current.Category,
    Brand: payload.brand || payload.Brand || current.Brand,
    'Model Number': payload.modelNumber || payload['Model Number'] || current['Model Number'],
    'Serial Number': payload.serialNumber !== undefined ? payload.serialNumber : current['Serial Number'],
    'Purchase Date': payload.purchaseDate || payload['Purchase Date'] || current['Purchase Date'],
    'Purchase Cost': payload.purchaseCost !== undefined ? Number(payload.purchaseCost) : current['Purchase Cost'],
    'Vendor Name': payload.vendorName || payload['Vendor Name'] || current['Vendor Name'],
    'Warranty Expiry': payload.warrantyExpiry || payload['Warranty Expiry'] || current['Warranty Expiry'],
    Condition: payload.condition || payload.Condition || current.Condition,
    Status: payload.status || payload.Status || current.Status,
    'Last Updated By': authUser.id,
    'Last Update Date': nowIso()
  };

  await upsertRow('Asset', 'AssetID', assetId, updatedRow);
  return { success: true, message: 'Asset updated successfully.', item: updatedRow };
}

export async function assignAsset({ assetId, employeeId, remarks = '', expectedReturnDate = '' } = {}, authUser) {
  if (!canManageAssets(authUser.role)) {
    return { success: false, message: 'Only Super Admin, Admin, and HR can assign assets to employees.' };
  }

  if (!assetId || !employeeId) {
    return { success: false, message: 'Asset ID and Employee ID are required for assignment.' };
  }

  const existingList = await findRowsByFilter('Asset', {
    $or: [{ 'data.AssetID': assetId }, { 'data.Asset ID': assetId }, { legacyId: assetId }]
  });
  if (!existingList.length) return { success: false, message: 'Asset not found.' };

  const asset = existingList[0];
  const users = await listRows('User');
  const targetEmployee = users.find(
    (u) => (u['Employee ID'] || u['User ID'] || u.employeeId || u.id) === employeeId
  );
  if (!targetEmployee) return { success: false, message: 'Employee not found.' };

  const empName = targetEmployee['Employee Name'] || targetEmployee.Name || targetEmployee.name || employeeId;
  const assignerLabel = getActorLabel(authUser, users);
  const historyEntry = {
    action: 'Assigned',
    employeeId,
    employeeName: empName,
    assignedDate: today(),
    assignedBy: assignerLabel,
    remarks,
    expectedReturnDate,
    timestamp: nowIso()
  };

  const currentHistory = Array.isArray(asset.History) ? asset.History : [];
  const updatedRow = {
    ...asset,
    Status: 'Assigned',
    'Assigned To ID': employeeId,
    'Assigned To Name': empName,
    'Assigned Date': today(),
    'Assigned By': assignerLabel,
    'Expected Return Date': expectedReturnDate,
    'Handover Remarks': remarks,
    History: [...currentHistory, historyEntry],
    'Last Updated By': assignerLabel,
    'Last Update Date': nowIso()
  };

  await upsertRow('Asset', 'AssetID', assetId, updatedRow);

  // Send WhatsApp Notification to Employee
  try {
    const contact = await WhatsAppContact.findOne({ employeeId, enabled: true }).lean();
    if (contact && contact.phone) {
      const msg = `💻 *COMPANY ASSET ALLOCATED* 💻\n---------------------------------\nHello *${empName}*,\n\nAapko company asset successfully assign kar diya gaya hai:\n\n🏷️ *Asset:* *${asset['Asset Name']}*\n🔢 *Serial No:* *${asset['Serial Number'] || 'N/A'}*\n📂 *Category:* *${asset.Category || 'Hardware'}*\n📅 *Assigned Date:* *${today()}*\n📝 *Remarks:* ${remarks || 'Standard issue'}\n⚙️ *Status:* *Active / Handed Over*\n\n👉 Please verify your assigned assets in the portal.\n\n~ Work Track System`;
      await sendWhatsAppText({
        contactId: String(contact._id),
        message: msg,
        alertType: 'attendance',
        entityId: assetId
      });
    }
  } catch (err) {
    console.warn(`[Asset] WhatsApp assignment alert skipped: ${err.message}`);
  }

  return { success: true, message: `Asset "${asset['Asset Name']}" successfully assigned to ${empName}.`, item: updatedRow };
}

export async function returnAsset({ assetId, returnCondition = 'Good', remarks = '' } = {}, authUser) {
  if (!canManageAssets(authUser.role)) {
    return { success: false, message: 'Only Super Admin, Admin, and HR can receive and return assets.' };
  }

  const existingList = await findRowsByFilter('Asset', {
    $or: [{ 'data.AssetID': assetId }, { 'data.Asset ID': assetId }, { legacyId: assetId }]
  });
  if (!existingList.length) return { success: false, message: 'Asset not found.' };

  const asset = existingList[0];
  const prevEmpId = asset['Assigned To ID'] || '';
  const prevEmpName = asset['Assigned To Name'] || '';

  const isDamaged = /damaged|repair/i.test(returnCondition);
  const nextStatus = isDamaged ? 'In Repair' : 'Available';

  const historyEntry = {
    action: 'Returned',
    employeeId: prevEmpId,
    employeeName: prevEmpName,
    returnedDate: today(),
    receivedBy: authUser.name || authUser.id,
    condition: returnCondition,
    remarks,
    timestamp: nowIso()
  };

  const currentHistory = Array.isArray(asset.History) ? asset.History : [];
  const updatedRow = {
    ...asset,
    Status: nextStatus,
    Condition: returnCondition,
    'Previous Assigned ID': prevEmpId,
    'Previous Assigned Name': prevEmpName,
    'Assigned To ID': '',
    'Assigned To Name': '',
    'Returned Date': today(),
    'Return Remarks': remarks,
    History: [...currentHistory, historyEntry],
    'Last Updated By': authUser.id,
    'Last Update Date': nowIso()
  };

  await upsertRow('Asset', 'AssetID', assetId, updatedRow);

  // Send return confirmation on WhatsApp
  if (prevEmpId) {
    try {
      const contact = await WhatsAppContact.findOne({ employeeId: prevEmpId, enabled: true }).lean();
      if (contact && contact.phone) {
        const msg = `📦 *ASSET RETURNED & VERIFIED* 📦\n---------------------------------\nHello *${prevEmpName}*,\n\nAapka assigned asset return successfully record ho gaya hai:\n\n🏷️ *Asset:* *${asset['Asset Name']}*\n🔢 *Serial No:* *${asset['Serial Number'] || 'N/A'}*\n📅 *Returned Date:* *${today()}*\n🔍 *Condition Check:* *${returnCondition}*\n⚙️ *Status:* *${nextStatus}*\n\n~ Work Track System`;
        await sendWhatsAppText({
          contactId: String(contact._id),
          message: msg,
          alertType: 'attendance',
          entityId: assetId
        });
      }
    } catch (err) {
      console.warn(`[Asset] WhatsApp return alert skipped: ${err.message}`);
    }
  }

  return { success: true, message: `Asset "${asset['Asset Name']}" returned to inventory as ${nextStatus}.`, item: updatedRow };
}

export async function submitAssetRequest(payload = {}, authUser) {
  const assetName = String(payload.assetName || payload['Asset Name'] || payload.type || '').trim();
  if (!assetName) return { success: false, message: 'Please specify the asset or item you are requesting.' };

  const id = `ARQ_${Date.now()}`;
  const empId = String(authUser.id || authUser.sub || '').trim();
  const users = await listRows('User');
  const targetUser = users.find(
    (u) => String(u['Employee ID'] || u['User ID'] || u.employeeId || u.id || '').trim().toLowerCase() === empId.toLowerCase()
  );
  const empName = targetUser?.['Employee Name'] || targetUser?.Name || authUser.name || empId;

  const row = {
    RequestID: id,
    'Request ID': id,
    'Employee ID': empId,
    'Employee Name': empName,
    'Asset Name': assetName,
    Category: payload.category || 'IT Hardware',
    Reason: payload.reason || '',
    Urgency: payload.urgency || 'Normal',
    Status: 'Pending',
    'Admin Remarks': '',
    'Requested Date': today(),
    'Created At': nowIso()
  };

  await insertRow('AssetRequest', row);

  return { success: true, message: 'Asset request submitted successfully and sent for HR/Admin approval.', item: row };
}

export async function processAssetRequestApproval(requestId, action = 'Approved', remarks = '', authUser) {
  if (!canManageAssets(authUser.role)) {
    return { success: false, message: 'Only Super Admin, Admin, and HR can approve or reject asset requests.' };
  }

  const existingList = await findRowsByFilter('AssetRequest', {
    $or: [{ 'data.RequestID': requestId }, { 'data.Request ID': requestId }, { legacyId: requestId }]
  });
  if (!existingList.length) return { success: false, message: 'Asset request not found.' };

  const req = existingList[0];
  const isApproved = /approved/i.test(action);
  const nextStatus = isApproved ? 'Approved' : 'Rejected';

  const updatedRow = {
    ...req,
    Status: nextStatus,
    'Admin Remarks': remarks,
    'Decided By': authUser.name || authUser.id,
    'Decision Date': today(),
    'Last Update Date': nowIso()
  };

  await upsertRow('AssetRequest', 'RequestID', requestId, updatedRow);

  // Notify applicant employee on WhatsApp
  const empId = req['Employee ID'];
  if (empId) {
    try {
      const contact = await WhatsAppContact.findOne({ employeeId: empId, enabled: true }).lean();
      if (contact && contact.phone) {
        const emoji = isApproved ? '✅' : '❌';
        const msg = `${emoji} *YOUR ASSET REQUEST HAS BEEN ${nextStatus.toUpperCase()}* ${emoji}\n---------------------------------\nHello *${req['Employee Name']}*,\n\nAapki asset request review ho gayi hai:\n\n🏷️ *Requested Asset:* *${req['Asset Name']}*\n⚙️ *Decision:* *${nextStatus}*\n💬 *HR/Admin Remarks:* ${remarks || 'Processed.'}\n\n~ Work Track System`;
        await sendWhatsAppText({
          contactId: String(contact._id),
          message: msg,
          alertType: 'approval',
          entityId: requestId
        });
      }
    } catch (err) {
      console.warn(`[Asset] WhatsApp decision alert skipped: ${err.message}`);
    }
  }

  return { success: true, message: `Asset request ${nextStatus.toLowerCase()} successfully.`, item: updatedRow };
}

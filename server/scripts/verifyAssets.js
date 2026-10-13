import assert from 'node:assert/strict';
import mongoose from 'mongoose';
mongoose.connection.readyState = 1;
import { canManageAssets, createAsset, updateAsset, assignAsset, returnAsset, submitAssetRequest, processAssetRequestApproval, getAssetsOverview } from '../services/assets.service.js';
import { LegacyModels } from '../models/legacyModels.js';

console.log('--- Starting Assets System Verification ---');

// 1. Role permission tests
assert.equal(canManageAssets('Super Admin'), true, 'Super Admin can manage assets');
assert.equal(canManageAssets('Admin'), true, 'Admin can manage assets');
assert.equal(canManageAssets('HR'), true, 'HR can manage assets');
assert.equal(canManageAssets('hr'), true, 'hr lowercase can manage assets');
assert.equal(canManageAssets('Manager'), false, 'Manager cannot manage assets');
assert.equal(canManageAssets('User'), false, 'User cannot manage assets');
assert.equal(canManageAssets('Client'), false, 'Client cannot manage assets');

// Mock Auth Users
const adminAuth = { id: 'ADM_001', sub: 'ADM_001', name: 'Admin User', role: 'Admin' };
const hrAuth = { id: 'HR_001', sub: 'HR_001', name: 'HR Manager', role: 'HR' };
const employeeAuth = { id: 'EMP_101', sub: 'EMP_101', name: 'Test Employee', role: 'User' };

// In-memory mock storage for isolated testing
const mockAssetStore = new Map();
const mockRequestStore = new Map();
const mockUserStore = [
  { 'Employee ID': 'ADM_001', Name: 'Admin User', Role: 'Admin', Status: 'Active' },
  { 'Employee ID': 'HR_001', Name: 'HR Manager', Role: 'HR', Status: 'Active' },
  { 'Employee ID': 'EMP_101', Name: 'Test Employee', Role: 'User', Status: 'Active' },
  { 'Employee ID': 'EMP_102', Name: 'Second Employee', Role: 'User', Status: 'Active' }
];

import { WhatsAppContact } from '../models/whatsappContact.model.js';

WhatsAppContact.findOne = () => ({
  lean: async () => ({ _id: 'mock_contact_1', phone: '919999999999', enabled: true })
});

function matchesQuery(item, query = {}) {
  if (!query || !Object.keys(query).length) return true;
  if (query.$or && Array.isArray(query.$or)) {
    return query.$or.some((subQ) => matchesQuery(item, subQ));
  }
  for (const [k, v] of Object.entries(query)) {
    const cleanKey = k.replace(/^data\./, '');
    const itemVal = item[cleanKey] ?? item[k];
    if (v instanceof RegExp) {
      if (!v.test(String(itemVal || ''))) return false;
    } else if (String(itemVal || '').toLowerCase() !== String(v || '').toLowerCase()) {
      return false;
    }
  }
  return true;
}

LegacyModels.Asset = {
  collection: { createIndex: async () => {} },
  findOne: ({ legacyId, ...rest }) => ({
    sort: () => ({
      lean: async () => {
        for (const val of mockAssetStore.values()) {
          if (val.AssetID === legacyId || val.legacyId === legacyId) return { legacyId, data: val };
        }
        return null;
      }
    })
  }),
  findOneAndUpdate: async (filter, update) => {
    const data = update.$set.data;
    mockAssetStore.set(data.AssetID, data);
    return { data };
  },
  find: (query = {}) => ({
    select: () => ({
      lean: async () => {
        return Array.from(mockAssetStore.values())
          .filter(v => matchesQuery(v, query))
          .map(v => ({ data: v }));
      }
    }),
    sort: () => ({
      select: () => ({
        lean: async () => Array.from(mockAssetStore.values()).filter(v => matchesQuery(v, query)).map(v => ({ data: v }))
      }),
      lean: async () => Array.from(mockAssetStore.values()).filter(v => matchesQuery(v, query)).map(v => ({ data: v }))
    })
  }),
  deleteMany: async () => {}
};

LegacyModels.AssetRequest = {
  collection: { createIndex: async () => {} },
  findOne: ({ legacyId }) => ({
    sort: () => ({
      lean: async () => {
        for (const val of mockRequestStore.values()) {
          if (val.RequestID === legacyId || val.legacyId === legacyId) return { legacyId, data: val };
        }
        return null;
      }
    })
  }),
  findOneAndUpdate: async (filter, update) => {
    const data = update.$set.data;
    mockRequestStore.set(data.RequestID, data);
    return { data };
  },
  find: (query = {}) => ({
    select: () => ({
      lean: async () => {
        return Array.from(mockRequestStore.values())
          .filter(v => matchesQuery(v, query))
          .map(v => ({ data: v }));
      }
    }),
    sort: () => ({
      select: () => ({
        lean: async () => Array.from(mockRequestStore.values()).filter(v => matchesQuery(v, query)).map(v => ({ data: v }))
      }),
      lean: async () => Array.from(mockRequestStore.values()).filter(v => matchesQuery(v, query)).map(v => ({ data: v }))
    })
  }),
  deleteMany: async () => {}
};

LegacyModels.User = {
  collection: { createIndex: async () => {} },
  find: () => ({
    sort: () => ({
      select: () => ({
        lean: async () => mockUserStore.map(u => ({ data: u }))
      }),
      lean: async () => mockUserStore.map(u => ({ data: u }))
    }),
    select: () => ({
      sort: () => ({
        lean: async () => mockUserStore.map(u => ({ data: u }))
      }),
      lean: async () => mockUserStore.map(u => ({ data: u }))
    }),
    lean: async () => mockUserStore.map(u => ({ data: u }))
  })
};

// 2. Permission enforcement on mutations
const empCreateAttempt = await createAsset({ name: 'Hacked Laptop' }, employeeAuth);
assert.equal(empCreateAttempt.success, false, 'Employee cannot create assets');
assert.match(empCreateAttempt.message, /Only Super Admin, Admin, and HR/);

// 3. Admin successfully creates an asset
const createRes = await createAsset({
  name: 'Dell Latitude 3420',
  category: 'IT Hardware',
  brand: 'Dell',
  serialNumber: 'SN-DELL-998877',
  purchaseCost: 65000,
  condition: 'New'
}, adminAuth);
assert.equal(createRes.success, true, 'Admin can create asset');
assert.equal(createRes.item['Asset Name'], 'Dell Latitude 3420');
assert.equal(createRes.item.Status, 'Available');
const createdAssetId = createRes.item.AssetID;

// 4. Duplicate serial number validation
const dupAttempt = await createAsset({
  name: 'Another Dell Laptop',
  serialNumber: 'SN-DELL-998877'
}, adminAuth);
assert.equal(dupAttempt.success, false, 'Duplicate serial number must be rejected');

// 5. Update asset details
const updateRes = await updateAsset(createdAssetId, {
  brand: 'Dell Technologies',
  purchaseCost: 62000
}, hrAuth);
assert.equal(updateRes.success, true, 'HR can update asset');
assert.equal(updateRes.item.Brand, 'Dell Technologies');
assert.equal(updateRes.item['Purchase Cost'], 62000);

// 6. Assign asset to employee EMP_101
const assignRes = await assignAsset({
  assetId: createdAssetId,
  employeeId: 'EMP_101',
  remarks: 'Issued with laptop charger and bag'
}, hrAuth);
assert.equal(assignRes.success, true, 'Asset assigned successfully');
assert.equal(assignRes.item.Status, 'Assigned');
assert.equal(assignRes.item['Assigned To ID'], 'EMP_101');
assert.equal(assignRes.item['Assigned To Name'], 'Test Employee');
assert.equal(assignRes.item.History.length, 1, 'History entry recorded for assignment');

// 7. Employee submits asset requisition request
const reqRes = await submitAssetRequest({
  assetName: '24-inch IPS Monitor',
  category: 'Peripherals',
  urgency: 'Normal',
  reason: 'Dual screen setup for coding and UI preview'
}, employeeAuth);
assert.equal(reqRes.success, true, 'Employee can submit asset request');
assert.equal(reqRes.item['Asset Name'], '24-inch IPS Monitor');
assert.equal(reqRes.item.Status, 'Pending');
assert.equal(reqRes.item['Employee ID'], 'EMP_101');
const requestId = reqRes.item.RequestID;

// 8. Admin approves asset request
const approveRes = await processAssetRequestApproval(requestId, 'Approved', 'Approved for IT engineering', adminAuth);
assert.equal(approveRes.success, true, 'Admin can approve request');
assert.equal(approveRes.item.Status, 'Approved');
assert.equal(approveRes.item['Admin Remarks'], 'Approved for IT engineering');

// 9. Employee attempts to approve (must be forbidden)
const empApproveAttempt = await processAssetRequestApproval(requestId, 'Rejected', 'Hacked', employeeAuth);
assert.equal(empApproveAttempt.success, false, 'Employee cannot approve requests');

// 10. Return asset back to inventory
const returnRes = await returnAsset({
  assetId: createdAssetId,
  returnCondition: 'Good',
  remarks: 'Returned in clean working condition'
}, hrAuth);
assert.equal(returnRes.success, true, 'Asset returned successfully');
assert.equal(returnRes.item.Status, 'Available');
assert.equal(returnRes.item['Assigned To ID'], '');
assert.equal(returnRes.item['Previous Assigned ID'], 'EMP_101');
assert.equal(returnRes.item.History.length, 2, 'History records return');

// 11. Return with damage marks status as In Repair
const damagedAsset = await createAsset({ name: 'Mechanical Keyboard', serialNumber: 'KB-101' }, adminAuth);
await assignAsset({ assetId: damagedAsset.item.AssetID, employeeId: 'EMP_102' }, adminAuth);
const damagedReturn = await returnAsset({ assetId: damagedAsset.item.AssetID, returnCondition: 'Damaged', remarks: 'Key switch broken' }, adminAuth);
assert.equal(damagedReturn.success, true);
assert.equal(damagedReturn.item.Status, 'In Repair', 'Damaged return sets status to In Repair');

console.log('✓ All 11 verification checks passed successfully for Assets System!');
process.exit(0);

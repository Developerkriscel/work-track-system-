import express from 'express';
import {
  authenticateClientFromMongo,
  authenticateEmployeeFromMongo,
  changeEmployeePasswordFromMongo,
  clientToken,
  employeeToken,
  getClientSessionFromMongo,
  getEmployeeSessionFromMongo,
  updateEmployeeProfileFromMongo,
  changeClientPasswordFromMongo,
  updateClientProfileFromMongo
} from '../services/auth.service.js';
import { primeDashboardSnapshots } from '../services/dashboard.service.js';
import { assertIdentity, requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/employee/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    const user = await authenticateEmployeeFromMongo(employeeId, password);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid employee ID or password.' });
    void primeDashboardSnapshots(user['Employee ID'], user.Role);
    return res.json({ success: true, user, token: employeeToken(user) });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/client/login', async (req, res) => {
  try {
    const { clientId, password } = req.body;
    const client = await authenticateClientFromMongo(clientId, password);
    if (!client) return res.status(401).json({ success: false, message: 'Invalid client ID or password.' });
    return res.json({ success: true, client, token: clientToken(client) });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/employee/session', requireAuth({ kind: 'employee' }), async (req, res) => {
  try {
    const user = await getEmployeeSessionFromMongo(req.body.employeeId);
    if (!user || !assertIdentity(req, 'employee', user['Employee ID'])) {
      return res.status(401).json({ success: false, message: 'Employee session is no longer valid.' });
    }
    void primeDashboardSnapshots(user['Employee ID'], user.Role);
    return res.json({ success: true, user, token: employeeToken(user) });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/employee/change-password', requireAuth({ kind: 'employee' }), async (req, res) => {
  try {
    const { employeeId, currentPassword, nextPassword } = req.body;
    if (!employeeId || !currentPassword || !nextPassword) {
      return res.status(400).json({ success: false, message: 'Employee ID, current password, and new password are required.' });
    }
    if (!assertIdentity(req, 'employee', employeeId)) {
      return res.status(403).json({ success: false, message: 'You can only change your own password.' });
    }

    const user = await changeEmployeePasswordFromMongo(employeeId, currentPassword, nextPassword);
    if (!user) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    return res.json({ success: true, user, message: 'Password changed successfully.' });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/employee/update-profile', requireAuth({ kind: 'employee' }), async (req, res) => {
  try {
    const { employeeId, avatarBase64, email, phone } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }
    if (!assertIdentity(req, 'employee', employeeId)) {
      return res.status(403).json({ success: false, message: 'You can only update your own profile.' });
    }

    const user = await updateEmployeeProfileFromMongo(employeeId, { avatarBase64, email, phone });
    if (!user) return res.status(404).json({ success: false, message: 'Employee not found.' });
    
    return res.json({ success: true, user, message: 'Profile updated successfully.' });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/client/session', requireAuth({ kind: 'client' }), async (req, res) => {
  try {
    const client = await getClientSessionFromMongo(req.body.clientId);
    if (!client || !assertIdentity(req, 'client', client.Client_Id)) {
      return res.status(401).json({ success: false, message: 'Client session is no longer valid.' });
    }
    return res.json({ success: true, client, token: clientToken(client) });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});


router.post('/client/change-password', requireAuth({ kind: 'client' }), async (req, res) => {
  try {
    const { clientId, currentPassword, nextPassword } = req.body;
    if (!clientId || !currentPassword || !nextPassword) {
      return res.status(400).json({ success: false, message: 'Client ID, current password, and new password are required.' });
    }
    if (!assertIdentity(req, 'client', clientId)) {
      return res.status(403).json({ success: false, message: 'You can only change your own password.' });
    }

    const client = await changeClientPasswordFromMongo(clientId, currentPassword, nextPassword);
    if (!client) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    return res.json({ success: true, client, message: 'Password changed successfully.' });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/client/update-profile', requireAuth({ kind: 'client' }), async (req, res) => {
  try {
    const { clientId, email, phone, avatarBase64 } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, message: 'Client ID is required.' });
    }
    if (!assertIdentity(req, 'client', clientId)) {
      return res.status(403).json({ success: false, message: 'You can only update your own profile.' });
    }

    const client = await updateClientProfileFromMongo(clientId, { email, phone, avatarBase64 });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found.' });
    
    return res.json({ success: true, client, message: 'Profile updated successfully.' });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});


export default router;

import express from 'express';
import { listMongoRows } from '../services/legacyStore.service.js';

const router = express.Router();

router.post('/employee/login', async (req, res) => {
  const { employeeId, password } = req.body;
  const users = await listMongoRows('User');
  const user = users.find((item) => {
    const candidateId = item['Employee ID'] || item['User ID'] || item.employeeId;
    const candidatePassword = item.Password || item.password;
    const candidateStatus = item.Status || item.status || 'Active';
    return String(candidateId).trim() === String(employeeId).trim() &&
      String(candidatePassword ?? '').trim() === String(password ?? '').trim() &&
      String(candidateStatus).trim().toLowerCase() === 'active';
  });
  if (!user) return res.status(401).json({ success: false, message: 'Invalid employee ID or password.' });
  const { Password, password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser, token: `mongo-employee-${String(user['Employee ID'] || user.employeeId).trim()}` });
});

router.post('/client/login', async (req, res) => {
  const { clientId, password } = req.body;
  const clients = await listMongoRows('Client');
  const client = clients.find((item) => {
    const candidateId = item.Client_Id || item['Client ID'] || item.clientId;
    const candidatePassword = item.Password || item.password;
    const candidateStatus = item.Status || item.status || 'Active';
    return String(candidateId).trim() === String(clientId).trim() &&
      String(candidatePassword ?? '').trim() === String(password ?? '').trim() &&
      String(candidateStatus).trim().toLowerCase() === 'active';
  });
  if (!client) return res.status(401).json({ success: false, message: 'Invalid client ID or password.' });
  const { Password, password: _, ...safeClient } = client;
  res.json({ success: true, client: safeClient, token: `mongo-client-${String(client.Client_Id || client.clientId).trim()}` });
});

export default router;

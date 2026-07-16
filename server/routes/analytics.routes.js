import express from 'express';
import { getAdminReports } from '../services/report.service.js';
import { listRows } from '../services/legacyStore.service.js';

const router = express.Router();

router.get('/reports', async (req, res) => {
  res.json(await getAdminReports(req.query.startDate, req.query.endDate));
});

router.get('/ticket-system-data', async (_req, res) => {
  const [clients, users] = await Promise.all([listRows('Client'), listRows('User')]);
  res.json({
    success: true,
    clients: clients.map((client) => ({ clientId: client.Client_Id || client['Client ID'] || client.clientId, name: client['Client Name'] || client.name })),
    users: users
      .filter((user) => String(user.Status || user.status || 'Active').toLowerCase() === 'active')
      .map((user) => ({ employeeId: user['Employee ID'] || user.employeeId, name: user['Employee Name'] || user.name, role: user.Role || user.role }))
  });
});

export default router;

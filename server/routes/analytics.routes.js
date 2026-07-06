import express from 'express';
import { getAdminReports } from '../services/report.service.js';
import { clients, users } from '../data/seed.js';

const router = express.Router();

router.get('/reports', (req, res) => {
  res.json(getAdminReports(req.query.startDate, req.query.endDate));
});

router.get('/ticket-system-data', (_req, res) => {
  res.json({
    success: true,
    clients: clients.map((client) => ({ clientId: client.clientId, name: client.name })),
    users: users.filter((user) => user.status === 'Active').map((user) => ({ employeeId: user.employeeId, name: user.name, role: user.role }))
  });
});

export default router;

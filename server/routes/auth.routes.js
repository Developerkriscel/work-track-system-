import express from 'express';
import {
  authenticateClientFromMongo,
  authenticateEmployeeFromMongo,
  clientToken,
  employeeToken,
  getClientSessionFromMongo,
  getEmployeeSessionFromMongo
} from '../services/auth.service.js';

const router = express.Router();

router.post('/employee/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    const user = await authenticateEmployeeFromMongo(employeeId, password);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid employee ID or password.' });
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

router.post('/employee/session', async (req, res) => {
  try {
    const user = await getEmployeeSessionFromMongo(req.body.employeeId);
    if (!user) return res.status(401).json({ success: false, message: 'Employee session is no longer valid.' });
    return res.json({ success: true, user, token: employeeToken(user) });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

router.post('/client/session', async (req, res) => {
  try {
    const client = await getClientSessionFromMongo(req.body.clientId);
    if (!client) return res.status(401).json({ success: false, message: 'Client session is no longer valid.' });
    return res.json({ success: true, client, token: clientToken(client) });
  } catch (error) {
    return res.status(503).json({ success: false, message: error.message });
  }
});

export default router;

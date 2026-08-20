import { verifyAccessToken, createAccessToken } from './middleware/auth.middleware.js';

// Create a valid employee token
const token = createAccessToken({ kind: 'employee', id: 'TEST001', role: 'Super Admin' });

fetch('http://localhost:5000/api/fms/sync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}).then(res => {
  console.log('STATUS:', res.status);
  return res.text();
}).then(text => {
  console.log('RESPONSE:', text);
}).catch(err => {
  console.error('ERROR:', err);
});

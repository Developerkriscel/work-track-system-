process.env.PARITY_EMPLOYEE_ID ??= 'VK';
process.env.PARITY_FMS_EMPLOYEE_ID ??= 'KR203';
process.env.PARITY_CLIENT_ID ??= 'CL000';
process.env.PARITY_PASSWORD ??= '123456';
process.env.PARITY_CLIENT_PASSWORD ??= '123456';

await import('./verifyBrowserParity.js');

fetch('http://localhost:5174/api/fms/sync', {
  method: 'OPTIONS',
  headers: {
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
    'Origin': 'http://localhost:5174'
  }
}).then(res => {
  console.log('STATUS:', res.status);
}).catch(err => {
  console.error('ERROR:', err);
});

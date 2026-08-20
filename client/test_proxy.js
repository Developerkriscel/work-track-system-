fetch('http://localhost:5174/api/fms/sync', {
  method: 'POST',
  headers: {
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

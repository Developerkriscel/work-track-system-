import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Ready.');
  conn.exec("ss -tulnp | grep 3003", (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (d) => process.stdout.write(d.toString()));
  });
}).connect({
  host: '187.127.149.196',
  port: 22,
  username: 'root',
  password: 'Kriscel@12345'
});

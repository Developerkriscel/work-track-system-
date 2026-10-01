import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Client } from 'ssh2';

const PROJECT_DIR = 'c:\\Users\\vikas\\OneDrive\\Desktop\\work track system kriscel';
const TAR_PATH = path.join(PROJECT_DIR, 'worktrack-deploy-v2.tar.gz');

function createTar() {
  console.log('Creating tarball with Windows tar...');
  if (fs.existsSync(TAR_PATH)) fs.unlinkSync(TAR_PATH);
  
  execSync(
    'tar --exclude="node_modules" --exclude=".git" --exclude=".agents" --exclude=".qodo" --exclude="backups" --exclude=".vscode" --exclude=".idea" --exclude=".env" --exclude="worktrack-deploy-v2.tar.gz" -czf worktrack-deploy-v2.tar.gz .',
    { cwd: PROJECT_DIR, stdio: 'inherit' }
  );
  
  const stats = fs.statSync(TAR_PATH);
  console.log(`Tarball created: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
}

async function run() {
  createTar();

  const conn = new Client();
  console.log('Connecting to SSH 187.127.149.196...');
  
  conn.on('ready', () => {
    console.log('SSH Ready. Uploading tarball via SFTP...');
    conn.sftp((err, sftp) => {
      if (err) throw err;
      
      const readStream = fs.createReadStream(TAR_PATH);
      const writeStream = sftp.createWriteStream('/tmp/worktrack-deploy-v2.tar.gz');
      
      writeStream.on('close', () => {
        console.log('SFTP upload finished. Executing deployment script...');
        
        const remoteScript = `
set -e
echo "=== Step 1: Extracting new release into /opt/kriscel.online ==="
tar --warning=no-unknown-keyword -xzf /tmp/worktrack-deploy-v2.tar.gz -C /opt/kriscel.online/ 2>&1 || tar -xzf /tmp/worktrack-deploy-v2.tar.gz -C /opt/kriscel.online/ || true

echo "=== Step 2: Restarting PM2 process kriscel.online-backend ==="
cd /opt/kriscel.online
pm2 restart kriscel.online-backend

echo "=== Step 3: Checking PM2 status ==="
pm2 status kriscel.online-backend

echo "=== Step 4: Testing site response ==="
sleep 2
curl -Is https://kriscel.online/login | head -n 15
`;
        conn.exec(remoteScript, (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('Finished with exit code:', code);
            conn.end();
            if (fs.existsSync(TAR_PATH)) fs.unlinkSync(TAR_PATH);
          }).on('data', (data) => {
            process.stdout.write(data.toString());
          }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
          });
        });
      });
      
      readStream.pipe(writeStream);
    });
  }).connect({
    host: '187.127.149.196',
    port: 22,
    username: 'root',
    password: 'Kriscel@12345'
  });
}

run().catch(console.error);

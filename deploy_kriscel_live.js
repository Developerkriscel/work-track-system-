import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_CONFIG = {
  host: '187.127.149.196',
  port: 22,
  username: 'root',
  password: 'Kriscel@12345'
};

const APP_DIR = '/opt/kriscel.online';
const HTDOCS_DIR = '/home/kriscelonlineweb/htdocs/kriscel.online';

function runSSHCommand(conn, command) {
  return new Promise((resolve, reject) => {
    console.log(`[SSH] ${command.trim().slice(0, 90)}...`);
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        resolve({ code, stdout, stderr });
      }).on('data', (d) => {
        stdout += d.toString();
        process.stdout.write(d.toString());
      }).stderr.on('data', (d) => {
        stderr += d.toString();
        process.stderr.write(d.toString());
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    console.log(`[SFTP] Uploading ${localPath} -> ${remotePath}...`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on('close', () => {
        console.log(`[SFTP] Upload completed.`);
        resolve();
      });
      writeStream.on('error', (err) => reject(err));
      readStream.pipe(writeStream);
    });
  });
}

async function main() {
  const archivePath = path.join(__dirname, 'kriscel-live-bundle.tar.gz');
  if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
  }

  console.log('[BUILD] Packaging latest codebase with client/dist...');
  execSync(`tar -czf "${archivePath}" server.js package.json package-lock.json server client/dist`, {
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log(`[BUILD] Archive size: ${fs.statSync(archivePath).size} bytes.`);

  const conn = new Client();

  conn.on('ready', async () => {
    console.log('[SSH] Connected to VPS 187.127.149.196');
    try {
      // 1. Backup existing .env
      await runSSHCommand(conn, `
        mkdir -p ${APP_DIR}
        if [ -f "${APP_DIR}/.env" ]; then
          cp "${APP_DIR}/.env" /tmp/kriscel_env_backup
        fi
      `);

      // 2. Upload new live bundle
      await uploadFile(conn, archivePath, '/tmp/kriscel-live-bundle.tar.gz');

      // 3. Extract into /opt/kriscel.online
      await runSSHCommand(conn, `
        tar -xzf /tmp/kriscel-live-bundle.tar.gz -C ${APP_DIR}
        if [ -f "/tmp/kriscel_env_backup" ]; then
          cp /tmp/kriscel_env_backup "${APP_DIR}/.env"
        fi
      `);

      // 4. Copy client/dist to htdocs
      await runSSHCommand(conn, `
        if [ -d "${HTDOCS_DIR}" ]; then
          cp -r ${APP_DIR}/client/dist/* ${HTDOCS_DIR}/
          chown -R kriscelonlineweb:kriscelonlineweb ${HTDOCS_DIR}/
        fi
      `);

      // 5. Install dependencies in /opt/kriscel.online
      await runSSHCommand(conn, `cd ${APP_DIR} && npm install --omit=dev`);

      // 6. Restart PM2 backend process
      await runSSHCommand(conn, `
        cd ${APP_DIR}
        pm2 restart kriscel.online-backend || pm2 start server.js --name "kriscel.online-backend"
        pm2 save
      `);

      // 7. Reload Nginx
      await runSSHCommand(conn, `nginx -t && systemctl reload nginx`);

      // 8. Verify
      console.log('\n[VERIFICATION]');
      await runSSHCommand(conn, `pm2 status`);
      await runSSHCommand(conn, `sleep 2 && curl -I https://kriscel.online/api/health || curl -I http://127.0.0.1:3003/api/health`);
      await runSSHCommand(conn, `curl -I https://kriscel.online/`);

      console.log('\n======================================================');
      console.log('🚀 LIVE DEPLOYMENT TO KRISCEL.ONLINE IS COMPLETE!');
      console.log('======================================================\n');

      conn.end();
      process.exit(0);
    } catch (err) {
      console.error('[ERROR]', err);
      conn.end();
      process.exit(1);
    }
  }).connect(SERVER_CONFIG);
}

main();

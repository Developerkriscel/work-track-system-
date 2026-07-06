import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const uploadRoot = path.join(rootDir, 'uploads');

export function saveBase64File(dataObj = {}, folderName = 'general') {
  const base64 = dataObj.base64 || dataObj.data || dataObj.content || '';
  if (!base64) return '';

  const safeFolder = String(folderName).replace(/[^a-z0-9_-]/gi, '_');
  const dir = path.join(uploadRoot, safeFolder);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = String(dataObj.fileName || dataObj.name || `file_${Date.now()}`).replace(/[<>:"/\\|?*]/g, '_');
  const cleanBase64 = String(base64).replace(/^data:[^;]+;base64,/, '');
  const target = path.join(dir, `${Date.now()}_${fileName}`);
  fs.writeFileSync(target, Buffer.from(cleanBase64, 'base64'));
  return `/uploads/${safeFolder}/${path.basename(target)}`;
}

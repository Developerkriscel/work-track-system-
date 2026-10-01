import crypto from 'crypto';
import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const REQUIRED_R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT'
];

const safe = (value = '') => String(value ?? '').trim();

let cachedClient = null;

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getMissingEnvVars() {
  return REQUIRED_R2_VARS.filter((key) => !safe(process.env[key]));
}

function assertR2Configured() {
  const missing = getMissingEnvVars();
  if (missing.length) {
    throw new Error(`Cloudflare R2 is not configured. Missing: ${missing.join(', ')}`);
  }
}

function ensureR2Client() {
  if (cachedClient) return cachedClient;
  assertR2Configured();
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: safe(process.env.R2_ENDPOINT),
    forcePathStyle: true,
    credentials: {
      accessKeyId: safe(process.env.R2_ACCESS_KEY_ID),
      secretAccessKey: safe(process.env.R2_SECRET_ACCESS_KEY)
    }
  });
  return cachedClient;
}

export function getR2Client() {
  return ensureR2Client();
}

function bucketName() {
  return safe(process.env.R2_BUCKET_NAME);
}

function decodeObjectKey(value = '') {
  const raw = safe(value);
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeFileName(fileName = '') {
  const fallback = `file_${Date.now()}`;
  return safe(fileName || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

function normalizeFolderName(folderName = 'general') {
  return safe(folderName || 'general').replace(/[^a-z0-9/_-]/gi, '_').replace(/^\/+|\/+$/g, '') || 'general';
}

function inferExtension(fileName = '', contentType = '') {
  const byName = safe(fileName).match(/\.([a-z0-9]{2,8})$/i)?.[0];
  if (byName) return byName.toLowerCase();
  const normalizedType = safe(contentType).toLowerCase();
  if (normalizedType.includes('jpeg')) return '.jpg';
  if (normalizedType.includes('png')) return '.png';
  if (normalizedType.includes('gif')) return '.gif';
  if (normalizedType.includes('webp')) return '.webp';
  if (normalizedType.includes('pdf')) return '.pdf';
  return '';
}

function inferContentType(dataObj = {}) {
  const declaredType = safe(dataObj.contentType || dataObj.mimeType || dataObj.type);
  if (declaredType) return declaredType;
  const base64 = safe(dataObj.base64 || dataObj.data || dataObj.content);
  const dataUriMatch = base64.match(/^data:([^;]+);base64,/i);
  if (dataUriMatch) return safe(dataUriMatch[1]);
  const fileName = safe(dataObj.fileName || dataObj.name).toLowerCase();
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.gif')) return 'image/gif';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function decodeBase64File(dataObj = {}) {
  const raw = safe(dataObj.base64 || dataObj.data || dataObj.content);
  if (!raw) {
    throw new Error('File payload is missing base64 content.');
  }
  const cleanBase64 = raw.replace(/^data:[^;]+;base64,/, '');
  try {
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (!buffer.length) throw new Error('Empty file buffer.');
    return buffer;
  } catch {
    throw new Error('Invalid base64 file payload.');
  }
}

function objectKeyFor(dataObj = {}, folderName = 'general') {
  const folder = normalizeFolderName(folderName);
  const fileName = normalizeFileName(dataObj.fileName || dataObj.name);
  const contentType = inferContentType(dataObj);
  const extension = inferExtension(fileName, contentType);
  const baseName = extension && fileName.toLowerCase().endsWith(extension)
    ? fileName.slice(0, -extension.length)
    : fileName;
  const unique = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  return `${folder}/${unique}_${baseName}${extension}`;
}

export function getFileUrl(objectKey = '') {
  const key = safe(objectKey).replace(/^\/+/, '');
  if (!key) return '';
  assertR2Configured();

  if (process.env.R2_PUBLIC_URL) {
    const publicUrl = safe(process.env.R2_PUBLIC_URL).replace(/\/+$/, '');
    return `${publicUrl}/${key}`;
  }

  const endpoint = safe(process.env.R2_ENDPOINT).replace(/\/+$/, '');
  return `${endpoint}/${bucketName()}/${key}`;
}

export function getStoredFileKey(fileUrl = '') {
  const value = safe(fileUrl);
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) return decodeObjectKey(value.replace(/^\/+/, ''));

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/^\/+/, '');

    if (process.env.R2_PUBLIC_URL) {
      try {
        const publicUrl = new URL(process.env.R2_PUBLIC_URL);
        if (parsed.hostname === publicUrl.hostname) {
          return decodeObjectKey(pathname);
        }
      } catch (e) {
        // Ignore invalid R2_PUBLIC_URL
      }
    }

    const bucket = bucketName();
    if (pathname.toLowerCase().startsWith(`${bucket.toLowerCase()}/`)) {
      return decodeObjectKey(pathname.slice(bucket.length + 1));
    }
    return decodeObjectKey(pathname);
  } catch {
    return '';
  }
}

export async function uploadBase64File(dataObj = {}, folderName = 'general') {
  const client = ensureR2Client();
  const key = objectKeyFor(dataObj, folderName);
  const contentType = inferContentType(dataObj);
  const buffer = decodeBase64File(dataObj);

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    return getFileUrl(key);
  } catch (error) {
    throw new Error(`Cloudflare R2 upload failed: ${error.message}`);
  }
}

export async function saveBase64File(dataObj = {}, folderName = 'general') {
  const base64 = safe(dataObj.base64 || dataObj.data || dataObj.content);
  if (!base64) return '';
  return uploadBase64File(dataObj, folderName);
}

export function getPresignedFileUrl(fileUrl = '', expiresSeconds = 600) {
  assertR2Configured();
  const key = getStoredFileKey(fileUrl);
  if (!key) return '';
  const endpoint = new URL(safe(process.env.R2_ENDPOINT).replace(/\/+$/, ''));
  const bucket = bucketName();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const credential = `${safe(process.env.R2_ACCESS_KEY_ID)}/${credentialScope}`;
  const canonicalUri = `/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.max(60, Math.min(3600, Number(expiresSeconds) || 600))),
    'X-Amz-SignedHeaders': 'host'
  });
  const canonicalQuery = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalHeaders = `host:${endpoint.host}\n`;
  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${safe(process.env.R2_SECRET_ACCESS_KEY)}`, date), region), service), 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function deleteStoredFile(fileUrl = '') {
  const key = getStoredFileKey(fileUrl);
  if (!key) return false;
  const client = ensureR2Client();

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: bucketName(),
      Key: key
    }));
    return true;
  } catch (error) {
    throw new Error(`Cloudflare R2 delete failed: ${error.message}`);
  }
}

export function hasCloudflareR2Config() {
  return getMissingEnvVars().length === 0;
}

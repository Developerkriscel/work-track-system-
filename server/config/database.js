import mongoose from 'mongoose';

function parseQuery(queryString = '') {
  const params = new URLSearchParams(queryString.replace(/^\?/, ''));
  const result = {};
  for (const [key, value] of params.entries()) {
    if (result[key] === undefined) {
      result[key] = value;
    } else if (Array.isArray(result[key])) {
      result[key].push(value);
    } else {
      result[key] = [result[key], value];
    }
  }
  return result;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else {
      search.set(key, value);
    }
  }
  return search.toString();
}

async function resolveDnsJson(name, type) {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, {
    headers: {
      Accept: 'application/dns-json'
    }
  });
  if (!response.ok) {
    throw new Error(`DNS lookup failed for ${name} (${type})`);
  }
  const payload = await response.json();
  return payload.Answer || [];
}

async function expandSrvUri(uri) {
  const parsed = new URL(uri);
  const serviceName = parsed.hostname;
  const srvAnswers = await resolveDnsJson(`_mongodb._tcp.${serviceName}`, 'SRV');
  const srvRecords = srvAnswers.map((answer) => {
    const [priority, weight, port, ...targetParts] = String(answer.data).trim().split(/\s+/);
    return {
      priority: Number(priority) || 0,
      weight: Number(weight) || 0,
      port: Number(port) || 27017,
      name: targetParts.join(' ').replace(/\.$/, '')
    };
  });
  if (!srvRecords.length) {
    throw new Error(`No SRV records found for ${serviceName}`);
  }

  const txtAnswers = await resolveDnsJson(`_mongodb._tcp.${serviceName}`, 'TXT').catch(() => []);
  const txtParams = {};
  for (const answer of txtAnswers) {
    const parsedTxt = parseQuery(String(answer.data || '').replace(/^"|"$/g, ''));
    Object.assign(txtParams, parsedTxt);
  }

  const hosts = srvRecords
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((record) => `${record.name}:${record.port || 27017}`);

  const mergedParams = {
    ...parseQuery(parsed.search),
    ...txtParams
  };

  delete mergedParams['authSource'];
  delete mergedParams['replicaSet'];

  const explicitParams = {
    authSource: 'admin',
    replicaSet: txtParams.replicaSet || mergedParams.replicaSet,
    retryWrites: mergedParams.retryWrites || 'true',
    w: mergedParams.w || 'majority',
    tls: mergedParams.tls || mergedParams.ssl || 'true',
    appName: mergedParams.appName
  };

  const query = buildQuery(explicitParams);
  const username = parsed.username ? decodeURIComponent(parsed.username) : '';
  const password = parsed.password ? decodeURIComponent(parsed.password) : '';
  const credentials = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';

  return `mongodb://${credentials}${hosts.join(',')}/${parsed.pathname.replace(/^\//, '')}${query ? `?${query}` : ''}`;
}

export async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required. MongoDB is the only supported live database.');
  }

  const uri = process.env.MONGO_URI.startsWith('mongodb+srv://')
    ? await expandSrvUri(process.env.MONGO_URI)
    : process.env.MONGO_URI;

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB || 'worktrack'
  });
  console.log('MongoDB connected');
}

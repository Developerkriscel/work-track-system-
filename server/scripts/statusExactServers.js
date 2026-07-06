const ports = ['5000', '5173'];

async function fetchRoot(port) {
  try {
    const response = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) });
    return { ok: true, status: response.status, body: await response.text() };
  } catch (error) {
    return { ok: false, error: error.name === 'TimeoutError' ? 'timeout' : error.code || error.message };
  }
}

function titleOf(body = '') {
  return body.match(/<title>(.*?)<\/title>/i)?.[1] || '';
}

for (const port of ports) {
  const result = await fetchRoot(port);
  if (!result.ok) {
    console.log(`${port}: not responding (${result.error})`);
    continue;
  }
  const generated = /Discussion Center|Track tickets|portal-rail/.test(result.body);
  const root = result.body.includes('id="root"');
  const shim = result.body.includes('/googleScriptRunShim.js');
  const exact = titleOf(result.body) === 'Work_Track_System' && shim && !root && !generated;
  console.log(`${port}: ${exact ? 'EXACT' : 'NOT EXACT'} title="${titleOf(result.body)}" shim=${shim} reactRoot=${root} generatedUi=${generated}`);
}

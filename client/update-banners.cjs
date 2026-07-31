const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (let file of list) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.jsx')) results.push(file);
  }
  return results;
}

const files = walk(path.join(process.cwd(), 'src/features'));

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;

  const errorPattern = /\{error \? <div className="dashboard-banner([^"]*)">\{error\}<\/div> : null\}/g;
  if (errorPattern.test(code)) {
    code = code.replace(errorPattern, '{error ? <div className="dashboard-banner$1"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={() => setError(null)}>OK</button></div> : null}');
    changed = true;
  }

  const messagePattern = /(<div className=\{\`dashboard-banner\$\{message\.tone[^>]*\`\}>)([\s\S]*?)(<\/div>)/g;
  if (messagePattern.test(code)) {
    code = code.replace(messagePattern, (match, p1, p2, p3) => {
      if (match.includes('dashboard-banner__close')) return match;
      return p1 + p2 + '\n          <button type="button" className="dashboard-banner__close" onClick={() => setMessage(null)}>OK</button>\n        ' + p3;
    });
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, code);
    console.log('Updated ' + file);
  }
}

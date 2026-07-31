const fs = require('fs');
const path = require('path');

function walkDir(dir, filter, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, filter, callback);
    } else if (filter.test(dirPath)) {
      callback(dirPath);
    }
  });
}

// 1. Update Hooks
walkDir(path.join(__dirname, 'client/src/features'), /use.*Data\.js$/, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  if (content.includes('error: state.error,')) {
    content = content.replace(/error: state\.error,/, 'error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),');
    updated = true;
  }
  if (content.includes('message,')) {
    // Only replace the return block message,
    content = content.replace(/(\s+)message,/, '$1message, clearMessage: () => setMessage(null),');
    updated = true;
  }
  if (updated) {
    fs.writeFileSync(filePath, content);
    console.log('Updated hook:', filePath);
  }
});

// 2. Update Components
walkDir(path.join(__dirname, 'client/src/features'), /.*Page\.jsx$|.*Tab\.jsx$|.*Panel\.jsx$|.*Dialog\.jsx$/, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  if (content.includes('error,') && content.includes('setError(null)')) {
    content = content.replace(/(\s+)error,/, '$1error, clearError,');
    content = content.replace(/onClick=\{\(\) => setError\(null\)\}/g, 'onClick={clearError}');
    updated = true;
  }

  if (content.includes('message,') && content.includes('setMessage(null)')) {
    content = content.replace(/(\s+)message,/, '$1message, clearMessage,');
    content = content.replace(/onClick=\{\(\) => setMessage\(null\)\}/g, 'onClick={clearMessage}');
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(filePath, content);
    console.log('Updated component:', filePath);
  }
});

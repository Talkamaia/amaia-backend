const { speak } = require('./eleven');
const fs = require('fs');
const path = require('path');

(async () => {
  const text = 'Hej älskling, det här är bara ett test.';
  const audioPath = await speak(text);
  const fullPath = path.join(__dirname, 'public', audioPath.replace('/audio/', 'audio/'));
  console.log('🔊 Testfil genererad:', fullPath);

  const exists = fs.existsSync(fullPath);
  console.log('✅ Fil finns:', exists);
})();

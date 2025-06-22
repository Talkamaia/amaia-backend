require('dotenv').config();
console.log("🔑 ELEVEN_API_KEY:", process.env.ELEVEN_API_KEY);

const { speak } = require('./eleven');
const fs = require('fs');
const path = require('path');

(async () => {
  const filepath = `/tmp/test-${Date.now()}.mp3`;
  try {
    const url = await speak("Hej älskling, jag har saknat dig...", filepath);
    console.log("🔊 ElevenLabs genererade ljud:", url);

    const finalPath = path.join(__dirname, 'public', url);
    if (fs.existsSync(finalPath)) {
      console.log("✅ Filen finns på:", finalPath);
    } else {
      console.error("❌ Filen hittades inte!");
    }
  } catch (err) {
    console.error("🚨 ElevenLabs fel:", err.message || err);
  }
})();

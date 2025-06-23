require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { speak } = require('./eleven');

const test = async () => {
  const testText = "Hej älskling. Jag är Amaia – och jag längtar efter att höra mer från dig.";
  const filepath = path.join(__dirname, 'public/audio', 'test.mp3');

  try {
    const buffer = await speak(testText, filepath);
    fs.writeFileSync(filepath, buffer);
    console.log("✅ ElevenLabs genererade ljud:", filepath);
  } catch (err) {
    console.error("❌ Fel från ElevenLabs:", err.message);
  }
};

test();

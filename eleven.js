require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function speak(text, filepath) {
  const voiceId = process.env.ELEVEN_VOICE_ID;
  const apiKey = process.env.ELEVEN_API_KEY;

  if (!voiceId || !apiKey) {
    console.error("🚨 ElevenLabs: Saknar voiceId eller API-nyckel");
    return Buffer.from("");
  }

  try {
    // Säkerställ att mappen finns
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Anropa ElevenLabs
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    // Spara och returnera fil
    fs.writeFileSync(filepath, response.data);
    console.log("✅ ElevenLabs genererade ljud:", filepath);
    return fs.readFileSync(filepath);
  } catch (err) {
    console.error("❌ ElevenLabs API-fel:", err.response?.data || err.message);
    return Buffer.from("");
  }
}

module.exports = { speak };

require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const voiceId = process.env.ELEVENLABS_VOICE_ID;

async function speak(text, filepath) {
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
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  fs.writeFileSync(filepath, response.data);
  return fs.readFileSync(filepath);
}

module.exports = { speak };

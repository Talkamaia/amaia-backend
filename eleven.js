const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const VOICE_ID = process.env.ELEVEN_VOICE_ID || 'rG05xR2lvyonVmthwvZ7';
const MODEL_ID = process.env.ELEVEN_MODEL_ID || 'eleven_turbo_v2_5';

async function speak(text, filepath) {
  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      data: {
        model_id: MODEL_ID,
        text,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.75,
          style: 0.45,
          use_speaker_boost: true,
        },
      },
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filepath));
      writer.on('error', reject);
    });
  } catch (err) {
    console.error('🚨 ElevenLabs error:', err?.response?.data || err.message);
    throw err;
  }
}

module.exports = { speak };

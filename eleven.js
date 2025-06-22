const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const VOICE_ID = process.env.ELEVEN_VOICE_ID;

async function speak(text) {
  const filename = `${uuidv4()}.mp3`;
  const filepath = path.join(__dirname, 'public', 'audio', filename);

  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });

  const response = await axios({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    headers: {
      'xi-api-key': ELEVEN_API_KEY,
      'Content-Type': 'application/json'
    },
    data: {
      text,
      voice_settings: { stability: 0.4, similarity_boost: 0.8 }
    },
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(`/audio/${filename}`));
    writer.on('error', reject);
  });
}

module.exports = { speak };

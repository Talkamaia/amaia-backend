const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { execSync } = require('child_process');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;

async function speak(text, filepath) {
  const outputPath = filepath.replace('.mp3', '.wav');
  try {
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        }
      },
      responseType: 'arraybuffer'
    });

    // Spara original mp3 först
    fs.writeFileSync(filepath, response.data);

    // 🔁 Konvertera till ulaw 8kHz mono WAV med ffmpeg
    const ffmpegCommand = `ffmpeg -y -i "${filepath}" -ar 8000 -ac 1 -f mulaw "${outputPath}"`;
    execSync(ffmpegCommand);

    console.log(`✅ ElevenLabs genererade ljud: ${outputPath}`);
    return fs.readFileSync(outputPath);
  } catch (err) {
    console.error('❌ ElevenLabs-fel:', err.response?.data || err.message);
    return Buffer.from([]);
  }
}

module.exports = { speak };

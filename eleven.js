import fs from 'fs/promises';
import axios from 'axios';
import { config } from './config.js';
import { v4 as uuidv4 } from 'uuid';

export async function speak(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVEN_VOICE_ID}`;
  const headers = {
    'xi-api-key': config.ELEVEN_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'audio/mpeg',
  };
  const body = {
    text,
    voice_settings: { stability: 0.4, similarity_boost: 0.7 },
  };

  const response = await axios.post(url, body, { headers, responseType: 'arraybuffer' });
  const filename = `/tmp/${uuidv4()}.mp3`;
  await fs.writeFile(filename, response.data);
  return filename;
}

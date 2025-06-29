const { createClient } = require('@deepgram/sdk');
require('dotenv').config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function testConnection() {
  try {
    const dgConnection = deepgram.listen.live({
      model: 'nova',
      language: 'sv',
      interim_results: false,
      encoding: 'linear16',
      sample_rate: 8000,
      channels: 1,
    });

    dgConnection.on('open', () => {
      console.log('✅ WebSocket till Deepgram öppnades korrekt!');
      dgConnection.finish(); // stäng direkt efter test
    });

    dgConnection.on('error', (err) => {
      console.error('❌ Deepgram error:', err?.message || err);
    });

  } catch (e) {
    console.error('🔥 Fel vid anslutning:', e.message);
  }
}

testConnection();

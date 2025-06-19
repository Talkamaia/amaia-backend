// stt.js
const { createClient } = require('@deepgram/sdk');
const dg = createClient(process.env.DEEPGRAM_API_KEY);

function newSocket(onFinal) {
  const socket = dg.listen.live({
    model: 'nova-2',
    language: 'sv',
    encoding: 'linear16',
    sample_rate: 16000,
    interim_results: false,
    smart_format: true,
    punctuate: true
  });

  socket.on('transcriptReceived', (m) => {
    const t = m.channel.alternatives[0]?.transcript;
    if (t && m.is_final) onFinal(t.trim());
  });
  socket.on('error', e => console.error('Deepgram', e));

  return socket;
}
module.exports = { newSocket };

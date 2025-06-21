import { Deepgram } from '@deepgram/sdk';
import { handleChat } from './gpt.js';
import { speak } from './eleven.js';

export const mediaServer = (socket, config) => {
  const dg = new Deepgram(config.DEEPGRAM_API_KEY);
  let stream;
  let lastResponseTime = 0;
  const cooldownMs = 3000; // 3 sekunders mellanrum mellan svar

  socket.on('media', async ({ media }) => {
    if (!stream) {
      stream = dg.transcription.live({ smart_format: true });

      stream.on('transcriptReceived', async (data) => {
        console.log('🧪 RAW Deepgram:', data);

        try {
          const transcript = JSON.parse(data)?.channel?.alternatives?.[0]?.transcript;
          console.log('👂 Transkriberat:', transcript);

          if (transcript && transcript.trim().length > 1) {
            const now = Date.now();

            if (now - lastResponseTime < cooldownMs) {
              console.log('⏳ Ignorerar (cooldown):', transcript);
              return;
            }

            console.log('👂 Kund:', transcript);
            lastResponseTime = now;

            const reply = await handleChat(transcript, socket.id); // socket.id är unikt för varje samtal
            console.log('🗣️ Amaia säger:', reply);
            console.log('🤖 Amaia:', reply);

            const audio = await speak(reply);
            console.log('🔊 Audio buffer (first 50 bytes):', audio?.slice(0, 50));
            socket.emit('audio', { audio });
          }
        } catch (err) {
          console.error('🚨 Fel i transcriptReceived:', err);
        }
      });
    }

    try {
      stream.write(Buffer.from(media.payload, 'base64'));
    } catch (err) {
      console.error('🚨 Fel vid stream.write:', err);
    }
  });

  socket.on('disconnect', () => {
    if (stream) stream.finish();
    console.log('📴 Media stream avslutad');
  });
};

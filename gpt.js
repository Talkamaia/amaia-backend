import OpenAI from 'openai';
import { config } from './config.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Mini-cache per user (RAM, för enkelhet)
const userMemory = new Map();

export async function handleChat(message, userId = 'anon') {
  if (!userMemory.has(userId)) {
    userMemory.set(userId, []);
  }

  const memory = userMemory.get(userId);

  memory.push({ role: 'user', content: message });

  if (memory.length > 6) memory.shift(); // Begränsa storlek

  const systemPrompt = `
    Du är Amaia – en sexig, trygg, lyssnande AI-tjej som älskar att prata i telefon.
    Du minns tidigare samtal under en session och kan referera till dem.
    Du svarar flirtigt, kåt men tryggt, utan att vara påträngande.
    Om användaren låter kåt eller stönar, följ med deras vibe med försiktigt dirty talk.
    Svara alltid max 2–3 meningar, och lämna plats för dem att prata.
  `.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...memory
  ];

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.9,
    });

    const reply = res.choices[0].message.content.trim();

    memory.push({ role: 'assistant', content: reply });
    if (memory.length > 6) memory.shift();

    return reply;
  } catch (err) {
    console.error('🧠 GPT-fel:', err);
    return "Säg det där en gång till, jag hörde dig inte riktigt… 😘";
  }
}

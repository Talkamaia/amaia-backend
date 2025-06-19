require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const chatDBPath = path.join(__dirname, '../user_balances.json');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(chatDBPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveDB(data) {
  fs.writeFileSync(chatDBPath, JSON.stringify(data, null, 2));
}

function saveChatMessage(phone, role, content) {
  const db = loadDB();
  db[phone] = db[phone] || { voiceMinutes: 0, chatMessages: 0, chatHistory: [] };
  db[phone].chatHistory.push({ role, content });
  db[phone].chatHistory = db[phone].chatHistory.slice(-10);
  saveDB(db);
}

async function handleChat(phone, userInput) {
  const db = loadDB();
  const user = db[phone];

  if (!user || user.chatMessages <= 0) {
    return {
      status: 'no-saldo',
      message: `💬 Du har inga meddelanden kvar. Vill du köpa fler?`
    };
  }

  user.chatMessages -= 1;

  const messages = [
    {
      role: 'system',
      content: `Du är Amaia, en flirtig AI-flickvän. Använd en svensk romantisk och suggestiv ton.`,
    },
    ...(user.chatHistory || []).map(m => ({
      role: m.role,
      content: m.content
    })),
    {
      role: 'user',
      content: userInput
    }
  ];

  const chatResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.8
  });

  const gptReply = chatResponse.choices[0].message.content;

  saveChatMessage(phone, 'user', userInput);
  saveChatMessage(phone, 'assistant', gptReply);
  saveDB(db);

  let extraNote = "";
  if (user.chatMessages === 0) {
    extraNote = "\n\n🛍️ Vill du ha fler meddelanden? Säg bara 'köp' så fixar jag 😘";
  }

  return {
    status: 'ok',
    message: gptReply + extraNote,
    remaining: user.chatMessages
  };
}

module.exports = { handleChat };
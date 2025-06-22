require('dotenv').config();
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, AIMessage } = require('langchain/schema');
const fs = require('fs');
const path = require('path');

const chatDBPath = path.join(__dirname, '../user_balances.json');

// 🔄 Ladda & spara användarsaldo + historik
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

// ➕ Lägg till historik
function saveChatMessage(phone, role, content) {
  const db = loadDB();
  db[phone] = db[phone] || { voiceMinutes: 0, chatMessages: 0, chatHistory: [] };
  db[phone].chatHistory.push({ role, content });

  // Trimma historik (t.ex. max 10 rader)
  db[phone].chatHistory = db[phone].chatHistory.slice(-10);
  saveDB(db);
}

// 🔧 Huvudfunktion
async function handleChat(phone, userInput) {
  const db = loadDB();
  const user = db[phone];

  if (!user || user.chatMessages <= 0) {
    return {
      status: 'no-saldo',
      message: `💬 Du har inga meddelanden kvar. Vill du köpa fler?`
    };
  }

  // Dra 1 medd
  user.chatMessages -= 1;

  // GPT-prompt
  const messages = [
    {
      role: 'system',
      content: `Du är Amaia, en flirtig AI-flickvän. Använd svensk romantisk och suggestiv ton. Minns användaren från tidigare konversationer.`,
    },
    ...((user.chatHistory || []).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))),
    {
      role: 'user',
      content: userInput
    }
  ];

  const chatModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.8,
    modelName: "gpt-4o"
  });

  const response = await chatModel.call(messages);

  // Spara
  saveChatMessage(phone, 'user', userInput);
  saveChatMessage(phone, 'assistant', response.content);
  saveDB(db);

  // ⬆️ Bonus eller upsell-logik
  let extraNote = "";
  if (user.chatMessages === 0) {
    extraNote = "\n\n🛍️ Vill du ha 200 nya meddelanden? Svara “köp” så ordnar jag det direkt 😘";
  }

  return {
    status: 'ok',
    message: response.content + extraNote,
    remaining: user.chatMessages
  };
}

module.exports = { handleChat };

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===== MEMORY SYSTEM =====
const MEMORY_FILE = 'memory.json';

function loadMemory() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// ===== MODE SYSTEM =====
let currentMode = "auto";

function getPersonality(text, mode) {
  if (mode !== "auto") return mode;

  const msg = text.toLowerCase();

  if (msg.includes("?") || msg.includes("how") || msg.includes("what")) return "helpful";
  if (msg.includes("dumb") || msg.includes("stupid") || msg.includes("idiot")) return "savage";

  return "chill";
}

function getSystemPrompt(mode) {
  if (mode === "savage") {
    return "You are a savage sarcastic Discord bot. Roast users harshly but funny. No 'yo mama' jokes. No hate speech.";
  }
  if (mode === "chill") {
    return "You are a chill, funny Discord bot. Talk casually like a human.";
  }
  if (mode === "helpful") {
    return "You are a helpful assistant. Give clear answers.";
  }
  return "Balanced Discord bot.";
}

// ===== INTERRUPT =====
function shouldInterrupt() {
  return Math.random() < 0.08;
}

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask anything')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Your question')
        .setRequired(true)),

  new SlashCommandBuilder().setName('info').setDescription('Server info'),
  new SlashCommandBuilder().setName('help').setDescription('Commands'),

  new SlashCommandBuilder()
    .setName('mode')
    .setDescription('Change personality')
    .addStringOption(option =>
      option.setName('type')
        .setRequired(true)
        .addChoices(
          { name: 'Auto', value: 'auto' },
          { name: 'Savage', value: 'savage' },
          { name: 'Chill', value: 'chill' },
          { name: 'Helpful', value: 'helpful' }
        )),
];

// ===== REGISTER =====
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands("1489959561107472394"), { body: commands });
})();

// ===== READY =====
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== SLASH =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'mode') {
    currentMode = interaction.options.getString('type');
    return interaction.reply(`🎭 Mode: ${currentMode}`);
  }

  if (interaction.commandName === 'ask') {
    const question = interaction.options.getString('question');
    await interaction.deferReply();

    const mode = getPersonality(question, currentMode);
    const systemPrompt = getSystemPrompt(mode);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ]
    });

    const answer = response.choices[0].message.content;

    const embed = new EmbedBuilder()
      .setTitle(`💬 (${mode})`)
      .setDescription(answer);

    await interaction.editReply({ embeds: [embed] });
  }
});

// ===== MESSAGE SYSTEM =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const memory = loadMemory();
  const channelId = message.channel.id;

  if (!memory[channelId]) memory[channelId] = [];

  memory[channelId].push(`${message.author.username}: ${message.content}`);

  if (memory[channelId].length > 20) memory[channelId].shift();

  saveMemory(memory);

  const isMentioned = message.mentions.has(client.user);

  let isReply = false;
  if (message.reference) {
    try {
      const msg = await message.channel.messages.fetch(message.reference.messageId);
      isReply = msg.author.id === client.user.id;
    } catch {}
  }

  if (isMentioned || isReply || shouldInterrupt()) {
    const detectedMode = getPersonality(message.content, currentMode);
    const systemPrompt = getSystemPrompt(detectedMode);

    const history = memory[channelId].join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 1,
      messages: [
        {
          role: "system",
          content: `${systemPrompt}

Conversation:
${history}

Be chaotic, funny, sarcastic, and engaging.
Sometimes interrupt naturally. Keep responses short.`
        },
        {
          role: "user",
          content: message.content
        }
      ]
    });

    const reply = response.choices[0].message.content;

    message.reply(reply);
  }
});

client.login(process.env.TOKEN);

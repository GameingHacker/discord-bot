require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Groq = require('groq-sdk');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

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
    return "You are a chill casual Discord bot. Talk like a funny human.";
  }
  if (mode === "helpful") {
    return "You are a helpful assistant. Give clear answers.";
  }
  return "Balanced bot.";
}

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the bot anything')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Your question')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Server information'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List commands'),

  new SlashCommandBuilder()
    .setName('mode')
    .setDescription('Change bot personality')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Choose mode')
        .setRequired(true)
        .addChoices(
          { name: 'Auto 🤖', value: 'auto' },
          { name: 'Savage 😈', value: 'savage' },
          { name: 'Chill 😌', value: 'chill' },
          { name: 'Helpful 🤓', value: 'helpful' }
        )),
];

// ===== REGISTER =====
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands("1489959561107472394"),
      { body: commands }
    );
    console.log('Commands registered');
  } catch (err) {
    console.error(err);
  }
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
    return interaction.reply(`🎭 Mode set to **${currentMode}**`);
  }

  if (interaction.commandName === 'info') {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle("📌 Server Info")
        .setDescription("This server is for chatting, events, and fun!")
        .setColor(0x00AE86)]
    });
  }

  if (interaction.commandName === 'help') {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle("🛠 Commands")
        .setDescription("/ask, /info, /help, /mode")
        .setColor(0xFFD700)]
    });
  }

  if (interaction.commandName === 'ask') {
    const question = interaction.options.getString('question');
    await interaction.deferReply();

    try {
      const mode = getPersonality(question, currentMode);
      const systemPrompt = getSystemPrompt(mode);

      const response = await groq.chat.completions.create({
        model: "llama3-70b-8192",
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ]
      });

      const answer = response.choices[0].message.content;

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle(`💬 Answer (${mode})`)
          .setDescription(answer)
          .setColor(0x3498db)]
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply("Free AI broke 💀 try again");
    }
  }
});

// ===== MESSAGE SYSTEM =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user);

  let isReplyToBot = false;
  if (message.reference) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      isReplyToBot = repliedMessage.author.id === client.user.id;
    } catch {}
  }

  if (isMentioned || isReplyToBot) {
    try {
      const detectedMode = getPersonality(message.content, currentMode);
      const systemPrompt = getSystemPrompt(detectedMode);

      const response = await groq.chat.completions.create({
        model: "llama3-70b-8192",
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message.content }
        ]
      });

      const reply = response.choices[0].message.content;

      message.reply(reply);

    } catch (err) {
      console.error(err);
      message.reply("Free AI is tired 💀 try later");
    }
  }
});

client.login(process.env.TOKEN);

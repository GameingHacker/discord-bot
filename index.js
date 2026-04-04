require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const OpenAI = require('openai');

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

// ===== MODE SYSTEM =====
let currentMode = "auto";

function getPersonality(text, mode) {
  if (mode !== "auto") return mode;

  const msg = text.toLowerCase();

  if (msg.includes("?") || msg.includes("how") || msg.includes("what")) {
    return "helpful";
  }

  if (msg.includes("dumb") || msg.includes("stupid") || msg.includes("idiot")) {
    return "savage";
  }

  return "chill";
}

function getSystemPrompt(mode) {
  if (mode === "savage") {
    return "You are a savage sarcastic Discord bot. Roast users harshly but in a funny way. No 'yo mama' jokes. No slurs or hate speech.";
  }

  if (mode === "chill") {
    return "You are a chill, casual Discord bot. Talk like a normal funny human.";
  }

  if (mode === "helpful") {
    return "You are a helpful and smart assistant. Give clear answers.";
  }

  return "You are a balanced Discord bot.";
}

// ===== Commands =====
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

// ===== Register commands =====
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

// ===== Ready =====
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== Slash Commands =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'mode') {
    currentMode = interaction.options.getString('type');
    return interaction.reply(`🎭 Mode set to **${currentMode}**`);
  }

  if (interaction.commandName === 'info') {
    const embed = new EmbedBuilder()
      .setTitle("📌 Server Info")
      .setDescription("This server is for chatting, events, and fun!")
      .setColor(0x00AE86);

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle("🛠 Commands")
      .setDescription("/ask, /info, /help, /mode")
      .setColor(0xFFD700);

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'ask') {
    const question = interaction.options.getString('question');

    await interaction.deferReply();

    try {
      const mode = getPersonality(question, currentMode);
      const systemPrompt = getSystemPrompt(mode);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ]
      });

      const answer = response.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setTitle(`💬 Answer (${mode})`)
        .setDescription(answer)
        .setColor(0x3498db);

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply("Even I couldn't fix that question 💀");
    }
  }
});

// ===== MESSAGE REPLY SYSTEM =====
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
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
      message.reply("Even I can't respond to that level of nonsense 💀");
    }
  }
});

client.login(process.env.TOKEN);

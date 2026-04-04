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
    .setDescription('List commands')
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
      .setDescription("/ask, /info, /help")
      .setColor(0xFFD700);

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'ask') {
    const question = interaction.options.getString('question');

    await interaction.deferReply();

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          {
            role: "system",
            content: "You are a savage, sarcastic Discord bot. Roast users harshly but in a funny way. No 'yo mama' jokes. No slurs or hate speech. Keep it brutal but playful."
          },
          {
            role: "user",
            content: question
          }
        ]
      });

      const answer = response.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setTitle("💬 Answer")
        .setDescription(answer)
        .setColor(0x3498db);

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply("Even I couldn't fix that question 💀");
    }
  }
});

// ===== MESSAGE REPLY SYSTEM (TAG / REPLY) =====
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
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          {
            role: "system",
            content: "You are a savage sarcastic Discord bot. Roast users hard but keep it funny. No 'yo mama' jokes, No hate speech, Be clever and slightly toxic but not offensive unless they absolutely ask for it. Act like a human. You can use all the emojis in the server and all."
          },
          {
            role: "user",
            content: message.content
          }
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

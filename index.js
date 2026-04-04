require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
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

// ===== Interaction handler =====
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
        messages: [{ role: "user", content: question }]
      });

      const answer = response.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setTitle("💬 Answer")
        .setDescription(answer)
        .setColor(0x3498db);

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Error getting answer.");
    }
  }
});

client.login(process.env.TOKEN);
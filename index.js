const { Client, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const CreditManager = require('./CreditManager');
const CreditHandler = require('./CreditHandler');
const SelfieCommandHandler = require('./SelfieCommandHandler');
const ImagineCommandHandler = require('./ImagineCommandHandler');
const pino = require('pino');
const fs = require('fs');

// Logger setup
const logStream = fs.createWriteStream('./task.log');
const logger = pino({ level: 'info' }, logStream);

// Initialize command handlers
const creditManager = new CreditManager();
const creditHandler = new CreditHandler(creditManager);
const selfieCommandHandler = new SelfieCommandHandler();
const imagineCommandHandler = new ImagineCommandHandler();

// Discord Client Initialization with intents
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent
    ]
});

// Slash Command Definitions
const commands = [
    imagineCommandHandler.getCommandData(),
    selfieCommandHandler.getCommandData(),
    ...creditHandler.getCommandData()
];

// Register Slash Commands with Discord
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        logger.info('Successfully registered global application commands.');
    } catch (error) {
        logger.error('Error registering global application commands:', error);
    }
})();

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const commandName = interaction.commandName;
    logger.info(`Received command: ${commandName}`);

    try {
        logger.info(`Command details: ${JSON.stringify(interaction.options.data)}`);

        if (commandName === 'imagine') {
            await interaction.deferReply();
            const prompt = interaction.options.getString('prompt');
            const userID = interaction.user.id;
            const canRender = await creditManager.handleRenderCostDeduction(userID);
            if (!canRender) {
                await interaction.followUp({ content: 'Insufficient credits.', ephemeral: true });
                return;
            }
            await imagineCommandHandler.handleInteraction(interaction, prompt);
        } else if (commandName === 'selfie') {
            await interaction.deferReply();
            await selfieCommandHandler.handleInteraction(interaction);
        } else {
            await interaction.deferReply();
            await creditHandler.handleInteraction(interaction);
        }
    } catch (error) {
        logger.error({
            message: 'Error handling command',
            commandName: commandName,
            error: error.message,
            stack: error.stack,
            interactionDetails: interaction.toJSON()
        });

        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: 'Error processing your request.', ephemeral: true });
        } else {
            await interaction.followUp({ content: 'Error processing your request.', ephemeral: true });
        }
    }
});

bot.login(process.env.DISCORD_BOT_TOKEN);
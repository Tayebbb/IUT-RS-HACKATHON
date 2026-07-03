'use strict';

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const config = require('./config');
const { findCommand } = require('./commands');
const { startAlertRelay } = require('./alertRelay');

if (!config.discordToken) {
   
  console.error('DISCORD_TOKEN missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.on('ready', () => {
   
  console.log(`[discord] Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) {return;}
    if (!message.content.startsWith(config.commandPrefix)) {return;}

    const raw = message.content.slice(config.commandPrefix.length).trim();
    if (raw.length === 0) {return;}

    const [name, ...args] = raw.split(/\s+/);
    const command = findCommand(name);
    if (!command) {
      await message.reply(`Unknown command \`${name}\`. Try \`${config.commandPrefix}help\`.`);
      return;
    }

    // Small typing indicator so users know we're working.
    if (message.channel?.sendTyping) {
      message.channel.sendTyping().catch(() => {});
    }

    const reply = await command.run({ args });
    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setDescription(reply.length > 4000 ? reply.slice(0, 4000) + '…' : reply)
      .setFooter({ text: 'Office Power Monitor' })
      .setTimestamp();
    await message.reply({ embeds: [embed] });
  } catch (err) {
     
    console.error('[command-error]', err);
    try {
      await message.reply(`Command failed: ${err.message}`);
    } catch {
      /* ignore */
    }
  }
});

let relay = { stop: () => {} };
client.once('ready', () => {
  relay = startAlertRelay(client);
});

const shutdown = async (signal) => {
   
  console.log(`[bot] shutting down (${signal})`);
  relay.stop();
  await client.destroy().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(config.discordToken).catch((err) => {
   
  console.error('[discord] login failed:', err.message);
  process.exit(1);
});

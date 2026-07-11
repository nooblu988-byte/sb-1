const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${d}d ${h}h ${m}m ${sec}s`;
}

module.exports = {
    name: 'uptime',
    aliases: ['upt'],
    description: "Check how long the bot has been online",
    category: 'info',
    cooldown: 3,
    run: async (client, message) => {
        const time = formatUptime(client.uptime);
        return message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `⏱️ **Uptime:** \`${time}\``
                    )),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }
};

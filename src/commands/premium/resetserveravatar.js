const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    PermissionFlagsBits,
    REST,
    Routes,
} = require('discord.js');

const send = (message, text) => message.reply({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
    flags: MessageFlags.IsComponentsV2,
});

module.exports = {
    name: 'resetserveravatar',
    aliases: ['rsa', 'clearserveravatar'],
    description: "Reset the bot's server-specific avatar to default",
    category: 'premium',
    cooldown: 5,

    async run(client, message) {
        if (!message.guild) {
            return send(message, `${client.emoji?.cross || '❌'} | This command can only be used in a server.`);
        }
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return send(message, `${client.emoji?.cross || '❌'} | You need **Administrator** permission to use this command.`);
        }

        const statusMsg = await message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('⏳ Resetting server avatar...'))],
            flags: MessageFlags.IsComponentsV2,
        });

        try {
            const rest = new REST({ version: '10' }).setToken(client.token);
            await rest.patch(Routes.guildMember(message.guild.id, '@me'), {
                body: { avatar: null },
            });

            await statusMsg.edit({
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji?.tick || '✅'} | Server avatar reset to default!`))],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (error) {
            console.error('Reset Avatar Error:', error.message);
            await statusMsg.edit({
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji?.cross || '❌'} | Failed to reset avatar: ${error.message}`))],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    },
};

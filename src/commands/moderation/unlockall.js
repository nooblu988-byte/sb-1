const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
    ChannelType,
} = require("discord.js");

module.exports = {
    name: "unlockall",
    aliases: [],
    description: "Unlock all text channels to allow @everyone to send messages",
    category: "moderation",
    cooldown: 10,
    run: async (client, message) => {
        const reply = (content, color = 0x26272F) => ({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.channel.send(reply(`${client.emoji.cross} You need \`Administrator\` permission to use this command.`));
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.channel.send(reply(`${client.emoji.cross} I need \`Manage Channels\` permission to unlock channels.`));
        }

        const loadingMsg = await message.channel.send(reply(`${client.emoji.loading} Unlocking all channels...`));

        const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);

        let success = 0;
        let failed = 0;

        for (const [, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
                success++;
            } catch {
                failed++;
            }
        }

        return loadingMsg.edit(reply(`${client.emoji.tick} Unlocked **${success}** channels. Failed: **${failed}**`, 0x57F287));
    },
};

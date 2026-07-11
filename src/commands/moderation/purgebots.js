const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

module.exports = {
    name: "purgebots",
    aliases: ["pb"],
    category: "mod",
    cat: "admin",

    run: async (client, message) => {
        const reply = (content, color = 0x26272F) => ({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply(reply(`${client.emoji.cross} You need **Manage Messages** permission.`));
        }

        if (!message.guild.members.me.permissions.has([
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ReadMessageHistory,
        ])) {
            return message.reply(reply(`${client.emoji.cross} I need **Manage Messages** and **Read Message History** permissions.`));
        }

        const messages = await message.channel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(m => m.author.bot);

        if (!botMessages.size) {
            return message.reply(reply(`${client.emoji.cross} No bot messages found to delete.`));
        }

        const deleted = await message.channel.bulkDelete(botMessages, true).catch(() => null);
        if (!deleted || !deleted.size) {
            return message.reply(reply(`${client.emoji.cross} Failed to delete bot messages.`));
        }

        const msg = await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.tick} Deleted **${deleted.size}** bot messages.`)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        setTimeout(() => msg.delete().catch(() => {}), 3000);
    },
};

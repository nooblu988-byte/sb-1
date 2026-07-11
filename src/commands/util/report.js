const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "report",
    aliases: ["bug", "feedback"],
    description: "Report a bug or send feedback to developers",
    category: "util",
    cooldown: 3,
    run: async (client, message, args, prefix) => {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const reply = (content, color = 0x26272F) => message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.guild) {
            return reply(`${client.emoji.cross} This command can only be used in servers, not in DMs.`);
        }

        if (!args || args.length === 0) {
            return reply(`${client.emoji.cross} Please provide a report message.\nUsage: \`${prefix}report <your message>\``);
        }

        const reportMessage = args.join(" ");
        const reportChannelId = client.config.reportChannel;

        try {
            const reportChannel = await client.channels.fetch(reportChannelId);

            if (!reportChannel) {
                return reply(`${client.emoji.cross} Unable to send report. Please try again later.`);
            }

            await reportChannel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 📋 New Report"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**By:** ${message.author.tag} (\`${message.author.id}\`)\n` +
                                `**From:** ${message.guild.name} (\`${message.guild.id}\`)\n` +
                                `**Report:** ${reportMessage}`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# User ID: ${message.author.id}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            return reply(`${client.emoji.tick} Your report has been successfully sent to the developers. Thank you for your feedback!`, 0x57F287);

        } catch (error) {
            console.error("Error sending report:", error);
            return reply(`${client.emoji.cross} Failed to send report. Please try again later.`);
        }
    },
};

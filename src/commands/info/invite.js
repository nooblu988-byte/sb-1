const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "invite",
    aliases: ["inv", "botinvite"],
    description: "Get the bot invite link and support server",
    category: "info",
    cooldown: 3,
    run: async (client, message) => {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        return message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${client.user.username}`)
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `Thanks for choosing **${client.user.username}**!\nClick the buttons below to invite me or join our support community.`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents(row =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setLabel("Invite Me")
                                .setStyle(ButtonStyle.Link)
                                .setURL(client.config.inviteURL)
                                .setEmoji(client.emoji.inviteBtn),
                            new ButtonBuilder()
                                .setLabel("Support Server")
                                .setStyle(ButtonStyle.Link)
                                .setURL(client.config.support_server_link)
                                .setEmoji(client.emoji.supportBtn)
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};

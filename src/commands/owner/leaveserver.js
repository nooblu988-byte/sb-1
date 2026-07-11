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
    name: "leaveserver",
    aliases: ["gl", "gleave"],
    description: "Leave a server by ID",
    category: "owner",
    cooldown: 3,
    run: async (client, message, args) => {
        if (!client.config.owner.includes(message.author.id)) return;

        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const id = args[0];
        const guild = id ? await client.guilds.fetch(id).catch(() => null) : message.guild;

        if (!guild) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${client.emoji.cross} Invalid server ID or I'm not in that server.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const name = guild.name || "Unknown Server";

        const msg = await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0xFFCC00)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`⚠️ Are you sure you want me to leave **${name}** (\`${guild.id}\`)?`)
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents(row =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("confirm_leave")
                                .setLabel("Yes, Leave")
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId("cancel_leave")
                                .setLabel("Cancel")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = msg.createMessageComponentCollector({
            time: 15000,
            filter: i => i.user.id === message.author.id,
        });

        collector.on("collect", async i => {
            await i.deferUpdate();

            if (i.customId === "cancel_leave") {
                collector.stop("cancelled");
                return msg.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x57F287)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`❎ Cancelled leaving **${name}**.`)
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (i.customId === "confirm_leave") {
                collector.stop("confirmed");
                await message.channel.send({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFF9900)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `📤 Left the guild **${name}**.\n**Reason:** Requested by Owner\n**Executor:** <@${message.author.id}>`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
                await guild.leave().catch(() => null);
                return msg.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x57F287)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`${client.emoji.tick} Successfully left **${name}** (\`${guild.id}\`).`)
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        });

        collector.on("end", (_, reason) => {
            if (reason === "time") {
                msg.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`⌛ Confirmation timed out. Did not leave **${name}**.`)
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        });
    },
};

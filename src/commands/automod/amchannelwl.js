const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "amchannelwl",
    aliases: ["amcwl"],
    description: "Manage automod channel whitelist — exempt channels from automod",
    category: "automod",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const owners      = client.config?.owner || [];
        const extra1      = await client.db.get(`ownerPermit1_${message.guild.id}`);
        const extra2      = await client.db.get(`ownerPermit2_${message.guild.id}`);
        const extraOwners = [extra1, extra2].filter(Boolean);

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id) &&
            !extraOwners.includes(message.author.id)
        ) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Only the **Server Owner** can use this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const guildId = message.guild.id;
        const key     = `amcwl_${guildId}`;
        let   list    = client.lmdbGet(key) || [];
        const opt     = args[0]?.toLowerCase();
        const sep     = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!opt) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Automod Channel Whitelist")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}amchannelwl add #channel\` — Exempt a channel\n` +
                                `\`${prefix}amchannelwl remove #channel\` — Remove exemption\n` +
                                `\`${prefix}amchannelwl show\` — View all exempted channels\n` +
                                `\`${prefix}amchannelwl reset\` — Clear all exemptions`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Requested by ${message.author.tag}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "show") {
            if (list.length === 0) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    "## Automod Channel Whitelist\n\nNo channels are currently whitelisted."
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const lines = list.map((id, i) => `\`${i + 1}.\` <#${id}> — \`${id}\``).join("\n");
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Automod Channel Whitelist — ${list.length} channel(s)`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(lines)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Requested by ${message.author.tag}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "add") {
            const channel = message.mentions.channels.first()
                || message.guild.channels.cache.get(args[1]);

            if (!channel) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Please mention a channel or provide a channel ID.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (list.includes(channel.id)) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} <#${channel.id}> is already whitelisted.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            list.push(channel.id);
            client.lmdbSet(key, list);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.enabled2} <#${channel.id}> has been added to the channel whitelist.\n-# Automod will ignore messages in this channel.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "remove") {
            const channel = message.mentions.channels.first()
                || message.guild.channels.cache.get(args[1]);

            if (!channel) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Please mention a channel or provide a channel ID.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (!list.includes(channel.id)) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} <#${channel.id}> is not in the channel whitelist.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            list = list.filter(x => x !== channel.id);
            client.lmdbSet(key, list);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.disabled2} <#${channel.id}> has been removed from the channel whitelist.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "reset") {
            if (list.length === 0) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Channel whitelist is already empty.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const confirmMsg = await message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Confirm Reset")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `This will remove all **${list.length}** whitelisted channel(s). This cannot be undone.`
                            )
                        )
                        .addActionRowComponents((row) =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId("amcwl_confirm")
                                    .setLabel("Confirm Reset")
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId("amcwl_cancel")
                                    .setLabel("Cancel")
                                    .setStyle(ButtonStyle.Secondary)
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = confirmMsg.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 30000,
                max: 1,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "amcwl_confirm") {
                    client.lmdbSet(key, []);
                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.disabled2} Channel whitelist has been reset.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
                if (i.customId === "amcwl_cancel") {
                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent("Reset cancelled.")
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
            });

            collector.on("end", async (collected) => {
                if (collected.size === 0) {
                    await confirmMsg.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent("Reset timed out.")
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }
            });

            return;
        }
    },
};

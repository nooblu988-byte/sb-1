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
    name: "amfilter",
    aliases: ["amf"],
    description: "Manage automod custom word filter",
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
        const key     = `amfilter_${guildId}`;
        let   filter  = client.lmdbGet(key) || [];
        const opt     = args[0]?.toLowerCase();
        const sep     = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!opt) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Automod Custom Word Filter")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}amfilter add <word>\` — Add a word to the filter\n` +
                                `\`${prefix}amfilter remove <word>\` — Remove a word\n` +
                                `\`${prefix}amfilter show\` — View all filtered words\n` +
                                `\`${prefix}amfilter reset\` — Clear all filtered words`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `-# Custom filter: **${filter.length}** word(s) active`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "show") {
            if (filter.length === 0) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    "## Automod Custom Word Filter\n\nNo custom words are currently filtered."
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const pageSize = 20;
            let page = 0;
            const total = Math.ceil(filter.length / pageSize);

            const buildPage = () => {
                const start = page * pageSize;
                const slice = filter.slice(start, start + pageSize);
                return new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Automod Custom Filter — ${filter.length} word(s)`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            slice.map((w, i) => `\`${start + i + 1}.\` ||${w}||`).join("  ")
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Page ${page + 1}/${total}`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("amf_prev")
                                .setLabel("Previous")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(page === 0),
                            new ButtonBuilder()
                                .setCustomId("amf_next")
                                .setLabel("Next")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(page === total - 1),
                            new ButtonBuilder()
                                .setCustomId("amf_close")
                                .setLabel("Close")
                                .setStyle(ButtonStyle.Danger)
                        )
                    );
            };

            const sent = await message.reply({
                components: [buildPage()],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 120000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "amf_prev") page = Math.max(0, page - 1);
                if (i.customId === "amf_next") page = Math.min(total - 1, page + 1);
                if (i.customId === "amf_close") {
                    await i.message.delete().catch(() => {});
                    return collector.stop("closed");
                }
                await i.update({ components: [buildPage()], flags: MessageFlags.IsComponentsV2 });
            });

            collector.on("end", async (_, reason) => {
                if (reason === "closed") return;
                const start = page * pageSize;
                const slice = filter.slice(start, start + pageSize);
                await sent.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Automod Custom Filter — ${filter.length} word(s)`))
                            .addSeparatorComponents(sep())
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    slice.map((w, i) => `\`${start + i + 1}.\` ||${w}||`).join("  ")
                                )
                            )
                            .addSeparatorComponents(sep())
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Page ${page + 1}/${total}`))
                            .addActionRowComponents((row) =>
                                row.addComponents(
                                    new ButtonBuilder().setCustomId("amf_prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                    new ButtonBuilder().setCustomId("amf_next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                    new ButtonBuilder().setCustomId("amf_close").setLabel("Close").setStyle(ButtonStyle.Danger).setDisabled(true),
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                }).catch(() => {});
            });

            return;
        }

        if (opt === "add") {
            const word = args[1]?.toLowerCase();
            if (!word) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Please provide a word to add. Usage: \`${prefix}amfilter add <word>\``
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (filter.includes(word)) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} \`${word}\` is already in the custom filter.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            filter.push(word);
            client.lmdbSet(key, filter);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.enabled2} \`${word}\` has been added to the custom filter.\n-# Total filtered words: \`${filter.length}\``
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "remove") {
            const word = args[1]?.toLowerCase();
            if (!word) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Please provide a word to remove. Usage: \`${prefix}amfilter remove <word>\``
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (!filter.includes(word)) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} \`${word}\` is not in the custom filter.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            filter = filter.filter(w => w !== word);
            client.lmdbSet(key, filter);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.disabled2} \`${word}\` has been removed from the custom filter.\n-# Total filtered words: \`${filter.length}\``
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "reset") {
            if (filter.length === 0) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} The custom filter is already empty.`
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
                                `This will delete all **${filter.length}** custom filtered word(s). This cannot be undone.`
                            )
                        )
                        .addActionRowComponents((row) =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId("amf_confirm")
                                    .setLabel("Confirm Reset")
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId("amf_cancel")
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
                if (i.customId === "amf_confirm") {
                    client.lmdbSet(key, []);
                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.disabled2} Custom word filter has been cleared.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
                if (i.customId === "amf_cancel") {
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

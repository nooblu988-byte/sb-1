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
    name: "amrolewl",
    aliases: ["amrwl"],
    description: "Manage automod role whitelist — exempt roles from automod",
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
        const key     = `amrwl_${guildId}`;
        let   list    = client.lmdbGet(key) || [];
        const opt     = args[0]?.toLowerCase();
        const sep     = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!opt) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Automod Role Whitelist")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}amrolewl add @role\` — Exempt a role\n` +
                                `\`${prefix}amrolewl remove @role\` — Remove exemption\n` +
                                `\`${prefix}amrolewl show\` — View all exempted roles\n` +
                                `\`${prefix}amrolewl reset\` — Clear all exemptions`
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
                                    "## Automod Role Whitelist\n\nNo roles are currently whitelisted."
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const lines = list.map((id, i) => `\`${i + 1}.\` <@&${id}> — \`${id}\``).join("\n");
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Automod Role Whitelist — ${list.length} role(s)`
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
            const role = message.mentions.roles.first()
                || message.guild.roles.cache.get(args[1]);

            if (!role) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Please mention a role or provide a role ID.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (list.includes(role.id)) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} <@&${role.id}> is already whitelisted.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            list.push(role.id);
            client.lmdbSet(key, list);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.enabled2} <@&${role.id}> has been added to the role whitelist.\n-# Members with this role will be ignored by automod.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (opt === "remove") {
            const role = message.mentions.roles.first()
                || message.guild.roles.cache.get(args[1]);

            if (!role) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Please mention a role or provide a role ID.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (!list.includes(role.id)) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} <@&${role.id}> is not in the role whitelist.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            list = list.filter(x => x !== role.id);
            client.lmdbSet(key, list);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.disabled2} <@&${role.id}> has been removed from the role whitelist.`
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
                                    `${client.emoji.cross} Role whitelist is already empty.`
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
                                `This will remove all **${list.length}** whitelisted role(s). This cannot be undone.`
                            )
                        )
                        .addActionRowComponents((row) =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId("amrwl_confirm")
                                    .setLabel("Confirm Reset")
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId("amrwl_cancel")
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
                if (i.customId === "amrwl_confirm") {
                    client.lmdbSet(key, []);
                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.disabled2} Role whitelist has been reset.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
                if (i.customId === "amrwl_cancel") {
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

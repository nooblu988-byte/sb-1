const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
    ChannelType,
    Routes,
} = require("discord.js");

const MODIFIABLE_TYPES = new Set([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
]);

module.exports = {
    name: "verification",
    aliases: ["vr"],
    description: "Manage the server verification system",
    category: "verification",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
        const ENABLED_EMOJI  = client.emoji.enabled2;
        const DISABLED_EMOJI = client.emoji.disabled2;

        if (!client.config.owner.includes(message.author.id) &&
            message.guild.ownerId !== message.author.id) {
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

        const sub     = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const cfgKey  = `verify_cfg_${guildId}`;
        const cfg     = client.lmdbGet(cfgKey);

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Verification System")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}verification setup\` — Set up verification\n` +
                                `\`${prefix}verification disable\` — Remove verification system\n` +
                                `\`${prefix}verification status\` — View current status`
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

        
        if (sub === "status") {
            if (!cfg) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${DISABLED_EMOJI} Verification is **not configured** for this server.\n` +
                                    `-# Run \`${prefix}verification setup\` to set it up.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const verifyChannel = message.guild.channels.cache.get(cfg.channelId);
            const verifiedRole  = message.guild.roles.cache.get(cfg.roleId);
            const verifiedCount = verifiedRole?.members.size ?? 0;

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${message.guild.name} — Verification Status`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Status:** ${ENABLED_EMOJI} Active\n` +
                                `**Verify Channel:** ${verifyChannel ? `<#${cfg.channelId}>` : "`Channel deleted`"}\n` +
                                `**Verified Role:** ${verifiedRole ? `<@&${cfg.roleId}>` : "`Role deleted`"}\n` +
                                `**Verified Members:** \`${verifiedCount}\`\n` +
                                `**Protected Channels:** \`${cfg.snapshots?.length ?? 0}\``
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ── SETUP ─────────────────────────────────────────────────────────
        if (sub === "setup") {
            if (cfg) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${ENABLED_EMOJI} Verification is already **active**.\n` +
                                    `-# Use \`${prefix}verification disable\` to remove it first.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const sent = await message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Verification Setup")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                "The following actions will be performed:\n\n" +
                                `${client.emoji.arrow} Create a **Verified** role\n` +
                                `${client.emoji.arrow} Create a **#verify** channel\n` +
                                `${client.emoji.arrow} Hide all visible channels from unverified users\n` +
                                `${client.emoji.arrow} Send a verification prompt in the verify channel\n\n` +
                                "-# Channel permissions are snapshotted and fully restored on disable."
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId("vr_setup_confirm")
                                    .setLabel("Confirm Setup")
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId("vr_setup_cancel")
                                    .setLabel("Cancel")
                                    .setStyle(ButtonStyle.Danger),
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                max: 1,
                time: 60000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "vr_setup_cancel") {
                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${DISABLED_EMOJI} Setup **cancelled**.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                await i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.loading} Setting up verification, please wait...`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });

                try {
                    const guild      = message.guild;
                    const everyoneId = guild.roles.everyone.id;

                    
                    const verifiedRole = await guild.roles.create({
                        name: "Verified",
                        color: 0x57F287,
                        reason: "Verification system setup",
                    });

                    
                    const snapshots = [];

                    for (const [, channel] of guild.channels.cache) {
                        if (!MODIFIABLE_TYPES.has(channel.type)) continue;

                        const ow       = channel.permissionOverwrites.cache.get(everyoneId);
                        const isDenied = ow?.deny.has(PermissionFlagsBits.ViewChannel);
                        if (isDenied) continue; 

                        snapshots.push({
                            id:    channel.id,
                            allow: ow ? ow.allow.bitfield.toString() : null,
                            deny:  ow ? ow.deny.bitfield.toString()  : null,
                        });

                        await channel.permissionOverwrites.edit(
                            everyoneId,
                            { ViewChannel: false },
                            { reason: "Verification system setup" }
                        ).catch(() => {});

                        await channel.permissionOverwrites.edit(
                            verifiedRole.id,
                            { ViewChannel: true },
                            { reason: "Verification system setup" }
                        ).catch(() => {});
                    }

                    
                    const verifyChannel = await guild.channels.create({
                        name: "verify",
                        type: ChannelType.GuildText,
                        topic: "Complete the captcha to gain access to the server.",
                        permissionOverwrites: [
                            {
                                id:    everyoneId,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                                deny:  [
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.AddReactions,
                                    PermissionFlagsBits.CreatePublicThreads,
                                    PermissionFlagsBits.CreatePrivateThreads,
                                ],
                            },
                            {
                                id:    guild.members.me.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.EmbedLinks,
                                    PermissionFlagsBits.AttachFiles,
                                    PermissionFlagsBits.ReadMessageHistory,
                                ],
                            },
                        ],
                        reason: "Verification system setup",
                    });

                    
                    const verifyMsg = await verifyChannel.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `## Verify to Access ${guild.name}`
                                    )
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        "To gain access to all channels, click the button below and complete the captcha.\n\n" +
                                        "-# Type the characters shown in the image. The code expires after 5 minutes."
                                    )
                                )
                                .addSeparatorComponents(sep())
                                .addActionRowComponents(row =>
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId("verify_start")
                                            .setLabel("Verify")
                                            .setStyle(ButtonStyle.Success)
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });

                    
                    client.lmdbSet(cfgKey, {
                        channelId: verifyChannel.id,
                        roleId:    verifiedRole.id,
                        messageId: verifyMsg.id,
                        snapshots,
                    });

                    await sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${ENABLED_EMOJI} Verification system is **active**.\n\n` +
                                        `${client.emoji.arrow} Verify channel: <#${verifyChannel.id}>\n` +
                                        `${client.emoji.arrow} Verified role: <@&${verifiedRole.id}>\n` +
                                        `${client.emoji.arrow} Protected channels: \`${snapshots.length}\`\n\n` +
                                        `-# Members must complete the captcha in <#${verifyChannel.id}> to access the server.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});

                } catch (err) {
                    console.error("[Verification Setup Error]", err);
                    await sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.cross} Setup failed. Ensure I have **Manage Channels** and **Manage Roles** permissions.\n-# ${err.message}`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }
            });

            collector.on("end", async (collected) => {
                if (collected.size === 0) {
                    await sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${DISABLED_EMOJI} Setup timed out.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }
            });

            return;
        }

        
        if (sub === "disable") {
            if (!cfg) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${DISABLED_EMOJI} Verification is not configured for this server.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const sent = await message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Disable Verification")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                "This will:\n\n" +
                                `${client.emoji.arrow} Restore all channel permissions to their original state\n` +
                                `${client.emoji.arrow} Delete the **Verified** role and remove it from all members\n` +
                                `${client.emoji.arrow} Delete the **#verify** channel\n\n` +
                                "This cannot be undone. Are you sure?"
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId("vr_disable_confirm")
                                    .setLabel("Confirm Disable")
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId("vr_disable_cancel")
                                    .setLabel("Cancel")
                                    .setStyle(ButtonStyle.Secondary),
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                max: 1,
                time: 60000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "vr_disable_cancel") {
                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${ENABLED_EMOJI} Disable **cancelled**. Verification remains active.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                await i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.loading} Removing verification system, please wait...`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });

                try {
                    const guild      = message.guild;
                    const everyoneId = guild.roles.everyone.id;
                    const { snapshots, channelId, roleId } = cfg;

                    
                    for (const snap of (snapshots || [])) {
                        const channel = guild.channels.cache.get(snap.id);
                        if (!channel) continue;

                        await channel.permissionOverwrites.delete(roleId, "Verification system disabled").catch(() => {});

                        if (snap.allow === null && snap.deny === null) {
                            await channel.permissionOverwrites.delete(everyoneId, "Verification system disabled").catch(() => {});
                        } else {
                            await client.rest.put(Routes.channelPermission(channel.id, everyoneId), {
                                body: { type: 0, allow: snap.allow ?? "0", deny: snap.deny ?? "0" },
                            }).catch(() => {});
                        }
                    }

                    
                    const verifyChannel = guild.channels.cache.get(channelId);
                    if (verifyChannel) await verifyChannel.delete("Verification system disabled").catch(() => {});

                    
                    const verifiedRole = guild.roles.cache.get(roleId);
                    if (verifiedRole) await verifiedRole.delete("Verification system disabled").catch(() => {});

                    
                    client.lmdbDel(cfgKey);

                    await sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${ENABLED_EMOJI} Verification system has been **disabled**.\n` +
                                        `-# All channel permissions have been restored.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});

                } catch (err) {
                    console.error("[Verification Disable Error]", err);
                    await sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.cross} Failed to fully disable verification.\n-# ${err.message}`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }
            });

            collector.on("end", async (collected) => {
                if (collected.size === 0) {
                    await sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${DISABLED_EMOJI} Disable timed out.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }
            });

            return;
        }

        return message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.cross} Invalid option. Use \`${prefix}verification <setup|disable|status>\``
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};

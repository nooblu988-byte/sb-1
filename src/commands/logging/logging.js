const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
} = require("discord.js");

const EVENT_GROUPS = [
    { value: "vc",       label: "Voice Channels" },
    { value: "messages", label: "Messages"        },
    { value: "roles",    label: "Roles"           },
    { value: "channels", label: "Channels"        },
    { value: "members",  label: "Members"         },
];

module.exports = {
    name: "logging",
    aliases: ["log"],
    description: "Enable, disable, or configure server event logging",
    category: "logging",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const ENABLED_EMOJI  = client.emoji.enabled2;
        const DISABLED_EMOJI = client.emoji.disabled2;

        const owners = client.config?.owner || [];
        const extra1 = client.lmdbGet(`ownerPermit1_${message.guild.id}`);
        const extra2 = client.lmdbGet(`ownerPermit2_${message.guild.id}`);

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id) &&
            extra1 !== message.author.id &&
            extra2 !== message.author.id
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

        const sub       = args[0]?.toLowerCase();
        const guildId   = message.guild.id;
        const key       = `logging_${guildId}`;
        const isEnabled = client.lmdbGet(key) === "enabled";
        const cfg       = client.lmdbGet(`logging_cfg_${guildId}`) || {};

        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Logging System")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}logging enable\` — Enable logging\n` +
                                `\`${prefix}logging disable\` — Disable logging\n` +
                                `\`${prefix}logging status\` — View current configuration\n` +
                                `\`${prefix}logging setup\` — Configure channels per event group`
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
            const lines = EVENT_GROUPS.map(g =>
                `**${g.label}:** ${cfg[g.value] ? `<#${cfg[g.value]}>` : "\`Not set\`"}`
            ).join("\n");

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## ${message.guild.name} — Logging Status`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Status:** ${isEnabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(lines)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // ── SETUP ────────────────────────────────────────────────────────
        if (sub === "setup") {
            const channels = {
                vc:       cfg.vc       || null,
                messages: cfg.messages || null,
                roles:    cfg.roles    || null,
                channels: cfg.channels || null,
                members:  cfg.members  || null,
            };
            let currentGroup = null;

            const overview = (chans) =>
                EVENT_GROUPS.map(g =>
                    `**${g.label}:** ${chans[g.value] ? `<#${chans[g.value]}>` : "\`Not set\`"}`
                ).join("\n");

            const groupSelect = (selected) =>
                new StringSelectMenuBuilder()
                    .setCustomId("log_group_select")
                    .setPlaceholder("Select event group to configure")
                    .addOptions(EVENT_GROUPS.map(g => ({
                        label:   g.label,
                        value:   g.value,
                        default: g.value === selected,
                    })));

            const channelSelect = (group) => {
                const menu = new ChannelSelectMenuBuilder()
                    .setCustomId("log_channel_select")
                    .setChannelTypes(ChannelType.GuildText)
                    .setDisabled(!group);

                menu.setPlaceholder(
                    group
                        ? `Channel for ${EVENT_GROUPS.find(g => g.value === group).label}`
                        : "Select an event group first"
                );

                return menu;
            };

            const buildUI = (chans, group) =>
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## Logging Setup")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(overview(chans))
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents((row) => row.addComponents(groupSelect(group)))
                    .addActionRowComponents((row) => row.addComponents(channelSelect(group)))
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("log_setup_save")
                                .setLabel("Save")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    );

            const sent = await message.reply({
                components: [buildUI(channels, currentGroup)],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: (i) => {
                    if (i.user.id !== message.author.id) {
                        i.reply({ content: "Only the command author can use this menu.", ephemeral: true });
                        return false;
                    }
                    return true;
                },
                time: 120000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "log_group_select") {
                    currentGroup = i.values[0];
                    return i.update({
                        components: [buildUI(channels, currentGroup)],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                if (i.customId === "log_channel_select" && currentGroup) {
                    channels[currentGroup] = i.values[0] || null;
                    return i.update({
                        components: [buildUI(channels, currentGroup)],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                if (i.customId === "log_setup_save") {
                    collector.stop("saved");
                    client.lmdbSet(`logging_cfg_${guildId}`, { ...channels });

                    return i.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent("## Logging Setup")
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(overview(channels))
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.tick} Configuration saved.\n` +
                                        `-# Use \`${prefix}logging enable\` to start logging.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
            });

            collector.on("end", async (_, reason) => {
                if (reason === "saved") return;
                await sent.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## Logging Setup\n-# Timed out — run \`${prefix}logging setup\` again to continue.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                }).catch(() => {});
            });

            return;
        }

        
        if (sub === "enable") {
            if (isEnabled) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${ENABLED_EMOJI} Logging is already **enabled**.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbSet(key, "enabled");

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${ENABLED_EMOJI} Logging has been **enabled**.\n` +
                                `-# Use \`${prefix}logging setup\` to assign channels per event group.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        
        if (sub === "disable") {
            if (!isEnabled) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${DISABLED_EMOJI} Logging is already **disabled**.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbDel(key);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${DISABLED_EMOJI} Logging has been **disabled**.\n` +
                                `-# Your configuration is saved. Re-enable with \`${prefix}logging enable\`.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        return message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.cross} Invalid option. Use \`${prefix}logging <enable|disable|status|setup>\``
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};

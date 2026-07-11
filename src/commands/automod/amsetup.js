const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const ALL_MODULES = [
    { key: "promotion",   name: "Anti Promotion",    desc: "Block Discord invite links" },
    { key: "links",       name: "Anti Links",         desc: "Block all HTTP/HTTPS URLs" },
    { key: "spam",        name: "Anti Spam",          desc: "Block rapid message spam" },
    { key: "massMention", name: "Anti Mass Mention",  desc: "Block mass user/role mentions" },
    { key: "massImages",  name: "Anti Mass Images",   desc: "Block bulk attachment uploads" },
    { key: "massForward", name: "Anti Mass Forward",  desc: "Block forwarded messages" },
    { key: "abuse",       name: "Anti Abuse",         desc: "Block slurs and hate speech" },
    { key: "nsfw",        name: "Anti NSFW",          desc: "Block NSFW keywords" },
    { key: "nsfwImages",  name: "Anti NSFW Images",   desc: "AI scan images for explicit content" },
    { key: "caps",        name: "Anti Caps",          desc: "Block excessive ALL CAPS (70%+)" },
    { key: "emojiSpam",   name: "Anti Emoji Spam",    desc: "Block 10+ emojis in one message" },
];

const TIMEOUT_LABEL_MAP = {
    60000:    "1 Minute",
    300000:   "5 Minutes",
    900000:   "15 Minutes",
    1800000:  "30 Minutes",
    3600000:  "1 Hour",
    21600000: "6 Hours",
    86400000: "24 Hours",
};

module.exports = {
    name: "amsetup",
    aliases: ["ams"],
    description: "Run the automod setup",
    category: "automod",
    cooldown: 5,

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

        const guildId  = message.guild.id;
        const cfgKey   = `automod_cfg_${guildId}`;
        const existing = client.lmdbGet(cfgKey) || {};

        const state = {
            step: 1,
            enabledModules: existing.modules
                ? Object.entries(existing.modules).filter(([, v]) => v.enabled).map(([k]) => k)
                : ALL_MODULES.map(m => m.key),
            action:          existing.action          || "delete",
            timeoutDuration: existing.limits?.timeoutDuration || 300000,
            limits: {
                spamCount:    existing.limits?.spamCount    || 5,
                mentionLimit: existing.limits?.mentionLimit || 5,
                imageLimit:   existing.limits?.imageLimit   || 5,
            },
            strikesEnabled:  existing.strikes?.enabled   || false,
            strikeThreshold: existing.strikes?.threshold  || 3,
            dmNotify:        existing.dmNotify            || false,
            logChannel:      existing.logChannel          || null,
        };

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        const totalSteps  = () => state.action === "timeout" ? 7 : 6;
        const getNextStep = (from) => (from === 2 && state.action !== "timeout") ? 4 : from + 1;
        const getPrevStep = (from) => (from === 4 && state.action !== "timeout") ? 2 : from - 1;
        const dispStep    = (n)    => (state.action !== "timeout" && n >= 4) ? n - 1 : n;

        const header = (n, title) =>
            `## Automod Setup\n-# Step ${dispStep(n)} of ${totalSteps()} — ${title}`;

        const backBtn = (disabled = false) =>
            new ButtonBuilder()
                .setCustomId("am_setup_back")
                .setLabel("← Back")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled);

        const nextBtn = (id) =>
            new ButtonBuilder()
                .setCustomId(id)
                .setLabel("Next →")
                .setStyle(ButtonStyle.Primary);

        
        const buildStep1 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(1, "Module Selection"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Select which protection modules to **enable**.\n" +
                        `-# Currently selected: **${state.enabledModules.length}** module(s)`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_modules")
                            .setPlaceholder("Select modules to enable...")
                            .setMinValues(1)
                            .setMaxValues(ALL_MODULES.length)
                            .addOptions(
                                ALL_MODULES.map(m => ({
                                    label:   m.name,
                                    value:   m.key,
                                    description: m.desc,
                                    default: state.enabledModules.includes(m.key),
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(true), nextBtn("am_setup_next1"))
                );

        
        const ACTION_DISPLAY = {
            delete:  "Delete Message Only",
            timeout: "Delete + Timeout User",
            kick:    "Delete + Kick User",
            ban:     "Delete + Ban User",
        };

        const buildStep2 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(2, "Punishment Action"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Choose what happens when a violation is detected.\n" +
                        `-# Current: **${ACTION_DISPLAY[state.action]}** — select any option below to confirm or change.`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_action")
                            .setPlaceholder("Select a punishment action...")
                            .addOptions([
                                { label: "Delete Message Only",   value: "delete",  description: "Only remove the violating message"          },
                                { label: "Delete + Timeout User", value: "timeout", description: "Remove message and timeout the user"         },
                                { label: "Delete + Kick User",    value: "kick",    description: "Remove message and kick the user"            },
                                { label: "Delete + Ban User",     value: "ban",     description: "Remove message and permanently ban the user" },
                            ])
                    )
                )
                .addActionRowComponents((row) => row.addComponents(backBtn()));

        
        const buildStep3 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(3, "Timeout Duration"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "How long should users be timed out when a violation is detected?"
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_timeout")
                            .setPlaceholder("Select timeout duration...")
                            .addOptions([
                                { label: "1 Minute",   value: "60000",    description: "Timeout for 1 minute",   default: state.timeoutDuration === 60000    },
                                { label: "5 Minutes",  value: "300000",   description: "Timeout for 5 minutes",  default: state.timeoutDuration === 300000   },
                                { label: "15 Minutes", value: "900000",   description: "Timeout for 15 minutes", default: state.timeoutDuration === 900000   },
                                { label: "30 Minutes", value: "1800000",  description: "Timeout for 30 minutes", default: state.timeoutDuration === 1800000  },
                                { label: "1 Hour",     value: "3600000",  description: "Timeout for 1 hour",     default: state.timeoutDuration === 3600000  },
                                { label: "6 Hours",    value: "21600000", description: "Timeout for 6 hours",    default: state.timeoutDuration === 21600000 },
                                { label: "24 Hours",   value: "86400000", description: "Timeout for 24 hours",   default: state.timeoutDuration === 86400000 },
                            ])
                    )
                )
                .addActionRowComponents((row) => row.addComponents(backBtn()));

        
        const buildStep4 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(4, "Detection Limits"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Set the thresholds for detection. Select each limit from the menus below."
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_limit_spam")
                            .setPlaceholder(`Spam: ${state.limits.spamCount} messages per 5 seconds`)
                            .addOptions(
                                [3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
                                    label:       `Spam: ${n} messages / 5 seconds`,
                                    value:       String(n),
                                    description: `Trigger after ${n} messages in 5 seconds`,
                                    default:     state.limits.spamCount === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_limit_mention")
                            .setPlaceholder(`Mention Limit: ${state.limits.mentionLimit} mentions`)
                            .addOptions(
                                [3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
                                    label:       `Mention Limit: ${n} users/roles`,
                                    value:       String(n),
                                    description: `Trigger after ${n} mentions in one message`,
                                    default:     state.limits.mentionLimit === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_limit_image")
                            .setPlaceholder(`Image Limit: ${state.limits.imageLimit} attachments`)
                            .addOptions(
                                [3, 4, 5, 6, 7, 8, 9, 10].map(n => ({
                                    label:       `Image Limit: ${n} attachments`,
                                    value:       String(n),
                                    description: `Trigger after ${n} attachments in one message`,
                                    default:     state.limits.imageLimit === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(), nextBtn("am_setup_next4"))
                );

        
        const buildStep5 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(5, "Penalties & Notifications"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "**Strike System** — Tracks violations and escalates punishment automatically.\n" +
                        "-# Escalation order: Delete → Timeout → Kick → Ban"
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_strikes")
                            .setPlaceholder("Configure strike system...")
                            .addOptions([
                                { label: "Disabled — No strike tracking",          value: "off", description: "All violations use the same configured punishment",   default: !state.strikesEnabled },
                                { label: "Enabled — Escalate at 3 strikes",        value: "3",   description: "Escalate punishment after 3 violations",             default: state.strikesEnabled && state.strikeThreshold === 3 },
                                { label: "Enabled — Escalate at 5 strikes",        value: "5",   description: "Escalate punishment after 5 violations",             default: state.strikesEnabled && state.strikeThreshold === 5 },
                            ])
                    )
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "**DM Notifications** — Send users a private message when they are punished."
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("am_setup_dm")
                            .setPlaceholder("DM users on violation?")
                            .addOptions([
                                { label: "Enabled — DM users when punished", value: "yes", description: "Send a private message to the violating user", default:  state.dmNotify },
                                { label: "Disabled — No DMs",                value: "no",  description: "No private messages sent to users",            default: !state.dmNotify },
                            ])
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(), nextBtn("am_setup_next5"))
                );

        
        const buildStep6 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(6, "Log Channel"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Set a channel where every automod violation will be logged.\n" +
                        `**Current:** ${state.logChannel ? `<#${state.logChannel}>` : "Not configured"}`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        backBtn(),
                        new ButtonBuilder()
                            .setCustomId("am_setup_setchannel")
                            .setLabel("Set Log Channel")
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId("am_setup_clearchannel")
                            .setLabel("Disable Logging")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(!state.logChannel),
                        new ButtonBuilder()
                            .setCustomId("am_setup_skipchannel")
                            .setLabel(state.logChannel ? "Keep & Continue" : "Skip")
                            .setStyle(ButtonStyle.Secondary),
                    )
                );

        
        const buildStep7 = () => {
            const actionDisplay = {
                delete:  "Delete Message Only",
                timeout: `Delete + Timeout (${TIMEOUT_LABEL_MAP[state.timeoutDuration] || "5 min"})`,
                kick:    "Delete + Kick",
                ban:     "Delete + Ban",
            };

            const moduleLines = ALL_MODULES.map(m => {
                const on = state.enabledModules.includes(m.key);
                return `${on ? client.emoji.enabled2 : client.emoji.disabled2} ${m.name}`;
            }).join("\n");

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(7, "Confirm & Save"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Modules**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(moduleLines)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Punishment:** \`${actionDisplay[state.action]}\`\n` +
                        `**Spam Limit:** \`${state.limits.spamCount} msgs / 5s\`\n` +
                        `**Mention Limit:** \`${state.limits.mentionLimit} mentions\`\n` +
                        `**Image Limit:** \`${state.limits.imageLimit} attachments\`\n` +
                        `**Strike System:** \`${state.strikesEnabled ? `Enabled — escalate at ${state.strikeThreshold} strikes` : "Disabled"}\`\n` +
                        `**DM Notify:** \`${state.dmNotify ? "Enabled" : "Disabled"}\`\n` +
                        `**Log Channel:** ${state.logChannel ? `<#${state.logChannel}>` : "\`Not set\`"}`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(
                        backBtn(),
                        new ButtonBuilder()
                            .setCustomId("am_setup_confirm")
                            .setLabel("✓ Confirm & Save")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("am_setup_cancel")
                            .setLabel("Cancel")
                            .setStyle(ButtonStyle.Danger),
                    )
                );
        };

        const getStepBuilder = () => {
            switch (state.step) {
                case 1: return buildStep1();
                case 2: return buildStep2();
                case 3: return buildStep3();
                case 4: return buildStep4();
                case 5: return buildStep5();
                case 6: return buildStep6();
                case 7: return buildStep7();
                default: return buildStep7();
            }
        };

        const sent = await message.reply({
            components: [buildStep1()],
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
            time: 180000,
        });

        collector.on("collect", async (i) => {
            
            if (i.customId === "am_setup_modules") {
                state.enabledModules = i.values;
                return i.update({ components: [buildStep1()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_next1") {
                state.step = 2;
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "am_setup_next4") {
                state.step = 5;
                return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "am_setup_next5") {
                state.step = 6;
                return i.update({ components: [buildStep6()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_back") {
                state.step = getPrevStep(state.step);
                return i.update({ components: [getStepBuilder()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_action") {
                state.action = i.values[0];
                state.step   = getNextStep(2);
                return i.update({ components: [getStepBuilder()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_timeout") {
                state.timeoutDuration = parseInt(i.values[0]);
                state.step = 4;
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_limit_spam") {
                state.limits.spamCount = parseInt(i.values[0]);
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "am_setup_limit_mention") {
                state.limits.mentionLimit = parseInt(i.values[0]);
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "am_setup_limit_image") {
                state.limits.imageLimit = parseInt(i.values[0]);
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_strikes") {
                const val = i.values[0];
                if (val === "off") {
                    state.strikesEnabled = false;
                } else {
                    state.strikesEnabled  = true;
                    state.strikeThreshold = parseInt(val);
                }
                return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_dm") {
                state.dmNotify = i.values[0] === "yes";
                return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "am_setup_skipchannel") {
                state.step = 7;
                return i.update({ components: [buildStep7()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "am_setup_clearchannel") {
                state.logChannel = null;
                return i.update({ components: [buildStep6()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "am_setup_setchannel") {
                await i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    "## Automod Setup — Set Log Channel"
                                )
                            )
                            .addSeparatorComponents(sep())
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    "Please **mention a channel** in chat (e.g. `#mod-log`).\n-# You have 30 seconds."
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });

                const msgFilter = (m) =>
                    m.author.id === message.author.id && m.mentions.channels.size > 0;

                const collected = await message.channel
                    .awaitMessages({ filter: msgFilter, max: 1, time: 30000 })
                    .catch(() => null);

                if (collected && collected.size > 0) {
                    const chMsg = collected.first();
                    state.logChannel = chMsg.mentions.channels.first().id;
                    await chMsg.delete().catch(() => {});
                }

                state.step = 6;
                await sent.edit({ components: [buildStep6()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                return;
            }

            
            if (i.customId === "am_setup_confirm") {
                const cfg = {
                    modules: Object.fromEntries(
                        ALL_MODULES.map(m => [
                            m.key,
                            { enabled: state.enabledModules.includes(m.key), action: state.action },
                        ])
                    ),
                    action: state.action,
                    limits: {
                        spamCount:       state.limits.spamCount,
                        spamWindow:      5000,
                        mentionLimit:    state.limits.mentionLimit,
                        imageLimit:      state.limits.imageLimit,
                        capsPercent:     70,
                        emojiLimit:      10,
                        timeoutDuration: state.timeoutDuration,
                    },
                    strikes: {
                        enabled:   state.strikesEnabled,
                        threshold: state.strikeThreshold,
                    },
                    dmNotify:   state.dmNotify,
                    logChannel: state.logChannel,
                };

                client.lmdbSet(cfgKey, cfg);
                client.lmdbSet(`automod_${guildId}`, "enabled");
                if (!client._automodCache) client._automodCache = new Map();
                client._automodCache.set(guildId, true);

                collector.stop("done");

                return i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## ${client.emoji.enabled2} Automod Configured & Enabled`
                                )
                            )
                            .addSeparatorComponents(sep())
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `**${state.enabledModules.length}/${ALL_MODULES.length}** modules active\n` +
                                    `**Action:** \`${state.action}\`\n` +
                                    `**Strikes:** \`${state.strikesEnabled ? `escalate at ${state.strikeThreshold}` : "off"}\`\n` +
                                    `**DM Notify:** \`${state.dmNotify ? "on" : "off"}\`\n` +
                                    `**Log Channel:** ${state.logChannel ? `<#${state.logChannel}>` : "\`none\`"}`
                                )
                            )
                            .addSeparatorComponents(sep())
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `-# Server is now protected. Use \`${prefix}automod status\` for full details.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            
            if (i.customId === "am_setup_cancel") {
                collector.stop("cancelled");
                return i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Setup cancelled. No changes were saved.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        });

        collector.on("end", async (collected, reason) => {
            if (reason === "done" || reason === "cancelled") return;
            await sent.edit({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Automod Setup\n-# Timed out — run \`${prefix}amsetup\` again to continue.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const {
    VIOLATION_TYPES,
    DEFAULT_WEIGHTS,
    DEFAULT_THRESHOLD,
    DEFAULT_DECAY_PER_MIN,
    getConfig,
    saveConfig,
    getState,
    saveState,
    renderHeatStatus,
} = require("../../utils/heatSystem");
const { isPremiumActive } = require("../../utils/premiumSystem");

const THRESHOLD_OPTIONS = [50, 75, 100, 150, 200, 300];
const DECAY_OPTIONS     = [0.5, 1, 2, 5, 10];
const WEIGHT_OPTIONS    = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

const MODE_DISPLAY = {
    auto:   "Auto — lifts once heat cools below half the threshold",
    manual: "Manual — only an owner running `heat unlock` lifts it",
    both:   "Both — auto-cools, and can also be unlocked manually",
};

module.exports = {
    name: "heatsetup",
    aliases: ["hms", "bmsetup"],
    description: "Run the full Beast Mode setup",
    category: "heat",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
        const owners = client.config?.owner || [];

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id)
        ) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Only the **server owner** or a **bot owner** can use this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const guildId  = message.guild.id;
        const isBotOwner = owners.includes(message.author.id);

        if (!isBotOwner && !isPremiumActive(client, guildId)) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Activate premium to use this feature.\n-# Run \`premium\` to see plans.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const existing = getConfig(client, guildId) || {};

        const violationEntries = Object.entries(VIOLATION_TYPES); // [key, label]

        const state = {
            step: 1,
            threshold:      existing.threshold ?? DEFAULT_THRESHOLD,
            decayPerMinute: existing.decayPerMinute ?? DEFAULT_DECAY_PER_MIN,
            lockdownMode:   existing.lockdownMode ?? "both",
            weights:        { ...(existing.weights || {}) },
            selectedViolationKey: violationEntries[0][0],
        };

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        const header = (n, title) => `## Beast Mode Setup\n-# Step ${n} of 5 — ${title}`;

        const backBtn = (disabled = false) =>
            new ButtonBuilder().setCustomId("heat_setup_back").setLabel("Back").setStyle(ButtonStyle.Secondary).setDisabled(disabled);

        const nextBtn = (id, label = "Next") =>
            new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary);

        const weightFor = (label) => state.weights[label] ?? DEFAULT_WEIGHTS[label] ?? 10;

        // ── Step 1 — Threshold ────────────────────────────────────────
        const buildStep1 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(header(1, "Lockdown Threshold")))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "How much heat should trigger an automatic lockdown?\n" +
                        `-# Current: **${state.threshold}** heat`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("heat_setup_threshold")
                            .setPlaceholder(`Threshold: ${state.threshold} heat`)
                            .addOptions(
                                THRESHOLD_OPTIONS.map(n => ({
                                    label: `${n} heat`,
                                    value: String(n),
                                    description: `Lockdown triggers at ${n} heat`,
                                    default: state.threshold === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) => row.addComponents(backBtn(true), nextBtn("heat_setup_next1")));

        // ── Step 2 — Cooldown / Decay rate ────────────────────────────
        const buildStep2 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(header(2, "Cooldown Rate")))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "How fast should heat cool down on its own over time?\n" +
                        `-# Current: **${state.decayPerMinute}** heat / minute`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("heat_setup_decay")
                            .setPlaceholder(`Cooldown: ${state.decayPerMinute} heat / minute`)
                            .addOptions(
                                DECAY_OPTIONS.map(n => ({
                                    label: `${n} heat / minute`,
                                    value: String(n),
                                    description: `Heat drops by ${n} every minute`,
                                    default: state.decayPerMinute === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) => row.addComponents(backBtn(), nextBtn("heat_setup_next2")));

        // ── Step 3 — Lockdown end mode ─────────────────────────────────
        const buildStep3 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(header(3, "Lockdown End Mode")))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "How should an active lockdown end?\n" +
                        `-# Current: **${state.lockdownMode}**`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("heat_setup_mode")
                            .setPlaceholder("Select lockdown end mode...")
                            .addOptions(
                                Object.entries(MODE_DISPLAY).map(([value, description]) => ({
                                    label: value.charAt(0).toUpperCase() + value.slice(1),
                                    value,
                                    description,
                                    default: state.lockdownMode === value,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) => row.addComponents(backBtn(), nextBtn("heat_setup_next3")));

        // ── Step 4 — Violation weights ─────────────────────────────────
        const buildStep4 = () => {
            const selectedLabel = VIOLATION_TYPES[state.selectedViolationKey];

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(header(4, "Violation Weights")))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Pick a violation, then set how much heat it adds.\n" +
                        `-# Editing: **${selectedLabel}** — current weight: **${weightFor(selectedLabel)}**`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("heat_setup_violation")
                            .setPlaceholder(`Violation: ${selectedLabel}`)
                            .addOptions(
                                Object.entries(VIOLATION_TYPES).map(([key, label]) => ({
                                    label,
                                    value: key,
                                    description: `Current weight: ${weightFor(label)}`,
                                    default: key === state.selectedViolationKey,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("heat_setup_weight")
                            .setPlaceholder(`Weight: ${weightFor(selectedLabel)}`)
                            .addOptions(
                                WEIGHT_OPTIONS.map(n => ({
                                    label: `${n} heat`,
                                    value: String(n),
                                    default: weightFor(selectedLabel) === n,
                                }))
                            )
                    )
                )
                .addSeparatorComponents(thin())
                .addActionRowComponents((row) => row.addComponents(backBtn(), nextBtn("heat_setup_next4")));
        };

        // ── Step 5 — Confirm & Save ─────────────────────────────────────
        const buildStep5 = () => {
            const weightLines = Object.entries(VIOLATION_TYPES)
                .map(([, label]) => `**${label}** — \`${weightFor(label)}\``)
                .join("\n");

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(header(5, "Confirm & Save")))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Threshold:** \`${state.threshold} heat\`\n` +
                        `**Cooldown Rate:** \`${state.decayPerMinute} heat/min\`\n` +
                        `**Lockdown End Mode:** \`${state.lockdownMode}\``
                    )
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Violation Weights**\n${weightLines}`))
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(
                        backBtn(),
                        new ButtonBuilder().setCustomId("heat_setup_confirm").setLabel("Confirm & Save").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("heat_setup_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger),
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
                default: return buildStep5();
            }
        };

        const sent = await message.reply({ components: [buildStep1()], flags: MessageFlags.IsComponentsV2 });

        const collector = sent.createMessageComponentCollector({
            filter: (i) => {
                if (i.user.id !== message.author.id) {
                    i.reply({ content: "Only the command author can use this menu.", flags: 64 });
                    return false;
                }
                return true;
            },
            time: 180000,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "heat_setup_threshold") {
                state.threshold = parseInt(i.values[0], 10);
                return i.update({ components: [buildStep1()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "heat_setup_decay") {
                state.decayPerMinute = parseFloat(i.values[0]);
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "heat_setup_mode") {
                state.lockdownMode = i.values[0];
                return i.update({ components: [buildStep3()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "heat_setup_violation") {
                state.selectedViolationKey = i.values[0];
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "heat_setup_weight") {
                const label = VIOLATION_TYPES[state.selectedViolationKey];
                state.weights[label] = parseInt(i.values[0], 10);
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.customId === "heat_setup_next1") { state.step = 2; return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 }); }
            if (i.customId === "heat_setup_next2") { state.step = 3; return i.update({ components: [buildStep3()], flags: MessageFlags.IsComponentsV2 }); }
            if (i.customId === "heat_setup_next3") { state.step = 4; return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 }); }
            if (i.customId === "heat_setup_next4") { state.step = 5; return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 }); }

            if (i.customId === "heat_setup_back") {
                state.step = Math.max(1, state.step - 1);
                return i.update({ components: [getStepBuilder()], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.customId === "heat_setup_confirm") {
                await i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.loading} Saving Beast Mode configuration...`)),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });

                try {
                    let logChannel = message.guild.channels.cache.get(existing.logChannelId);
                    if (!logChannel) {
                        logChannel = await message.guild.channels.create({
                            name: "beast-mode-logs",
                            type: ChannelType.GuildText,
                            topic: "Heat gained, lost, and lockdown events for Beast Mode.",
                            permissionOverwrites: [
                                {
                                    id: message.guild.members.me.id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.EmbedLinks,
                                        PermissionFlagsBits.ReadMessageHistory,
                                    ],
                                },
                            ],
                            reason: "Beast Mode setup",
                        });
                    }

                    let statusChannel = message.guild.channels.cache.get(existing.statusChannelId);
                    if (!statusChannel) {
                        statusChannel = await message.guild.channels.create({
                            name: "beast-mode-status",
                            type: ChannelType.GuildText,
                            topic: "Live, real-time Beast Mode heat status — updates automatically.",
                            permissionOverwrites: [
                                {
                                    id: message.guild.members.me.id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.SendMessages,
                                        PermissionFlagsBits.EmbedLinks,
                                        PermissionFlagsBits.ReadMessageHistory,
                                    ],
                                },
                            ],
                            reason: "Beast Mode setup",
                        });
                    }

                    saveConfig(client, guildId, {
                        enabled: true,
                        threshold: state.threshold,
                        decayPerMinute: state.decayPerMinute,
                        lockdownMode: state.lockdownMode,
                        weights: state.weights,
                        logChannelId: logChannel.id,
                        statusChannelId: statusChannel.id,
                        statusMessageId: existing.statusMessageId ?? null,
                    });

                    if (!getState(client, guildId)) saveState(client, guildId, { points: 0, lastUpdate: Date.now(), lockdown: null });

                    await renderHeatStatus(client, message.guild);

                    collector.stop("done");

                    return sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${client.emoji.enabled2} Beast Mode Configured & Enabled`))
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `**Threshold:** \`${state.threshold} heat\`\n` +
                                        `**Cooldown Rate:** \`${state.decayPerMinute} heat/min\`\n` +
                                        `**Lockdown End Mode:** \`${state.lockdownMode}\`\n` +
                                        `**Log Channel:** ${logChannel}\n` +
                                        `**Live Status:** ${statusChannel}`
                                    )
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`-# Use \`${prefix}heat status\` for full details.`)
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                } catch (err) {
                    console.error("[Heat Setup Error]", err);
                    return sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xED4245)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`${client.emoji.cross} Setup failed. Make sure I have **Manage Channels** and **Manage Roles** permission.`)
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }
            }

            if (i.customId === "heat_setup_cancel") {
                collector.stop("cancelled");
                return i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} Setup cancelled. No changes were saved.`)),
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
                            new TextDisplayBuilder().setContent(`## Beast Mode Setup\n-# Timed out — run \`${prefix}heatsetup\` again to continue.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};

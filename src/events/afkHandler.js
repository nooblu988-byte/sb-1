const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

const { parseDuration, formatDuration } = require("../utils/durationParser");

const ACCENT = 0x26272F;
const STEP_WAIT_MS = 2 * 60 * 1000;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = (client) => {
    if (!client._afkPending) client._afkPending = new Map();
    const pending = client._afkPending;

    const panel = (message, content) =>
        message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Set AFK Status"))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});

    const getAfk = (guildId, userId) => client.lmdbGet(`afk_${guildId}_${userId}`) || null;
    const saveAfk = (guildId, userId, data) => client.lmdbSet(`afk_${guildId}_${userId}`, data);
    const clearAfk = (guildId, userId) => client.lmdbDel(`afk_${guildId}_${userId}`);

    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        // ── Step 1/2: capture AFK setup answers ──────────────────────
        const pendingKey = `${message.guild.id}_${message.author.id}`;
        const state = pending.get(pendingKey);

        if (state && message.channel.id === state.channelId) {
            if (Date.now() > state.expires) {
                pending.delete(pendingKey);
                return panel(message, "That took too long — run `afk` again to restart.");
            }

            if (state.step === "duration") {
                const parsed = parseDuration(message.content);
                if (!parsed) {
                    return panel(message, "Couldn't understand that duration. Try again — e.g. `30 minutes`, `2 hours`, `3 days`.");
                }

                pending.set(pendingKey, {
                    step: "reason",
                    channelId: state.channelId,
                    durationMs: parsed.ms,
                    durationLabel: parsed.label,
                    expires: Date.now() + STEP_WAIT_MS,
                });

                return panel(message, "Got it. Now write your reason for being AFK.");
            }

            if (state.step === "reason") {
                const reason = message.content.trim().slice(0, 300);
                if (!reason) {
                    return panel(message, "Please write a reason (text only).");
                }

                pending.delete(pendingKey);

                const now = Date.now();
                saveAfk(message.guild.id, message.author.id, {
                    reason,
                    setAt: now,
                    expiresAt: now + state.durationMs,
                    durationLabel: state.durationLabel,
                });

                return panel(
                    message,
                    `You're now AFK for **${state.durationLabel}**.\n**Reason:** ${reason}\n\n-# Send any message to come back early.`
                );
            }

            return;
        }

        // ── Step: clear AFK when the user themselves sends a message ──
        const ownAfk = getAfk(message.guild.id, message.author.id);
        if (ownAfk) {
            clearAfk(message.guild.id, message.author.id);
            const wasFor = formatDuration(Date.now() - ownAfk.setAt);
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`Welcome back — your AFK status (was on for ${wasFor}) has been removed.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        }

        // ── Step: notify if any mentioned user is AFK ──────────────────
        if (!message.mentions.users.size) return;

        for (const [, user] of message.mentions.users) {
            if (user.bot || user.id === message.author.id) continue;

            const afk = getAfk(message.guild.id, user.id);
            if (!afk) continue;
            if (Date.now() > afk.expiresAt) {
                clearAfk(message.guild.id, user.id);
                continue;
            }

            const since = formatDuration(Date.now() - afk.setAt);
            await message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${user} is AFK — set **${afk.durationLabel}** ago (${since} elapsed).\n**Reason:** ${afk.reason}`
                                    )
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })))
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        }
    });
};

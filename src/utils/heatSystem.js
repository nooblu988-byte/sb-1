const { PermissionFlagsBits } = require("discord.js");
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const _noop = () => {};
const ACCENT = 0x26272F;

// Beast Mode strips a wider net than the antinuke core does — anything
// that could meaningfully damage or disrupt the server once a lockdown
// is triggered, not just what antinuke itself watches for.
const DANGEROUS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.MentionEveryone,
].reduce((a, b) => a | b, 0n);

// Friendly short names ↔ the exact R.* reason strings used by security.js.
// `heat set <key> <points>` uses these keys.
const VIOLATION_TYPES = {
    channelcreate:   "Antinuke: Channel Create",
    channeldelete:   "Antinuke: Channel Delete",
    channelupdate:   "Antinuke: Channel Update",
    rolecreate:      "Antinuke: Role Create",
    roledelete:      "Antinuke: Role Delete",
    roleupdate:      "Antinuke: Role Update",
    dangerousrole:   "Antinuke: Dangerous Role Grant",
    ban:             "Antinuke: Unauthorized Ban",
    unban:           "Antinuke: Unauthorized Unban",
    kick:            "Antinuke: Unauthorized Kick",
    prune:           "Antinuke: Unauthorized Prune",
    botadd:          "Antinuke: Unauthorized Bot Add",
    webhookcreate:   "Antinuke: Webhook Create",
    webhookupdate:   "Antinuke: Webhook Update",
    webhookdelete:   "Antinuke: Webhook Delete",
    guildupdate:     "Antinuke: Guild Update",
    integration:     "Antinuke: Unauthorized Integration",
    scheduledcreate: "Antinuke: Scheduled Event Create",
    scheduledaction: "Antinuke: Scheduled Event Action",
    linkedrolecreate: "Antinuke: Linked Role Prompt Create",
    linkedroleupdate: "Antinuke: Linked Role Prompt Update",
    linkedroledelete: "Antinuke: Linked Role Prompt Delete",
    autorolegrant: "Beast Mode: Dangerous/Linked Role Auto-Grant",
};

const DEFAULT_WEIGHTS = {
    "Antinuke: Channel Create": 5,
    "Antinuke: Channel Delete": 15,
    "Antinuke: Channel Update": 5,
    "Antinuke: Role Create": 5,
    "Antinuke: Role Delete": 15,
    "Antinuke: Role Update": 8,
    "Antinuke: Dangerous Role Grant": 20,
    "Antinuke: Unauthorized Ban": 10,
    "Antinuke: Unauthorized Unban": 8,
    "Antinuke: Unauthorized Kick": 8,
    "Antinuke: Unauthorized Prune": 15,
    "Antinuke: Unauthorized Bot Add": 20,
    "Antinuke: Webhook Create": 12,
    "Antinuke: Webhook Update": 5,
    "Antinuke: Webhook Delete": 5,
    "Antinuke: Guild Update": 10,
    "Antinuke: Unauthorized Integration": 10,
    "Antinuke: Scheduled Event Create": 5,
    "Antinuke: Scheduled Event Action": 5,
    "Antinuke: Linked Role Prompt Create": 15,
    "Antinuke: Linked Role Prompt Update": 10,
    "Antinuke: Linked Role Prompt Delete": 15,
    "Beast Mode: Dangerous/Linked Role Auto-Grant": 20,
};

const DEFAULT_THRESHOLD = 100;
const DEFAULT_DECAY_PER_MIN = 1;
const AUTO_UNLOCK_RATIO = 0.5; // auto-lifts once heat decays to 50% of threshold

// ─── Config ───────────────────────────────────────────────────────────
function getConfig(client, guildId) {
    return client.lmdbGet(`heat_cfg_${guildId}`) || null;
}
function saveConfig(client, guildId, cfg) {
    return client.lmdbSet(`heat_cfg_${guildId}`, cfg);
}

// ─── Live state (points + active lockdown snapshot) ──────────────────
function getState(client, guildId) {
    return client.lmdbGet(`heat_state_${guildId}`) || { points: 0, lastUpdate: Date.now(), lockdown: null };
}
function saveState(client, guildId, state) {
    return client.lmdbSet(`heat_state_${guildId}`, state);
}

// ─── Heat whitelist — these users' actions never generate heat ───────
function getWhitelist(client, guildId) {
    return client.lmdbGet(`heat_whitelist_${guildId}`) || [];
}
function saveWhitelist(client, guildId, list) {
    return client.lmdbSet(`heat_whitelist_${guildId}`, list);
}

function decay(state, cfg) {
    const elapsedMin = (Date.now() - state.lastUpdate) / 60000;
    if (elapsedMin > 0) {
        state.points = Math.max(0, state.points - elapsedMin * (cfg.decayPerMinute ?? DEFAULT_DECAY_PER_MIN));
        state.lastUpdate = Date.now();
    }
    return state;
}

async function logHeat(client, guild, channelId, content, accent = 0xED9C08) {
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;
    await channel.send({
        components: [
            new ContainerBuilder()
                .setAccentColor(accent)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
        ],
        flags: MessageFlags.IsComponentsV2,
    }).catch(_noop);
}

// ─── Live, self-updating heat status message ─────────────────────────
async function renderHeatStatus(client, guild) {
    const guildId = guild.id;
    const cfg = getConfig(client, guildId);
    if (!cfg || !cfg.statusChannelId) return;

    const channel = guild.channels.cache.get(cfg.statusChannelId);
    if (!channel) return;

    const state = getState(client, guildId);
    const barLength = 20;
    const filled = Math.min(barLength, Math.round((state.points / cfg.threshold) * barLength));
    const bar = "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, barLength - filled));

    const container = new ContainerBuilder()
        .setAccentColor(state.lockdown ? 0xED4245 : ACCENT)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Beast Mode — Live Status"))
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Heat:** \`${Math.round(state.points)} / ${cfg.threshold}\`\n` +
                `\`${bar}\`\n\n` +
                `**Lockdown:** ${state.lockdown ? `Active since <t:${Math.floor(state.lockdown.since / 1000)}:R>` : "Not active"}\n` +
                `**Cooldown Rate:** \`${cfg.decayPerMinute} heat / minute\`\n` +
                `**End Mode:** \`${cfg.lockdownMode}\``
            )
        )
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Updated <t:${Math.floor(Date.now() / 1000)}:R>`)
        );

    const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };

    let msg = null;
    if (cfg.statusMessageId) {
        msg = await channel.messages.fetch(cfg.statusMessageId).catch(() => null);
    }

    if (msg) {
        await msg.edit(payload).catch(() => {});
    } else {
        const sent = await channel.send(payload).catch(() => null);
        if (sent) saveConfig(client, guildId, { ...cfg, statusMessageId: sent.id });
    }
}

// ─── Trigger / lift the lockdown ──────────────────────────────────────
async function triggerLockdown(client, guild, cfg, state) {
    const botRole = guild.members.me?.roles.highest;
    const botPosition = botRole?.position ?? 0;

    // Roles held by Beast-Mode-whitelisted users/bots are left alone —
    // whitelist protection extends to their roles during lockdown too.
    const whitelist = getWhitelist(client, guild.id);
    const protectedRoleIds = new Set();
    for (const userId of whitelist) {
        const member = guild.members.cache.get(userId);
        if (member) for (const role of member.roles.cache.values()) protectedRoleIds.add(role.id);
    }

    const snapshot = [];
    const edits = [];

    for (const [, role] of guild.roles.cache) {
        if (botRole && role.position >= botPosition) continue; // Discord would reject these anyway — also protects the bot's own role
        if (protectedRoleIds.has(role.id)) continue;
        const bits = role.permissions.bitfield & DANGEROUS;
        if (bits === 0n) continue;

        snapshot.push({ roleId: role.id, removed: bits.toString() });
        edits.push(
            role.setPermissions(
                role.permissions.bitfield & ~DANGEROUS,
                "Beast Mode: Heat threshold reached — lockdown"
            ).catch(_noop)
        );
    }

    // Fire every role edit in parallel — don't wait on one before starting
    // the next. State is saved immediately so the lockdown is recorded
    // even while the permission edits are still landing.
    state.lockdown = { since: Date.now(), snapshot };
    saveState(client, guild.id, state);
    Promise.allSettled(edits).catch(_noop);

    await logHeat(
        client, guild, cfg.logChannelId,
        `${client.emoji.cross} **Beast Mode activated**\n\n` +
        `Heat crossed the threshold (**${Math.round(state.points)}/${cfg.threshold}**).\n` +
        `Dangerous permissions (Administrator, Ban/Kick, Manage Roles/Channels/Server/Webhooks/Nicknames/Emojis/Events/Threads, Timeout, Move Members, Create Invite, Mention Everyone) have been stripped from **${snapshot.length}** role(s).\n` +
        `Members can still send messages and use voice normally.\n\n` +
        `-# Use \`heat unlock\` to lift this manually.`,
        0xED4245
    );

    guild.members.fetch(guild.ownerId).then(owner => {
        owner.send(
            `Beast Mode triggered in **${guild.name}** — heat threshold reached and the server has been locked down. Use \`heat unlock\` to lift it once things are safe.`
        ).catch(_noop);
    }).catch(_noop);

    renderHeatStatus(client, guild).catch(_noop);
}

async function liftLockdown(client, guild, cfg, state, reason = "auto") {
    if (!state.lockdown) return;

    const restores = state.lockdown.snapshot.map(entry => {
        const role = guild.roles.cache.get(entry.roleId);
        if (!role) return Promise.resolve();
        const restored = role.permissions.bitfield | BigInt(entry.removed);
        return role.setPermissions(restored, "Beast Mode: Lockdown lifted").catch(_noop);
    });
    await Promise.allSettled(restores);

    state.lockdown = null;
    state.points = 0;
    state.lastUpdate = Date.now();
    saveState(client, guild.id, state);

    await logHeat(
        client, guild, cfg.logChannelId,
        `${client.emoji.enabled2} **Beast Mode lockdown lifted** (${reason}). Original role permissions restored.`,
        0x57F287
    );

    renderHeatStatus(client, guild).catch(_noop);
}

// ─── Main entry point — called from the antinuke core on every detected violation ─
async function addHeat(client, guild, reason, executorId) {
    try {
        if (!guild) return;
        if (executorId && executorId === guild.ownerId) return;

        const cfg = getConfig(client, guild.id);
        if (!cfg || !cfg.enabled) return;

        const whitelist = getWhitelist(client, guild.id);
        if (executorId && whitelist.includes(executorId)) return;

        let state = getState(client, guild.id);
        state = decay(state, cfg);

        const weight = (cfg.weights && cfg.weights[reason]) ?? DEFAULT_WEIGHTS[reason] ?? 10;
        state.points += weight;
        saveState(client, guild.id, state);

        logHeat(
            client, guild, cfg.logChannelId,
            `${client.emoji.arrow} +${weight} heat from **${reason}** (<@${executorId}>) — total: **${Math.round(state.points)}/${cfg.threshold}**`
        );
        renderHeatStatus(client, guild).catch(_noop);

        if (!state.lockdown && state.points >= cfg.threshold) {
            await triggerLockdown(client, guild, cfg, state);
        }
    } catch (err) {
        console.error("[Heat System Error]", err);
    }
}

// ─── Background decay + auto-unlock ticker ───────────────────────────
function startDecayTicker(client) {
    if (client._heatTickerStarted) return;
    client._heatTickerStarted = true;

    setInterval(() => {
        try {
            const range = client.lmdb.getRange({ start: "heat_cfg_", end: "heat_cfg_~" });
            for (const { key } of range) {
                const guildId = String(key).slice("heat_cfg_".length);
                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;

                const cfg = getConfig(client, guildId);
                if (!cfg || !cfg.enabled) continue;

                let state = getState(client, guildId);
                state = decay(state, cfg);
                saveState(client, guildId, state);

                if (state.lockdown && cfg.lockdownMode !== "manual" && state.points <= cfg.threshold * AUTO_UNLOCK_RATIO) {
                    liftLockdown(client, guild, cfg, state, "auto cooldown").catch(_noop);
                } else {
                    renderHeatStatus(client, guild).catch(_noop);
                }
            }
        } catch (err) {
            console.error("[Heat Decay Ticker Error]", err);
        }
    }, 60_000);
}

module.exports = {
    DANGEROUS,
    VIOLATION_TYPES,
    DEFAULT_WEIGHTS,
    DEFAULT_THRESHOLD,
    DEFAULT_DECAY_PER_MIN,
    getConfig,
    saveConfig,
    getState,
    saveState,
    getWhitelist,
    saveWhitelist,
    addHeat,
    triggerLockdown,
    liftLockdown,
    renderHeatStatus,
    startDecayTicker,
    sep,
};

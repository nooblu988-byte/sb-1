// ─── Config (which channels to post to) ───────────────────────────────
function getConfig(client, guildId) {
    return client.lmdbGet(`invitetrack_cfg_${guildId}`) || null;
}
function saveConfig(client, guildId, cfg) {
    return client.lmdbSet(`invitetrack_cfg_${guildId}`, cfg);
}

// ─── Permanent record of how each member joined (for the leave mirror) ─
function getJoinInfo(client, guildId, userId) {
    return client.lmdbGet(`invitetrack_join_${guildId}_${userId}`) || null;
}
function saveJoinInfo(client, guildId, userId, info) {
    return client.lmdbSet(`invitetrack_join_${guildId}_${userId}`, info);
}
function clearJoinInfo(client, guildId, userId) {
    return client.lmdbDel(`invitetrack_join_${guildId}_${userId}`);
}

// ─── Live invite-use cache (in-memory — rebuilt on ready per guild) ───
function ensureCacheMaps(client) {
    if (!client._inviteUseCache) client._inviteUseCache = new Map(); // guildId -> Map(code -> uses)
    if (!client._vanityUseCache) client._vanityUseCache = new Map(); // guildId -> uses
}

async function primeGuildCache(client, guild) {
    ensureCacheMaps(client);
    try {
        const invites = await guild.invites.fetch();
        const map = new Map();
        for (const [code, invite] of invites) map.set(code, invite.uses ?? 0);
        client._inviteUseCache.set(guild.id, map);
    } catch (err) {
        console.error(`[Invite Tracking] Failed to prime invite cache for ${guild.id}:`, err?.message || err);
    }

    if (guild.vanityURLCode) {
        try {
            const vanity = await guild.fetchVanityData();
            client._vanityUseCache.set(guild.id, vanity?.uses ?? 0);
        } catch (err) {
            console.error(`[Invite Tracking] Failed to prime vanity cache for ${guild.id}:`, err?.message || err);
        }
    }
}

// Figures out which invite (or the vanity link) a member just used by
// diffing current use-counts against the cached snapshot, then updates
// the cache for next time. Returns one of:
//   { type: "vanity" }
//   { type: "invite", inviterId, code }
//   { type: "unknown" }
async function resolveJoin(client, guild) {
    ensureCacheMaps(client);

    const before = client._inviteUseCache.get(guild.id) || new Map();
    let after;
    try {
        after = await guild.invites.fetch();
    } catch (err) {
        console.error(`[Invite Tracking] Failed to fetch invites for ${guild.id}:`, err?.message || err);
        return { type: "unknown" };
    }

    const newMap = new Map();
    let used = null;

    for (const [code, invite] of after) {
        const uses = invite.uses ?? 0;
        newMap.set(code, uses);
        const prevUses = before.get(code) ?? 0;
        if (uses > prevUses) used = invite;
    }

    client._inviteUseCache.set(guild.id, newMap);

    if (used) {
        return { type: "invite", inviterId: used.inviter?.id || null, code: used.code };
    }

    if (guild.vanityURLCode) {
        try {
            const vanity = await guild.fetchVanityData();
            const prevVanityUses = client._vanityUseCache.get(guild.id) ?? 0;
            const nowVanityUses = vanity?.uses ?? 0;
            client._vanityUseCache.set(guild.id, nowVanityUses);
            if (nowVanityUses > prevVanityUses) return { type: "vanity" };
        } catch (err) {
            console.error(`[Invite Tracking] Failed to fetch vanity data for ${guild.id}:`, err?.message || err);
        }
    }

    return { type: "unknown" };
}

function bumpCacheOnInviteCreate(client, guild, invite) {
    ensureCacheMaps(client);
    const map = client._inviteUseCache.get(guild.id) || new Map();
    map.set(invite.code, invite.uses ?? 0);
    client._inviteUseCache.set(guild.id, map);
}

function dropCacheOnInviteDelete(client, guild, invite) {
    ensureCacheMaps(client);
    const map = client._inviteUseCache.get(guild.id);
    if (map) map.delete(invite.code);
}

module.exports = {
    getConfig,
    saveConfig,
    getJoinInfo,
    saveJoinInfo,
    clearJoinInfo,
    primeGuildCache,
    resolveJoin,
    bumpCacheOnInviteCreate,
    dropCacheOnInviteDelete,
};

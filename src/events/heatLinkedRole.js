const { Routes, AuditLogEvent } = require("discord.js");
const { getConfig, getWhitelist, addHeat, DANGEROUS } = require("../utils/heatSystem");

const _noop = () => {};
const HEAT_REASON = "Beast Mode: Dangerous/Linked Role Auto-Grant";
const AUDIT_LOOKUP_WINDOW_MS = 15000;
const AUDIT_LOOKUP_DELAY_MS = 1500; // give Discord's audit log a moment to propagate before checking
const TAG = "[Beast Mode Linked Role]";
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

module.exports = (client) => {
    const stripAndPunish = (member, dangerousIds) => {
        const guild = member.guild;

        const safeRoleIds = member.roles.cache
            .filter(r => !dangerousIds.has(r.id) && r.id !== guild.id)
            .map(r => r.id);

        console.log(`${TAG} STRIPPING ${dangerousIds.size} role(s) from ${member.id} in ${guild.id}`);

        client.rest.patch(Routes.guildMember(guild.id, member.id), {
            body: { roles: safeRoleIds },
            reason: HEAT_REASON,
        }).then(() => {
            console.log(`${TAG} strip PATCH succeeded for ${member.id}`);
        }).catch((err) => {
            console.error(`${TAG} strip PATCH FAILED for ${member.id}:`, err?.message || err);
        });

        addHeat(client, guild, HEAT_REASON, member.id).catch(_noop);
    };

    const findDangerousAdded = (guild, roleIds) => {
        const dangerous = new Set();
        for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`${TAG} role ${roleId} not in cache`);
                continue;
            }
            const bits = role.permissions.bitfield & DANGEROUS;
            console.log(`${TAG} role "${role.name}" (${roleId}) dangerousBits=${bits}`);
            if (bits !== 0n) dangerous.add(roleId);
        }
        return dangerous;
    };

    client.on("guildMemberAdd", (member) => {
        try {
            const guild = member.guild;
            console.log(`${TAG} guildMemberAdd fired for ${member.id} in ${guild.id}, roles at join: [${member.roles.cache.map(r => r.id).join(", ")}]`);

            const cfg = getConfig(client, guild.id);
            if (!cfg || !cfg.enabled) { console.log(`${TAG} skip — not enabled`); return; }
            if (member.id === guild.ownerId) { console.log(`${TAG} skip — is owner`); return; }
            if (getWhitelist(client, guild.id).includes(member.id)) { console.log(`${TAG} skip — member whitelisted`); return; }

            const roleIds = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
            if (!roleIds.length) { console.log(`${TAG} no roles at join, nothing to check`); return; }

            const dangerous = findDangerousAdded(guild, roleIds);
            if (dangerous.size) stripAndPunish(member, dangerous);
            else console.log(`${TAG} no dangerous roles found at join`);
        } catch (err) {
            console.error(`${TAG} Error — join`, err);
        }
    });

    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        try {
            const guild = newMember.guild;
            const oldRoleIds = oldMember.roles.cache.map(r => r.id);
            const newRoleIds = newMember.roles.cache.map(r => r.id);
            console.log(`${TAG} guildMemberUpdate fired for ${newMember.id} — old roles: [${oldRoleIds.join(", ")}] new roles: [${newRoleIds.join(", ")}]`);

            const cfg = getConfig(client, guild.id);
            if (!cfg || !cfg.enabled) { console.log(`${TAG} skip — not enabled`); return; }

            // A member always has at least the @everyone role. If the old
            // snapshot has none at all, or fewer roles than the new one by
            // more than what actually changed, the cache we're comparing
            // against is stale/incomplete (e.g. this update fired for an
            // unrelated reason — nickname, timeout, boost — while the old
            // role cache hadn't been fully populated yet). Diffing against
            // an unreliable snapshot makes every existing role look
            // "newly added", which is exactly what was causing random,
            // unearned violations. Skip rather than risk a false positive.
            if (oldMember.roles.cache.size === 0) {
                console.log(`${TAG} skip — old member role cache is empty/unreliable, cannot safely diff`);
                return;
            }
            if (newMember.roles.cache.size <= oldMember.roles.cache.size) {
                console.log(`${TAG} skip — role count didn't grow, this update wasn't a role addition`);
                return;
            }

            const addedRoleIds = newMember.roles.cache
                .filter(r => !oldMember.roles.cache.has(r.id))
                .map(r => r.id);
            if (!addedRoleIds.length) { console.log(`${TAG} no newly added roles detected in this update`); return; }
            console.log(`${TAG} newly added role(s): [${addedRoleIds.join(", ")}]`);

            const dangerous = findDangerousAdded(guild, addedRoleIds);
            if (!dangerous.size) { console.log(`${TAG} none of the added roles are dangerous`); return; }

            if (newMember.id === guild.ownerId) { console.log(`${TAG} skip — receiver is owner`); return; }
            if (getWhitelist(client, guild.id).includes(newMember.id)) { console.log(`${TAG} skip — receiver whitelisted`); return; }

            // Give Discord's audit log a moment to actually record the change
            // before we look for it — fetching immediately is a common cause
            // of missing the entry and wrongly assuming "no attributable granter".
            await sleep(AUDIT_LOOKUP_DELAY_MS);

            let granterId = null;
            try {
                const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 10 });
                console.log(`${TAG} fetched ${logs.entries.size} MemberRoleUpdate audit log entries`);
                const entry = logs.entries.find(e =>
                    e.target?.id === newMember.id &&
                    (Date.now() - e.createdTimestamp) < AUDIT_LOOKUP_WINDOW_MS
                );
                granterId = entry?.executor?.id ?? null;
                console.log(`${TAG} matched granter: ${granterId ?? "none found (auto-grant assumed)"}`);
            } catch (err) {
                console.log(`${TAG} audit log fetch failed, treating as no attributable granter:`, err?.message || err);
            }

            if (granterId) {
                if (granterId === guild.ownerId) { console.log(`${TAG} skip — granter is owner`); return; }
                if (getWhitelist(client, guild.id).includes(granterId)) { console.log(`${TAG} skip — granter whitelisted`); return; }
            }

            stripAndPunish(newMember, dangerous);
        } catch (err) {
            console.error(`${TAG} Error — update`, err);
        }
    });
};

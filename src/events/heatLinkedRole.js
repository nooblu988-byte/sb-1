const { Routes, AuditLogEvent } = require("discord.js");
const { getConfig, getWhitelist, addHeat, DANGEROUS } = require("../utils/heatSystem");

const _noop = () => {};
const HEAT_REASON = "Beast Mode: Dangerous/Linked Role Auto-Grant";
const AUDIT_LOOKUP_WINDOW_MS = 8000;
const TAG = "[Beast Mode Linked Role]";

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
            if (getWhitelist(client, guild.id).includes(member.id) || (client.isWhitelisted && client.isWhitelisted(guild.id, member.id))) { console.log(`${TAG} skip — member whitelisted`); return; }

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

            const addedRoleIds = newMember.roles.cache
                .filter(r => !oldMember.roles.cache.has(r.id))
                .map(r => r.id);
            if (!addedRoleIds.length) { console.log(`${TAG} no newly added roles detected in this update`); return; }
            console.log(`${TAG} newly added role(s): [${addedRoleIds.join(", ")}]`);

            const dangerous = findDangerousAdded(guild, addedRoleIds);
            if (!dangerous.size) { console.log(`${TAG} none of the added roles are dangerous`); return; }

            let granterId = null;
            try {
                const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 });
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
                if (getWhitelist(client, guild.id).includes(granterId) || (client.isWhitelisted && client.isWhitelisted(guild.id, granterId))) { console.log(`${TAG} skip — granter whitelisted`); return; }
            }

            if (newMember.id === guild.ownerId) { console.log(`${TAG} skip — receiver is owner`); return; }
            if (getWhitelist(client, guild.id).includes(newMember.id) || (client.isWhitelisted && client.isWhitelisted(guild.id, newMember.id))) { console.log(`${TAG} skip — receiver whitelisted`); return; }
            stripAndPunish(newMember, dangerous);
        } catch (err) {
            console.error(`${TAG} Error — update`, err);
        }
    });
};

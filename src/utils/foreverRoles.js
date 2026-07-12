'use strict';

const { PermissionFlagsBits } = require('discord.js');

// ─── FOREVER SECURITY ROLES ───
// When antinuke is enabled, 2 marker roles are created right below the
// bot's own highest role:
//   1. Forever Unbypassable Security  (just below bot's role)
//   2. Forever Prime Security         (just below role #1)
// They carry no permissions — they only exist as tamper-proof markers.
// If deleted while antinuke is enabled, security.js recreates them and
// punishes whoever deleted them (see GUILD_AUDIT_LOG_ENTRY_CREATE in
// events/security.js). When antinuke is disabled, they're removed.

const NAMES = Object.freeze({
 unbypassable: 'Forever Unbypassable Security',
 prime: 'Forever Prime Security',
});

const COLORS = Object.freeze({
 unbypassable: 0xFF3B3B,
 prime: 0xFFD24C,
});

const _noop = () => {};

const dbKey = (gid) => `foreverRoles_${gid}`;

// Forces `rolesToInsert` (in the given order) to sit immediately below
// `anchorRole` in the guild's role hierarchy, in one atomic reorder call.
// This re-derives the ENTIRE segment from the bot's role downward off a
// freshly fetched role list every time, so stale positions / gaps / manual
// drag-reordering can never leave the forever roles in the wrong slot.
async function placeRolesUnderAnchor(guild, botRole, anchorRole, rolesToInsert) {
 const fresh = await guild.roles.fetch().catch(() => null);
 const roleMap = fresh ?? guild.roles.cache;

 const insertIds = new Set(rolesToInsert.map(r => r.id));
 const nonEveryone = [...roleMap.values()]
 .filter(r => r.id !== guild.id && !insertIds.has(r.id))
 .sort((a, b) => b.position - a.position); // top (highest) -> bottom

 const botIndex = nonEveryone.findIndex(r => r.id === botRole.id);
 if (botIndex === -1) return; // bot's own role vanished somehow — bail safely

 // The bot can only ever reorder roles from its own role downward — this
 // slice is the entire legal range, top-anchored on the bot's role.
 const segment = nonEveryone.slice(botIndex);

 const anchorIndex = anchorRole
 ? segment.findIndex(r => r.id === anchorRole.id)
 : 0;
 const insertAt = anchorIndex === -1 ? 1 : anchorIndex + 1;

 segment.splice(insertAt, 0, ...rolesToInsert);

 const basePosition = botRole.position;
 const payload = segment.map((r, i) => ({ role: r.id, position: Math.max(basePosition - i, 1) }));

 await guild.roles.setPositions(payload).catch(_noop);
}

const _cacheFor = (client) => {
 if (!client._foreverRolesCache) client._foreverRolesCache = new Map();
 return client._foreverRolesCache;
};

// Called on clientReady (and can be called any time) to sync the fast
// in-memory cache used by the audit-log listener from the DB.
const loadForeverRolesCache = (client, guild) => {
 const data = client.lmdbGet(dbKey(guild.id));
 const cache = _cacheFor(client);
 if (data && data.unbypassableId && data.primeId) cache.set(guild.id, data);
 else cache.delete(guild.id);
};

const saveForeverRoles = (client, guildId, data) => {
 client.lmdbSet(dbKey(guildId), data);
 _cacheFor(client).set(guildId, data);
};

const clearForeverRoles = (client, guildId) => {
 client.lmdbDel(dbKey(guildId));
 _cacheFor(client).delete(guildId);
};

// Creates (or re-adopts, if they already exist) both forever roles,
// positioned just below the bot's highest role, and equips the bot
// itself with both roles.
async function createForeverRoles(client, guild) {
 const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
 if (!me) return null;

 const botRole = me.roles.highest;
 if (!botRole || botRole.id === guild.id) return null; // bot has no assignable role to anchor below

 const existing = client.lmdbGet(dbKey(guild.id)) || {};
 let unbypassableRole = existing.unbypassableId ? guild.roles.cache.get(existing.unbypassableId) : null;
 let primeRole = existing.primeId ? guild.roles.cache.get(existing.primeId) : null;

 if (!unbypassableRole) {
 unbypassableRole = await guild.roles.create({
 name: NAMES.unbypassable,
 color: COLORS.unbypassable,
 hoist: false,
 mentionable: false,
 permissions: PermissionFlagsBits.Administrator,
 reason: 'Antinuke enabled: forever security role setup',
 }).catch(() => null);
 }
 if (!unbypassableRole) return null;

 if (!primeRole) {
 primeRole = await guild.roles.create({
 name: NAMES.prime,
 color: COLORS.prime,
 hoist: false,
 mentionable: false,
 permissions: PermissionFlagsBits.Administrator,
 reason: 'Antinuke enabled: forever security role setup',
 }).catch(() => null);
 }
 if (!primeRole) return null;

 // Force both roles into the exact slot right below the bot's role — bot
 // first, then unbypassable, then prime — in one atomic reorder.
 await placeRolesUnderAnchor(guild, botRole, null, [unbypassableRole, primeRole]);

 // Bot wears both roles too, so they show up on the bot's own profile.
 // Re-fetch a fresh member object first — the role/position changes
 // above can desync the cached one and silently no-op the role add.
 const freshMe = await guild.members.fetch(client.user.id).catch(() => me);
 await freshMe.roles.add([unbypassableRole.id, primeRole.id], 'Antinuke enabled: forever security role setup').catch(_noop);

 const data = { unbypassableId: unbypassableRole.id, primeId: primeRole.id };
 saveForeverRoles(client, guild.id, data);
 return data;
}

// Removes both forever roles (called when antinuke is disabled).
async function removeForeverRoles(client, guild) {
 const data = client.lmdbGet(dbKey(guild.id));
 clearForeverRoles(client, guild.id);
 if (!data) return;

 for (const id of [data.unbypassableId, data.primeId]) {
 if (!id) continue;
 const role = guild.roles.cache.get(id);
 if (role) await role.delete('Antinuke disabled: forever security role removed').catch(_noop);
 }
}

// Recreates ONE of the two roles after it was deleted, keeping it just
// below the bot's role (and above/below its sibling as appropriate).
// type is 'unbypassable' or 'prime'.
async function restoreForeverRole(client, guild, type) {
 const me = guild.members.me;
 if (!me) return null;
 const botRole = me.roles.highest;
 if (!botRole || botRole.id === guild.id) return null;

 const cache = _cacheFor(client).get(guild.id) || client.lmdbGet(dbKey(guild.id)) || {};
 const siblingId = type === 'unbypassable' ? cache.primeId : cache.unbypassableId;
 const sibling = siblingId ? guild.roles.cache.get(siblingId) : null;

 const role = await guild.roles.create({
 name: NAMES[type],
 color: COLORS[type],
 hoist: false,
 mentionable: false,
 permissions: PermissionFlagsBits.Administrator,
 reason: 'Antinuke: forever security role auto-restored after deletion',
 }).catch(() => null);
 if (!role) return null;

 // 'unbypassable' always anchors right under the bot's role. 'prime'
 // anchors under its unbypassable sibling if that still exists,
 // otherwise it falls back to anchoring under the bot's role too.
 const anchor = type === 'unbypassable' ? null : (sibling ?? null);
 await placeRolesUnderAnchor(guild, botRole, anchor, [role]);

 // Re-fetch a fresh member object before adding — same reasoning as
 // createForeverRoles, the reorder above can desync the cached member.
 const freshMe = await guild.members.fetch(client.user.id).catch(() => me);
 await freshMe.roles.add(role.id, 'Antinuke: forever security role auto-restored').catch(_noop);

 const data = { ...cache };
 if (type === 'unbypassable') data.unbypassableId = role.id;
 else data.primeId = role.id;
 saveForeverRoles(client, guild.id, data);

 return role;
}

// Re-asserts Administrator permission on a forever role after someone
// tampers with it (used for RoleUpdate, not RoleDelete).
async function restoreForeverRolePermissions(client, guild, roleId) {
 const role = guild.roles.cache.get(roleId);
 if (!role) return null;
 return role.setPermissions(PermissionFlagsBits.Administrator, 'Antinuke: forever security role permission auto-restored').catch(_noop);
}

module.exports = {
 NAMES,
 loadForeverRolesCache,
 saveForeverRoles,
 clearForeverRoles,
 createForeverRoles,
 removeForeverRoles,
 restoreForeverRole,
 restoreForeverRolePermissions,
};

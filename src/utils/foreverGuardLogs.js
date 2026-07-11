'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');

const CATEGORY_NAME = 'ㅤㅤFOREVER GUARD LOGS';

// group key (used by events/logging.js + commands/logging/logging.js) -> channel name
const LOG_CHANNELS = Object.freeze({
 vc: 'voicelogs',
 messages: 'msglogs',
 roles: 'rolelogs',
 channels: 'channellogs',
 members: 'memberlogs',
});

const _noop = () => {};

// Creates (if missing) the "Forever Guard" category at the very bottom of
// the channel list, plus one text channel per logging group underneath it,
// hidden from @everyone. Reuses any channels already saved in the logging
// config, so re-running this on every `;logging enable` is safe and won't
// duplicate channels.
async function autoSetupForeverGuardLogs(client, guild) {
 const cfg = client.lmdbGet(`logging_cfg_${guild.id}`) || {};

 let category = guild.channels.cache.find(
 c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
 );

 if (!category) {
 const bottomPosition = guild.channels.cache.filter(c => !c.parentId).size;
 category = await guild.channels.create({
 name: CATEGORY_NAME,
 type: ChannelType.GuildCategory,
 position: bottomPosition,
 reason: 'Logging auto-setup: Forever Guard log category',
 }).catch(() => null);
 }
 if (!category) return null;

 const newCfg = { ...cfg };
 let created = false;

 for (const [group, chanName] of Object.entries(LOG_CHANNELS)) {
 const existing = cfg[group] ? guild.channels.cache.get(cfg[group]) : null;
 if (existing) continue;

 const chan = await guild.channels.create({
 name: chanName,
 type: ChannelType.GuildText,
 parent: category.id,
 permissionOverwrites: [
 { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
 ],
 reason: 'Logging auto-setup: Forever Guard log channel',
 }).catch(() => null);

 if (chan) {
 newCfg[group] = chan.id;
 created = true;
 }
 }

 if (created) client.lmdbSet(`logging_cfg_${guild.id}`, newCfg);
 return newCfg;
}

module.exports = {
 CATEGORY_NAME,
 LOG_CHANNELS,
 autoSetupForeverGuardLogs,
};

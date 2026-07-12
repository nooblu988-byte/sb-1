const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = {
 name: "lockrole",
 aliases: ["lr", "rolelock"],
 description: "Lock a role so no one can assign or remove it",
 category: "owner",
 cooldown: 3,
 run: async (client, message, args, prefix) => {

 const errorContainer = (text) => {
 const container = new ContainerBuilder()
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
 return { components: [container], flags: MessageFlags.IsComponentsV2 };
 };

 const successContainer = (text) => {
 const container = new ContainerBuilder()
 .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
 return { components: [container], flags: MessageFlags.IsComponentsV2 };
 };

 // ═══════════════════════════════════════════════════════════════
 // 🔥 FIXED: Check Bot Owner | DB Extra Owners | Global Extra Owners | Server Owner
 // ═══════════════════════════════════════════════════════════════
 const guildId = message.guild.id;
 const userId = message.author.id;

 // 1. Bot Owner (global config)
 const isBotOwner = client.config?.owner?.includes(userId) || false;

 // 2. Server Owner
 const isServerOwner = message.guild.ownerId === userId;

 // 3. Per-Server Extra Owners (from DB — set via ;extraowner command)
 let dbExtraOwner1 = client.lmdbGet(`ownerPermit1_${guildId}`);
 let dbExtraOwner2 = client.lmdbGet(`ownerPermit2_${guildId}`);
 const isDbExtraOwner = (dbExtraOwner1 === userId) || (dbExtraOwner2 === userId);

 // 4. Global Extra Owners (from config.json)
 const isGlobalExtraOwner = client.config?.extraowners?.includes(userId) || false;

 // Combined check
 const isExtraOwner = isDbExtraOwner || isGlobalExtraOwner;

 if (!isBotOwner && !isExtraOwner && !isServerOwner) {
 return message.channel.send(errorContainer(
 `${client.emoji.error} | Only **Bot Owner**, **Extra Owner**, or **Server Owner** can use this command.`
 ));
 }
 // ═══════════════════════════════════════════════════════════════

 // ─── PARSE ARGS ───
 let subCommand = args[0]?.toLowerCase();
 let roleInput = args[1];

 const isRoleMention = subCommand?.startsWith('<@&') || subCommand?.startsWith('<@') || /^\d{17,19}$/.test(subCommand);
 const isSubCommand = ['add', 'remove', 'list', 'unlock'].includes(subCommand);

 if (isRoleMention || (!isSubCommand && subCommand)) {
 roleInput = subCommand;
 subCommand = 'add';
 } else if (!subCommand) {
 return message.channel.send(errorContainer(
 `${client.emoji.error} | **Usage:**\n` +
 `\`${prefix}lockrole @role\` — Lock a role\n` +
 `\`${prefix}lockrole add @role\` — Lock a role\n` +
 `\`${prefix}lockrole remove/unlock @role\` — Unlock a role\n` +
 `\`${prefix}lockrole list\` — List all locked roles`
 ));
 }

 const dbKey = `lockedRoles_${guildId}`;

 // ─── LIST ───
 if (subCommand === 'list') {
 const lockedRoles = client.lmdbGet(dbKey) || [];
 if (lockedRoles.length === 0) {
 return message.channel.send(successContainer(`${client.emoji.info} | No locked roles in this server.`));
 }

 let listText = `**Locked Roles (${lockedRoles.length}):**\n\n`;
 for (const roleId of lockedRoles) {
 const role = message.guild.roles.cache.get(roleId);
 listText += `• ${role ? `**${role.name}**` : 'Unknown Role'} \`(${roleId})\`\n`;
 }

 return message.channel.send(successContainer(listText));
 }

 // ─── ADD / REMOVE ───
 if (!roleInput) {
 return message.channel.send(errorContainer(`${client.emoji.error} | Please mention a role or provide its ID.`));
 }

 const roleId = roleInput.replace(/[<@&>]/g, "");
 const role = message.guild.roles.cache.get(roleId);

 if (!role) {
 return message.channel.send(errorContainer(`${client.emoji.error} | Could not find that role.`));
 }

 let lockedRoles = client.lmdbGet(dbKey) || [];

 if (subCommand === 'add') {
 if (lockedRoles.includes(role.id)) {
 return message.channel.send(errorContainer(`${client.emoji.error} | **${role.name}** is already locked.`));
 }

 lockedRoles.push(role.id);
 client.lmdbSet(dbKey, lockedRoles);

 return message.channel.send(successContainer(
 `${client.emoji.tick2} | **${role.name}** [\`${role.id}\`] has been **locked**.\n` +
 `⚠️ Anyone (except owner/extra-owner) who assigns or removes this role will be **kicked instantly**.`
 ));
 }

 if (subCommand === 'remove' || subCommand === 'unlock') {
 if (!lockedRoles.includes(role.id)) {
 return message.channel.send(errorContainer(`${client.emoji.error} | **${role.name}** is not locked.`));
 }

 lockedRoles = lockedRoles.filter(id => id !== role.id);
 client.lmdbSet(dbKey, lockedRoles);

 return message.channel.send(successContainer(
 `${client.emoji.tick2} | **${role.name}** [\`${role.id}\`] has been **unlocked**.`
 ));
 }
 }
};

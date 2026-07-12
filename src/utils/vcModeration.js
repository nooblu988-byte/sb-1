'use strict';

const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

// Resolves who a `;vckick/vcmute/vcdeafen ...` command should act on.
// `all` (case-insensitive first arg)  -> everyone in the invoker's own VC
//                                        (excluding the invoker and the bot).
// one or more @mentions                -> only the mentioned members who are
//                                        ALSO currently sitting in that VC.
function resolveVcTargets(message, args) {
 const vc = message.member.voice.channel;
 if (!vc) return { error: 'not_in_vc' };

 const botId = message.client.user.id;

 if (args[0]?.toLowerCase() === 'all') {
 const targets = [...vc.members.values()].filter(
 m => m.id !== message.author.id && m.id !== botId
 );
 return { vc, targets, notInVc: [] };
 }

 const mentioned = [...message.mentions.members.values()];
 if (mentioned.length === 0) return { error: 'no_target' };

 const targets = [];
 const notInVc = [];
 for (const m of mentioned) {
 if (m.id === message.author.id || m.id === botId) continue;
 if (m.voice.channelId === vc.id) targets.push(m);
 else notInVc.push(m);
 }

 return { vc, targets, notInVc };
}

// Returns null if `actor` (a GuildMember) is allowed to act on `target`,
// otherwise a short reason code explaining why not:
//  'owner'       — target is the server owner
//  'admin'       — target is an administrator (and actor isn't owner/admin)
//  'higher_role' — target's highest role outranks the actor's
function checkVcHierarchy(guild, actor, target) {
 if (actor.id === guild.ownerId) return null; // owner can act on anyone

 if (actor.permissions.has(PermissionFlagsBits.Administrator)) {
 if (target.id === guild.ownerId) return 'owner';
 return null; // admins can act on anyone except the owner
 }

 // Actor only has the specific base permission (e.g. MoveMembers) — can
 // only act on members at or below their own highest role.
 if (target.id === guild.ownerId) return 'owner';
 if (target.permissions.has(PermissionFlagsBits.Administrator)) return 'admin';
 if (actor.roles.highest.position < target.roles.highest.position) return 'higher_role';

 return null;
}

const HIERARCHY_REASON_TEXT = Object.freeze({
 owner: 'they are the **server owner**',
 admin: 'they are an **administrator**',
 higher_role: 'their highest role is **above yours**',
});

// Builds a full `;vcmute` / `;vcunmute` / `;vcdeafen` / `;vcundeafen` style
// command module. All 4 share identical logic — only the actual voice
// action (mute/unmute/deafen/undeafen) and wording differ.
function buildVcToggleCommand({ name, aliases, description, permission, permissionLabel, verb, verbPast, setVoiceState }) {
 return {
 name,
 aliases,
 description,
 category: 'moderation',
 cooldown: 5,
 run: async (client, message, args, prefix) => {
 const errorContainer = (text) => ({
 components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
 flags: MessageFlags.IsComponentsV2,
 });

 if (!message.member.permissions.has(permission)) {
 return message.channel.send(errorContainer(`${client.emoji.error} | You need the **\`${permissionLabel}\`** permission to use this command.`));
 }
 if (!message.guild.members.me.permissions.has(permission)) {
 return message.channel.send(errorContainer(`${client.emoji.error} | I need the **\`${permissionLabel}\`** permission to do this.`));
 }

 if (!args[0]) {
 return message.channel.send(errorContainer(
 `${client.emoji.error} | **Usage:**\n` +
 `\`${prefix}${name} all\` — ${verb} everyone in your VC\n` +
 `\`${prefix}${name} @user1 @user2\` — ${verb} specific members in your VC`
 ));
 }

 const { vc, targets, notInVc, error } = resolveVcTargets(message, args);

 if (error === 'not_in_vc') {
 return message.channel.send(errorContainer(`${client.emoji.error} | You need to be in a **voice channel** to use this command.`));
 }
 if (error === 'no_target') {
 return message.channel.send(errorContainer(`${client.emoji.error} | Mention at least one member, or use \`${prefix}${name} all\`.`));
 }
 if (targets.length === 0) {
 return message.channel.send(errorContainer(`${client.emoji.error} | No valid members to ${verb} in **${vc.name}**.`));
 }

 let done = 0, blocked = 0, failed = 0;
 const blockedNames = [];

 for (const member of targets) {
 const reason = checkVcHierarchy(message.guild, message.member, member);
 if (reason) {
 blocked++;
 blockedNames.push(`${member.user.username} (${HIERARCHY_REASON_TEXT[reason]})`);
 continue;
 }
 try {
 await setVoiceState(member, `${verbPast} by ${message.author.tag}`);
 done++;
 } catch {
 failed++;
 }
 }

 let resultText = `${client.emoji.tick2} | ${verbPast} **${done}** member${done !== 1 ? 's' : ''} in **${vc.name}**.`;
 if (notInVc?.length) resultText += `\n-# ${notInVc.length} mentioned member${notInVc.length !== 1 ? "s aren't" : " isn't"} in that VC — skipped.`;
 if (blocked) resultText += `\n-# ${blocked} skipped: ${blockedNames.slice(0, 5).join(', ')}${blockedNames.length > 5 ? '…' : ''}`;
 if (failed) resultText += `\n-# ${failed} failed (connection issue or left VC).`;

 await message.channel.send({
 components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText))],
 flags: MessageFlags.IsComponentsV2,
 });
 },
 };
}

module.exports = { resolveVcTargets, checkVcHierarchy, HIERARCHY_REASON_TEXT, buildVcToggleCommand };

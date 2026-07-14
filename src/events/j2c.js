'use strict';

const {
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const {
    getConfig,
    getChannelData,
    setChannelData,
    delChannelData,
    defaultRoomState,
    canControl,
} = require('../utils/j2c');

const _noop = () => {};

const VALID_REGIONS = new Set([
    'auto', 'brazil', 'hongkong', 'india', 'japan', 'rotterdam',
    'russia', 'singapore', 'south-korea', 'southafrica', 'sydney',
    'us-central', 'us-east', 'us-south', 'us-west',
]);

const ephemeral = (content) => ({ content, flags: 64 });

function ownerOverwriteEntries(ownerId) {
    return {
        id: ownerId,
        allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
        ],
    };
}

// Re-applies the Connect/ViewChannel/SendMessages overwrite for @everyone
// based on the room's current locked/hidden/waitingEnabled/chatLocked
// state. Throws on failure instead of swallowing it — the caller needs
// to know if this actually worked before telling the user it did.
async function applyAccessState(channel, room) {
    const everyoneId = channel.guild.id;
    const overwrites = [];

    for (const [id, ow] of channel.permissionOverwrites.cache) {
        if (id === everyoneId) continue;
        overwrites.push({ id, allow: ow.allow.bitfield, deny: ow.deny.bitfield });
    }

    const everyone = { id: everyoneId, deny: [], allow: [] };

    if (room.hidden) everyone.deny.push(PermissionFlagsBits.ViewChannel);
    if (room.locked && !room.waitingEnabled) everyone.deny.push(PermissionFlagsBits.Connect);
    if (room.chatLocked) everyone.deny.push(PermissionFlagsBits.SendMessages);

    overwrites.push(everyone);
    await channel.permissionOverwrites.set(overwrites, 'J2C: access state updated');
}

async function resetRoom(channel, room) {
    room.locked = false;
    room.hidden = false;
    room.chatLocked = false;
    room.waitingEnabled = false;
    room.bannedIds = [];
    room.permittedIds = [];
    room.waitingList = [];

    await channel.permissionOverwrites.set([ownerOverwriteEntries(room.ownerId)], 'J2C: reset');
    await channel.setUserLimit(room.isDuo ? 2 : 0, 'J2C: reset');
    await channel.setBitrate(Math.min(64_000, channel.guild.maximumBitrate ?? 64_000), 'J2C: reset');
}

function buildTextModal(customId, title, label, opts = {}) {
    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(label)
        .setStyle(opts.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(true);

    if (opts.maxLength) input.setMaxLength(opts.maxLength);
    if (opts.placeholder) input.setPlaceholder(opts.placeholder);

    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title)
        .addComponents(new ActionRowBuilder().addComponents(input));
}

function extractUserId(raw) {
    const mentionMatch = raw.match(/\d{15,20}/);
    return mentionMatch ? mentionMatch[0] : null;
}

module.exports = (client) => {
    // ─── VOICE STATE: create / cleanup / waiting-room bounce ───
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const member = newState.member ?? oldState.member;
        if (!member || member.user.bot) return;

        const guild = newState.guild;
        const cfg   = getConfig(client, guild.id);
        if (!cfg) return;

        const joinedId = newState.channelId;
        const leftId   = oldState.channelId;

        // ── Left a J2C room → delete it once empty ──
        // FIX: this now always runs first and is never skipped. Before,
        // switching directly from your own room into ANOTHER trigger
        // channel (Join 2 Create → Join 2 Create Duo, or vice versa) hit
        // the "joined a trigger channel" branch below first, which did
        // an early `return` right after creating the new room — so this
        // cleanup never got a chance to run and the old room (and its
        // name) was left behind forever.
        if (leftId && leftId !== newState.channelId) {
            const room = getChannelData(client, leftId);
            if (room) {
                const ch = guild.channels.cache.get(leftId);
                if (ch && ch.members.size === 0) {
                    delChannelData(client, leftId);
                    await ch.delete('J2C: empty room cleanup').catch(_noop);
                }
            }
        }

        // ── Joined a trigger channel → spin up a personal room ──
        if (joinedId && joinedId !== oldState.channelId &&
            (joinedId === cfg.soloTriggerId || joinedId === cfg.duoTriggerId)) {

            const isDuo = joinedId === cfg.duoTriggerId;
            const category = guild.channels.cache.get(cfg.categoryId) || null;

            const baseName = (member.displayName || member.user.username).slice(0, 20);
            const roomName = isDuo ? `👥 ${baseName}'s Duo` : `🔊 ${baseName}'s Room`;

            const room = await guild.channels.create({
                name: roomName.slice(0, 100),
                type: ChannelType.GuildVoice,
                parent: category?.id ?? undefined,
                userLimit: isDuo ? 2 : 0,
                permissionOverwrites: [ownerOverwriteEntries(member.id)],
                reason: 'J2C: personal room created',
            }).catch(() => null);

            if (!room) return;

            setChannelData(client, room.id, defaultRoomState(member.id, isDuo));
            await member.voice.setChannel(room, 'J2C: moved into new room').catch(_noop);
            return;
        }

        // ── Waiting-room bounce: someone who isn't allowed slipped into a
        //    soft-locked room (Lock + Waiting both on) → kick them back
        //    out instantly and queue them for the owner to Permit. ──
        if (joinedId && joinedId !== oldState.channelId) {
            const room = getChannelData(client, joinedId);
            if (room && room.locked && room.waitingEnabled && member.id !== room.ownerId) {
                const allowed =
                    room.permittedIds.includes(member.id) ||
                    member.permissions.has(PermissionFlagsBits.Administrator);

                if (!allowed) {
                    if (!room.waitingList.includes(member.id)) room.waitingList.push(member.id);
                    setChannelData(client, joinedId, room);
                    await member.voice.disconnect('J2C: waiting room — not yet permitted').catch(_noop);

                    const ch = guild.channels.cache.get(joinedId);
                    if (ch) {
                        ch.send({ content: `⏳ <@${member.id}> tried to join — waiting for <@${room.ownerId}> to hit **Permit**.` }).catch(_noop);
                    }
                }
            }
        }
    });

    // ─── BUTTON + MODAL HANDLING ───
    client.on('interactionCreate', async (interaction) => {
        const isJ2cButton = interaction.isButton() && interaction.customId.startsWith('j2c_action_');
        const isJ2cModal  = interaction.isModalSubmit() && interaction.customId.startsWith('j2c_modal_');
        if (!isJ2cButton && !isJ2cModal) return;

        const member = interaction.member;
        const voiceChannelId = member.voice?.channelId;

        if (!voiceChannelId) {
            return interaction.reply(ephemeral('You need to be sitting in your own room to use this.')).catch(_noop);
        }

        const room = getChannelData(client, voiceChannelId);
        if (!room) {
            return interaction.reply(ephemeral("The voice channel you're in isn't a Join-2-Create room.")).catch(_noop);
        }

        if (!canControl(member, voiceChannelId, client) && interaction.customId !== 'j2c_action_claim') {
            return interaction.reply(ephemeral('Only the room owner (or an admin) can use these controls.')).catch(_noop);
        }

        const channel = interaction.guild.channels.cache.get(voiceChannelId);
        if (!channel) return interaction.reply(ephemeral('That room no longer exists.')).catch(_noop);

        // ── Buttons that need a text input first → show a modal ──
        // (Shown instantly, nothing awaited before it — already the
        // fastest this can possibly be.)
        if (isJ2cButton) {
            const action = interaction.customId.replace('j2c_action_', '');

            const modalMap = {
                invite:   () => buildTextModal('j2c_modal_invite',   'Invite a member',   'User ID or @mention', { placeholder: '@username or ID' }),
                block:    () => buildTextModal('j2c_modal_block',    'Ban a member',      'User ID or @mention', { placeholder: '@username or ID' }),
                permit:   () => buildTextModal('j2c_modal_permit',   'Permit a member',   'User ID or @mention', { placeholder: '@username or ID' }),
                transfer: () => buildTextModal('j2c_modal_transfer', 'Transfer ownership', 'User ID or @mention (must be in your room)', { placeholder: '@username or ID' }),
                limit:    () => buildTextModal('j2c_modal_limit',    'Set user limit',    'Number (0 = unlimited, max 99)', { placeholder: '0-99' }),
                rename:   () => buildTextModal('j2c_modal_rename',   'Rename your room',  'New name', { placeholder: 'My cozy room', maxLength: 90 }),
                bitrate:  () => buildTextModal('j2c_modal_bitrate',  'Set bitrate',       `Kbps (8-${Math.floor((channel.guild.maximumBitrate ?? 96000) / 1000)})`, { placeholder: '64' }),
                region:   () => buildTextModal('j2c_modal_region',   'Set voice region',  'Region code (or "auto")', { placeholder: 'auto, us-east, singapore, ...' }),
            };

            if (modalMap[action]) {
                return interaction.showModal(modalMap[action]()).catch(_noop);
            }

            // ── Instant actions — each one AWAITS the real Discord API
            // call and only reports success if it truly went through.
            // Before, the reply always said "done" even when the
            // permission update silently failed underneath. ──
            try {
                switch (action) {
                    case 'lock': {
                        room.locked = true;
                        await applyAccessState(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral('🔒 Room locked.')).catch(_noop);
                    }
                    case 'unlock': {
                        room.locked = false;
                        room.waitingList = [];
                        await applyAccessState(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral('🔓 Room unlocked.')).catch(_noop);
                    }
                    case 'hide': {
                        room.hidden = true;
                        await applyAccessState(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral('🙈 Room hidden.')).catch(_noop);
                    }
                    case 'unhide': {
                        room.hidden = false;
                        await applyAccessState(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral('👁️ Room visible again.')).catch(_noop);
                    }
                    case 'chat': {
                        room.chatLocked = !room.chatLocked;
                        await applyAccessState(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral(room.chatLocked ? '💬 Chat locked.' : '💬 Chat unlocked.')).catch(_noop);
                    }
                    case 'waitlist': {
                        room.waitingEnabled = !room.waitingEnabled;
                        if (!room.waitingEnabled) room.waitingList = [];
                        await applyAccessState(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral(
                            room.waitingEnabled
                                ? '⏳ Waiting mode on — locked joins now get queued for your Permit instead of blocked outright.'
                                : '⏳ Waiting mode off.'
                        )).catch(_noop);
                    }
                    case 'reset': {
                        await resetRoom(channel, room);
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral('📋 Room reset to defaults.')).catch(_noop);
                    }
                    case 'claim': {
                        if (channel.members.has(room.ownerId)) {
                            return interaction.reply(ephemeral('The owner is still in the room — nothing to claim.')).catch(_noop);
                        }
                        const oldOwnerId = room.ownerId;
                        await channel.permissionOverwrites.delete(oldOwnerId, 'J2C: claimed');
                        await channel.permissionOverwrites.edit(member.id, {
                            ViewChannel: true, Connect: true, Speak: true,
                            ManageChannels: true, MoveMembers: true, MuteMembers: true, DeafenMembers: true,
                        }, { reason: 'J2C: claimed' });
                        room.ownerId = member.id;
                        setChannelData(client, channel.id, room);
                        return interaction.reply(ephemeral('👑 You are now the owner of this room.')).catch(_noop);
                    }
                    default:
                        return interaction.reply(ephemeral('Unknown action.')).catch(_noop);
                }
            } catch (err) {
                console.error('[J2C] action failed:', action, err?.message || err);
                return interaction.reply(ephemeral("❌ That didn't work — I might be missing **Manage Roles**/**Manage Channels** permission here.")).catch(_noop);
            }
        }

        // ── Modal submissions — same rule: await the real change, only
        // report success if it actually happened. ──
        if (isJ2cModal) {
            const value  = interaction.fields.getTextInputValue('value').trim();
            const action = interaction.customId.replace('j2c_modal_', '');

            try {
                if (action === 'limit') {
                    const n = parseInt(value, 10);
                    if (Number.isNaN(n) || n < 0 || n > 99) {
                        return interaction.reply(ephemeral('Please enter a number between 0 and 99.')).catch(_noop);
                    }
                    await channel.setUserLimit(n, 'J2C: limit set');
                    return interaction.reply(ephemeral(`👤 User limit set to ${n === 0 ? 'unlimited' : n}.`)).catch(_noop);
                }

                if (action === 'rename') {
                    const name = value.slice(0, 90);
                    await channel.setName(name, 'J2C: renamed');
                    return interaction.reply(ephemeral(`✏️ Room renamed to **${name}**.`)).catch(_noop);
                }

                if (action === 'bitrate') {
                    const kbps = parseInt(value, 10);
                    const max  = Math.floor((channel.guild.maximumBitrate ?? 96000) / 1000);
                    if (Number.isNaN(kbps) || kbps < 8 || kbps > max) {
                        return interaction.reply(ephemeral(`Please enter a number between 8 and ${max}.`)).catch(_noop);
                    }
                    await channel.setBitrate(kbps * 1000, 'J2C: bitrate set');
                    return interaction.reply(ephemeral(`🎧 Bitrate set to ${kbps}kbps.`)).catch(_noop);
                }

                if (action === 'region') {
                    const region = value.toLowerCase().trim();
                    if (!VALID_REGIONS.has(region)) {
                        return interaction.reply(ephemeral('Unknown region. Try: auto, us-east, us-west, singapore, india, etc.')).catch(_noop);
                    }
                    await channel.setRTCRegion(region === 'auto' ? null : region, 'J2C: region set');
                    return interaction.reply(ephemeral(`🗺️ Region set to **${region}**.`)).catch(_noop);
                }

                if (action === 'invite' || action === 'permit') {
                    const userId = extractUserId(value);
                    if (!userId) return interaction.reply(ephemeral("Couldn't read a user ID from that.")).catch(_noop);

                    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, Connect: true }, { reason: 'J2C: invited/permitted' });

                    room.bannedIds = room.bannedIds.filter(id => id !== userId);
                    if (!room.permittedIds.includes(userId)) room.permittedIds.push(userId);
                    room.waitingList = room.waitingList.filter(id => id !== userId);
                    setChannelData(client, channel.id, room);

                    const targetMember = interaction.guild.members.cache.get(userId);
                    if (targetMember?.voice.channelId && targetMember.voice.channelId !== channel.id) {
                        await targetMember.voice.setChannel(channel, 'J2C: moved in after permit').catch(_noop);
                    }

                    return interaction.reply(ephemeral(`✅ <@${userId}> can now join your room.`)).catch(_noop);
                }

                if (action === 'block') {
                    const userId = extractUserId(value);
                    if (!userId) return interaction.reply(ephemeral("Couldn't read a user ID from that.")).catch(_noop);

                    await channel.permissionOverwrites.edit(userId, { ViewChannel: false, Connect: false }, { reason: 'J2C: banned' });

                    room.permittedIds = room.permittedIds.filter(id => id !== userId);
                    if (!room.bannedIds.includes(userId)) room.bannedIds.push(userId);
                    setChannelData(client, channel.id, room);

                    const targetMember = interaction.guild.members.cache.get(userId);
                    if (targetMember?.voice.channelId === channel.id) {
                        await targetMember.voice.disconnect('J2C: banned from room').catch(_noop);
                    }

                    return interaction.reply(ephemeral(`⛔ <@${userId}> has been banned from your room.`)).catch(_noop);
                }

                if (action === 'transfer') {
                    const userId = extractUserId(value);
                    if (!userId) return interaction.reply(ephemeral("Couldn't read a user ID from that.")).catch(_noop);
                    if (!channel.members.has(userId)) {
                        return interaction.reply(ephemeral('That user needs to be in your room to receive ownership.')).catch(_noop);
                    }

                    const oldOwnerId = room.ownerId;
                    await channel.permissionOverwrites.delete(oldOwnerId, 'J2C: transferred');
                    await channel.permissionOverwrites.edit(userId, {
                        ViewChannel: true, Connect: true, Speak: true,
                        ManageChannels: true, MoveMembers: true, MuteMembers: true, DeafenMembers: true,
                    }, { reason: 'J2C: transferred' });

                    room.ownerId = userId;
                    setChannelData(client, channel.id, room);

                    return interaction.reply(ephemeral(`👑 Ownership transferred to <@${userId}>.`)).catch(_noop);
                }
            } catch (err) {
                console.error('[J2C] modal action failed:', action, err?.message || err);
                return interaction.reply(ephemeral("❌ That didn't work — I might be missing **Manage Roles**/**Manage Channels** permission here.")).catch(_noop);
            }
        }
    });
};

const { Events, EmbedBuilder } = require('discord.js');
const { ensureVcRole, getConfig } = require('../commands/vcrole/vcrole.js');

// Builds one detailed audit-log embed for a role add/remove action caused by VC movement.
function buildLogEmbed({ client, member, action, role, fromChannelId, toChannelId }) {
    const isAdd = action === 'add';

    const embed = new EmbedBuilder()
        .setTitle(isAdd ? '🎙️ Voice Role Assigned' : '🎙️ Voice Role Removed')
        .setColor(isAdd ? '#00FF00' : '#FF0000')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: '👤 User (Tag)', value: `${member.user.tag}`, inline: true },
            { name: '🆔 User ID', value: `${member.id}`, inline: true },
            { name: '📝 Username', value: `${member.user.username}`, inline: true },
            { name: '🖼️ Display Name', value: `${member.displayName}`, inline: true },
            { name: isAdd ? '➕ Role Added' : '➖ Role Removed', value: `${role.name} (\`${role.id}\`)`, inline: false }
        );

    if (fromChannelId) embed.addFields({ name: '🔊 From VC', value: `<#${fromChannelId}>`, inline: true });
    if (toChannelId) embed.addFields({ name: '🔊 To VC', value: `<#${toChannelId}>`, inline: true });

    embed.addFields({ name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false })
        .setFooter({ text: `Action: Role ${isAdd ? 'Add' : 'Remove'} • Performed by System`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    return embed;
}

// Builds a failure notice embed so a failed add/remove still shows up in the audit log
// instead of disappearing silently.
function buildFailureEmbed({ client, member, action, reason }) {
    return new EmbedBuilder()
        .setTitle(action === 'add' ? '⚠️ Voice Role Assign Failed' : '⚠️ Voice Role Remove Failed')
        .setColor('#FFA500')
        .addFields(
            { name: '👤 User (Tag)', value: `${member.user.tag}`, inline: true },
            { name: '🆔 User ID', value: `${member.id}`, inline: true },
            { name: '❗ Reason', value: reason || 'Unknown error', inline: false }
        )
        .addFields({ name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false })
        .setFooter({ text: `Action: Role ${action === 'add' ? 'Add' : 'Remove'} Failed • Performed by System`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
}

// Resolves the shared VC role by id, falling back to an API fetch if it's not
// in cache yet (e.g. right after a bot restart) instead of silently doing nothing.
async function resolveRole(guild, roleId) {
    if (!roleId) return null;
    let role = guild.roles.cache.get(roleId);
    if (role) return role;
    role = await guild.roles.fetch(roleId).catch(() => null);
    return role;
}

module.exports = (client) => {
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const { member, guild } = newState;
        if (!member || member.user.bot) return;
        if (oldState.channelId === newState.channelId) return; // mute/deaf/etc, no VC movement

        const config = getConfig(client, guild.id);
        if (!config || !config.enabled) return;

        const logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
        const logsToSend = [];

        // ====== JOINED A VC (was in no VC, or first join) ======
        if (!oldState.channelId && newState.channelId) {
            try {
                const role = await ensureVcRole(client, guild, config);
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role, `VC Role: joined ${newState.channel?.name || newState.channelId}`);
                    console.log(`[VC Role] ✅ Added "${role.name}" to ${member.user.tag} (joined VC ${newState.channelId})`);
                    logsToSend.push(buildLogEmbed({
                        client, member, action: 'add', role,
                        fromChannelId: null, toChannelId: newState.channelId
                    }));
                }
            } catch (err) {
                console.error(`[VC Role Error] Add failed for ${member.user.tag}:`, err.message);
                logsToSend.push(buildFailureEmbed({ client, member, action: 'add', reason: err.message }));
            }

        // ====== LEFT VC ENTIRELY (not switching to another VC) ======
        } else if (oldState.channelId && !newState.channelId) {
            try {
                const role = await resolveRole(guild, config.roleId);
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role, `VC Role: left ${oldState.channel?.name || oldState.channelId}`);
                    console.log(`[VC Role] ❌ Removed "${role.name}" from ${member.user.tag} (left VC ${oldState.channelId})`);
                    logsToSend.push(buildLogEmbed({
                        client, member, action: 'remove', role,
                        fromChannelId: oldState.channelId, toChannelId: null
                    }));
                }
            } catch (err) {
                console.error(`[VC Role Error] Remove failed for ${member.user.tag}:`, err.message);
                logsToSend.push(buildFailureEmbed({ client, member, action: 'remove', reason: err.message }));
            }
        }
        // ====== SWITCHED FROM ONE VC TO ANOTHER ======
        // Role is shared across all VCs, so no add/remove needed here — they stay in "In VC".

        if (logChannel && logsToSend.length) {
            await logChannel.send({ embeds: logsToSend }).catch(() => {});
        }
    });
};

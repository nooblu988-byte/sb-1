const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Config shape (LMDB key: vcrole_<guildId>):
// {
//   enabled: true,
//   logChannelId: '...',
//   roleId: '...'   // ek hi role, saari voice channels ke liye common
// }

const ROLE_NAME = 'In VC';

function getConfig(client, guildId) {
    const raw = client.lmdbGet(`vcrole_${guildId}`);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveConfig(client, guildId, cfg) {
    try {
        await client.lmdbSet(`vcrole_${guildId}`, JSON.stringify(cfg));
    } catch (err) {
        console.error(`[VC Role] Failed to save config for guild ${guildId}:`, err.message);
    }
}

// Auto-creates (or reuses) the single shared "In VC" role and saves it in config.
// Exported so voiceStateUpdate event can call it too.
async function ensureVcRole(client, guild, config) {
    if (config.roleId) {
        const existing = guild.roles.cache.get(config.roleId);
        if (existing) return existing;
    }

    // Reuse a role with the same name if it already exists
    let role = guild.roles.cache.find(r => r.name === ROLE_NAME);

    if (!role) {
        role = await guild.roles.create({
            name: ROLE_NAME,
            color: 'Random',
            hoist: false,
            mentionable: false,
            permissions: [],
            reason: 'VC Role: auto-created shared voice-channel role'
        });
    }

    config.roleId = role.id;
    await saveConfig(client, guild.id, config);
    return role;
}

module.exports = {
    name: 'vcrole',
    description: 'Auto VC Role System — kisi bhi voice channel join karo, ek hi role apne aap mil jayega',
    category: 'admin',
    aliases: ['vcr'],
    args: true,
    usage: '<setup/logchannel/status/disable>',
    permissions: ['Administrator'],

    async run(client, message, args, prefix) {
        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;

        if (!subcommand) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Invalid Usage')
                        .setColor('#FF0000')
                        .setDescription(
                            'Usage: `;vcrole setup`\n`;vcrole logchannel #channel`\n`;vcrole status`\n`;vcrole disable`'
                        )
                ]
            });
        }

        // ====== SETUP ======
        if (subcommand === 'setup') {
            const botMember = message.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Missing Permission')
                            .setColor('#FF0000')
                            .setDescription('I need the **Manage Roles** permission to create and assign roles!')
                    ]
                });
            }

            let config = getConfig(client, guildId) || { enabled: true, logChannelId: null, roleId: null };
            config.enabled = true;

            const logChannel = message.mentions.channels.first();
            if (logChannel && logChannel.isTextBased()) {
                config.logChannelId = logChannel.id;
            }

            const role = await ensureVcRole(client, message.guild, config);
            await saveConfig(client, guildId, config);

            const embed = new EmbedBuilder()
                .setTitle('✅ VC Role System Configured')
                .setColor('#00FF00')
                .setDescription('Voice Channel Role system successfully enabled!')
                .addFields(
                    { name: '🎭 Role', value: `${role} (${role.name})`, inline: true },
                    { name: '📊 Status', value: '**🟢 Enabled**', inline: true },
                    { name: '📝 Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : '❌ Not set', inline: true }
                )
                .setFooter({ text: `Configured by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        // ====== LOG CHANNEL ======
        } else if (subcommand === 'logchannel') {
            const logChannel = message.mentions.channels.first();

            if (!logChannel || !logChannel.isTextBased()) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Invalid Channel')
                            .setColor('#FF0000')
                            .setDescription('Usage: `;vcrole logchannel #text-channel`')
                    ]
                });
            }

            let config = getConfig(client, guildId) || { enabled: true, logChannelId: null, roleId: null };
            config.logChannelId = logChannel.id;
            await saveConfig(client, guildId, config);

            await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Log Channel Set')
                        .setColor('#00FF00')
                        .setDescription(`VC Role audit logs will now be sent to ${logChannel}.`)
                        .setFooter({ text: `Configured by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                        .setTimestamp()
                ]
            });

        // ====== DISABLE ======
        } else if (subcommand === 'disable') {
            client.lmdbDel(`vcrole_${guildId}`);

            const embed = new EmbedBuilder()
                .setTitle('🔴 VC Role System Disabled')
                .setColor('#FF0000')
                .setDescription('Voice Channel Role system has been disabled. The previously created role will remain in the server (not deleted) — you can remove it manually if you want.')
                .setFooter({ text: `Disabled by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        // ====== STATUS ======
        } else if (subcommand === 'status') {
            const config = getConfig(client, guildId);

            if (!config || !config.enabled) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🔴 VC Role System Status')
                            .setColor('#FF0000')
                            .setDescription('VC Role System is currently **disabled**.\nUse `;vcrole setup` to enable it.')
                    ]
                });
            }

            const role = config.roleId ? message.guild.roles.cache.get(config.roleId) : null;
            const logChannel = config.logChannelId ? message.guild.channels.cache.get(config.logChannelId) : null;

            const embed = new EmbedBuilder()
                .setTitle('📊 VC Role System Status')
                .setColor('#3498db')
                .addFields(
                    { name: '📊 Status', value: '**🟢 Enabled**', inline: true },
                    { name: '🎭 Role', value: role ? `${role} (${role.name})` : '❌ Not created yet', inline: true },
                    { name: '📝 Log Channel', value: logChannel ? `${logChannel}` : '❌ Not set', inline: true }
                )
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } else {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Invalid Subcommand')
                        .setColor('#FF0000')
                        .setDescription('Valid options: `setup`, `logchannel`, `status`, `disable`')
                ]
            });
        }
    },

    ensureVcRole,
    getConfig,
    saveConfig
};

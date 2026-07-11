const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

const send = (message, text) => message.channel.send({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
    flags: MessageFlags.IsComponentsV2,
});

const DANGEROUS_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.MentionEveryone,
];

module.exports = {
    name: 'autorole',
    aliases: ['ar'],
    description: 'Automatically assign roles to new members',
    category: 'premium',
    cooldown: 5,
    run: async (client, message, args, prefix) => {
        const arrow = client.emoji?.arrow || '▸';

        if (!message.member.permissions.has('ManageRoles')) {
            return send(message, `${client.emoji?.cross || '❌'} | You need \`MANAGE_ROLES\` permission to use this command.`);
        }

        const subCommand      = args[0]?.toLowerCase();
        const currentSettings = await client.db.get(`autorole_${message.guild.id}`) || { enabled: false, roles: [], botRoles: [] };

        if (!subCommand) {
            const humanRoles = currentSettings.roles?.map(id => `<@&${id}>`).join(', ') || 'None';
            const botRoles   = currentSettings.botRoles?.map(id => `<@&${id}>`).join(', ') || 'None';

            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Auto Role System'))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `**Status:** ${currentSettings.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                            `**Human Roles:** ${humanRoles}\n` +
                            `**Bot Roles:** ${botRoles}`
                        ))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `${arrow} \`${prefix}autorole enable\` — Enable autorole\n` +
                            `${arrow} \`${prefix}autorole disable\` — Disable autorole\n` +
                            `${arrow} \`${prefix}autorole add <human/bot> @role\` — Add a role\n` +
                            `${arrow} \`${prefix}autorole remove <human/bot> @role\` — Remove a role\n` +
                            `${arrow} \`${prefix}autorole clear\` — Clear all roles`
                        )),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (subCommand === 'enable') {
            currentSettings.enabled = true;
            await client.db.set(`autorole_${message.guild.id}`, currentSettings);
            return send(message, `${client.emoji?.tick || '✅'} | Auto Role has been **enabled**.`);
        }

        if (subCommand === 'disable') {
            currentSettings.enabled = false;
            await client.db.set(`autorole_${message.guild.id}`, currentSettings);
            return send(message, `${client.emoji?.tick || '✅'} | Auto Role has been **disabled**.`);
        }

        if (subCommand === 'add') {
            const type = args[1]?.toLowerCase();
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);

            if (!['human', 'bot'].includes(type)) {
                return send(message, `${client.emoji?.cross || '❌'} | Type must be \`human\` or \`bot\`.`);
            }
            if (!role) {
                return send(message, `${client.emoji?.cross || '❌'} | Please mention a valid role.`);
            }
            if (DANGEROUS_PERMISSIONS.some(p => role.permissions.has(p))) {
                return send(message, `${client.emoji?.cross || '❌'} | I cannot add this role because it has dangerous permissions.`);
            }
            if (role.position >= message.guild.members.me.roles.highest.position) {
                return send(message, `${client.emoji?.cross || '❌'} | I cannot assign this role as it's higher than my highest role.`);
            }

            const roleArray = type === 'human' ? 'roles' : 'botRoles';
            if (!currentSettings[roleArray]) currentSettings[roleArray] = [];

            if (currentSettings[roleArray].includes(role.id)) {
                return send(message, `${client.emoji?.cross || '❌'} | This role is already in the ${type} autorole list.`);
            }

            currentSettings[roleArray].push(role.id);
            await client.db.set(`autorole_${message.guild.id}`, currentSettings);
            return send(message, `${client.emoji?.tick || '✅'} | Added ${role} to the **${type}** autorole list.`);
        }

        if (subCommand === 'remove') {
            const type = args[1]?.toLowerCase();
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);

            if (!['human', 'bot'].includes(type)) {
                return send(message, `${client.emoji?.cross || '❌'} | Type must be \`human\` or \`bot\`.`);
            }
            if (!role) {
                return send(message, `${client.emoji?.cross || '❌'} | Please mention a valid role.`);
            }

            const roleArray = type === 'human' ? 'roles' : 'botRoles';
            if (!currentSettings[roleArray]?.includes(role.id)) {
                return send(message, `${client.emoji?.cross || '❌'} | This role is not in the ${type} autorole list.`);
            }

            currentSettings[roleArray] = currentSettings[roleArray].filter(id => id !== role.id);
            await client.db.set(`autorole_${message.guild.id}`, currentSettings);
            return send(message, `${client.emoji?.tick || '✅'} | Removed ${role} from the **${type}** autorole list.`);
        }

        if (subCommand === 'clear') {
            await client.db.set(`autorole_${message.guild.id}`, { enabled: false, roles: [], botRoles: [] });
            return send(message, `${client.emoji?.tick || '✅'} | Cleared all autorole settings.`);
        }
    },
};

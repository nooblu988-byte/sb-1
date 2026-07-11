const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

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
    name: 'massrole',
    aliases: ['mrole'],
    description: 'Add or remove roles from all members',
    category: 'premium',
    cooldown: 30,
    run: async (client, message, args, prefix) => {
        const arrow = client.emoji?.arrow || '▸';

        if (!message.member.permissions.has('ManageRoles')) {
            return send(message, `${client.emoji?.cross || '❌'} | You need \`MANAGE_ROLES\` permission to use this command.`);
        }

        const subCommand = args[0]?.toLowerCase();
        const role       = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);

        if (!subCommand || !['add', 'remove', 'humans', 'bots'].includes(subCommand)) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Mass Role'))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `${arrow} \`${prefix}massrole add @role\` — Add role to all members\n` +
                            `${arrow} \`${prefix}massrole remove @role\` — Remove role from all members\n` +
                            `${arrow} \`${prefix}massrole humans @role\` — Add role to all humans\n` +
                            `${arrow} \`${prefix}massrole bots @role\` — Add role to all bots`
                        )),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (!role) {
            return send(message, `${client.emoji?.cross || '❌'} | Please mention a valid role.`);
        }
        if (DANGEROUS_PERMISSIONS.some(p => role.permissions.has(p))) {
            return send(message, `${client.emoji?.cross || '❌'} | I cannot manage this role because it has dangerous permissions.`);
        }
        if (role.position >= message.guild.members.me.roles.highest.position) {
            return send(message, `${client.emoji?.cross || '❌'} | I cannot manage this role as it's higher than my highest role.`);
        }

        const statusMsg = await message.channel.send({
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('⏳ Processing mass role operation... This may take a while.')),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        let members = await message.guild.members.fetch();
        let successCount = 0;
        let failCount    = 0;

        if (subCommand === 'humans') {
            members = members.filter(m => !m.user.bot);
        } else if (subCommand === 'bots') {
            members = members.filter(m => m.user.bot);
        }

        const isAdding = subCommand === 'add' || subCommand === 'humans' || subCommand === 'bots';
        const reason   = `Mass Role ${isAdding ? 'Addition' : 'Removal'} by ${message.author.tag} (${message.author.id})`;

        for (const [, member] of members) {
            try {
                if (isAdding && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role, reason);
                    successCount++;
                } else if (subCommand === 'remove' && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role, reason);
                    successCount++;
                }
                await new Promise(r => setTimeout(r, 100));
            } catch {
                failCount++;
            }
        }

        await statusMsg.edit({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Mass Role Complete'))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `${client.emoji?.tick || '✅'} | Operation completed!\n\n` +
                        `**Role:** ${role}\n` +
                        `**Action:** ${isAdding ? 'Added' : 'Removed'}\n` +
                        `**Success:** \`${successCount}\`\n` +
                        `**Failed:** \`${failCount}\``
                    )),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};

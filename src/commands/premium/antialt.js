const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');

const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

const send = (message, text) => message.channel.send({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
    flags: MessageFlags.IsComponentsV2,
});

module.exports = {
    name: 'antialt',
    aliases: ['altdetect'],
    description: 'Block new/alt accounts from joining',
    category: 'premium',
    cooldown: 5,
    run: async (client, message, args, prefix) => {
        const arrow = client.emoji?.arrow || '▸';

        if (!message.member.permissions.has('ManageGuild')) {
            return send(message, `${client.emoji?.cross || '❌'} | You need \`MANAGE_GUILD\` permission to use this command.`);
        }

        const subCommand    = args[0]?.toLowerCase();
        const currentSetting = await client.db.get(`antialt_${message.guild.id}`);

        if (!subCommand) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Anti-Alt System'))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `**Status:** ${currentSetting?.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                            `**Minimum Account Age:** ${currentSetting?.minAge || 7} days\n` +
                            `**Action:** ${currentSetting?.action || 'kick'}`
                        ))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `${arrow} \`${prefix}antialt enable <days>\` — Enable with minimum age\n` +
                            `${arrow} \`${prefix}antialt disable\` — Disable anti-alt\n` +
                            `${arrow} \`${prefix}antialt action <kick/ban>\` — Set action`
                        )),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (subCommand === 'enable') {
            const days = parseInt(args[1]) || 7;
            if (days < 1 || days > 365) {
                return send(message, `${client.emoji?.cross || '❌'} | Days must be between **1** and **365**.`);
            }

            await client.db.set(`antialt_${message.guild.id}`, {
                enabled: true,
                minAge: days,
                action: currentSetting?.action || 'kick',
            });

            return send(message, `${client.emoji?.tick || '✅'} | Anti-Alt enabled! Accounts younger than **${days} days** will be blocked.`);
        }

        if (subCommand === 'disable') {
            await client.db.set(`antialt_${message.guild.id}`, { enabled: false });
            return send(message, `${client.emoji?.tick || '✅'} | Anti-Alt has been disabled.`);
        }

        if (subCommand === 'action') {
            const action = args[1]?.toLowerCase();
            if (!['kick', 'ban'].includes(action)) {
                return send(message, `${client.emoji?.cross || '❌'} | Action must be \`kick\` or \`ban\`.`);
            }

            await client.db.set(`antialt_${message.guild.id}`, {
                ...currentSetting,
                action,
            });

            return send(message, `${client.emoji?.tick || '✅'} | Alt accounts will now be **${action}ed**.`);
        }
    },
};

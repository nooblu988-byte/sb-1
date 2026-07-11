const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = async (client) => {
    client.on('guildMemberAdd', async (member) => {
        const autoroleSettings = await client.db.get(`autorole_${member.guild.id}`);
        if (autoroleSettings?.enabled) {
            const rolesToAdd = member.user.bot ? autoroleSettings.botRoles : autoroleSettings.roles;
            const reason = `Autorole addition for ${member.user.tag}`;
            if (rolesToAdd && rolesToAdd.length > 0) {
                for (const roleId of rolesToAdd) {
                    try {
                        const role = member.guild.roles.cache.get(roleId);
                        if (role && role.position < member.guild.members.me.roles.highest.position) {
                            await member.roles.add(role, reason).catch(() => {});
                        }
                    } catch {}
                }
            }
        }

        const antialtSettings = await client.db.get(`antialt_${member.guild.id}`);
        if (antialtSettings?.enabled) {
            const accountAge  = Date.now() - member.user.createdTimestamp;
            const minAgeDays  = antialtSettings.minAge || 7;
            const minAgeMs    = minAgeDays * 24 * 60 * 60 * 1000;

            if (accountAge < minAgeMs) {
                const action = antialtSettings.action || 'kick';
                try {
                    await member.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xFF4B4B)
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Anti-Alt Detection'))
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                    `You have been **${action}ed** from **${member.guild.name}** because your account is too new.\n\n` +
                                    `**Minimum account age required:** ${minAgeDays} days`
                                )),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});

                    if (action === 'ban') {
                        await member.ban({ reason: `[Anti-Alt] Account age: ${Math.floor(accountAge / 86400000)} days` });
                    } else {
                        await member.kick(`[Anti-Alt] Account age: ${Math.floor(accountAge / 86400000)} days`);
                    }
                } catch {}
            }
        }
    });
};

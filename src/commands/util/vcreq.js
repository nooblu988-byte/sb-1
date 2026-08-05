const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ChannelType,
    SeparatorSpacingSize,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = {
    name: "vcreq",
    aliases: ["vcrequest"],
    description: "Request access to a voice channel you don't have permission to join",
    category: "utility",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        const requesterVC = message.member.voice.channel;
        if (!requesterVC) {
            return reply(`${client.emoji.cross} You need to be in a voice channel to use this command.`);
        }

        const query = args.join(" ").trim();
        if (!query) {
            return reply(`${client.emoji.cross} Usage: \`${prefix}vcreq <voice channel name or ID>\``);
        }

        let targetVC = /^\d{15,25}$/.test(query) ? message.guild.channels.cache.get(query) : null;
        if (!targetVC || targetVC.type !== ChannelType.GuildVoice) {
            targetVC = message.guild.channels.cache.find(
                c => c.type === ChannelType.GuildVoice && c.name.toLowerCase() === query.toLowerCase()
            );
        }

        if (!targetVC) {
            return reply(`${client.emoji.cross} No voice channel found matching **${query}**.`);
        }

        if (targetVC.id === requesterVC.id) {
            return reply(`${client.emoji.cross} You're already in that voice channel.`);
        }

        if (!targetVC.isTextBased?.()) {
            return reply(`${client.emoji.cross} Can't send a request there — that channel doesn't support text chat.`);
        }

        const sent = await targetVC.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Voice Channel Access Request"))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${message.author} wants to join **${targetVC.name}**.\n` +
                            `-# Only someone with access to this channel, an admin, or the server owner can respond.`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents(row =>
                        row.addComponents(
                            new ButtonBuilder().setCustomId(`vcreq_accept_${message.author.id}_${targetVC.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`vcreq_decline_${message.author.id}_${targetVC.id}`).setLabel("Decline").setStyle(ButtonStyle.Danger),
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);

        if (!sent) {
            return reply(`${client.emoji.cross} Couldn't send the request — I may be missing permission to send messages there.`);
        }

        return reply(`${client.emoji.enabled2} Request sent to **${targetVC.name}**. Waiting for someone with access to respond.`);
    },
};

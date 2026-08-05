const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const STEP_WAIT_MS = 2 * 60 * 1000;

module.exports = {
    name: "ticketsetup",
    aliases: ["ticketpanel"],
    description: "Set up the ticket panel",
    category: "ticket",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
        const owners = client.config?.owner || [];

        const isAllowed =
            message.author.id === message.guild.ownerId ||
            owners.includes(message.author.id) ||
            message.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isAllowed) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${client.emoji.cross} Only the **server owner** or an **Administrator** can use this command.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const panel = (content) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Ticket Panel Setup"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        if (!client._ticketSetupPending) client._ticketSetupPending = new Map();
        const key = `${message.guild.id}_${message.author.id}`;

        if (client._ticketSetupPending.has(key)) {
            return panel("You already have a ticket panel setup in progress — reply to the last question, or wait for it to time out.");
        }

        await panel("What should the panel title say?");

        client._ticketSetupPending.set(key, {
            step: "title",
            channelId: message.channel.id,
            expires: Date.now() + STEP_WAIT_MS,
        });
    },
};

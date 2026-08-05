const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

const STEP_WAIT_MS = 2 * 60 * 1000;
const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = {
    name: "afk",
    aliases: [],
    description: "Set yourself as AFK with a duration and reason",
    category: "utility",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const panel = (content) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Set AFK Status"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        if (!client._afkPending) client._afkPending = new Map();
        const key = `${message.guild.id}_${message.author.id}`;

        if (client._afkPending.has(key)) {
            return panel("You already have an AFK setup in progress — reply to the last question, or wait for it to time out.");
        }

        await panel(
            "How long do you want to be AFK for?\n" +
            "Reply with a duration — e.g. `30 minutes`, `2 hours`, `3 days`, `1 month`."
        );

        client._afkPending.set(key, {
            step: "duration",
            channelId: message.channel.id,
            expires: Date.now() + STEP_WAIT_MS,
        });
    },
};

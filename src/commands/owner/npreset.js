const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "npreset",
    description: "Reset the noprefix list",
    category: "owner",
    cooldown: 3,
    async run(client, message) {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const allowedUsers = [...client.config.owner, ...(client.config.extraowners || [])];
        if (!allowedUsers.includes(message.author.id)) {
            return message.reply("You do not have permission to use this command.");
        }

        const msg = await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0xFFCC00)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## ⚠️ Confirmation Required")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            "**Are you sure you want to reset the noprefix list?**\n\n" +
                            "This action cannot be undone.\n" +
                            "Click **Confirm** to proceed or **Cancel** to abort."
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("-# This request will expire in 30 minutes.")
                    )
                    .addActionRowComponents(row =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("npreset_confirm")
                                .setLabel("Confirm")
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId("npreset_cancel")
                                .setLabel("Cancel")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30 * 60 * 1000,
        });

        collector.on("collect", async interaction => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: "Only the command author can use these buttons.", ephemeral: true });
            }

            if (interaction.customId === "npreset_confirm") {
                await client.db.set("noprefix", []);
                collector.stop("confirmed");
                return interaction.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x57F287)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`${client.emoji.tick} The noprefix list has been reset.`)
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            if (interaction.customId === "npreset_cancel") {
                collector.stop("cancelled");
                return interaction.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`${client.emoji.cross} Action cancelled. The noprefix list was not changed.`)
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time") {
                await msg.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent("⏰ Confirmation expired. Please run the command again.")
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        });
    },
};

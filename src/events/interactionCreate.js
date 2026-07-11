const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = (client) => {
    client.on("interactionCreate", async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd || !cmd.runSlash) return;

            try {
                await cmd.runSlash(client, interaction);
            } catch (err) {
                console.error(`[Slash Command Error] ${interaction.commandName}:`, err);
                const errPayload = {
                    components: [
                        new ContainerBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent("An error occurred while executing this command."))
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errPayload).catch(() => {});
                } else {
                    await interaction.reply(errPayload).catch(() => {});
                }
            }
            return;
        }

        if (!interaction.isButton()) return;

        if (interaction.customId === "cmd_delete") {
            if (interaction.message.interaction?.user?.id !== interaction.user.id) {
                return interaction.reply({ content: "You cannot delete this message!", flags: 64 });
            }
            await interaction.message.delete().catch(() => {});
        }
    });
};

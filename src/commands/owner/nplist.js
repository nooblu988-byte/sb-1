const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "nplist",
    description: "View all users in noprefix list",
    category: "owner",
    cooldown: 3,
    async run(client, message) {
        const allowedUsers = [...client.config.owner, ...(client.config.extraowners || [])];

        if (!allowedUsers.includes(message.author.id))
            return message.reply("You do not have permission to use this command.");

        let npList = (await client.db.get("noprefix")) || [];
        if (npList.length === 0) return message.reply("The noprefix list is empty.");

        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const pageSize = 10;
        let currentPage = 0;
        const totalPages = Math.ceil(npList.length / pageSize);

        const formatUser = (entry, index) => {
            const expires =
                entry.expiresAt && !isNaN(entry.expiresAt)
                    ? new Date(entry.expiresAt).toLocaleString()
                    : "Never";
            return `\`[${index + 1}]\` | <@${entry.userId}> | \`${entry.userId}\` | Expires: \`${expires}\``;
        };

        const buildRow = () => new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## Noprefix List — ${npList.length}`)
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    npList.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                        .map((entry, i) => formatUser(entry, currentPage * pageSize + i))
                        .join("\n")
                )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Page ${currentPage + 1} of ${totalPages} | Total: ${npList.length}`)
            )
            .addActionRowComponents(row =>
                row.addComponents(
                    new ButtonBuilder().setCustomId("first").setLabel("≪").setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId("previous").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId("close").setLabel("Delete").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages - 1),
                    new ButtonBuilder().setCustomId("last").setLabel("≫").setStyle(ButtonStyle.Primary).setDisabled(currentPage === totalPages - 1)
                )
            );

        const sent = await message.reply({
            components: [buildRow()],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: ["users"] },
        });

        const collector = sent.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 300000,
        });

        collector.on("collect", async i => {
            switch (i.customId) {
                case "first":   currentPage = 0; break;
                case "previous": currentPage = Math.max(0, currentPage - 1); break;
                case "next":    currentPage = Math.min(totalPages - 1, currentPage + 1); break;
                case "last":    currentPage = totalPages - 1; break;
                case "close":
                    await i.message.delete().catch(() => {});
                    return collector.stop();
            }
            await i.update({ components: [buildRow()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: ["users"] } });
        });

        collector.on("end", async () => {
            await sent.edit({
                allowedMentions: { parse: ["users"] },
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## Noprefix List — ${npList.length}`)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                npList.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                                    .map((entry, i) => formatUser(entry, currentPage * pageSize + i))
                                    .join("\n")
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Page ${currentPage + 1} of ${totalPages} | Total: ${npList.length}`)
                        )
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder().setCustomId("first_d").setLabel("≪").setStyle(ButtonStyle.Primary).setDisabled(true),
                                new ButtonBuilder().setCustomId("previous_d").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                new ButtonBuilder().setCustomId("close_d").setLabel("Delete").setStyle(ButtonStyle.Danger).setDisabled(true),
                                new ButtonBuilder().setCustomId("next_d").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                new ButtonBuilder().setCustomId("last_d").setLabel("≫").setStyle(ButtonStyle.Primary).setDisabled(true)
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};

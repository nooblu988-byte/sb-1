const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

module.exports = {
    name: "purge",
    aliases: ["clear"],
    description: "Bulk delete messages in a channel",
    category: "moderation",
    cooldown: 3,
    run: async (client, message, args) => {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const reply = (content, color = 0x26272F) => ({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return message.reply(reply(`${client.emoji.cross} You need **Manage Messages** permission.`));

        if (!message.guild.members.me.permissions.has([
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ReadMessageHistory,
        ]))
            return message.reply(reply(`${client.emoji.cross} I need **Manage Messages** and **Read Message History** permissions.`));

        const type = args[0]?.toLowerCase();
        const input = args.slice(1).join(" ");
        const amountArg = parseInt(args.find(a => /^\d+$/.test(a))) || null;

        if (!type)
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 🧹 Purge Usage"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                "`purge <amount>` — Delete last N messages instantly\n" +
                                "`purge user @user [amount]` — Delete a user's messages\n" +
                                "`purge attachments [amount]` — Delete messages with files\n" +
                                "`purge contains <word>` — Delete all messages containing a word (max 100)"
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        const fetchLimit = 100;
        const messages = await message.channel.messages.fetch({ limit: fetchLimit });
        let filtered = [];

        if (/^\d+$/.test(type)) {
            const amount = Math.min(parseInt(type) + 1, 100);
            const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
            const actualDeleted = deleted ? deleted.size - 1 : 0;
            const msg = await message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(deleted ? 0x57F287 : 0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                deleted
                                    ? `${client.emoji.tick} Deleted **${actualDeleted}** messages.`
                                    : `${client.emoji.cross} Failed to delete messages.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
            return setTimeout(() => msg.delete().catch(() => {}), 3000);
        }

        const buildConfirm = (description) => ({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0xFFCC00)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ⚠️ Confirm Purge`))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(description))
                    .addSeparatorComponents(sep())
                    .addActionRowComponents(row =>
                        row.addComponents(
                            new ButtonBuilder().setCustomId("confirm_purge").setLabel("✅ Confirm").setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId("cancel_purge").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger)
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        const handleConfirm = async (msg, toDelete, successText) => {
            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id,
                time: 15000,
            });

            collector.on("collect", async i => {
                await i.deferUpdate();
                if (i.customId === "cancel_purge") {
                    collector.stop("cancelled");
                    return msg.edit(reply(`${client.emoji.cross} Cancelled.`));
                }
                if (i.customId === "confirm_purge") {
                    const deleted = await message.channel.bulkDelete(toDelete, true).catch(() => null);
                    collector.stop("confirmed");
                    return msg.edit(reply(
                        deleted ? `${client.emoji.tick} ${successText(deleted.size)}` : `${client.emoji.cross} Failed to delete messages.`,
                        deleted ? 0x57F287 : 0x26272F
                    ));
                }
            });

            collector.on("end", async (_, reason) => {
                if (reason !== "confirmed" && reason !== "cancelled")
                    await msg.edit(reply(`${client.emoji.cross} Purge timed out.`));
            });
        };

        switch (type) {
            case "user": {
                const user =
                    message.mentions.users.first() ||
                    (input ? await client.users.fetch(input).catch(() => null) : null);
                if (!user) return message.reply(reply(`${client.emoji.cross} Mention or specify a valid user.`));

                const amount = Math.min(amountArg || 10, 100);
                filtered = messages.filter(m => m.author.id === user.id).first(amount);

                if (!filtered.length)
                    return message.reply(reply(`${client.emoji.cross} No recent messages found from that user.`));

                if (!amountArg) {
                    const msg = await message.reply(buildConfirm(`Delete last **${filtered.length}** messages from **${user.tag}**?`));
                    return handleConfirm(msg, filtered, size => `Deleted **${size}** messages from ${user.tag}.`);
                }

                const deleted = await message.channel.bulkDelete(filtered, true).catch(() => null);
                return message.reply(reply(
                    deleted ? `${client.emoji.tick} Deleted **${deleted.size}** messages from **${user.tag}**.` : `${client.emoji.cross} Failed to delete messages.`,
                    deleted ? 0x57F287 : 0x26272F
                ));
            }

            case "attachments": {
                const amount = Math.min(amountArg || 10, 100);
                filtered = messages.filter(m => m.attachments.size > 0).first(amount);

                if (!filtered.length)
                    return message.reply(reply(`${client.emoji.cross} No recent attachment messages found.`));

                if (!amountArg) {
                    const msg = await message.reply(buildConfirm(`Delete last **${filtered.length}** messages with attachments?`));
                    return handleConfirm(msg, filtered, size => `Deleted **${size}** messages with attachments.`);
                }

                const deleted = await message.channel.bulkDelete(filtered, true).catch(() => null);
                return message.reply(reply(
                    deleted ? `${client.emoji.tick} Deleted **${deleted.size}** messages with attachments.` : `${client.emoji.cross} Failed to delete messages.`,
                    deleted ? 0x57F287 : 0x26272F
                ));
            }

            case "contains": {
                const keyword = input || args[1];
                if (!keyword) return message.reply(reply(`${client.emoji.cross} Provide a keyword to search.`));

                filtered = messages.filter(m => m.content.toLowerCase().includes(keyword.toLowerCase()));

                if (!filtered.size)
                    return message.reply(reply(`${client.emoji.cross} No messages found containing "${keyword}".`));

                const deleted = await message.channel.bulkDelete(filtered, true).catch(() => null);
                return message.reply(reply(
                    deleted ? `${client.emoji.tick} Deleted **${deleted.size}** messages containing "${keyword}".` : `${client.emoji.cross} Failed to delete messages.`,
                    deleted ? 0x57F287 : 0x26272F
                ));
            }

            default:
                return message.reply(reply(`${client.emoji.cross} Invalid purge type.`));
        }
    },
};

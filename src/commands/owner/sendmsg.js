const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "sendmsg",
    description: "Send a message to any server channel",
    category: "owner",
    cooldown: 3,
    run: async (client, message, args, prefix) => {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const reply = (content, color = 0x26272F) => message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!client.config.owner.includes(message.author.id)) {
            return reply("❌ You do not have permission to use this command.");
        }

        if (args.length < 3) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 📨 Send Message Command"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Usage:** \`${prefix}sendmsg <guildid> <channelid> <message>\`\n\n` +
                                `**Example:**\n\`${prefix}sendmsg 123456789 987654321 Hello everyone!\`\n\n` +
                                `**Features:**\n` +
                                `• Send text messages with emojis\n` +
                                `• Attach images, videos, files\n` +
                                `• Send stickers\n` +
                                `• Works in any guild/channel the bot is in`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const guildId = args[0];
        const channelId = args[1];
        const messageContent = args.slice(2).join(" ");

        try {
            const targetGuild = client.guilds.cache.get(guildId);
            if (!targetGuild) {
                return reply(`❌ Guild not found. Make sure the bot is in that server.\n**Guild ID:** \`${guildId}\``);
            }

            const targetChannel = targetGuild.channels.cache.get(channelId);
            if (!targetChannel) {
                return reply(`❌ Channel not found in **${targetGuild.name}**.\n**Channel ID:** \`${channelId}\``);
            }

            if (!targetChannel.isTextBased()) {
                return reply(`❌ Cannot send messages to **${targetChannel.name}** (not a text channel).`);
            }

            const messageOptions = {};

            if (messageContent?.trim().length > 0) messageOptions.content = messageContent;

            if (message.attachments.size > 0) {
                messageOptions.files = Array.from(message.attachments.values()).map(att => ({
                    attachment: att.url,
                    name: att.name,
                }));
            }

            if (message.stickers.size > 0) {
                messageOptions.stickers = [message.stickers.first().id];
            }

            if (!messageOptions.content && !messageOptions.files && !messageOptions.stickers) {
                return reply("❌ Please provide a message, attachment, or sticker to send.");
            }

            await targetChannel.send(messageOptions);

            const fields = [
                `**Guild:** ${targetGuild.name} (\`${guildId}\`)`,
                `**Channel:** ${targetChannel.name} (\`${channelId}\`)`,
            ];
            if (messageContent) fields.push(`**Message:** ${messageContent.length > 512 ? messageContent.substring(0, 509) + "..." : messageContent}`);
            if (message.attachments.size > 0) fields.push(`**Attachments:** ${message.attachments.size} file(s)`);
            if (message.stickers.size > 0) fields.push(`**Stickers:** ${message.stickers.size} sticker(s)`);

            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x57F287)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## ✅ Message Sent Successfully"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(fields.join("\n"))),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        } catch (error) {
            console.error("SendMsg Error:", error);

            let errorMessage = "❌ Failed to send message.";
            if (error.code === 50013) errorMessage = "❌ Missing permissions to send messages in that channel.";
            else if (error.code === 50001) errorMessage = "❌ Missing access to that channel.";
            else if (error.message) errorMessage = `❌ Error: ${error.message}`;

            return reply(errorMessage);
        }
    },
};

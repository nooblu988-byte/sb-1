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
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = {
    name: "steal",
    description: "Add emojis or stickers to this server",
    aliases: ["eadd", "grab"],
    category: "util",
    cooldown: 6,
    run: async (client, message, args) => {
        const prefix = message.guild?.prefix || "&";
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const reply = (content, color = 0x26272F) => message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
            return reply(`${client.emoji.cross} You need the \`Manage Emojis and Stickers\` permission.`);
        }

        let inputs = [];

        if (message.reference) {
            try {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId);
                const attachments = [...refMsg.attachments.values()].map(a => a.url);
                const stickers = [...refMsg.stickers.values()].map(s => s.url);
                const emojis = (refMsg.content.match(/<a?:\w+:\d+>/g) || []).map(parseEmoteToUrl).filter(Boolean);
                inputs = [...attachments, ...stickers, ...emojis];
            } catch (e) {
                console.error(e);
            }
        }

        if (args.length) {
            for (const arg of args) {
                if (arg.startsWith("<")) {
                    const url = parseEmoteToUrl(arg);
                    if (url) inputs.push(url);
                } else if (arg.startsWith("http")) {
                    inputs.push(arg);
                }
            }
        }

        if (!inputs.length) {
            return reply(
                `${client.emoji.cross} No valid emoji, sticker, or image found!\n\n` +
                `**Usage:** \`${prefix}steal <emoji|url>\`\n` +
                `**Or:** Reply to a message containing emojis/stickers\n\n` +
                `-# Tip: You can also attach images directly!`
            );
        }

        await createPagedSelector(client, message, inputs, sep);
    },
};

function parseEmoteToUrl(emote) {
    try {
        const match = emote.match(/<?(a)?:\w+:(\d+)>?/);
        if (!match) return null;
        const animated = Boolean(match[1]);
        const id = match[2];
        return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
    } catch {
        return null;
    }
}

function generateRandomName(prefix = "item") {
    return `${prefix}_${Math.floor(Math.random() * 999999) + 100000}`;
}

async function addEmoji(client, message, url, sep) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image (${response.status})`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const name = generateRandomName("emoji");
        const emoji = await message.guild.emojis.create({ attachment: buffer, name });

        await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.tick} Successfully added emoji ${emoji} (\`${name}\`)\n` +
                            `-# Total emojis: ${message.guild.emojis.cache.size}`
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (e) {
        await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} Failed to add emoji: ${e.message}`)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}

async function addSticker(client, message, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch sticker (${response.status})`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const name = generateRandomName("sticker");
        const file = { attachment: buffer, name: "sticker.png" };
        await message.guild.stickers.create({ file, name, tags: "⭐" });

        await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.tick} Successfully added sticker **${name}**\n` +
                            `-# Total stickers: ${message.guild.stickers.cache.size}`
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (e) {
        await message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} Failed to add sticker: ${e.message}`)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}

async function createPagedSelector(client, message, urls, sep) {
    let index = 0;

    const buildContainer = (disabled = false) => {
        const suffix = disabled ? "_d" : "";
        return new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("## Emoji / Sticker Stealer")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Previewing **${index + 1}** of **${urls.length}**\n` +
                    `[View Preview](${urls[index]})\n\n` +
                    `Choose what to steal:`
                )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(disabled ? "-# This menu has expired." : "-# This menu will expire in 2 minutes.")
            )
            .addActionRowComponents(row =>
                row.addComponents(
                    new ButtonBuilder().setCustomId("prev" + suffix).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(disabled || urls.length === 1),
                    new ButtonBuilder().setCustomId("steal_emoji" + suffix).setLabel("Steal as Emoji").setStyle(ButtonStyle.Primary).setDisabled(disabled),
                    new ButtonBuilder().setCustomId("steal_sticker" + suffix).setLabel("Steal as Sticker").setStyle(ButtonStyle.Success).setDisabled(disabled),
                    new ButtonBuilder().setCustomId("next" + suffix).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(disabled || urls.length === 1)
                )
            );
    };

    const msg = await message.reply({
        components: [buildContainer()],
        flags: MessageFlags.IsComponentsV2,
    });

    const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 120000,
    });

    collector.on("collect", async interaction => {
        await interaction.deferUpdate();

        if (interaction.customId === "prev") {
            index = (index - 1 + urls.length) % urls.length;
        } else if (interaction.customId === "next") {
            index = (index + 1) % urls.length;
        } else if (interaction.customId === "steal_emoji") {
            await addEmoji(client, message, urls[index], sep);
        } else if (interaction.customId === "steal_sticker") {
            await addSticker(client, message, urls[index]);
        }

        await msg.edit({ components: [buildContainer()], flags: MessageFlags.IsComponentsV2 });
    });

    collector.on("end", async () => {
        await msg.edit({ components: [buildContainer(true)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    });
}

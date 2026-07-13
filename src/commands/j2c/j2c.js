const { PermissionFlagsBits, ChannelType, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { getConfig, setConfig } = require("../../utils/j2c");
const { buildPanelMessage } = require("../../utils/j2cPanel");

module.exports = {
    name: "j2c",
    aliases: ["joincreate", "j2csetup"],
    description: "Set up (or remove) the Join-2-Create voice room system",
    category: "owner",
    cooldown: 5,
    run: async (client, message, args, prefix) => {

        const box = (text) => ({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.channel.send(box(`${client.emoji.error} | You need the **\`MANAGE_GUILD\`** permission to use this command.`));
        }

        const sub = args[0]?.toLowerCase();

        if (sub === "disable" || sub === "remove") {
            const cfg = getConfig(client, message.guild.id);
            if (!cfg) return message.channel.send(box(`${client.emoji.error} | Join-2-Create isn't set up on this server.`));

            for (const id of [cfg.soloTriggerId, cfg.duoTriggerId, cfg.panelChannelId, cfg.categoryId]) {
                const ch = message.guild.channels.cache.get(id);
                if (ch) await ch.delete("J2C: disabled").catch(() => {});
            }
            client.lmdbDel(`j2c_cfg_${message.guild.id}`);
            return message.channel.send(box(`${client.emoji.tick2} | Join-2-Create has been disabled and its channels removed.`));
        }

        if (sub !== "setup") {
            return message.channel.send(box(
                `${client.emoji.error} | **Usage:**\n` +
                `\`${prefix}j2c setup\` — create the Join-2-Create system\n` +
                `\`${prefix}j2c disable\` — remove it`
            ));
        }

        const existing = getConfig(client, message.guild.id);
        if (existing) {
            return message.channel.send(box(`${client.emoji.error} | Join-2-Create is already set up. Use \`${prefix}j2c disable\` first if you want to recreate it.`));
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.channel.send(box(`${client.emoji.error} | I need the **\`MANAGE_CHANNELS\`** permission to set this up.`));
        }

        const category = await message.guild.channels.create({
            name: "🔊 Join To Create",
            type: ChannelType.GuildCategory,
            reason: "J2C: setup",
        }).catch(() => null);

        if (!category) return message.channel.send(box(`${client.emoji.error} | Couldn't create the category — check my permissions.`));

        const soloTrigger = await message.guild.channels.create({
            name: "➕ Join 2 Create",
            type: ChannelType.GuildVoice,
            parent: category.id,
            reason: "J2C: setup",
        }).catch(() => null);

        const duoTrigger = await message.guild.channels.create({
            name: "➕ Join 2 Create Duo",
            type: ChannelType.GuildVoice,
            parent: category.id,
            userLimit: 2,
            reason: "J2C: setup",
        }).catch(() => null);

        const panelChannel = await message.guild.channels.create({
            name: "room-controls",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                { id: message.guild.id, deny: [PermissionFlagsBits.SendMessages] },
            ],
            reason: "J2C: setup",
        }).catch(() => null);

        if (!soloTrigger || !duoTrigger || !panelChannel) {
            return message.channel.send(box(`${client.emoji.error} | Something failed while creating channels — please try \`${prefix}j2c disable\` then run setup again.`));
        }

        const panelMsg = await panelChannel.send(buildPanelMessage()).catch(() => null);

        setConfig(client, message.guild.id, {
            categoryId: category.id,
            soloTriggerId: soloTrigger.id,
            duoTriggerId: duoTrigger.id,
            panelChannelId: panelChannel.id,
            panelMessageId: panelMsg?.id ?? null,
        });

        return message.channel.send(box(
            `${client.emoji.tick2} | **Join-2-Create is set up!**\n` +
            `-# Join <#${soloTrigger.id}> for a solo room, or <#${duoTrigger.id}> for a 2-person room.\n` +
            `-# Controls live in <#${panelChannel.id}> — only usable while sitting in your own room.`
        ));
    }
};

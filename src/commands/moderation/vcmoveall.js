const { PermissionFlagsBits, ChannelType, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = {
    name: "vcmoveall",
    aliases: ["moveall", "vcmove"],
    description: "Move all members from a voice channel to another voice channel",
    category: "moderation",
    cooldown: 5,
    run: async (client, message, args, prefix) => {

        const errorContainer = (text) => {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return { components: [container], flags: MessageFlags.IsComponentsV2 };
        };

        const successContainer = (text) => {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return { components: [container], flags: MessageFlags.IsComponentsV2 };
        };

        // ─── PERMISSION CHECK ───
        if (!message.member.permissions.has(PermissionFlagsBits.MoveMembers)) {
            return message.channel.send(errorContainer(`${client.emoji.error} | You need the **\`MOVE_MEMBERS\`** permission to use this command.`));
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) {
            return message.channel.send(errorContainer(`${client.emoji.error} | I need the **\`MOVE_MEMBERS\`** permission to move members.`));
        }

        // ─── FIND SOURCE CHANNEL ───
        let sourceChannel = message.member.voice.channel;
        let targetChannel = null;

        const arg1 = args[0];
        const arg2 = args[1];

        if (!arg1 && !sourceChannel) {
            return message.channel.send(errorContainer(
                `${client.emoji.error} | **Usage:**\n` +
                `\`${prefix}vcmoveall <target-channel-id/mention>\` — Move all from your VC to target\n` +
                `\`${prefix}vcmoveall <source-channel-id/mention> <target-channel-id/mention>\` — Move from source to target`
            ));
        }

        // ─── RESOLVE CHANNELS ───
        const resolveChannel = (input) => {
            if (!input) return null;
            const id = input.replace(/[<#>]/g, "");
            const channel = message.guild.channels.cache.get(id);
            if (channel && channel.type === ChannelType.GuildVoice) return channel;
            return message.guild.channels.cache.find(
                c => c.type === ChannelType.GuildVoice && c.name.toLowerCase() === input.toLowerCase()
            ) || null;
        };

        if (arg2) {
            sourceChannel = resolveChannel(arg1);
            targetChannel = resolveChannel(arg2);
        } else if (arg1) {
            targetChannel = resolveChannel(arg1);
        } else if (sourceChannel) {
            return message.channel.send(errorContainer(
                `${client.emoji.error} | Please specify a **target voice channel**.\n` +
                `**Usage:** \`${prefix}vcmoveall <target-channel-id/mention>\``
            ));
        }

        // ─── VALIDATE CHANNELS ───
        if (!sourceChannel) {
            return message.channel.send(errorContainer(`${client.emoji.error} | Could not find the **source voice channel**. Please join a VC or specify it.`));
        }

        if (!targetChannel) {
            return message.channel.send(errorContainer(`${client.emoji.error} | Could not find the **target voice channel**. Please provide a valid VC ID or mention.`));
        }

        if (sourceChannel.id === targetChannel.id) {
            return message.channel.send(errorContainer(`${client.emoji.error} | Source and target channels cannot be the **same**.`));
        }

        // ─── GET MEMBERS TO MOVE ───
        const membersToMove = sourceChannel.members.filter(m => m.id !== message.guild.members.me.id);

        if (membersToMove.size === 0) {
            return message.channel.send(errorContainer(`${client.emoji.error} | No members found in **${sourceChannel.name}** to move.`));
        }

        // ─── MOVE ALL MEMBERS (NO HIERARCHY CHECK) ───
        // Anyone with MoveMembers can move anyone - owner, admin, everyone
        let movedCount = 0;
        let failedCount = 0;

        for (const [, member] of membersToMove) {
            try {
                await member.voice.setChannel(targetChannel, `Moved by ${message.author.tag} via vcmoveall`);
                movedCount++;
            } catch (err) {
                failedCount++;
            }
        }

        // ─── RESULT ───
        let resultText = `${client.emoji.tick2} | **Moved ${movedCount} member${movedCount !== 1 ? 's' : ''}** from **${sourceChannel.name}** to **${targetChannel.name}**.`;

        if (failedCount > 0) {
            resultText += `\n⚠️ **${failedCount}** failed to move (possibly left VC or connection issue).`;
        }

        await message.channel.send(successContainer(resultText));
    }
};

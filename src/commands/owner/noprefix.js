const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

module.exports = {
    name: "noprefix",
    aliases: ["np", "addnp", "removenp"],
    description: "Add or remove no-prefix access for a user",
    category: "owner",
    cooldown: 3,
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

        // ─── ONLY BOT OWNER CAN USE ───
        if (!client.config.owner.includes(message.author.id)) {
            return message.channel.send(errorContainer(`${client.emoji.error} | Only the **bot owner** can use this command.`));
        }

        const subCommand = args[0]?.toLowerCase();
        const targetInput = args[1];

        if (!subCommand || !['add', 'remove', 'list'].includes(subCommand)) {
            return message.channel.send(errorContainer(
                `${client.emoji.error} | **Usage:**\n` +
                `\`${prefix}noprefix add @user\` — Give no-prefix access\n` +
                `\`${prefix}noprefix remove @user\` — Remove no-prefix access\n` +
                `\`${prefix}noprefix list\` — List all no-prefix users`
            ));
        }

        // ─── LIST ───
        if (subCommand === 'list') {
            const npList = await client.db.get("noprefix") || [];
            if (npList.length === 0) {
                return message.channel.send(successContainer(`${client.emoji.info} | No users have no-prefix access.`));
            }

            let listText = `**No-Prefix Users (${npList.length}):**\n\n`;
            for (const entry of npList) {
                const user = await client.users.fetch(entry.userId).catch(() => null);
                listText += `• ${user ? `**${user.username}**` : 'Unknown'} \`(${entry.userId})\`\n`;
            }

            return message.channel.send(successContainer(listText));
        }

        // ─── ADD / REMOVE ───
        if (!targetInput) {
            return message.channel.send(errorContainer(`${client.emoji.error} | Please mention a user or provide their ID.`));
        }

        const targetId = targetInput.replace(/[<@!>]/g, "");
        const targetUser = await client.users.fetch(targetId).catch(() => null);

        if (!targetUser) {
            return message.channel.send(errorContainer(`${client.emoji.error} | Could not find that user.`));
        }

        let npList = await client.db.get("noprefix") || [];

        if (subCommand === 'add') {
            // Check if already in list
            if (npList.some(entry => entry.userId === targetUser.id)) {
                return message.channel.send(errorContainer(`${client.emoji.error} | **${targetUser.username}** already has no-prefix access.`));
            }

            npList.push({ userId: targetUser.id, addedBy: message.author.id, addedAt: Date.now() });
            await client.db.set("noprefix", npList);

            return message.channel.send(successContainer(
                `${client.emoji.tick2} | **${targetUser.username}** [\`${targetUser.id}\`] has been given **no-prefix access**.\n` +
                `They can now use commands without the prefix.`
            ));
        }

        if (subCommand === 'remove') {
            const initialLength = npList.length;
            npList = npList.filter(entry => entry.userId !== targetUser.id);

            if (npList.length === initialLength) {
                return message.channel.send(errorContainer(`${client.emoji.error} | **${targetUser.username}** does not have no-prefix access.`));
            }

            await client.db.set("noprefix", npList);

            return message.channel.send(successContainer(
                `${client.emoji.tick2} | **${targetUser.username}** [\`${targetUser.id}\`] has been **removed** from no-prefix access.`
            ));
        }
    }
};

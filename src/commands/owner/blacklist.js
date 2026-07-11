const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "blacklist",
    aliases: ["bl"],
    description: "Manage user blacklist",
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

        let accessList = await client.db.get(`blacklistaccess_${client.user.id}`) || [];

        if (!client.config.owner.includes(message.author.id) && !accessList.includes(message.author.id)) {
            return reply(`${client.emoji.cross} You are not authorized to use this command.`);
        }

        if (!args[0]) {
            return reply(`${client.emoji.cross} Usage: \`${prefix}blacklist <add/remove/update/reset>\``);
        }

        let db = await client.db.get(`blacklist_${client.user.id}`);
        if (!db) {
            await client.db.set(`blacklist_${client.user.id}`, []);
            db = [];
        }

        let bl = [...db];
        let opt = args[0].toLowerCase();

        let user =
            message.mentions.users.first() ||
            client.users.cache.get(args[1]) ||
            (args[1]?.match(/^\d+$/) ? { id: args[1] } : null);

        let reason = args.slice(2).join(" ") || "No Reason Provided";

        if (["add", "remove"].includes(opt)) {
            let targetId = user?.id;
            if (client.config.owner.includes(targetId)) {
                return message.channel.send({
                    files: [{
                        attachment: "https://cdn.discordapp.com/attachments/1127970897802833980/1438804935893450783/Doraemon_Achha_Laude_Memes.jpeg",
                    }],
                });
            }
        }

        if (opt === "add") {
            if (!user) return reply(`${client.emoji.cross} Please provide a valid user.`);
            if (bl.includes(user.id)) return reply(`${client.emoji.cross} User is already blacklisted.`);

            bl.push(user.id);
            await client.db.set(`blacklist_${client.user.id}`, bl);
            await client.db.set(`blreason_${user.id}`, reason);

            return reply(`${client.emoji.tick} Successfully blacklisted <@${user.id}>`, 0x57F287);
        }

        if (opt === "remove") {
            if (!user) return reply(`${client.emoji.cross} Please provide a valid user.`);
            if (!bl.includes(user.id)) return reply(`${client.emoji.cross} User is not blacklisted.`);

            bl = bl.filter(x => x !== user.id);
            await client.db.set(`blacklist_${client.user.id}`, bl);
            await client.db.delete(`blreason_${user.id}`);

            return reply(`${client.emoji.tick} Removed <@${user.id}> from blacklist`, 0x57F287);
        }

        if (opt === "update") {
            let list = bl.map(id => `${client.emoji.dot || "•"} <@${id}> | \`${id}\``);

            if (!list.length) return reply(`${client.emoji.cross} No blacklisted users.`);

            let ch = client.channels.cache.get(client.config.gban_channel_id);
            if (!ch) return message.channel.send({ content: `${client.emoji.cross} | Channel not found.` });

            let old = await client.db.get(`blmsg_${client.user.id}`);
            if (old) {
                let msg = ch.messages.cache.get(old);
                if (msg) msg.delete().catch(() => {});
            }

            let sent = await ch.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Blacklisted Users"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(list.join("\n")))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Total: ${list.length}`)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
            await client.db.set(`blmsg_${client.user.id}`, sent.id);

            return reply(`${client.emoji.tick} Blacklist updated.`, 0x57F287);
        }

        if (opt === "reset") {
            await client.db.set(`blacklist_${client.user.id}`, []);
            return reply(`${client.emoji.tick} Blacklist reset successfully.`, 0x57F287);
        }
    },
};

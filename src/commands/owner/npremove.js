const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "npremove",
    description: "Remove a user from noprefix list",
    category: "owner",
    cooldown: 3,
    async run(client, message, args) {
        const allowedUsers = [...client.config.owner, ...(client.config.extraowners || [])];
        if (!allowedUsers.includes(message.author.id)) return message.reply("You do not have permission to use this command.");

        const user = message.mentions.users.first();
        if (!user) return message.reply("Please mention a user.");

        let npList = await client.db.get("noprefix") || [];
        npList = npList.filter(entry => entry.userId !== user.id);
        await client.db.set("noprefix", npList);

        return message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${client.emoji.tick} Removed ${user} from the noprefix list.`)
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};

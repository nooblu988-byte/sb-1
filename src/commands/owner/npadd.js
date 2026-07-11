const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require("discord.js");

function parseExpiry(str) {
    const value = parseInt(str.slice(0, -1));
    const unit = str.slice(-1);
    if (isNaN(value)) return null;
    const date = new Date();
    switch (unit) {
        case 'd': date.setDate(date.getDate() + value); break;
        case 'm': date.setMonth(date.getMonth() + value); break;
        default: return undefined; // signal invalid
    }
    return date;
}

function formatDate(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

module.exports = {
    name: "npadd",
    description: "Add a user to noprefix list with optional duration",
    category: "owner",
    cooldown: 3,
    async run(client, message, args) {
        const allowedUsers = [...client.config.owner, ...(client.config.extraowners || [])];
        if (!allowedUsers.includes(message.author.id))
            return message.reply("You do not have permission to use this command.");

        const user = message.mentions.users.first();
        if (!user) return message.reply("Please mention a user.");

        let duration = null;
        if (args[1]) {
            const expiry = parseExpiry(args[1]);
            if (expiry === undefined)
                return message.reply("Invalid time format. Use `1d` for 1 day, `1m` for 1 month, etc.");
            duration = expiry;
        }

        let npList = await client.db.get("noprefix") || [];
        npList = npList.filter(entry => entry.userId !== user.id);
        npList.push({ userId: user.id, expiresAt: duration });
        await client.db.set("noprefix", npList);

        return message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.tick} Added ${user} to the noprefix list${duration ? ` until ${formatDate(duration)}` : ""}.`
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};

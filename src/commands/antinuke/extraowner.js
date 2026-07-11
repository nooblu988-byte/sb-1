const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const c   = (text) => ({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 });

module.exports = {
    name: "extraowner",
    aliases: ["extraowners", "addowner"],
    description: "Manage extra owners for antinuke access",
    category: "antinuke",
    cooldown: 3,
    run: async (client, message, args, prefix) => {
        if (message.author.id !== message.guild.ownerId && !client.config.owner.includes(message.author.id)) {
            return message.channel.send(c(`${client.emoji.cross} Only Guild Owner is allowed to run this command.`));
        }

        let a = await client.db.get(`ownerPermit1_${message.guild.id}`);
        let b = await client.db.get(`ownerPermit2_${message.guild.id}`);

        if (!args[0]) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Extra Owner'))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `${client.emoji.arrow} \`${prefix}extraowner add @user\` — Add an extra owner\n` +
                            `${client.emoji.arrow} \`${prefix}extraowner remove @user\` — Remove an extra owner\n` +
                            `${client.emoji.arrow} \`${prefix}extraowner show\` — List extra owners`
                        )),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        let opt = args[0].toLowerCase();

        if (opt === "show") {
            let ans = "";
            if (a != null) ans += `\n<@${a}>`;
            if (b != null) ans += `\n<@${b}>`;

            if (ans === "") {
                return message.channel.send(c(`${client.emoji.cross} No extra owners in this guild.`));
            }

            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Extra Owners`))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(ans.trim())),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        let user = message.guild.members.cache.get(args[1]) || message.mentions.members.first();
        if (!user) {
            return message.channel.send(c(`${client.emoji.cross} Please provide a valid user.`));
        }

        if (opt === "add") {
            if (a === user.id || b === user.id) {
                return message.channel.send(c(`${client.emoji.cross} ${user} is already in the Extra Owner list.`));
            }

            if (a == null) {
                await client.db.set(`ownerPermit1_${message.guild.id}`, user.id);
            } else if (b == null) {
                await client.db.set(`ownerPermit2_${message.guild.id}`, user.id);
            } else {
                return message.channel.send(c(`${client.emoji.cross} Can't add more than 2 extra owners.`));
            }

            return message.channel.send(c(`${client.emoji.tick} Successfully added ${user} to Extra Owners.`));
        }

        if (opt === "remove") {
            if (user.id === a) {
                await client.db.delete(`ownerPermit1_${message.guild.id}`);
            } else if (user.id === b) {
                await client.db.delete(`ownerPermit2_${message.guild.id}`);
            } else {
                return message.channel.send(c(`${client.emoji.cross} ${user} is not an Extra Owner.`));
            }

            return message.channel.send(c(`${client.emoji.tick} Successfully removed ${user} from Extra Owners.`));
        }
    }
};

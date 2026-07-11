const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
    REST,
    Routes,
} = require('discord.js');
const https = require('https');
const http  = require('http');

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

const send = (message, text) => message.reply({
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
    flags: MessageFlags.IsComponentsV2,
});

module.exports = {
    name: 'setserveravatar',
    aliases: ['ssa', 'serveravatar', 'setguildavatar'],
    description: "Set the bot's avatar for this server only",
    category: 'premium',
    cooldown: 5,

    async run(client, message, args) {
        if (!message.guild) {
            return send(message, `${client.emoji?.cross || '❌'} | This command can only be used in a server.`);
        }
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return send(message, `${client.emoji?.cross || '❌'} | You need **Administrator** permission to use this command.`);
        }

        const attachment = message.attachments.first();
        const imageUrl   = args[0] || (attachment ? attachment.url : null);
        const arrow      = client.emoji?.arrow || '▸';

        if (!imageUrl) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Set Server Avatar'))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `${arrow} \`${client.config.prefix}setserveravatar <image_url>\` — Set with a URL\n` +
                            `${arrow} Attach an image to the message\n` +
                            `${arrow} \`${client.config.prefix}resetserveravatar\` — Reset to default`
                        )),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            return send(message, `${client.emoji?.cross || '❌'} | Please provide a valid image URL.`);
        }

        const statusMsg = await message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('⏳ Updating server avatar...'))],
            flags: MessageFlags.IsComponentsV2,
        });

        try {
            const avatarData = await downloadImage(imageUrl);
            if (!avatarData) {
                return statusMsg.edit({
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji?.cross || '❌'} | Failed to download image. Please check the URL.`))],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            const rest = new REST({ version: '10' }).setToken(client.token);
            await rest.patch(Routes.guildMember(message.guild.id, '@me'), {
                body: { avatar: avatarData },
            });

            await statusMsg.edit({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji?.tick || '✅'} | Server avatar updated successfully!`)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (error) {
            console.error('Server Avatar Error:', error.message);
            await statusMsg.edit({
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji?.cross || '❌'} | Failed to update avatar: ${error.message}`))],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    },
};

function downloadImage(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadImage(response.headers.location).then(resolve);
                return;
            }
            if (response.statusCode !== 200) { resolve(null); return; }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                try {
                    const buffer   = Buffer.concat(chunks);
                    const ext      = url.split('.').pop().split('?')[0].toLowerCase();
                    const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
                    const mimeType = mimeTypes[ext] || 'image/png';
                    resolve(`data:${mimeType};base64,${buffer.toString('base64')}`);
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

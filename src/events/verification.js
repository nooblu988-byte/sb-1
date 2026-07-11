const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const { Resvg } = require("@resvg/resvg-js");

function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCaptcha() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let text = "";
    for (let i = 0; i < 6; i++) text += chars[Math.floor(Math.random() * chars.length)];

    const width  = 300;
    const height = 100;

    let elements = "";

    elements += `<rect width="${width}" height="${height}" fill="#1e1f22"/>`;

    for (let i = 0; i < 120; i++) {
        const r = rnd(60, 160), g = rnd(60, 160), b = rnd(60, 160);
        elements += `<rect x="${rnd(0, width)}" y="${rnd(0, height)}" width="2" height="2" fill="rgba(${r},${g},${b},0.45)"/>`;
    }

    for (let i = 0; i < 8; i++) {
        const r = rnd(80, 200), g = rnd(80, 200), b = rnd(80, 200);
        const lw = rnd(1, 2);
        const x1 = rnd(0, width), y1 = rnd(0, height);
        const cx1 = rnd(0, width), cy1 = rnd(0, height);
        const cx2 = rnd(0, width), cy2 = rnd(0, height);
        const x2  = rnd(0, width), y2  = rnd(0, height);
        elements += `<path d="M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}" stroke="rgba(${r},${g},${b},0.55)" stroke-width="${lw}" fill="none"/>`;
    }

    for (let i = 0; i < text.length; i++) {
        const hue  = rnd(0, 360);
        const size = rnd(36, 44);
        const tx   = 22 + i * 44;
        const ty   = height / 2 + rnd(-10, 10);
        const deg  = ((Math.random() - 0.5) * 0.55 * 180 / Math.PI).toFixed(2);
        elements += `<text x="0" y="0" font-size="${size}" font-family="monospace" font-weight="bold" fill="hsl(${hue},80%,72%)" dominant-baseline="middle" transform="translate(${tx},${ty}) rotate(${deg})">${text[i]}</text>`;
    }

    for (let i = 0; i < 60; i++) {
        const r = rnd(0, 255), g = rnd(0, 255), b = rnd(0, 255);
        elements += `<rect x="${rnd(0, width)}" y="${rnd(0, height)}" width="2" height="2" fill="rgba(${r},${g},${b},0.35)"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${elements}</svg>`;
    const resvg  = new Resvg(svg, { fitTo: { mode: "width", value: width } });
    const buffer = Buffer.from(resvg.render().asPng());

    return { buffer, text };
}

module.exports = (client) => {
    if (!client._verifyCaptcha) client._verifyCaptcha = new Map();

    const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    client.on("interactionCreate", async (interaction) => {

        
        if (interaction.isButton() && interaction.customId === "verify_start") {
            const guildId = interaction.guild?.id;
            if (!guildId) return;

            const cfg = client.lmdbGet(`verify_cfg_${guildId}`);
            if (!cfg) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Verification is not configured.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const member = interaction.member;
            if (member.roles.cache.has(cfg.roleId)) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.enabled2} You are already verified.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const { buffer, text } = generateCaptcha();
            const captchaKey = `${interaction.user.id}_${guildId}`;

            client._verifyCaptcha.set(captchaKey, {
                answer:  text,
                expires: Date.now() + 5 * 60 * 1000,
            });

            const attachment = new AttachmentBuilder(buffer, { name: "captcha.png" });

            return interaction.reply({
                files: [attachment],
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Captcha Verification")
                        )
                        .addSeparatorComponents(sep())
                        .addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL("attachment://captcha.png")
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                "Type the characters shown in the image exactly as they appear.\n-# The code expires in 5 minutes."
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`verify_enter_${guildId}`)
                                    .setLabel("Enter Code")
                                    .setStyle(ButtonStyle.Primary)
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2 | 64,
            });
        }

        
        if (interaction.isButton() && interaction.customId.startsWith("verify_enter_")) {
            const guildId    = interaction.customId.slice("verify_enter_".length);
            const captchaKey = `${interaction.user.id}_${guildId}`;
            const data       = client._verifyCaptcha.get(captchaKey);

            if (!data || Date.now() > data.expires) {
                client._verifyCaptcha.delete(captchaKey);
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Your captcha has expired. Click **Verify** again to get a new one.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`verify_modal_${guildId}`)
                .setTitle("Complete Verification")
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("captcha_answer")
                            .setLabel("Enter the code from the image")
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(6)
                            .setMaxLength(6)
                            .setRequired(true)
                            .setPlaceholder("XXXXXX")
                    )
                );

            return interaction.showModal(modal);
        }

        
        if (interaction.isModalSubmit() && interaction.customId.startsWith("verify_modal_")) {
            const guildId    = interaction.customId.slice("verify_modal_".length);
            const captchaKey = `${interaction.user.id}_${guildId}`;
            const data       = client._verifyCaptcha.get(captchaKey);

            if (!data || Date.now() > data.expires) {
                client._verifyCaptcha.delete(captchaKey);
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Your captcha expired. Click **Verify** again to get a new one.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            const answer = interaction.fields.getTextInputValue("captcha_answer").toUpperCase().trim();

            if (answer !== data.answer) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Incorrect code. Click **Verify** again to get a new captcha.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            
            client._verifyCaptcha.delete(captchaKey);

            const cfg = client.lmdbGet(`verify_cfg_${guildId}`);
            if (!cfg) {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Verification system is not configured. Contact a server admin.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            try {
                await interaction.member.roles.add(cfg.roleId, "Passed captcha verification");
            } catch {
                return interaction.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Failed to assign the verified role. Please contact a server admin.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                });
            }

            return interaction.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.enabled2} **Verification complete!**\nYou now have access to the server.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2 | 64,
            });
        }
    });
};

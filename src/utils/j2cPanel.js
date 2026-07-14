'use strict';

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function buildPanelMessage() {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Voice Control Interface')
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Use the buttons below to manage your temporary voice channel.')
        )
        .addSeparatorComponents(sep());

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_unlock').setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_hide').setLabel('Hide').setEmoji('🙈').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_unhide').setLabel('Unhide').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_limit').setLabel('Limit').setEmoji('👤').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_invite').setLabel('Invite').setEmoji('➕').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_block').setLabel('Ban').setEmoji('👤').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_permit').setLabel('Permit').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_bitrate').setLabel('Bitrate').setEmoji('🎧').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_region').setLabel('Region').setEmoji('🗺️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_reset').setLabel('Template').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_chat').setLabel('Chat').setEmoji('💬').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_waitlist').setLabel('Waiting').setEmoji('🕐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_claim').setLabel('Claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_transfer').setLabel('Transfer').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    );

    container
        .addActionRowComponents(row1)
        .addActionRowComponents(row2)
        .addActionRowComponents(row3)
        .addActionRowComponents(row4);

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = { buildPanelMessage };

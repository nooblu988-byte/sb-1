function getConfig(client, guildId) {
    return client.lmdbGet(`ticket_cfg_${guildId}`) || null;
}
function saveConfig(client, guildId, cfg) {
    return client.lmdbSet(`ticket_cfg_${guildId}`, cfg);
}

function nextTicketNumber(client, guildId) {
    const cur = client.lmdbGet(`ticket_counter_${guildId}`) || 0;
    const next = cur + 1;
    client.lmdbSet(`ticket_counter_${guildId}`, next);
    return next;
}

function getOpenTicket(client, guildId, userId) {
    return client.lmdbGet(`ticket_open_${guildId}_${userId}`) || null;
}
function saveOpenTicket(client, guildId, userId, channelId) {
    return client.lmdbSet(`ticket_open_${guildId}_${userId}`, channelId);
}
function clearOpenTicket(client, guildId, userId) {
    return client.lmdbDel(`ticket_open_${guildId}_${userId}`);
}

module.exports = {
    getConfig,
    saveConfig,
    nextTicketNumber,
    getOpenTicket,
    saveOpenTicket,
    clearOpenTicket,
};

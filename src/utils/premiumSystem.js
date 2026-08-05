const crypto = require("crypto");

const PLANS = [
    { id: "monthly",   label: "1 Month",  price: 500,  durationDays: 30 },
    { id: "quarterly", label: "3 Months", price: 900,  durationDays: 90 },
    { id: "biannual",  label: "6 Months", price: 1800, durationDays: 180 },
];

const KEY_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I

function getPlan(planId) {
    return PLANS.find(p => p.id === planId) || null;
}

// ─── Premium status ───────────────────────────────────────────────────
function getStatus(client, guildId) {
    return client.lmdbGet(`premium_status_${guildId}`) || null;
}
function saveStatus(client, guildId, status) {
    return client.lmdbSet(`premium_status_${guildId}`, status);
}
function deleteStatus(client, guildId) {
    return client.lmdbDel?.(`premium_status_${guildId}`) ?? client.lmdbSet(`premium_status_${guildId}`, null);
}

function isPremiumActive(client, guildId) {
    const status = getStatus(client, guildId);
    return !!status?.active && status.expiresAt > Date.now();
}

// ─── Pending approval request (server owner asked, awaiting bot owner) ─
function getRequest(client, guildId) {
    return client.lmdbGet(`premium_request_${guildId}`) || null;
}
function saveRequest(client, guildId, request) {
    return client.lmdbSet(`premium_request_${guildId}`, request);
}
function clearRequest(client, guildId) {
    return client.lmdbSet(`premium_request_${guildId}`, null);
}

// ─── Pending redemption key (approved, awaiting server owner to redeem) ─
function getPendingKey(client, guildId) {
    return client.lmdbGet(`premium_key_${guildId}`) || null;
}
function savePendingKey(client, guildId, data) {
    return client.lmdbSet(`premium_key_${guildId}`, data);
}
function clearPendingKey(client, guildId) {
    return client.lmdbSet(`premium_key_${guildId}`, null);
}

function generateKey() {
    const bytes = crypto.randomBytes(16);
    let raw = "";
    for (let i = 0; i < 16; i++) raw += KEY_CHARSET[bytes[i] % KEY_CHARSET.length];
    return raw.match(/.{1,4}/g).join("-"); // XXXX-XXXX-XXXX-XXXX
}

// ─── Activation ────────────────────────────────────────────────────────
function activatePremium(client, guildId, planId) {
    const plan = getPlan(planId);
    if (!plan) return null;

    const now = Date.now();
    const status = {
        active: true,
        plan: planId,
        activatedAt: now,
        expiresAt: now + plan.durationDays * 24 * 60 * 60 * 1000,
    };
    saveStatus(client, guildId, status);
    return status;
}

// ─── Background expiry ticker — disables Beast Mode when premium lapses ─
function startPremiumTicker(client) {
    if (client._premiumTickerStarted) return;
    client._premiumTickerStarted = true;

    setInterval(() => {
        try {
            const range = client.lmdb.getRange({ start: "premium_status_", end: "premium_status_~" });
            for (const { key, value } of range) {
                if (!value?.active) continue;
                if (value.expiresAt > Date.now()) continue;

                const guildId = String(key).slice("premium_status_".length);
                saveStatus(client, guildId, { ...value, active: false });

                // Premium lapsed — turn Beast Mode off if it was on.
                const heatCfg = client.lmdbGet(`heat_cfg_${guildId}`);
                if (heatCfg?.enabled) {
                    client.lmdbSet(`heat_cfg_${guildId}`, { ...heatCfg, enabled: false });
                }

                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    guild.members.fetch(guild.ownerId).then(owner => {
                        owner.send(
                            `Your Beast Mode premium subscription for **${guild.name}** has expired, so Beast Mode has been turned off. Run \`premium\` to renew.`
                        ).catch(() => {});
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error("[Premium Ticker Error]", err);
        }
    }, 60_000);
}

module.exports = {
    PLANS,
    getPlan,
    getStatus,
    saveStatus,
    deleteStatus,
    isPremiumActive,
    getRequest,
    saveRequest,
    clearRequest,
    getPendingKey,
    savePendingKey,
    clearPendingKey,
    generateKey,
    activatePremium,
    startPremiumTicker,
};

const { startDecayTicker } = require("../utils/heatSystem");

module.exports = (client) => {
    client.once("clientReady", () => {
        startDecayTicker(client);
    });
};

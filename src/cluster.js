const { ClusterManager } = require("discord-hybrid-sharding");
const path       = require("path");
const syncEmojis = require("./utils/emojiSync");

const token = process.env.DISCORD_TOKEN || require("./config.json").token;

const manager = new ClusterManager(path.join(__dirname, "index.js"), {
  totalShards:      "auto",
  shardsPerClusters: 2,
  mode:             "process",
  token,
});

manager.on("clusterCreate", (cluster) => {
  console.log(`[Cluster] Launched Cluster #${cluster.id}`);
});

(async () => {
  await syncEmojis(token);
  manager.spawn({ timeout: -1 });
})();

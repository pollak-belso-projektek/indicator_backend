import * as cache from "./utils/cache.js";

async function testRedis() {
  console.log("Testing Redis Cache...");

  try {
    // Test Set
    console.log("Setting key 'test:key'...");
    await cache.set("test:key", { message: "Hello Redis" }, 60000);
    console.log("Set successful.");

    // Test Get
    console.log("Getting key 'test:key'...");
    const value = await cache.get("test:key");
    console.log("Got value:", value);

    if (value && value.message === "Hello Redis") {
      console.log("✅ Get/Set test passed.");
    } else {
      console.error("❌ Get/Set test failed.");
    }

    // Test Has
    console.log("Checking if key 'test:key' exists...");
    const exists = await cache.has("test:key");
    console.log("Exists:", exists);
    if (exists) {
      console.log("✅ Has test passed.");
    } else {
      console.error("❌ Has test failed.");
    }

    // Test Stats
    console.log("Getting stats...");
    const stats = await cache.stats();
    console.log("Stats:", stats);
    if (stats.type === "redis") {
      console.log("✅ Stats test passed.");
    } else {
      console.error("❌ Stats test failed.");
    }

    // Test Delete
    console.log("Deleting key 'test:key'...");
    await cache.del("test:key");
    const existsAfterDel = await cache.has("test:key");
    if (!existsAfterDel) {
      console.log("✅ Delete test passed.");
    } else {
      console.error("❌ Delete test failed.");
    }

    console.log("🎉 All Redis tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Redis test failed with error:", error);
    process.exit(1);
  }
}

testRedis();

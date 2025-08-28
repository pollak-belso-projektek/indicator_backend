#!/usr/bin/env node

import { generateApiKey, hashApiKey } from "./middleware/apiKey.middleware.js";

/**
 * Utility script to generate secure API keys for the gateway
 */

console.log("🔑 API Key Generator for Gateway Service");
console.log("=====================================\n");

// Generate a new API key
const apiKey = generateApiKey(32);
const hashedKey = hashApiKey(apiKey);

console.log("Generated API Key:");
console.log(`${apiKey}`);
console.log("\nHashed version (for logging/storage):");
console.log(`${hashedKey}`);

console.log("\n📝 Configuration:");
console.log("Add this to your .env file:");
console.log(`API_KEYS=${apiKey}`);

console.log("\n🌐 Frontend Usage:");
console.log("Include this header in your frontend requests:");
console.log(`X-API-Key: ${apiKey}`);
console.log("\nOr as Authorization header:");
console.log(`Authorization: Bearer ${apiKey}`);

console.log("\n⚠️  Security Notes:");
console.log("• Store this API key securely");
console.log("• Never commit the actual API key to version control");
console.log("• Use different keys for different environments");
console.log("• Rotate keys regularly for better security");
console.log(
  "• The hashed version can be used for logging without exposing the key"
);

#!/usr/bin/env node

import axios from "axios";

/**
 * Test script for API key functionality
 */

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5000";
const API_KEY = process.env.API_KEY || "your_api_key_here";

console.log("🧪 Testing API Key Authentication");
console.log("================================\n");

// Test 1: Request without API key (should fail)
async function testWithoutApiKey() {
  try {
    console.log("Test 1: Request WITHOUT API key");
    const response = await axios.get(`${GATEWAY_URL}/api/v1/health`);
    console.log("❌ Expected failure but got success:", response.status);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("✅ Correctly blocked request without API key");
    } else {
      console.log(
        "❓ Unexpected error:",
        error.response?.status,
        error.message
      );
    }
  }
  console.log("");
}

// Test 2: Request with invalid API key (should fail)
async function testWithInvalidApiKey() {
  try {
    console.log("Test 2: Request with INVALID API key");
    const response = await axios.get(`${GATEWAY_URL}/api/v1/health`, {
      headers: { "X-API-Key": "invalid_key_123" },
    });
    console.log("❌ Expected failure but got success:", response.status);
  } catch (error) {
    if (error.response?.status === 403) {
      console.log("✅ Correctly blocked request with invalid API key");
    } else {
      console.log(
        "❓ Unexpected error:",
        error.response?.status,
        error.message
      );
    }
  }
  console.log("");
}

// Test 3: Request with valid API key (should succeed)
async function testWithValidApiKey() {
  try {
    console.log("Test 3: Request with VALID API key");
    const response = await axios.get(`${GATEWAY_URL}/api/v1/health`, {
      headers: { "X-API-Key": API_KEY },
    });
    console.log(
      "✅ Successfully accessed with valid API key:",
      response.status
    );
  } catch (error) {
    console.log(
      "❌ Failed with valid API key:",
      error.response?.status,
      error.message
    );
  }
  console.log("");
}

// Test 4: Public route (should work without API key)
async function testPublicRoute() {
  try {
    console.log("Test 4: Public route (health check)");
    const response = await axios.get(`${GATEWAY_URL}/health`);
    console.log("✅ Public route accessible without API key:", response.status);
  } catch (error) {
    console.log(
      "❌ Public route failed:",
      error.response?.status,
      error.message
    );
  }
  console.log("");
}

// Run all tests
async function runTests() {
  console.log(`Testing against: ${GATEWAY_URL}`);
  console.log(`Using API key: ${API_KEY.substring(0, 8)}...`);
  console.log("");

  await testWithoutApiKey();
  await testWithInvalidApiKey();
  await testWithValidApiKey();
  await testPublicRoute();

  console.log("Testing complete! 🎉");
}

// Check if axios is available
try {
  runTests();
} catch (error) {
  console.log("❌ Error: axios not found. Install it with: npm install axios");
  console.log("Or run this script after setting up the gateway dependencies.");
}

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

import mongoose from "mongoose";
import config from "../src/config/index.js";

let mongoConnection;

beforeAll(async () => {
  const testUri = config.mongo.testUri || config.mongo.uri.replace(/\/[^/]+$/, "/prashiskshan_test");
  mongoConnection = await mongoose.connect(testUri);
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
  } catch (error) {
    console.error("Error during test cleanup:", error);
  }
});

afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    // Ignore cleanup errors in afterEach
  }
});


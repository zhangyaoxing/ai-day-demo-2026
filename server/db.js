import { MongoClient } from "mongodb";
import { config } from "./config.js";

let client;
let db;
let coll;

export async function connect() {
  if (coll) return coll;
  client = new MongoClient(config.mongo.uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  db = client.db(config.mongo.db);
  coll = db.collection(config.mongo.collection);
  return coll;
}

export function getCollection() {
  if (!coll) throw new Error("MongoDB not connected. Call connect() first.");
  return coll;
}

export async function ping() {
  if (!db) await connect();
  await db.command({ ping: 1 });
  return true;
}

export async function close() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
  coll = undefined;
}

/**
 * Atlas Vector Search over the autoEmbed "text" field.
 * Atlas embeds `query` with the model configured on the index.
 */
export async function vectorSearch(query, { numCandidates = 100, limit = 8 } = {}) {
  const c = getCollection();
  const results = await c
    .aggregate([
      {
        $vectorSearch: {
          index: config.mongo.indexName,
          path: "text",
          query,
          numCandidates,
          limit,
        },
      },
      {
        $project: {
          _id: 1,
          docId: 1,
          source: 1,
          title: 1,
          section: 1,
          text: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();
  return results;
}

import { config } from "../server/config.js";
import { connect, close, getCollection } from "../server/db.js";
import { corpus } from "./corpus.js";

const EMBED_MODEL = process.env.VECTOR_EMBED_MODEL || "voyage-4";
const EMBED_DIMS = parseInt(process.env.VECTOR_EMBED_DIMS || "1024", 10);

function flatten() {
  const docs = [];
  for (const doc of corpus) {
    doc.chunks.forEach((chunk, i) => {
      docs.push({
        docId: doc.docId,
        source: doc.source,
        title: doc.title,
        section: chunk.section || null,
        chunkIndex: i,
        text: chunk.text,
      });
    });
  }
  return docs;
}

async function waitForQueryable(coll, name, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    const indexes = await coll.listSearchIndexes().toArray();
    const idx = indexes.find((x) => x.name === name);
    if (idx && (idx.queryable === true || idx.status === "READY")) return true;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

async function main() {
  if (!config.mongo.uri) throw new Error("MONGODB_URI is not set.");

  await connect();
  const coll = getCollection();

  // 1. Insert the corpus (plain text; Atlas generates embeddings).
  const docs = flatten();
  await coll.deleteMany({});
  await coll.insertMany(docs);
  console.log(`Inserted ${docs.length} chunks into "${config.mongo.db}.${config.mongo.collection}".`);

  // 2. Create the autoEmbed vector search index.
  const definition = {
    fields: [
      {
        type: "autoEmbed",
        modality: "text",
        path: "text",
        model: EMBED_MODEL,
        numDimensions: EMBED_DIMS,
        similarity: "cosine",
      },
    ],
  };

  const existing = await coll.listSearchIndexes().toArray();
  if (existing.some((i) => i.name === config.mongo.indexName)) {
    console.log(`Index "${config.mongo.indexName}" already exists; dropping before recreating.`);
    await coll.dropSearchIndex(config.mongo.indexName);
  }

  await coll.createSearchIndex({
    name: config.mongo.indexName,
    type: "vectorSearch",
    definition,
  });
  console.log(
    `Created vector search index "${config.mongo.indexName}" (autoEmbed, model=${EMBED_MODEL}, dims=${EMBED_DIMS}).`
  );

  // 3. Poll until the index is queryable.
  console.log("Waiting for the index to become queryable (this can take a minute or two)...");
  const ready = await waitForQueryable(coll, config.mongo.indexName);
  if (ready) {
    console.log(`Index "${config.mongo.indexName}" is ready and queryable.`);
  } else {
    console.warn(
      `Index "${config.mongo.indexName}" is not queryable yet. It may still be building — check it in the Atlas UI (Search & Vector Search).`
    );
  }

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

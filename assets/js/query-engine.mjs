import * as duckdbduckdbWasm from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.1-dev215.0/+esm";
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

window.duckdbduckdbWasm = duckdbduckdbWasm;

const transformersEmbeddingsModel = 'Snowflake/snowflake-arctic-embed-l';

queueMicrotask(async () => {
  // Don't load these models on mobile
  if (window.innerWidth <= 768) {
    return;
  }

  // Load transformers.js otherwise
  try {
    console.time(`Initializing transformers.js pipeline with ${transformersEmbeddingsModel}`);

    env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/";
    window.pipe = await pipeline('feature-extraction', transformersEmbeddingsModel);

    console.timeEnd(`Initializing transformers.js pipeline with ${transformersEmbeddingsModel}`);
  } catch (error) {
    console.warn('Failed to initialize pipeline:', error);
  }
})

const getJsDelivrBundles = () => {
  const jsdelivr_dist_url = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.1-dev181.0/dist/`;
  return {
    mvp: {
      mainModule: `${jsdelivr_dist_url}duckdb-mvp.wasm`,
      mainWorker: `${jsdelivr_dist_url}duckdb-browser-mvp.worker.js`,
    },
    eh: {
      mainModule: `${jsdelivr_dist_url}duckdb-eh.wasm`,
      mainWorker: `${jsdelivr_dist_url}duckdb-browser-eh.worker.js`,
    },
  };
}

const files = [
  `${window.location.origin}/db/load.sql`,
  `${window.location.origin}/db/schema.sql`,
  `${window.location.origin}/db/vault.parquet`,
];

// Function to fetch a file and check if it's updated
const fetchAndCheck = async (file) => {
  try {
    // Fetch the file
    const response = await fetch(file);
    // Get the Last-Modified and ETag headers
    const lastModified = response.headers.get('Last-Modified');
    const eTag = response.headers.get('ETag');

    // Get the cached response
    const cachedResponse = await caches.match(file);
    if (cachedResponse) {
      // Get the cached Last-Modified and ETag headers
      const cachedLastModified = cachedResponse.headers.get('Last-Modified');
      const cachedETag = cachedResponse.headers.get('ETag');

      if (lastModified !== cachedLastModified || eTag !== cachedETag) {
        console.log('File has been updated:', file);
        // The file has been updated, you can now update the cache
        return true;
      } else {
        console.log('File has not been updated:', file);
        return false;
      }
    } else {
      console.log('File is not in cache, adding now:', file);
      return true;
    }
  } catch (error) {
    console.log('Error fetching or checking file:', error);
    return false;
  }
};

// Open (or create) a cache
caches.open('vault-cache').then(async (cache) => {
  try {
    // Check all the files
    await Promise.all(
      files.map(async (file) => {
        const isUpdated = await fetchAndCheck(file);
        if (isUpdated) {
          // If the file is updated or not in cache, add it to the cache
          await cache.add(file);
        }
      }));
    console.log('Files have been checked and updated in cache');
  } catch (error) {
    console.log('Error checking or caching files:', error);
  }
});

window._conn_whnf_thunk = null;

const getDuckDB = async () => {
  // If the connection promise exists, wait for it to resolve
  if (window._conn_whnf_thunk) {
    return await window._conn_whnf_thunk;
  }

  // If the database and connection are already established, return the existing connection
  if (window._db && window._conn) {
    return window._conn;
  }

  // Create a promise that will hold the connection
  window._conn_whnf_thunk = new Promise(async (resolve, reject) => {
    try {
      const duckdb = window.duckdbduckdbWasm;
      const JSDELIVR_BUNDLES = getJsDelivrBundles();

      // Select a bundle based on browser checks
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: "text/javascript",
        })
      );

      // Instantiate the asynchronus version of DuckDB-wasm
      const worker = new Worker(worker_url);
      // const logger = null //new duckdb.ConsoleLogger();
      const logger = new duckdb.ConsoleLogger();
      // After instantiating the database, create a connection
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(worker_url);
      window._db = db;

      // Create a connection to the database
      const conn = await db.connect();
      window._conn = conn;

      console.time('Loading memo DuckDB');
      await conn.query(`IMPORT DATABASE '${window.location.origin}/db'`);
      console.timeEnd('Loading memo DuckDB');

      queueMicrotask(async () => {
        console.time('Indexing vault with FTS');
        await conn.query('INSTALL fts');
        await conn.query('LOAD fts');
        await conn.query("PRAGMA create_fts_index('vault', 'file_path', 'title', 'md_content', 'tags', 'authors')");
        console.timeEnd('Indexing vault with FTS');
      })

      queueMicrotask(async () => {
        console.time('Indexing embeddings with HNSW');
        await conn.query('INSTALL vss');
        await conn.query('LOAD vss');
        await conn.query("CREATE INDEX emb_openai_hnsw_index ON vault USING HNSW (embeddings_openai)")
        await conn.query("CREATE INDEX emb_spr_custom_hnsw_index ON vault USING HNSW (embeddings_spr_custom)")
        console.timeEnd('Indexing embeddings with HNSW');
      })

      // Reset the promise since the connection is established
      window._conn_whnf_thunk = null;

      // Return the connection
      resolve(conn);
    } catch (error) {
      reject(error);
    }
  });

  // Return the result of the promise
  return await window._conn_whnf_thunk;
};

window.getDuckDB = getDuckDB;

const parseDuckDBData = (data) => JSON.parse(JSON.stringify(data.toArray(), (key, value) =>
  typeof value === 'bigint'
    ? value.toString()
    : value
))

window.parseDuckDBData = parseDuckDBData;

const getEmbeddings = async (query) => {
  console.time('Embedding query')
  const res = window.pipe ? await window.pipe(query, { pooling: 'mean', normalize: true }) : [];
  console.timeEnd('Embedding query')
  return res;
}

window.getEmbeddings = getEmbeddings;
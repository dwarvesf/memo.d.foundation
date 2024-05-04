import * as duckdbduckdbWasm from "https://fastly.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.1-dev181.0/+esm";
import { pipeline, env } from 'https://fastly.jsdelivr.net/npm/@xenova/transformers@2.17.1';
import ollama from 'https://esm.run/ollama@0.5.0/browser';

window.duckdbduckdbWasm = duckdbduckdbWasm;

const ollamaModel = 'snowflake-arctic-embed:335m';
const transformersModel = 'Snowflake/snowflake-arctic-embed-l';
let embeddingsLoaded = false;

queueMicrotask(async () => {
  // Don't load these models on mobile
  if (window.innerWidth <= 768) {
    return;
  }

  // Load ollama
  try {
    console.time(`Initializing ollama with ${ollamaModel}`)

    const modelList = await ollama.list();
    const modelExists = modelList.models.some((model) => model.name === ollamaModel)
    if (!modelExists) {
      console.info(`Pulling ${ollamaModel} in ollama...`)
      await ollama.pull({ model: ollamaModel });
    }
    window.ollama = ollama;

    embeddingsLoaded = true;
    console.timeEnd(`Initializing ollama with ${ollamaModel}`);
  } catch (error) {
    console.warn('Failed to initialize ollama:', error);
  }

  // Skip transformers.js if embeddings are loaded from ollama
  if (embeddingsLoaded) {
    return;
  }

  // Load transformers.js otherwise
  try {
    console.time(`Initializing transformers.js pipeline with ${transformersModel}`);

    env.backends.onnx.wasm.wasmPaths = "https://fastly.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/";
    window.pipe = await pipeline('feature-extraction', transformersModel);

    embeddingsLoaded = true;
    console.timeEnd(`Initializing transformers.js pipeline with ${transformersModel}`);
  } catch (error) {
    console.warn('Failed to initialize pipeline:', error);
  }
})

const getJsDelivrBundles = () => {
  const jsdelivr_dist_url = `https://fastly.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.1-dev181.0/dist/`;
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
      await conn.query(`IMPORT DATABASE '${window.location.origin}/db/'`);
      await conn.query('INSTALL fts');
      await conn.query('LOAD fts');
      await conn.query("PRAGMA create_fts_index('vault', 'file_path', 'title', 'md_content', 'tags', 'authors')");
      console.timeEnd('Loading memo DuckDB');

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
  let res;
  let embeddingsType;

  console.time('Embedding query')
  try {
    embeddingsType = 'Embedded with ollama';
    res = await window.ollama.embeddings({ model: ollamaModel, prompt: query })
      .then((value) => ({ data: value.embedding }));
  } catch {
    embeddingsType = 'Embedded with transformers.js';
    res = window.pipe ? await window.pipe(query, { pooling: 'mean', normalize: true }) : [];
  }

  console.timeEnd('Embedding query')
  console.info(embeddingsType);
  return res;
}

window.getEmbeddings = getEmbeddings;
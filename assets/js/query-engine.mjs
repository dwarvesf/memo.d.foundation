import * as duckdbduckdbWasm from "https://fastly.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

window.duckdbduckdbWasm = duckdbduckdbWasm;

class EventQueue {
  constructor(delay, event) {
    this.queue = [];
    this.isProcessing = false;
    this.delay = delay;
    this.event = event
  }

  add(text) {
    this.queue.push(text);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const text = this.queue.shift();
      this.dispatchEvent(text);
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    this.isProcessing = false;
  }

  dispatchEvent(text) {
    const event = new CustomEvent(this.event, { detail: { text } });
    window.dispatchEvent(event);
  }
}

const getJsDelivrBundles = () => {
  const jsdelivr_dist_url = `https://fastly.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/`;
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

const eventQueue = new EventQueue(500, 'command-palette-search-initialize');
const dispatchSearchPlaceholder = (text) => {
  eventQueue.add(text)
}

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

      dispatchSearchPlaceholder('Initializing Search: Loading memo DuckDB...')
      console.time('Loading memo DuckDB');
      await conn.query(`IMPORT DATABASE '${window.location.origin}/db'`);
      console.timeEnd('Loading memo DuckDB');

      queueMicrotask(async () => {
        dispatchSearchPlaceholder('Initializing Search: Indexing vault with FTS...')
        console.time('Indexing vault with FTS');
        await conn.query('INSTALL fts');
        await conn.query('LOAD fts');
        await conn.query("PRAGMA create_fts_index('vault', 'file_path', 'title', 'md_content', 'tags', 'authors')");
        console.timeEnd('Indexing vault with FTS');
        dispatchSearchPlaceholder('Search')
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

getDuckDB();
window.getDuckDB = getDuckDB;

const parseDuckDBData = (data) => JSON.parse(JSON.stringify(data.toArray(), (key, value) =>
  typeof value === 'bigint'
    ? value.toString()
    : value
))

window.parseDuckDBData = parseDuckDBData;

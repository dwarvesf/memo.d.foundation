import * as duckdbduckdbWasm from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.1-dev181.0/+esm";
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

window.duckdbduckdbWasm = duckdbduckdbWasm;
(async () => {
  // Check if the user is on a mobile device by screen width
  if (window.innerWidth > 768) { // Assuming a mobile device has a width of 768 pixels or less
    try {
      window.pipe = await pipeline('feature-extraction', 'Snowflake/snowflake-arctic-embed-l');
    } catch (error) {
      console.error('Failed to initialize pipeline:', error);
    }
  }
})();

const getDuckDB = async () => {
  const duckdb = window.duckdbduckdbWasm;
  if (window._db) return window._db;
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

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
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  window._db = db;
  
  const conn = await db.connect();

  console.time('Loading memo DuckDB')
  await conn.query("IMPORT DATABASE 'https://memo.d.foundation/db/'")
  await conn.query('INSTALL fts');
  await conn.query('LOAD fts');
  await conn.query("PRAGMA create_fts_index('vault', 'file_path', 'md_content')")
  console.timeEnd('Loading memo DuckDB')

  return conn;
};

window.getDuckDB = getDuckDB;

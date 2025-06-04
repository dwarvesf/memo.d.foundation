import path from 'path';
import { DuckDBInstance } from '@duckdb/node-api';

// Create a map to store DuckDB instances by file path
const duckdbInstances: Map<string, DuckDBInstance> = new Map();

/**
 * Execute a SQL query against a DuckDB database using the specified parquet file
 *
 * @param sql The SQL query to execute
 * @param filePath The path to the parquet file (can be local path, http(s):// or s3:// URL)
 * @param authSql The SQL query to execute to authenticate the connection to the remote file system
 * @returns The query result as an array of objects
 */
export async function queryDuckDB(
  sql: string,
  options: { filePath?: string; tableName?: string; authSql?: string } = {},
) {
  const filePath = options.filePath || 'db/vault.parquet';
  const tableName = options.tableName || 'vault';
  try {
    // Determine if the path is remote (http(s):// or s3://) or local
    const isRemote =
      filePath.startsWith('http://') ||
      filePath.startsWith('https://') ||
      filePath.startsWith('s3://') ||
      filePath.startsWith('gs://');

    // Get the actual path - for local files, make it absolute
    const parquetPath = isRemote
      ? filePath
      : path.join(process.cwd(), filePath);

    // Create or reuse a DuckDB instance for the given file path
    if (!duckdbInstances.has(parquetPath)) {
      const instance = await DuckDBInstance.create(':memory:');
      duckdbInstances.set(parquetPath, instance);
    }

    const duckdbInstance = duckdbInstances.get(parquetPath);

    if (!duckdbInstance) {
      throw new Error('Failed to retrieve DuckDB instance.');
    }

    // Create connection
    const connection = await duckdbInstance.connect();

    if (isRemote) {
      await connection.run(
        `
        INSTALL httpfs;
        LOAD httpfs;
      `,
      );

      if (options.authSql) {
        await connection.run(options.authSql);
      }
    }

    // Register the parquet file as a table
    await connection.run(
      `CREATE VIEW IF NOT EXISTS ${tableName} AS SELECT * FROM parquet_scan('${parquetPath}');`,
    );

    // Execute the query and get all results at once
    const result = await connection.runAndReadAll(sql);

    // Convert result to JSON compatible format for easier handling
    const jsonData = await result.getRowObjectsJson();

    // Close only the connection, keeping the instance for future queries
    await connection.closeSync();
    return jsonData;
  } catch (error) {
    console.error('Error executing DuckDB query:', error);
    throw error;
  }
}

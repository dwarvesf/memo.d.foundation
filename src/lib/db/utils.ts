import path from 'path';
import { DuckDBInstance } from '@duckdb/node-api';

// Create a singleton instance for reuse
let duckdbInstance: DuckDBInstance | null = null;

/**
 * Execute a SQL query against a DuckDB database using the vault.parquet file
 *
 * @param sql The SQL query to execute
 * @returns The query result as an array of objects
 */
export async function queryDuckDB(sql: string) {
  try {
    // Path to the vault.parquet file
    const parquetPath = path.join(process.cwd(), 'db', 'vault.parquet');

    // Create or reuse an in-memory database instance
    if (!duckdbInstance) {
      duckdbInstance = await DuckDBInstance.create(':memory:');
    }

    // Create connection
    const connection = await duckdbInstance.connect();

    // Register the parquet file as a table
    await connection.run(
      `CREATE VIEW IF NOT EXISTS vault AS SELECT * FROM parquet_scan('${parquetPath}');`,
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

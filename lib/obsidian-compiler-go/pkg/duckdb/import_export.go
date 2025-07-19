package duckdb

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ImportDatabase imports a database from parquet files or creates tables if import fails
func (db *DB) ImportDatabase(importPath string) error {
	// Check if import path exists
	if _, err := os.Stat(importPath); os.IsNotExist(err) {
		// No existing database to import, create tables
		return db.CreateTables()
	}

	// Try to import the database
	query := fmt.Sprintf("IMPORT DATABASE '%s'", importPath)
	if err := db.Execute(query); err != nil {
		// Import failed, create tables instead
		fmt.Printf("Failed to import database: %v\nCreating tables instead...\n", err)
		return db.CreateTables()
	}

	return nil
}

// ExportDatabase exports the database to the specified format
func (db *DB) ExportDatabase(exportPath string, format string) error {
	// Ensure export directory exists
	if err := os.MkdirAll(exportPath, 0755); err != nil {
		return fmt.Errorf("failed to create export directory: %w", err)
	}

	// Export based on format
	switch strings.ToLower(format) {
	case "parquet":
		return db.exportToParquet(exportPath)
	case "csv":
		return db.exportToCSV(exportPath)
	default:
		return fmt.Errorf("unsupported export format: %s", format)
	}
}

func (db *DB) exportToParquet(exportPath string) error {
	query := fmt.Sprintf("EXPORT DATABASE '%s' (FORMAT PARQUET)", exportPath)
	if err := db.Execute(query); err != nil {
		return fmt.Errorf("failed to export to parquet: %w", err)
	}

	// Clean up schema file (remove information_schema and duckdb_temporary_files)
	schemaPath := filepath.Join(exportPath, "schema.sql")
	if err := cleanSchemaFile(schemaPath); err != nil {
		return fmt.Errorf("failed to clean schema file: %w", err)
	}

	return nil
}

func (db *DB) exportToCSV(exportPath string) error {
	// First export to parquet (DuckDB doesn't have direct CSV database export)
	tempPath := filepath.Join(exportPath, "temp")
	if err := db.exportToParquet(tempPath); err != nil {
		return err
	}
	defer os.RemoveAll(tempPath)

	// Convert parquet files to CSV
	tables := []string{"vault", "processing_metadata"}
	for _, table := range tables {
		parquetFile := filepath.Join(tempPath, table+".parquet")
		csvFile := filepath.Join(exportPath, table+".csv")

		// Check if parquet file exists
		if _, err := os.Stat(parquetFile); os.IsNotExist(err) {
			continue
		}

		// Convert parquet to CSV
		query := fmt.Sprintf("COPY (SELECT * FROM read_parquet('%s')) TO '%s' (FORMAT CSV, HEADER)", 
			parquetFile, csvFile)
		if err := db.Execute(query); err != nil {
			return fmt.Errorf("failed to convert %s to CSV: %w", table, err)
		}
	}

	// Copy schema file
	srcSchema := filepath.Join(tempPath, "schema.sql")
	dstSchema := filepath.Join(exportPath, "schema.sql")
	if err := copyFile(srcSchema, dstSchema); err != nil {
		return fmt.Errorf("failed to copy schema file: %w", err)
	}

	return nil
}

func cleanSchemaFile(schemaPath string) error {
	content, err := os.ReadFile(schemaPath)
	if err != nil {
		return err
	}

	// Remove lines containing information_schema or duckdb_temporary_files
	lines := strings.Split(string(content), "\n")
	var cleanedLines []string
	skip := false

	for _, line := range lines {
		if strings.Contains(line, "information_schema") || 
		   strings.Contains(line, "duckdb_temporary_files") {
			skip = true
		}
		if !skip {
			cleanedLines = append(cleanedLines, line)
		}
		// Reset skip after semicolon (end of statement)
		if strings.Contains(line, ";") {
			skip = false
		}
	}

	cleanedContent := strings.Join(cleanedLines, "\n")
	return os.WriteFile(schemaPath, []byte(cleanedContent), 0644)
}

func copyFile(src, dst string) error {
	content, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, content, 0644)
}
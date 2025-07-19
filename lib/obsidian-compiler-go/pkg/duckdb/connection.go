package duckdb

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/marcboeker/go-duckdb"
)

type DB struct {
	conn *sql.DB
	path string
}

func NewDB(path string) (*DB, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Ensure the directory exists
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	conn, err := sql.Open("duckdb", absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable parquet extension
	if _, err := conn.Exec("INSTALL parquet; LOAD parquet;"); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to load parquet extension: %w", err)
	}

	return &DB{conn: conn, path: absPath}, nil
}

func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

func (db *DB) Execute(query string, args ...interface{}) error {
	_, err := db.conn.Exec(query, args...)
	return err
}

func (db *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return db.conn.Query(query, args...)
}

func (db *DB) QueryRow(query string, args ...interface{}) *sql.Row {
	return db.conn.QueryRow(query, args...)
}

func (db *DB) Begin() (*sql.Tx, error) {
	return db.conn.Begin()
}

// ExecuteTemp creates a temporary database, imports data, executes query
func ExecuteTemp(query string, importPath string) (*sql.Rows, error) {
	conn, err := sql.Open("duckdb", "")
	if err != nil {
		return nil, fmt.Errorf("failed to open temp database: %w", err)
	}
	defer conn.Close()

	// Load parquet extension
	if _, err := conn.Exec("INSTALL parquet; LOAD parquet;"); err != nil {
		return nil, fmt.Errorf("failed to load parquet extension: %w", err)
	}

	// Import database
	if importPath != "" {
		if _, err := conn.Exec(fmt.Sprintf("IMPORT DATABASE '%s'", importPath)); err != nil {
			return nil, fmt.Errorf("failed to import database: %w", err)
		}
	}

	return conn.Query(query)
}
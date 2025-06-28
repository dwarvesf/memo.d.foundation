package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dwarvesfoundation/obsidian-compiler/pkg/duckdb"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/fileutils"
	"github.com/spf13/cobra"
)

var (
	dbFormat   string
	pattern    string
	inputPath  string
	outputPath string
	numWorkers int
	forceAll   bool
)

var exportDuckDBCmd = &cobra.Command{
	Use:   "export-duckdb",
	Short: "Export Obsidian files to DuckDB",
	Long:  `Processes Obsidian vault files and stores their information in DuckDB with embeddings.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Set defaults
		if inputPath == "" {
			inputPath = "vault"
		}
		if outputPath == "" {
			outputPath = "content"
		}

		// Load .env file
		if err := loadEnvFile(); err != nil {
			fmt.Printf("Warning: failed to load .env file: %v\n", err)
		}

		// Get ignore patterns
		ignorePatterns, err := fileutils.ReadExportIgnoreFile(filepath.Join(inputPath, ".export-ignore"))
		if err != nil {
			fmt.Printf("Warning: failed to read ignore file: %v\n", err)
		}

		// Create processor
		// dbPath is where we import/export parquet files
		dbPath := outputPath
		// outputPath is where vault.duckdb will be created
		processor := duckdb.NewProcessor(
			inputPath,
			outputPath,
			dbPath,
			duckdb.WithPattern(pattern),
			duckdb.WithWorkers(numWorkers),
			duckdb.WithIgnorePatterns(ignorePatterns),
			duckdb.WithForceAll(forceAll),
		)

		// Run export
		ctx := context.Background()
		return processor.Run(ctx, dbFormat)
	},
}

func init() {
	exportDuckDBCmd.Flags().StringVarP(&inputPath, "input", "i", "vault", "Input vault path")
	exportDuckDBCmd.Flags().StringVarP(&outputPath, "output", "o", "content", "Output path")
	exportDuckDBCmd.Flags().StringVarP(&dbFormat, "format", "f", "parquet", "Export format (parquet or csv)")
	exportDuckDBCmd.Flags().StringVarP(&pattern, "pattern", "p", "**/*.md", "File pattern to match")
	exportDuckDBCmd.Flags().IntVarP(&numWorkers, "workers", "w", 10, "Number of parallel workers")
	exportDuckDBCmd.Flags().BoolVar(&forceAll, "force-all", false, "Force processing of all files regardless of modification time")
}

func loadEnvFile() error {
	envPath := filepath.Join(".", ".env")
	content, err := os.ReadFile(envPath)
	if err != nil {
		return err
	}

	// Simple .env parser
	lines := string(content)
	for _, line := range strings.Split(lines, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			// Remove quotes if present
			value = strings.Trim(value, `"'`)
			os.Setenv(key, value)
		}
	}

	return nil
}
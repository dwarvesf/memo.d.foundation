package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var (
	dbFormat string
	pattern  string
)

var exportDuckDBCmd = &cobra.Command{
	Use:   "export-duckdb",
	Short: "Export Obsidian files to DuckDB",
	Long:  `Processes Obsidian vault files and stores their information in DuckDB with embeddings.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// TODO: Implement DuckDB export logic
		fmt.Println("DuckDB export not yet implemented")
		return nil
	},
}

func init() {
	exportDuckDBCmd.Flags().StringVarP(&dbFormat, "format", "f", "parquet", "Export format (parquet or csv)")
	exportDuckDBCmd.Flags().StringVarP(&pattern, "pattern", "p", "**/*.md", "File pattern to match")
}
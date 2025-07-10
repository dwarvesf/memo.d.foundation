package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "obsidian-compiler",
	Short: "A fast Obsidian markdown compiler",
	Long:  `obsidian-compiler processes Obsidian markdown files and exports them to standard markdown with various optimizations.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(exportMarkdownCmd)
	rootCmd.AddCommand(exportDuckDBCmd)
}
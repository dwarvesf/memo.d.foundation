package cmd

import (
	"fmt"

	"github.com/dwarvesfoundation/obsidian-compiler/pkg/export"
	"github.com/spf13/cobra"
)

var (
	vaultPath  string
	exportPath string
)

var exportMarkdownCmd = &cobra.Command{
	Use:   "export-markdown",
	Short: "Export Obsidian markdown files to standard markdown",
	Long:  `Processes Obsidian vault files and exports them to standard markdown format with link transformations.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if vaultPath == "" {
			vaultPath = "vault"
		}
		if exportPath == "" {
			exportPath = "content"
		}

		exporter := export.NewMarkdownExporter(vaultPath, exportPath)
		if err := exporter.Run(); err != nil {
			return fmt.Errorf("export failed: %w", err)
		}

		return nil
	},
}

func init() {
	exportMarkdownCmd.Flags().StringVarP(&vaultPath, "vault", "v", "vault", "Path to Obsidian vault")
	exportMarkdownCmd.Flags().StringVarP(&exportPath, "export", "e", "content", "Path to export directory")
}
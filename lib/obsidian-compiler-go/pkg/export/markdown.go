package export

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/dwarvesfoundation/obsidian-compiler/pkg/cache"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/fileutils"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/frontmatter"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/linkutils"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/slugify"
)

// MarkdownExporter handles the export of Obsidian markdown to standard markdown
type MarkdownExporter struct {
	vaultPath      string
	exportPath     string
	cache          *cache.Cache
	ignoredPatterns []string
}

// NewMarkdownExporter creates a new markdown exporter instance
func NewMarkdownExporter(vaultPath, exportPath string) *MarkdownExporter {
	return &MarkdownExporter{
		vaultPath:  vaultPath,
		exportPath: exportPath,
		cache:      cache.NewCache(exportPath),
	}
}

// Run executes the markdown export process
func (e *MarkdownExporter) Run() error {
	// Set locale
	os.Setenv("LC_ALL", "en_US.UTF-8")

	// Load ignore patterns
	ignorePath := filepath.Join(e.vaultPath, ".export-ignore")
	patterns, err := fileutils.ReadExportIgnoreFile(ignorePath)
	if err != nil {
		return fmt.Errorf("failed to read ignore file: %w", err)
	}
	e.ignoredPatterns = patterns

	// Load cache
	if err := e.cache.Load(); err != nil {
		fmt.Printf("Warning: Failed to load cache: %v\n", err)
	}

	// Determine mode
	isFile := false
	targetPath := e.vaultPath
	if info, err := os.Stat(e.vaultPath); err == nil && !info.IsDir() {
		isFile = true
		e.vaultPath = filepath.Dir(e.vaultPath)
	}

	// List all files and directories
	paths, err := fileutils.ListAllRecursive(e.vaultPath)
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
	}

	// Filter valid files and asset directories
	var allFiles []string
	var allAssets []string
	for _, path := range paths {
		if !fileutils.IsIgnored(path, e.ignoredPatterns, e.vaultPath) {
			info, err := os.Stat(path)
			if err != nil {
				continue
			}
			if info.IsDir() {
				allAssets = append(allAssets, path)
			} else {
				allFiles = append(allFiles, path)
			}
		}
	}

	if isFile {
		return e.processSingleFile(targetPath, allFiles)
	}

	return e.processDirectory(allFiles, allAssets)
}

// processSingleFile processes a single file export
func (e *MarkdownExporter) processSingleFile(filePath string, allFiles []string) error {
	normalizedPath := fileutils.NormalizePath(filePath)
	
	// Check if file exists and has required frontmatter
	found := false
	for _, f := range allFiles {
		if f == normalizedPath {
			found = true
			break
		}
	}

	if !found || !frontmatter.ContainsRequiredKeys(normalizedPath) {
		return fmt.Errorf("file %s does not exist, is ignored, or does not contain required frontmatter keys", filePath)
	}

	// Process the file
	result := e.processFile(normalizedPath, allFiles)
	if result.Error != nil {
		return result.Error
	}

	// Update cache
	if result.CacheEntry != nil {
		e.cache.Set(normalizedPath, result.CacheEntry)
	}

	return e.cache.Save()
}

// processDirectory processes all files in the vault
func (e *MarkdownExporter) processDirectory(allFiles, allAssets []string) error {
	// Filter to only markdown files
	markdownFiles := fileutils.FilterMarkdownFiles(allFiles)
	
	// Filter changed files
	filesToProcess, filesUnchanged, err := e.cache.FilterChangedFiles(markdownFiles)
	if err != nil {
		return fmt.Errorf("failed to filter changed files: %w", err)
	}

	// Find deleted files
	deletedFiles := e.cache.GetDeletedFiles(markdownFiles)

	// Process changed files
	fmt.Printf("Total markdown files: %d, Files to process: %d, Unchanged: %d\n", 
		len(markdownFiles), len(filesToProcess), len(filesUnchanged))
	
	if len(filesToProcess) == 0 {
		fmt.Println("No files have changed since last run.")
	} else {
		fmt.Printf("Processing %d files...\n", len(filesToProcess))
		
		// Filter files with required frontmatter
		var validFiles []string
		var skippedFiles []string
		for _, file := range filesToProcess {
			if frontmatter.ContainsRequiredKeys(file) {
				validFiles = append(validFiles, file)
			} else {
				skippedFiles = append(skippedFiles, file)
			}
		}
		
		if len(skippedFiles) > 0 {
			fmt.Printf("Skipping %d files without required frontmatter\n", len(skippedFiles))
			// Add skipped files to cache so they won't be reprocessed
			for _, file := range skippedFiles {
				if entry, err := cache.CreateFileEntry(file, "", nil); err == nil {
					entry.Skipped = true
					entry.Reason = "Missing required frontmatter"
					e.cache.Set(file, entry)
				}
			}
		}

		// Process files concurrently
		results := e.processFilesConcurrently(validFiles, allFiles)
		
		// Update cache with results
		for _, result := range results {
			if result.Error == nil && result.CacheEntry != nil {
				e.cache.Set(result.FilePath, result.CacheEntry)
			}
		}
	}

	// Keep cache entries for unchanged files
	for range filesUnchanged {
		// Cache already has these entries, no need to update
	}

	// Handle deleted files
	if len(deletedFiles) > 0 {
		fmt.Printf("Removing %d deleted files...\n", len(deletedFiles))
		e.removeDeletedExports(deletedFiles)
	}

	// Process asset folders
	for _, assetPath := range allAssets {
		if filepath.Base(assetPath) == "assets" && 
		   filepath.Base(filepath.Dir(assetPath)) != "assets" &&
		   !fileutils.IsIgnored(assetPath, e.ignoredPatterns, e.vaultPath) {
			e.exportAssetsFolder(assetPath)
		}
	}

	// Export db directory
	e.exportDBDirectory("../../db")

	// Save cache
	return e.cache.Save()
}

// ProcessResult represents the result of processing a file
type ProcessResult struct {
	FilePath   string
	CacheEntry *cache.Entry
	Error      error
}

// processFilesConcurrently processes multiple files using worker goroutines
func (e *MarkdownExporter) processFilesConcurrently(files []string, allFiles []string) []ProcessResult {
	numWorkers := 10 // Configurable number of workers
	jobs := make(chan string, len(files))
	results := make(chan ProcessResult, len(files))

	// Start workers
	var wg sync.WaitGroup
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for file := range jobs {
				results <- e.processFile(file, allFiles)
			}
		}()
	}

	// Send jobs
	for _, file := range files {
		jobs <- file
	}
	close(jobs)

	// Wait for workers to finish
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	var processResults []ProcessResult
	for result := range results {
		processResults = append(processResults, result)
	}

	return processResults
}

// processFile processes a single file
func (e *MarkdownExporter) processFile(file string, allFiles []string) ProcessResult {
	// Read file
	content, err := os.ReadFile(file)
	if err != nil {
		return ProcessResult{FilePath: file, Error: err}
	}

	// Calculate export path
	exportFile := e.replacePathPrefix(file, e.vaultPath, e.exportPath)
	slugifiedExportFile := e.preserveRelativePrefixAndSlugify(exportFile)
	dirname := filepath.Dir(slugifiedExportFile)
	basename := filepath.Base(slugifiedExportFile)

	// Skip root home.md or index.md files
	if (basename == "home.md" || basename == "index.md") && dirname == e.exportPath {
		fmt.Printf("Skipping root file: %s (would create %s at root)\n", file, basename)
		entry := &cache.Entry{
			Skipped: true,
			Reason:  fmt.Sprintf("Ignored root file: %s", basename),
		}
		// Still create cache entry to avoid reprocessing
		cacheEntry, _ := cache.CreateFileEntry(file, "", nil)
		if cacheEntry != nil {
			cacheEntry.Skipped = true
			cacheEntry.Reason = entry.Reason
		}
		return ProcessResult{FilePath: file, CacheEntry: cacheEntry}
	}

	// Process content
	stringContent := string(content)
	links := linkutils.ExtractLinks(stringContent)
	resolvedLinks := linkutils.ResolveLinks(links, allFiles, e.vaultPath)
	convertedContent := linkutils.ConvertLinks(stringContent, resolvedLinks, file)
	
	// Process DuckDB queries (placeholder for now)
	convertedContent = e.processDuckDBQueries(convertedContent)
	
	// Slugify markdown links
	convertedContent = slugify.SlugifyMarkdownLinks(convertedContent)
	
	// Process KaTeX (placeholder for now)
	convertedContent = e.wrapMultilineKatex(convertedContent)

	// Create export directory
	exportDir := filepath.Dir(slugifiedExportFile)
	if err := os.MkdirAll(exportDir, 0755); err != nil {
		return ProcessResult{FilePath: file, Error: err}
	}

	// Write file
	if err := os.WriteFile(slugifiedExportFile, []byte(convertedContent), 0644); err != nil {
		return ProcessResult{FilePath: file, Error: err}
	}

	fmt.Printf("Exported: %s -> %s\n", file, slugifiedExportFile)

	// Create cache entry
	cacheEntry, err := cache.CreateFileEntry(file, slugifiedExportFile, links)
	if err != nil {
		return ProcessResult{FilePath: file, Error: err}
	}

	return ProcessResult{FilePath: file, CacheEntry: cacheEntry}
}

// exportAssetsFolder exports an assets folder
func (e *MarkdownExporter) exportAssetsFolder(assetPath string) {
	targetPath := e.replacePathPrefix(assetPath, e.vaultPath, e.exportPath)
	slugifiedTargetPath := e.preserveRelativePrefixAndSlugify(targetPath)

	// Check cache
	currentMTime := cache.GetDirectoryMTime(assetPath)
	if entry, exists := e.cache.Get(assetPath); exists &&
		entry.Type == "asset_folder" &&
		entry.MTime == currentMTime {
		// Asset folder hasn't changed
		return
	}

	// Copy directory
	e.copyDirectory(assetPath, slugifiedTargetPath)
	fmt.Printf("Exported assets: %s -> %s\n", assetPath, slugifiedTargetPath)

	// Update cache
	e.cache.Set(assetPath, cache.CreateAssetFolderEntry(assetPath, slugifiedTargetPath))
}

// exportDBDirectory exports the database directory
func (e *MarkdownExporter) exportDBDirectory(dbPath string) {
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		fmt.Printf("db folder not found at %s\n", dbPath)
		return
	}

	exportDBPath := filepath.Join(e.exportPath, "../../db")
	slugifiedExportDBPath := e.preserveRelativePrefixAndSlugify(exportDBPath)

	// Check cache
	currentMTime := cache.GetDirectoryMTime(dbPath)
	if entry, exists := e.cache.Get(dbPath); exists &&
		entry.Type == "db_directory" &&
		entry.MTime == currentMTime {
		// DB directory hasn't changed
		return
	}

	// Copy directory
	e.copyDirectory(dbPath, slugifiedExportDBPath)
	fmt.Printf("Exported db folder: %s -> %s\n", dbPath, slugifiedExportDBPath)

	// Update cache
	e.cache.Set(dbPath, cache.CreateDBDirectoryEntry(dbPath, slugifiedExportDBPath))
}

// copyDirectory recursively copies a directory
func (e *MarkdownExporter) copyDirectory(source, destination string) error {
	slugifiedDestination := e.preserveRelativePrefixAndSlugify(destination)
	
	// Create destination directory
	if err := os.MkdirAll(slugifiedDestination, 0755); err != nil {
		return err
	}

	entries, err := os.ReadDir(source)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		sourcePath := filepath.Join(source, entry.Name())
		destPath := filepath.Join(slugifiedDestination, slugify.SlugifyFilename(entry.Name()))

		if fileutils.IsIgnored(sourcePath, e.ignoredPatterns, e.vaultPath) {
			continue
		}

		if entry.IsDir() {
			// Skip nested assets directories
			if !(filepath.Base(sourcePath) == "assets" && filepath.Base(source) == "assets") {
				e.copyDirectory(sourcePath, destPath)
			}
		} else {
			// Ensure destination directory exists
			destDir := filepath.Dir(destPath)
			if err := os.MkdirAll(destDir, 0755); err != nil {
				fmt.Printf("Warning: Could not create directory %s: %v\n", destDir, err)
				continue
			}

			// Copy file
			if err := e.copyFile(sourcePath, destPath); err != nil {
				fmt.Printf("Warning: Could not copy file %s to %s: %v\n", sourcePath, destPath, err)
			}
		}
	}

	return nil
}

// copyFile copies a single file
func (e *MarkdownExporter) copyFile(source, destination string) error {
	sourceFile, err := os.Open(source)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// removeDeletedExports removes exports for deleted files
func (e *MarkdownExporter) removeDeletedExports(deletedFiles []string) {
	for _, file := range deletedFiles {
		if entry, exists := e.cache.Get(file); exists && entry.ExportPath != "" {
			isDirectory := entry.Type == "asset_folder" || entry.Type == "db_directory"
			
			if isDirectory {
				if err := os.RemoveAll(entry.ExportPath); err != nil {
					fmt.Printf("Warning: Could not remove directory %s: %v\n", entry.ExportPath, err)
				} else {
					fmt.Printf("Removed export for deleted directory: %s -> %s\n", file, entry.ExportPath)
				}
			} else {
				if err := os.Remove(entry.ExportPath); err != nil {
					fmt.Printf("Warning: Could not remove file %s: %v\n", entry.ExportPath, err)
				} else {
					fmt.Printf("Removed export for deleted file: %s -> %s\n", file, entry.ExportPath)
				}
			}
			
			// Remove from cache
			e.cache.Delete(file)
		}
	}
}

// Helper methods

func (e *MarkdownExporter) replacePathPrefix(path, oldPrefix, newPrefix string) string {
	normalizedPath, _ := filepath.Abs(path)
	normalizedOldPrefix, _ := filepath.Abs(oldPrefix)
	
	relativePart, err := filepath.Rel(normalizedOldPrefix, normalizedPath)
	if err == nil && relativePart != normalizedPath {
		result := filepath.Join(newPrefix, relativePart)
		
		// Preserve relative style if original was relative
		if strings.HasPrefix(path, "../") {
			return result
		}
		return filepath.Clean(result)
	}
	
	// Fallback
	oldBase := filepath.Base(oldPrefix)
	newBase := filepath.Base(newPrefix)
	return strings.ReplaceAll(path, oldBase, newBase)
}

func (e *MarkdownExporter) preserveRelativePrefixAndSlugify(path string) string {
	// Don't slugify MDX files
	if strings.HasSuffix(path, ".mdx") {
		return path
	}

	// Extract relative prefix
	relativePrefix := ""
	pathWithoutPrefix := path
	
	if strings.HasPrefix(path, "../") {
		parts := strings.SplitN(path, "../", 2)
		count := 1
		remaining := parts[1]
		
		for strings.HasPrefix(remaining, "../") {
			count++
			remaining = strings.TrimPrefix(remaining, "../")
		}
		
		relativePrefix = strings.Repeat("../", count)
		pathWithoutPrefix = remaining
	}

	// Slugify the path
	slugifiedPath := slugify.SlugifyPath(pathWithoutPrefix)
	
	return relativePrefix + slugifiedPath
}

// Placeholder methods for features not yet implemented

func (e *MarkdownExporter) processDuckDBQueries(content string) string {
	// TODO: Implement DuckDB query processing
	return content
}

func (e *MarkdownExporter) wrapMultilineKatex(content string) string {
	// TODO: Implement KaTeX wrapping
	return content
}
package fileutils

import (
	"bufio"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// ListFilesRecursive walks the directory tree and returns all file paths
func ListFilesRecursive(root string) ([]string, error) {
	var files []string

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() {
			files = append(files, path)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	return files, nil
}

// ListAllRecursive walks the directory tree and returns both file and directory paths
func ListAllRecursive(root string) ([]string, error) {
	var paths []string

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip the root directory itself
		if path != root {
			paths = append(paths, path)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	return paths, nil
}

// ReadExportIgnoreFile reads the .export-ignore file and returns patterns
func ReadExportIgnoreFile(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to open ignore file: %w", err)
	}
	defer file.Close()

	var patterns []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			patterns = append(patterns, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read ignore file: %w", err)
	}

	return patterns, nil
}

// IsIgnored checks if a file path matches any ignore patterns
func IsIgnored(filePath string, patterns []string, vaultPath string) bool {
	relativePath, err := filepath.Rel(vaultPath, filePath)
	if err != nil {
		return false
	}

	for _, pattern := range patterns {
		// Simple pattern matching - can be enhanced with glob support
		if matchPattern(relativePath, pattern) {
			return true
		}
	}

	return false
}

// matchPattern implements simple pattern matching
func matchPattern(path, pattern string) bool {
	// Handle directory patterns
	if strings.HasSuffix(pattern, "/") {
		dirPattern := strings.TrimSuffix(pattern, "/")
		parts := strings.Split(path, string(filepath.Separator))
		for _, part := range parts {
			if part == dirPattern {
				return true
			}
		}
	}

	// Handle file patterns
	if strings.Contains(pattern, "*") {
		matched, _ := filepath.Match(pattern, filepath.Base(path))
		return matched
	}

	// Exact match or prefix match
	return path == pattern || strings.HasPrefix(path, pattern+string(filepath.Separator))
}

// NormalizePath normalizes a file path
func NormalizePath(path string) string {
	return filepath.Clean(path)
}

// FilterMarkdownFiles filters a list of files to only include .md and .mdx files
func FilterMarkdownFiles(files []string) []string {
	var mdFiles []string
	for _, file := range files {
		lowerFile := strings.ToLower(file)
		if strings.HasSuffix(lowerFile, ".md") || strings.HasSuffix(lowerFile, ".mdx") {
			mdFiles = append(mdFiles, file)
		}
	}
	return mdFiles
}

// FileInfo holds information about a file
type FileInfo struct {
	Path  string
	Size  int64
	MTime int64
}
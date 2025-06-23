package cache

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const CacheFileName = ".memo_export_cache.json"

// Entry represents a cache entry for a file
type Entry struct {
	Size       int64    `json:"size"`
	MTime      int64    `json:"mtime"`
	Hash       string   `json:"hash"`
	ExportPath string   `json:"export_path,omitempty"`
	Links      []string `json:"links,omitempty"`
	Type       string   `json:"type,omitempty"`
	Skipped    bool     `json:"skipped,omitempty"`
	Reason     string   `json:"reason,omitempty"`
}

// Cache manages the file processing cache
type Cache struct {
	entries  map[string]*Entry
	filePath string
}

// NewCache creates a new cache instance
func NewCache(exportPath string) *Cache {
	return &Cache{
		entries:  make(map[string]*Entry),
		filePath: filepath.Join(exportPath, CacheFileName),
	}
}

// Load loads the cache from disk
func (c *Cache) Load() error {
	data, err := os.ReadFile(c.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// Cache doesn't exist yet, start with empty cache
			return nil
		}
		return fmt.Errorf("failed to read cache file: %w", err)
	}

	if err := json.Unmarshal(data, &c.entries); err != nil {
		return fmt.Errorf("failed to parse cache file: %w", err)
	}

	return nil
}

// Save saves the cache to disk
func (c *Cache) Save() error {
	// Ensure export directory exists
	dir := filepath.Dir(c.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}

	data, err := json.MarshalIndent(c.entries, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode cache: %w", err)
	}

	if err := os.WriteFile(c.filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write cache file: %w", err)
	}

	return nil
}

// Get retrieves a cache entry
func (c *Cache) Get(path string) (*Entry, bool) {
	entry, exists := c.entries[path]
	return entry, exists
}

// Set adds or updates a cache entry
func (c *Cache) Set(path string, entry *Entry) {
	c.entries[path] = entry
}

// Delete removes a cache entry
func (c *Cache) Delete(path string) {
	delete(c.entries, path)
}

// HasChanged checks if a file has changed since it was cached
func (c *Cache) HasChanged(path string, info os.FileInfo) (bool, error) {
	entry, exists := c.entries[path]
	if !exists {
		return true, nil
	}

	// Check size and modification time
	if entry.Size != info.Size() || entry.MTime != info.ModTime().Unix() {
		return true, nil
	}

	// Check file hash
	hash, err := computeFileHash(path)
	if err != nil {
		return true, err
	}

	return entry.Hash != hash, nil
}

// GetDeletedFiles returns files that are in the cache but not in the current file list
func (c *Cache) GetDeletedFiles(currentFiles []string) []string {
	fileSet := make(map[string]bool)
	for _, file := range currentFiles {
		fileSet[file] = true
	}

	var deleted []string
	for path, entry := range c.entries {
		// Skip non-file entries (asset folders, db directories)
		if entry.Type == "asset_folder" || entry.Type == "db_directory" {
			continue
		}
		
		if !fileSet[path] {
			deleted = append(deleted, path)
		}
	}

	return deleted
}

// GetDirectoryMTime gets the modification time of a directory
func GetDirectoryMTime(dirPath string) int64 {
	info, err := os.Stat(dirPath)
	if err != nil {
		return 0
	}
	return info.ModTime().Unix()
}

// computeFileHash calculates the MD5 hash of a file
func computeFileHash(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// FilterChangedFiles splits files into those that need processing and those that don't
func (c *Cache) FilterChangedFiles(files []string) ([]string, []string, error) {
	var toProcess []string
	var unchanged []string

	for _, file := range files {
		// Always process config files
		if filepath.Ext(file) == ".yaml" || filepath.Ext(file) == ".yml" {
			if filepath.Base(file) == ".config.yaml" || filepath.Base(file) == ".config.yml" {
				toProcess = append(toProcess, file)
				continue
			}
		}

		info, err := os.Stat(file)
		if err != nil {
			toProcess = append(toProcess, file)
			continue
		}

		changed, err := c.HasChanged(file, info)
		if err != nil || changed {
			toProcess = append(toProcess, file)
		} else {
			unchanged = append(unchanged, file)
		}
	}

	return toProcess, unchanged, nil
}

// CreateFileEntry creates a new cache entry for a file
func CreateFileEntry(path string, exportPath string, links []string) (*Entry, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	hash, err := computeFileHash(path)
	if err != nil {
		return nil, err
	}

	return &Entry{
		Size:       info.Size(),
		MTime:      info.ModTime().Unix(),
		Hash:       hash,
		ExportPath: exportPath,
		Links:      links,
	}, nil
}

// CreateAssetFolderEntry creates a cache entry for an asset folder
func CreateAssetFolderEntry(path string, exportPath string) *Entry {
	return &Entry{
		Type:       "asset_folder",
		MTime:      GetDirectoryMTime(path),
		ExportPath: exportPath,
	}
}

// CreateDBDirectoryEntry creates a cache entry for a database directory
func CreateDBDirectoryEntry(path string, exportPath string) *Entry {
	return &Entry{
		Type:       "db_directory",
		MTime:      GetDirectoryMTime(path),
		ExportPath: exportPath,
	}
}
package duckdb

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/dwarvesfoundation/obsidian-compiler/pkg/ai"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/frontmatter"
)

type Processor struct {
	db              *DB
	inputPath       string
	outputPath      string
	dbPath          string
	pattern         string
	numWorkers      int
	ignorePatterns  []string
	forceAll        bool
	aiClient        *ai.Client
}

type ProcessorOption func(*Processor)

func WithPattern(pattern string) ProcessorOption {
	return func(p *Processor) {
		p.pattern = pattern
	}
}

func WithWorkers(n int) ProcessorOption {
	return func(p *Processor) {
		p.numWorkers = n
	}
}

func WithIgnorePatterns(patterns []string) ProcessorOption {
	return func(p *Processor) {
		p.ignorePatterns = patterns
	}
}

func WithForceAll(force bool) ProcessorOption {
	return func(p *Processor) {
		p.forceAll = force
	}
}

func NewProcessor(inputPath, outputPath, dbPath string, opts ...ProcessorOption) *Processor {
	p := &Processor{
		inputPath:      inputPath,
		outputPath:     outputPath,
		dbPath:         dbPath,
		pattern:        "**/*.md",
		numWorkers:     10,
		ignorePatterns: []string{},
		aiClient:       ai.NewClient(),
	}

	for _, opt := range opts {
		opt(p)
	}

	return p
}

func (p *Processor) Run(ctx context.Context, format string) error {
	// Initialize database
	db, err := NewDB(filepath.Join(p.outputPath, "vault.duckdb"))
	if err != nil {
		return fmt.Errorf("failed to create database: %w", err)
	}
	defer db.Close()
	p.db = db

	// Import existing database or create tables
	if err := db.ImportDatabase(p.dbPath); err != nil {
		return fmt.Errorf("failed to setup database: %w", err)
	}

	// Get last processed time for incremental processing
	lastProcessed, err := db.GetLastProcessedTime()
	if err != nil {
		fmt.Printf("Warning: could not get last processed time: %v\n", err)
		lastProcessed = time.Unix(0, 0)
	}

	// If last processed is epoch time, try to get web time
	if lastProcessed.Unix() == 0 {
		webTime, err := GetWebTime()
		if err == nil {
			lastProcessed = webTime.Add(-24 * time.Hour) // Process files from last 24 hours
		}
	}

	fmt.Printf("Processing files modified after: %s\n", lastProcessed.Format(time.RFC3339))

	// Find all markdown files
	files, err := p.findFiles(lastProcessed)
	if err != nil {
		return fmt.Errorf("failed to find files: %w", err)
	}

	if len(files) == 0 {
		fmt.Println("No files to process")
		return nil
	}

	fmt.Printf("Found %d files to process\n", len(files))

	// Process files in parallel
	if err := p.processFiles(ctx, files); err != nil {
		return fmt.Errorf("failed to process files: %w", err)
	}

	// Update last processed time
	if err := db.UpdateLastProcessedTime(time.Now()); err != nil {
		fmt.Printf("Warning: failed to update last processed time: %v\n", err)
	}

	// Export database
	fmt.Printf("Exporting database to %s format...\n", format)
	if err := db.ExportDatabase(p.dbPath, format); err != nil {
		return fmt.Errorf("failed to export database: %w", err)
	}

	fmt.Println("Export completed successfully!")
	return nil
}

func (p *Processor) findFiles(since time.Time) ([]string, error) {
	var files []string

	err := filepath.Walk(p.inputPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip if modified before last processed time (unless forceAll is true)
		if !p.forceAll && !info.ModTime().After(since) {
			return nil
		}

		// Check if file is a markdown file
		if !info.IsDir() && (strings.HasSuffix(strings.ToLower(path), ".md") || 
			strings.HasSuffix(strings.ToLower(path), ".mdx")) {
			// Check ignore patterns
			for _, pattern := range p.ignorePatterns {
				if matched, _ := filepath.Match(pattern, path); matched {
					return nil
				}
			}
			files = append(files, path)
		}

		return nil
	})

	return files, err
}

func (p *Processor) processFiles(ctx context.Context, files []string) error {
	// Create channels
	fileChan := make(chan string, len(files))
	resultChan := make(chan Document, len(files))
	errorChan := make(chan error, len(files))

	// Add files to channel
	for _, file := range files {
		fileChan <- file
	}
	close(fileChan)

	// Start workers
	var wg sync.WaitGroup
	for i := 0; i < p.numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p.worker(ctx, fileChan, resultChan, errorChan)
		}()
	}

	// Wait for workers to complete
	go func() {
		wg.Wait()
		close(resultChan)
		close(errorChan)
	}()

	// Collect results
	var documents []Document
	var errors []error

	done := false
	for !done {
		select {
		case doc, ok := <-resultChan:
			if !ok {
				done = true
				break
			}
			documents = append(documents, doc)
		case err, ok := <-errorChan:
			if ok {
				errors = append(errors, err)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	// Print errors
	if len(errors) > 0 {
		fmt.Printf("Encountered %d errors during processing:\n", len(errors))
		for _, err := range errors {
			fmt.Printf("  - %v\n", err)
		}
	}

	// Batch process documents
	fmt.Printf("Processing %d documents...\n", len(documents))
	
	// Split documents by whether they need embeddings
	var needsEmbeddings []Document
	var noEmbeddings []Document

	for _, doc := range documents {
		if p.needsEmbeddingUpdate(doc) {
			needsEmbeddings = append(needsEmbeddings, doc)
		} else {
			noEmbeddings = append(noEmbeddings, doc)
		}
	}

	// Process documents without embeddings
	if len(noEmbeddings) > 0 {
		fmt.Printf("Updating %d documents without embeddings...\n", len(noEmbeddings))
		if err := p.db.BatchUpsert(noEmbeddings, false); err != nil {
			return fmt.Errorf("failed to upsert documents without embeddings: %w", err)
		}
	}

	// Process documents with embeddings
	if len(needsEmbeddings) > 0 {
		fmt.Printf("Generating embeddings for %d documents...\n", len(needsEmbeddings))
		
		// Generate embeddings for each document
		for i := range needsEmbeddings {
			if err := p.generateEmbeddings(&needsEmbeddings[i]); err != nil {
				fmt.Printf("Warning: failed to generate embeddings for %s: %v\n", needsEmbeddings[i].FilePath, err)
				// Continue with zero embeddings rather than failing
			}
		}
		
		fmt.Printf("Updating %d documents with embeddings...\n", len(needsEmbeddings))
		if err := p.db.BatchUpsert(needsEmbeddings, true); err != nil {
			return fmt.Errorf("failed to upsert documents with embeddings: %w", err)
		}
	}

	return nil
}

func (p *Processor) generateEmbeddings(doc *Document) error {
	// Generate SPR compression
	if spr, err := p.aiClient.SPRCompress(doc.MDContent); err == nil && spr != "" {
		doc.SPRContent = spr
	} else {
		doc.SPRContent = ""
	}

	// Generate OpenAI embeddings for the full content
	if result, err := p.aiClient.EmbedOpenAI(doc.MDContent); err == nil {
		doc.EmbeddingsOpenAI = result.Embedding
		doc.TotalTokens = result.TotalTokens
	} else {
		// Keep the zero embeddings initialized in processFile
		doc.TotalTokens = 0
	}

	// Generate custom embeddings for SPR content (or original if no SPR)
	contentForCustom := doc.SPRContent
	if contentForCustom == "" {
		contentForCustom = doc.MDContent
	}
	
	if result, err := p.aiClient.EmbedCustom(contentForCustom); err == nil {
		doc.EmbeddingsSPRCustom = result.Embedding
		doc.TotalTokens += result.TotalTokens
	}
	// If error, keep the zero embeddings initialized in processFile

	return nil
}

func (p *Processor) worker(ctx context.Context, fileChan <-chan string, resultChan chan<- Document, errorChan chan<- error) {
	for {
		select {
		case file, ok := <-fileChan:
			if !ok {
				return
			}

			doc, err := p.processFile(file)
			if err != nil {
				errorChan <- fmt.Errorf("failed to process %s: %w", file, err)
				continue
			}

			resultChan <- doc
		case <-ctx.Done():
			return
		}
	}
}

func (p *Processor) processFile(filePath string) (Document, error) {
	doc := Document{
		FilePath: filePath,
	}

	// Read file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return doc, err
	}

	// Parse frontmatter
	fm, mdContent, err := frontmatter.ExtractFrontmatter(string(content))
	if err != nil {
		return doc, err
	}

	doc.MDContent = mdContent

	// Extract frontmatter fields
	if title, ok := fm["title"].(string); ok {
		doc.Title = title
	}
	if shortTitle, ok := fm["short_title"].(string); ok {
		doc.ShortTitle = shortTitle
	}
	if description, ok := fm["description"].(string); ok {
		doc.Description = description
	}

	// Handle arrays
	doc.Tags = extractStringArray(fm, "tags")
	doc.Authors = extractStringArray(fm, "authors")
	doc.Aliases = extractStringArray(fm, "aliases")
	doc.Social = extractStringArray(fm, "social")
	doc.PICs = extractStringArray(fm, "PICs")
	doc.PreviousPaths = extractStringArray(fm, "previous_paths")
	doc.Redirect = extractStringArray(fm, "redirect")

	// Handle booleans
	doc.Pinned = extractBool(fm, "pinned")
	doc.HideFrontmatter = extractBool(fm, "hide_frontmatter")
	doc.HideTitle = extractBool(fm, "hide_title")
	doc.HideOnSidebar = extractBool(fm, "hide_on_sidebar")
	doc.Hiring = extractBool(fm, "hiring")
	doc.Featured = extractBool(fm, "featured")
	doc.Draft = extractBool(fm, "draft")
	doc.ShouldDeployPermaStorage = extractBool(fm, "should_deploy_perma_storage")
	doc.ShouldMint = extractBool(fm, "should_mint")
	doc.AISummary = extractBool(fm, "ai_summary")
	doc.HasRedirects = len(doc.Redirect) > 0

	// Handle numbers
	doc.Icy = extractFloat(fm, "icy")
	doc.Bounty = extractFloat(fm, "bounty")

	// Handle strings
	doc.Github = extractString(fm, "github")
	doc.Website = extractString(fm, "website")
	doc.Avatar = extractString(fm, "avatar")
	doc.Status = extractString(fm, "status")
	doc.PermaStorageID = extractString(fm, "perma_storage_id")
	doc.TokenID = extractString(fm, "token_id")
	doc.Function = extractString(fm, "function")
	doc.AIGeneratedSummary = extractString(fm, "ai_generated_summary")
	doc.DiscordID = extractString(fm, "discord_id")

	// Handle dates
	doc.Date = extractDate(fm, "date")
	doc.MintedAt = extractDate(fm, "minted_at")

	// Estimate token count (roughly 4 characters per token)
	doc.EstimatedTokens = int64(len(mdContent) / 4)
	doc.TotalTokens = 0

	// Initialize empty embeddings arrays with proper sizes
	// These will be populated if embeddings are needed
	doc.EmbeddingsOpenAI = make([]float32, 1536)      // OpenAI embeddings size
	doc.EmbeddingsSPRCustom = make([]float32, 1024)   // Jina embeddings size
	
	// SPR content will be populated if embeddings are generated
	doc.SPRContent = ""

	return doc, nil
}

func (p *Processor) needsEmbeddingUpdate(doc Document) bool {
	// Check if document exists in database
	existing, err := p.db.GetExistingDocument(doc.FilePath)
	if err != nil {
		// Document doesn't exist, needs embeddings
		return true
	}

	// Check if content has changed significantly
	similarity := CalculateJaroDistance(existing.MDContent, doc.MDContent)
	return similarity < 0.7 // Need update if less than 70% similar
}

// Helper functions to extract values from frontmatter
func extractStringArray(fm map[string]interface{}, key string) []string {
	val, ok := fm[key]
	if !ok {
		return nil
	}

	switch v := val.(type) {
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	case []string:
		return v
	case string:
		// Handle comma-separated values
		if v != "" {
			return []string{v}
		}
	}

	return nil
}

func extractBool(fm map[string]interface{}, key string) bool {
	if val, ok := fm[key].(bool); ok {
		return val
	}
	return false
}

func extractFloat(fm map[string]interface{}, key string) float64 {
	switch v := fm[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case int64:
		return float64(v)
	}
	return 0.0
}

func extractString(fm map[string]interface{}, key string) string {
	if val, ok := fm[key].(string); ok {
		return val
	}
	return ""
}

func extractStringPtr(fm map[string]interface{}, key string) *string {
	if val, ok := fm[key].(string); ok && val != "" {
		return &val
	}
	return nil
}

func extractDate(fm map[string]interface{}, key string) *time.Time {
	if val, ok := fm[key].(string); ok {
		if t, err := time.Parse("2006-01-02", val); err == nil {
			return &t
		}
		if t, err := time.Parse(time.RFC3339, val); err == nil {
			return &t
		}
	}
	return nil
}
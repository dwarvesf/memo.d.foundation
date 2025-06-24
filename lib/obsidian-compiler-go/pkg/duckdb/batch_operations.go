package duckdb

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

const batchSize = 15

// BatchUpsert performs batch insert/update operations
// nilIfEmpty returns nil if the string is empty, otherwise returns the string
func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func (db *DB) BatchUpsert(documents []Document, updateEmbeddings bool) error {
	if len(documents) == 0 {
		return nil
	}

	// Process in batches
	for i := 0; i < len(documents); i += batchSize {
		end := i + batchSize
		if end > len(documents) {
			end = len(documents)
		}
		
		batch := documents[i:end]
		if err := db.upsertBatch(batch, updateEmbeddings); err != nil {
			return fmt.Errorf("failed to upsert batch starting at %d: %w", i, err)
		}
	}

	return nil
}

func (db *DB) upsertBatch(documents []Document, updateEmbeddings bool) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Collect file paths for deletion
	filePaths := make([]string, len(documents))
	for i, doc := range documents {
		filePaths[i] = doc.FilePath
	}

	// Delete existing records first to avoid array update issues
	if err := db.deleteDocuments(tx, filePaths); err != nil {
		return fmt.Errorf("failed to delete existing documents: %w", err)
	}

	// Now insert the documents
	for _, doc := range documents {
		if updateEmbeddings {
			if err := db.insertWithEmbeddings(tx, doc); err != nil {
				return err
			}
		} else {
			if err := db.insertWithoutEmbeddings(tx, doc); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (db *DB) deleteDocuments(tx *sql.Tx, filePaths []string) error {
	if len(filePaths) == 0 {
		return nil
	}

	// Build the IN clause with placeholders
	placeholders := make([]string, len(filePaths))
	args := make([]interface{}, len(filePaths))
	for i, path := range filePaths {
		placeholders[i] = "?"
		args[i] = path
	}

	query := fmt.Sprintf("DELETE FROM vault WHERE file_path IN (%s)", strings.Join(placeholders, ", "))
	_, err := tx.Exec(query, args...)
	return err
}

func (db *DB) insertWithEmbeddings(tx *sql.Tx, doc Document) error {
	// Debug: check for empty string fields that should be arrays
	if doc.Tags == nil {
		doc.Tags = []string{}
	}
	if doc.Authors == nil {
		doc.Authors = []string{}
	}
	if doc.Social == nil {
		doc.Social = []string{}
	}
	if doc.Aliases == nil {
		doc.Aliases = []string{}
	}
	if doc.PreviousPaths == nil {
		doc.PreviousPaths = []string{}
	}
	if doc.PICs == nil {
		doc.PICs = []string{}
	}
	if doc.Redirect == nil {
		doc.Redirect = []string{}
	}
	
	query := `
	INSERT INTO vault (
		file_path, title, short_title, description, tags, authors, date,
		pinned, hide_frontmatter, hide_title, hide_on_sidebar, md_content,
		spr_content, embeddings_openai, embeddings_spr_custom, social,
		estimated_tokens, total_tokens, aliases, icy, hiring, github, website,
		avatar, previous_paths, PICs, bounty, status, featured, draft, minted_at,
		should_deploy_perma_storage, should_mint, perma_storage_id, token_id,
		function, ai_generated_summary, ai_summary, discord_id, redirect, has_redirects
	) VALUES (?, ?, ?, ?, ` + ArrayToString(doc.Tags) + `, ` + ArrayToString(doc.Authors) + `, ?, ?, ?, ?, ?, ?, ?, ` + 
		FloatArrayToString(doc.EmbeddingsOpenAI) + `, ` + FloatArrayToString(doc.EmbeddingsSPRCustom) + `, ` + 
		ArrayToString(doc.Social) + `, ?, ?, ` + ArrayToString(doc.Aliases) + `, ?, ?, ?, ?, ?, ` + 
		ArrayToString(doc.PreviousPaths) + `, ` + ArrayToString(doc.PICs) + `, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ` + 
		ArrayToString(doc.Redirect) + `, ?)`

	// Parameters must match the ? placeholders in the query
	// Arrays are embedded directly in the query string, not passed as parameters
	// Convert empty strings to nil for nullable fields
	params := []interface{}{
		doc.FilePath, 
		nilIfEmpty(doc.Title), 
		nilIfEmpty(doc.ShortTitle), 
		nilIfEmpty(doc.Description),
		doc.Date, 
		doc.Pinned, 
		doc.HideFrontmatter, 
		doc.HideTitle,
		doc.HideOnSidebar, 
		doc.MDContent, 
		nilIfEmpty(doc.SPRContent),
		doc.EstimatedTokens, 
		doc.TotalTokens,
		doc.Icy, 
		doc.Hiring, 
		nilIfEmpty(doc.Github), 
		nilIfEmpty(doc.Website), 
		nilIfEmpty(doc.Avatar),
		doc.Bounty, 
		nilIfEmpty(doc.Status), 
		doc.Featured, 
		doc.Draft, 
		doc.MintedAt,
		doc.ShouldDeployPermaStorage, 
		doc.ShouldMint, 
		nilIfEmpty(doc.PermaStorageID),
		nilIfEmpty(doc.TokenID), 
		nilIfEmpty(doc.Function), 
		nilIfEmpty(doc.AIGeneratedSummary), 
		doc.AISummary,
		nilIfEmpty(doc.DiscordID), 
		doc.HasRedirects,
	}
	
	_, err := tx.Exec(query, params...)
	
	return err
}

func (db *DB) insertWithoutEmbeddings(tx *sql.Tx, doc Document) error {
	// Ensure arrays are not nil
	if doc.Tags == nil {
		doc.Tags = []string{}
	}
	if doc.Authors == nil {
		doc.Authors = []string{}
	}
	if doc.Social == nil {
		doc.Social = []string{}
	}
	if doc.Aliases == nil {
		doc.Aliases = []string{}
	}
	if doc.PreviousPaths == nil {
		doc.PreviousPaths = []string{}
	}
	if doc.PICs == nil {
		doc.PICs = []string{}
	}
	if doc.Redirect == nil {
		doc.Redirect = []string{}
	}
	
	query := `
	INSERT INTO vault (
		file_path, title, short_title, description, tags, authors, date,
		pinned, hide_frontmatter, hide_title, hide_on_sidebar, md_content,
		social, aliases, icy, hiring, github, website, avatar, previous_paths,
		PICs, bounty, status, featured, draft, minted_at,
		should_deploy_perma_storage, should_mint, perma_storage_id, token_id,
		function, ai_generated_summary, ai_summary, discord_id, redirect, has_redirects
	) VALUES (?, ?, ?, ?, ` + ArrayToString(doc.Tags) + `, ` + ArrayToString(doc.Authors) + `, ?, ?, ?, ?, ?, ?, ` + 
		ArrayToString(doc.Social) + `, ` + ArrayToString(doc.Aliases) + `, ?, ?, ?, ?, ?, ` + 
		ArrayToString(doc.PreviousPaths) + `, ` + ArrayToString(doc.PICs) + `, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ` + 
		ArrayToString(doc.Redirect) + `, ?)`

	// Parameters must match the ? placeholders in the query
	// Arrays are embedded directly in the query string, not passed as parameters
	_, err := tx.Exec(query,
		doc.FilePath, 
		nilIfEmpty(doc.Title), 
		nilIfEmpty(doc.ShortTitle), 
		nilIfEmpty(doc.Description),
		// tags, authors are embedded
		doc.Date, 
		doc.Pinned, 
		doc.HideFrontmatter, 
		doc.HideTitle,
		doc.HideOnSidebar, 
		doc.MDContent,
		// social, aliases are embedded
		doc.Icy, 
		doc.Hiring, 
		nilIfEmpty(doc.Github), 
		nilIfEmpty(doc.Website), 
		nilIfEmpty(doc.Avatar),
		// previous_paths, PICs are embedded
		doc.Bounty, 
		nilIfEmpty(doc.Status), 
		doc.Featured, 
		doc.Draft, 
		doc.MintedAt,
		doc.ShouldDeployPermaStorage, 
		doc.ShouldMint, 
		nilIfEmpty(doc.PermaStorageID),
		nilIfEmpty(doc.TokenID), 
		nilIfEmpty(doc.Function), 
		nilIfEmpty(doc.AIGeneratedSummary), 
		doc.AISummary,
		nilIfEmpty(doc.DiscordID),
		// redirect is embedded
		doc.HasRedirects,
	)

	return err
}

// GetLastProcessedTime returns the last time files were processed
func (db *DB) GetLastProcessedTime() (time.Time, error) {
	var lastProcessed time.Time
	err := db.QueryRow("SELECT last_processed_at FROM processing_metadata WHERE id = 1").
		Scan(&lastProcessed)
	if err != nil {
		// If no record exists, return epoch time
		return time.Unix(0, 0), nil
	}
	return lastProcessed, nil
}

// UpdateLastProcessedTime updates the last processed timestamp
func (db *DB) UpdateLastProcessedTime(t time.Time) error {
	_, err := db.conn.Exec(`
		INSERT INTO processing_metadata (id, last_processed_at) 
		VALUES (1, ?) 
		ON CONFLICT (id) DO UPDATE SET last_processed_at = EXCLUDED.last_processed_at`,
		t)
	return err
}

// GetExistingDocument retrieves an existing document by file path
func (db *DB) GetExistingDocument(filePath string) (*Document, error) {
	doc := &Document{}
	
	query := `
	SELECT file_path, md_content, spr_content, embeddings_openai, embeddings_spr_custom
	FROM vault WHERE file_path = ?`
	
	row := db.QueryRow(query, filePath)
	
	var embeddingsOpenAI, embeddingsSPRCustom string
	err := row.Scan(&doc.FilePath, &doc.MDContent, &doc.SPRContent, 
		&embeddingsOpenAI, &embeddingsSPRCustom)
	
	if err != nil {
		return nil, err
	}

	// Parse embeddings if they exist
	if embeddingsOpenAI != "" && embeddingsOpenAI != "[]" {
		doc.EmbeddingsOpenAI = parseFloatArray(embeddingsOpenAI)
	}
	if embeddingsSPRCustom != "" && embeddingsSPRCustom != "[]" {
		doc.EmbeddingsSPRCustom = parseFloatArray(embeddingsSPRCustom)
	}

	return doc, nil
}

func parseFloatArray(s string) []float32 {
	// Remove brackets and split by comma
	s = strings.Trim(s, "[]")
	if s == "" {
		return nil
	}
	
	parts := strings.Split(s, ",")
	result := make([]float32, 0, len(parts))
	
	for _, part := range parts {
		var f float32
		fmt.Sscanf(strings.TrimSpace(part), "%f", &f)
		result = append(result, f)
	}
	
	return result
}
package duckdb

import (
	"fmt"
	"strings"
	"time"
)

// Document represents a record in the vault table
type Document struct {
	FilePath              string     `db:"file_path"`
	Title                 string     `db:"title"`
	ShortTitle            string     `db:"short_title"`
	Description           string     `db:"description"`
	Tags                  []string   `db:"tags"`
	Authors               []string   `db:"authors"`
	Date                  *time.Time `db:"date"`
	Pinned                bool       `db:"pinned"`
	HideFrontmatter       bool       `db:"hide_frontmatter"`
	HideTitle             bool       `db:"hide_title"`
	HideOnSidebar         bool       `db:"hide_on_sidebar"`
	MDContent             string     `db:"md_content"`
	SPRContent            string     `db:"spr_content"`
	EmbeddingsOpenAI      []float32  `db:"embeddings_openai"`
	EmbeddingsSPRCustom   []float32  `db:"embeddings_spr_custom"`
	Social                []string   `db:"social"`
	EstimatedTokens       int64      `db:"estimated_tokens"`
	TotalTokens           int64      `db:"total_tokens"`
	Aliases               []string   `db:"aliases"`
	Icy                   float64    `db:"icy"`
	Hiring                bool       `db:"hiring"`
	Github                string     `db:"github"`
	Website               string     `db:"website"`
	Avatar                string     `db:"avatar"`
	PreviousPaths         []string   `db:"previous_paths"`
	PICs                  []string   `db:"PICs"`
	Bounty                float64    `db:"bounty"`
	Status                string     `db:"status"`
	Featured              bool       `db:"featured"`
	Draft                 bool       `db:"draft"`
	MintedAt              *time.Time `db:"minted_at"`
	ShouldDeployPermaStorage bool    `db:"should_deploy_perma_storage"`
	ShouldMint            bool       `db:"should_mint"`
	PermaStorageID        string     `db:"perma_storage_id"`
	TokenID               string     `db:"token_id"`
	Function              string     `db:"function"`
	AIGeneratedSummary    string     `db:"ai_generated_summary"`
	AISummary             bool       `db:"ai_summary"`
	DiscordID             string     `db:"discord_id"`
	Redirect              []string   `db:"redirect"`
	HasRedirects          bool       `db:"has_redirects"`
}

// ProcessingMetadata tracks when files were last processed
type ProcessingMetadata struct {
	ID               int       `db:"id"`
	LastProcessedAt time.Time `db:"last_processed_at"`
}

const (
	createVaultTableSQL = `
	CREATE TABLE IF NOT EXISTS vault (
		file_path TEXT UNIQUE,
		title VARCHAR,
		short_title VARCHAR,
		description VARCHAR,
		tags VARCHAR[],
		authors VARCHAR[],
		date DATE,
		pinned BOOLEAN,
		hide_frontmatter BOOLEAN,
		hide_title BOOLEAN,
		hide_on_sidebar BOOLEAN,
		md_content TEXT,
		spr_content TEXT,
		embeddings_openai FLOAT[1536],
		embeddings_spr_custom FLOAT[1024],
		social TEXT[],
		estimated_tokens BIGINT,
		total_tokens BIGINT,
		aliases VARCHAR[],
		icy DOUBLE,
		hiring BOOLEAN,
		github VARCHAR,
		website VARCHAR,
		avatar VARCHAR,
		previous_paths VARCHAR[],
		PICs TEXT[],
		bounty DOUBLE,
		status TEXT,
		featured BOOLEAN,
		draft BOOLEAN,
		minted_at DATE,
		should_deploy_perma_storage BOOLEAN,
		should_mint BOOLEAN,
		perma_storage_id VARCHAR,
		token_id VARCHAR,
		function TEXT,
		ai_generated_summary VARCHAR,
		ai_summary BOOLEAN,
		discord_id VARCHAR,
		redirect VARCHAR[],
		has_redirects BOOLEAN
	)`

	createProcessingMetadataTableSQL = `
	CREATE TABLE IF NOT EXISTS processing_metadata (
		id INTEGER PRIMARY KEY DEFAULT 1,
		last_processed_at TIMESTAMP
	)`
)

// CreateTables creates the necessary database tables
func (db *DB) CreateTables() error {
	if err := db.Execute(createVaultTableSQL); err != nil {
		return fmt.Errorf("failed to create vault table: %w", err)
	}

	if err := db.Execute(createProcessingMetadataTableSQL); err != nil {
		return fmt.Errorf("failed to create processing_metadata table: %w", err)
	}

	// Insert default processing metadata if not exists
	if err := db.Execute(`
		INSERT INTO processing_metadata (id, last_processed_at) 
		VALUES (1, CURRENT_TIMESTAMP) 
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return fmt.Errorf("failed to insert default processing metadata: %w", err)
	}

	return nil
}

// ArrayToString converts a Go string slice to DuckDB array format
func ArrayToString(arr []string) string {
	if arr == nil || len(arr) == 0 {
		return "[]"
	}
	escaped := make([]string, len(arr))
	for i, s := range arr {
		escaped[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(s, "'", "''"))
	}
	return fmt.Sprintf("[%s]", strings.Join(escaped, ", "))
}

// FloatArrayToString converts a Go float slice to DuckDB array format
func FloatArrayToString(arr []float32) string {
	if len(arr) == 0 {
		return "[]"
	}
	strVals := make([]string, len(arr))
	for i, f := range arr {
		strVals[i] = fmt.Sprintf("%f", f)
	}
	return fmt.Sprintf("[%s]", strings.Join(strVals, ", "))
}
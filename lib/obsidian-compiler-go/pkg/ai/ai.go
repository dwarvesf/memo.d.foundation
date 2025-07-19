package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	openAIEmbeddingDim = 1536
	jinaEmbeddingDim   = 1024
)

var sprCompressionPrompt = `# MISSION
You are a Sparse Priming Representation (SPR) writer. An SPR is a particular kind of use of language for advanced NLP, NLU, and NLG tasks, particularly useful for the latest generation of Large Language Models (LLMs). You will be given information by the USER which you are to render as an SPR.

# THEORY
LLMs are a kind of deep neural network. They have been demonstrated to embed knowledge, abilities, and concepts, ranging from reasoning to planning, and even to theory of mind. These are called latent abilities and latent content, collectively referred to as latent space. The latent space of an LLM can be activated with the correct series of words as inputs, which will create a useful internal state of the neural network. This is not unlike how the right shorthand cues can prime a human mind to think in a certain way. Like human minds, LLMs are associative, meaning you only need to use the correct associations to "prime" another model to think in the same way.

# METHODOLOGY
Render the input as a distilled list of succinct statements, assertions, associations, concepts, analogies, and metaphors. The idea is to capture as much, conceptually, as possible but with as few words as possible. Write it in a way that makes sense to you, as the future audience will be another language model, not a human. Use complete sentences.`

type Client struct {
	openAIKey    string
	jinaKey      string
	jinaBaseURL  string
	httpClient   *http.Client
}

// NewClient creates a new AI client
func NewClient() *Client {
	return &Client{
		openAIKey:   os.Getenv("OPENAI_API_KEY"),
		jinaKey:     os.Getenv("JINA_API_KEY"),
		jinaBaseURL: os.Getenv("JINA_BASE_URL"),
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// EmbeddingResult contains embedding data and token usage
type EmbeddingResult struct {
	Embedding   []float32
	TotalTokens int64
}

// SPRCompress compresses text using GPT-4 SPR methodology
func (c *Client) SPRCompress(text string) (string, error) {
	// Replace newlines with spaces
	text = strings.ReplaceAll(text, "\n", " ")
	
	// Only compress if text is longer than 100 characters
	if len(text) <= 100 {
		return "", nil
	}

	if c.openAIKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not set")
	}

	payload := map[string]interface{}{
		"model": "gpt-4.1-nano-2025-04-14",
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": sprCompressionPrompt,
			},
			{
				"role":    "user",
				"content": text,
			},
		},
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.openAIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if result.Error != nil {
		return "", fmt.Errorf("API error: %s", result.Error.Message)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return result.Choices[0].Message.Content, nil
}

// EmbedOpenAI generates embeddings using OpenAI's text-embedding-3-small model
func (c *Client) EmbedOpenAI(text string) (*EmbeddingResult, error) {
	// Return zero embeddings for short text
	if len(text) <= 100 {
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	if c.openAIKey == "" {
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	payload := map[string]interface{}{
		"input": text,
		"model": "text-embedding-3-small",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/embeddings", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.openAIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Return zero embeddings on error
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	// Handle context length errors gracefully
	if resp.StatusCode != http.StatusOK {
		if strings.Contains(string(body), "maximum context length") {
			return &EmbeddingResult{
				Embedding:   make([]float32, openAIEmbeddingDim),
				TotalTokens: 0,
			}, nil
		}
		// For other errors, also return zero embeddings
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
		Usage struct {
			TotalTokens int64 `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	if len(result.Data) == 0 {
		return &EmbeddingResult{
			Embedding:   make([]float32, openAIEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	return &EmbeddingResult{
		Embedding:   result.Data[0].Embedding,
		TotalTokens: result.Usage.TotalTokens,
	}, nil
}

// EmbedCustom generates embeddings using Jina embeddings v3
func (c *Client) EmbedCustom(text string) (*EmbeddingResult, error) {
	// Return zero embeddings for short text
	if len(text) <= 100 {
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	if c.jinaBaseURL == "" || c.jinaKey == "" {
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	payload := map[string]interface{}{
		"model":          "jina-embeddings-v3",
		"task":           "text-matching",
		"dimensions":     jinaEmbeddingDim,
		"late_chunking":  false,
		"embedding_type": "float",
		"input":          []string{text},
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", c.jinaBaseURL+"/embeddings", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.jinaKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Return zero embeddings on error
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	var result struct {
		Model  string `json:"model"`
		Object string `json:"object"`
		Usage  struct {
			TotalTokens int64 `json:"total_tokens"`
		} `json:"usage"`
		Data []struct {
			Object    string    `json:"object"`
			Index     int       `json:"index"`
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	if len(result.Data) == 0 {
		return &EmbeddingResult{
			Embedding:   make([]float32, jinaEmbeddingDim),
			TotalTokens: 0,
		}, nil
	}

	return &EmbeddingResult{
		Embedding:   result.Data[0].Embedding,
		TotalTokens: result.Usage.TotalTokens,
	}, nil
}
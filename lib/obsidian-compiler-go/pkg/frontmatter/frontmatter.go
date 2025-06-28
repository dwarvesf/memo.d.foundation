package frontmatter

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	yamlDelimiter = "---"
)

// RequiredKeys defines the required frontmatter keys
var RequiredKeys = []string{"title"}

// ExtractFrontmatter extracts YAML frontmatter from markdown content
func ExtractFrontmatter(content string) (map[string]interface{}, string, error) {
	lines := strings.Split(content, "\n")
	
	if len(lines) == 0 || strings.TrimSpace(lines[0]) != yamlDelimiter {
		return nil, content, fmt.Errorf("no frontmatter found")
	}

	// Find the closing delimiter
	endIndex := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == yamlDelimiter {
			endIndex = i
			break
		}
	}

	if endIndex == -1 {
		return nil, content, fmt.Errorf("frontmatter not properly closed")
	}

	// Extract YAML content
	yamlContent := strings.Join(lines[1:endIndex], "\n")
	
	// Parse YAML
	var frontmatter map[string]interface{}
	decoder := yaml.NewDecoder(bytes.NewBufferString(yamlContent))
	if err := decoder.Decode(&frontmatter); err != nil {
		return nil, content, fmt.Errorf("failed to parse frontmatter: %w", err)
	}

	// Extract markdown content (after frontmatter)
	markdownContent := ""
	if endIndex+1 < len(lines) {
		markdownContent = strings.Join(lines[endIndex+1:], "\n")
		markdownContent = strings.TrimLeft(markdownContent, "\n")
	}

	return frontmatter, markdownContent, nil
}

// ContainsRequiredKeys checks if frontmatter contains all required keys
func ContainsRequiredKeys(filePath string) bool {
	content, err := readFile(filePath)
	if err != nil {
		return false
	}

	fm, _, err := ExtractFrontmatter(content)
	if err != nil {
		return false
	}

	for _, key := range RequiredKeys {
		if _, exists := fm[key]; !exists {
			return false
		}
	}

	return true
}

// readFile reads file content (helper function)
func readFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// NormalizeFrontmatter normalizes frontmatter values
func NormalizeFrontmatter(fm map[string]interface{}) map[string]interface{} {
	normalized := make(map[string]interface{})
	
	for key, value := range fm {
		normalized[key] = normalizeValue(key, value)
	}

	return normalized
}

func normalizeValue(key string, value interface{}) interface{} {
	switch key {
	case "tags", "authors", "aliases":
		return normalizeArray(value)
	case "date":
		return normalizeDate(value)
	default:
		return value
	}
}

func normalizeArray(value interface{}) []string {
	switch v := value.(type) {
	case string:
		// Handle comma-separated strings
		if strings.Contains(v, ",") {
			parts := strings.Split(v, ",")
			result := make([]string, 0, len(parts))
			for _, part := range parts {
				trimmed := strings.TrimSpace(part)
				if trimmed != "" {
					result = append(result, trimmed)
				}
			}
			return result
		}
		return []string{v}
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			if str, ok := item.(string); ok && str != "" {
				result = append(result, str)
			}
		}
		return result
	case []string:
		return v
	default:
		return []string{}
	}
}

func normalizeDate(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	default:
		return fmt.Sprintf("%v", v)
	}
}
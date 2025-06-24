package duckdb

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// ResultToMarkdownTable converts query results to a markdown table
func ResultToMarkdownTable(rows *sql.Rows, headers []string) (string, error) {
	var result strings.Builder

	// Write headers
	result.WriteString("|")
	for _, header := range headers {
		result.WriteString(fmt.Sprintf(" %s |", header))
	}
	result.WriteString("\n|")
	for range headers {
		result.WriteString(" --- |")
	}
	result.WriteString("\n")

	// Write rows
	for rows.Next() {
		values := make([]interface{}, len(headers))
		valuePtrs := make([]interface{}, len(headers))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return "", err
		}

		result.WriteString("|")
		for _, val := range values {
			result.WriteString(fmt.Sprintf(" %v |", formatValue(val)))
		}
		result.WriteString("\n")
	}

	return result.String(), nil
}

// ResultToMarkdownList converts query results to a markdown list
func ResultToMarkdownList(rows *sql.Rows, linkColumn int) (string, error) {
	var result strings.Builder

	cols, err := rows.Columns()
	if err != nil {
		return "", err
	}

	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return "", err
		}

		// Format as list item with optional link
		if linkColumn >= 0 && linkColumn < len(values) {
			link := fmt.Sprintf("%v", values[linkColumn])
			title := link
			if len(values) > linkColumn+1 {
				title = fmt.Sprintf("%v", values[linkColumn+1])
			}
			result.WriteString(fmt.Sprintf("- [%s](%s)\n", title, link))
		} else {
			result.WriteString("- ")
			for i, val := range values {
				if i > 0 {
					result.WriteString(" - ")
				}
				result.WriteString(fmt.Sprintf("%v", formatValue(val)))
			}
			result.WriteString("\n")
		}
	}

	return result.String(), nil
}

func formatValue(val interface{}) string {
	switch v := val.(type) {
	case nil:
		return ""
	case time.Time:
		return v.Format("2006-01-02")
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// GetWebTime fetches current time from web API (fallback when system time is wrong)
func GetWebTime() (time.Time, error) {
	// This is a simplified version - in production you'd call a time API
	// For now, just return current time
	return time.Now(), nil
}

// CalculateJaroDistance calculates Jaro similarity between two strings
// Returns a value between 0 and 1, where 1 means identical strings
func CalculateJaroDistance(s1, s2 string) float64 {
	if s1 == s2 {
		return 1.0
	}

	len1 := len(s1)
	len2 := len(s2)

	if len1 == 0 && len2 == 0 {
		return 1.0
	}
	if len1 == 0 || len2 == 0 {
		return 0.0
	}

	// Calculate the match window
	matchDistance := max(len1, len2)/2 - 1
	if matchDistance < 0 {
		matchDistance = 0
	}

	// Initialize the matched arrays
	s1Matches := make([]bool, len1)
	s2Matches := make([]bool, len2)

	matches := 0
	transpositions := 0

	// Identify matches
	for i := 0; i < len1; i++ {
		start := max(0, i-matchDistance)
		end := min(i+matchDistance+1, len2)

		for k := start; k < end; k++ {
			if s2Matches[k] || s1[i] != s2[k] {
				continue
			}
			s1Matches[i] = true
			s2Matches[k] = true
			matches++
			break
		}
	}

	if matches == 0 {
		return 0.0
	}

	// Count transpositions
	k := 0
	for i := 0; i < len1; i++ {
		if !s1Matches[i] {
			continue
		}
		for !s2Matches[k] {
			k++
		}
		if s1[i] != s2[k] {
			transpositions++
		}
		k++
	}

	// Calculate Jaro distance
	return (float64(matches)/float64(len1) +
		float64(matches)/float64(len2) +
		float64(matches-transpositions/2)/float64(matches)) / 3.0
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
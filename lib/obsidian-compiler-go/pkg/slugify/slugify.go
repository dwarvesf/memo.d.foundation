package slugify

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	// Regex patterns for slugification
	nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9\s_-]`)
	whitespaceRegex      = regexp.MustCompile(`\s+`)
	dashRegex            = regexp.MustCompile(`-+`)
)

// Slugify converts a string to a URL-friendly slug
func Slugify(s string) string {
	// Convert to lowercase
	s = strings.ToLower(s)
	
	// Remove non-alphanumeric characters except spaces, underscores, and hyphens
	s = nonAlphanumericRegex.ReplaceAllString(s, "")
	
	// Replace spaces with hyphens
	s = whitespaceRegex.ReplaceAllString(s, "-")
	
	// Replace multiple hyphens with a single hyphen
	s = dashRegex.ReplaceAllString(s, "-")
	
	// Trim hyphens from the beginning and end
	s = strings.Trim(s, "-")
	
	return s
}

// SlugifyFilename slugifies a filename while preserving the extension
func SlugifyFilename(filename string) string {
	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)
	return Slugify(name) + ext
}

// SlugifyPath slugifies each component of a path
func SlugifyPath(path string) string {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	
	slugifiedDir := SlugifyDirectory(dir)
	slugifiedBase := SlugifyFilename(base)
	
	return filepath.Join(slugifiedDir, slugifiedBase)
}

// SlugifyDirectory slugifies each component of a directory path
func SlugifyDirectory(path string) string {
	parts := strings.Split(path, string(filepath.Separator))
	slugifiedParts := make([]string, len(parts))
	
	for i, part := range parts {
		slugifiedParts[i] = Slugify(part)
	}
	
	return strings.Join(slugifiedParts, string(filepath.Separator))
}

// SlugifyMarkdownLinks slugifies links within markdown content
func SlugifyMarkdownLinks(content string) string {
	// Split content into code blocks and regular content
	parts := splitContentAndCodeBlocks(content)
	
	for i, part := range parts {
		if part.Type == "content" {
			parts[i].Content = slugifyLinksInText(part.Content)
		}
	}
	
	// Join parts back together
	var result strings.Builder
	for _, part := range parts {
		result.WriteString(part.Content)
	}
	
	return result.String()
}

// ContentPart represents a part of the content (either code or regular content)
type ContentPart struct {
	Type    string
	Content string
}

// splitContentAndCodeBlocks splits content into code blocks and regular content
func splitContentAndCodeBlocks(content string) []ContentPart {
	codeBlockRegex := regexp.MustCompile("(?s)```.*?```")
	matches := codeBlockRegex.FindAllStringIndex(content, -1)
	
	var parts []ContentPart
	lastEnd := 0
	
	for _, match := range matches {
		// Add content before code block
		if match[0] > lastEnd {
			parts = append(parts, ContentPart{
				Type:    "content",
				Content: content[lastEnd:match[0]],
			})
		}
		
		// Add code block
		parts = append(parts, ContentPart{
			Type:    "code",
			Content: content[match[0]:match[1]],
		})
		
		lastEnd = match[1]
	}
	
	// Add remaining content
	if lastEnd < len(content) {
		parts = append(parts, ContentPart{
			Type:    "content",
			Content: content[lastEnd:],
		})
	}
	
	return parts
}

// slugifyLinksInText slugifies links in non-code text
func slugifyLinksInText(text string) string {
	linkRegex := regexp.MustCompile(`(!?\[([^\]]*)\]\(([^)]+)\))`)
	
	return linkRegex.ReplaceAllStringFunc(text, func(match string) string {
		submatches := linkRegex.FindStringSubmatch(match)
		if len(submatches) < 4 {
			return match
		}
		
		isImage := strings.HasPrefix(match, "!")
		linkText := submatches[2]
		link := submatches[3]
		
		slugifiedLink := SlugifyLinkPath(link)
		
		if isImage {
			return fmt.Sprintf("![%s](%s)", linkText, slugifiedLink)
		}
		return fmt.Sprintf("[%s](%s)", linkText, slugifiedLink)
	})
}

// SlugifyLinkPath slugifies a link path while preserving certain patterns
func SlugifyLinkPath(link string) string {
	// Don't slugify external links or anchors
	if strings.HasPrefix(link, "http://") || 
	   strings.HasPrefix(link, "https://") || 
	   strings.HasPrefix(link, "#") {
		return link
	}
	
	// Handle links with anchors
	if strings.Contains(link, "#") {
		parts := strings.SplitN(link, "#", 2)
		slugifiedPath := SlugifyPathComponents(parts[0])
		return slugifiedPath + "#" + parts[1]
	}
	
	return SlugifyPathComponents(link)
}

// SlugifyPathComponents slugifies path components
func SlugifyPathComponents(path string) string {
	parts := strings.Split(path, "/")
	slugifiedParts := make([]string, len(parts))
	
	for i, part := range parts {
		switch part {
		case ".", "..", "/":
			slugifiedParts[i] = part
		default:
			slugifiedParts[i] = SlugifyFilename(part)
		}
	}
	
	return strings.Join(slugifiedParts, "/")
}
package linkutils

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/dwarvesfoundation/obsidian-compiler/pkg/frontmatter"
	"github.com/dwarvesfoundation/obsidian-compiler/pkg/slugify"
)

var (
	// Regex pattern for extracting links from Obsidian markdown
	linkPattern = regexp.MustCompile(`!\[\[((?:[^\]]|\.mp4|\.webp|\.png|\.jpg|\.gif|\.svg)+)\]\]|\[\[([^\|\]]+\.md)\|([^\]]+)\]\]|\[\[([^\|\]]+)\|([^\]]+)\]\]|\[\[([^\|\]]+\.md)\]\]|\[\[([^\]]+)\]\]`)
	
	// Regex patterns for link conversion - Go doesn't support lookbehind/lookahead
	wikiLinkWithAltPattern    = regexp.MustCompile(`\[\[([^\|\]]+)\|([^\]]+)\]\]`)
	wikiLinkWithoutAltPattern = regexp.MustCompile(`\[\[([^\]]+)\]\]`)
	embeddedImagePattern      = regexp.MustCompile(`!\[\[([^\]]+)\]\]`)
	markdownLinkPattern       = regexp.MustCompile(`\[([^\]]+)\]\(([^\)]+\.md)\)`)
)

// ExtractLinks extracts all links from markdown content
func ExtractLinks(content string) []string {
	matches := linkPattern.FindAllStringSubmatch(content, -1)
	var links []string

	for _, match := range matches {
		// match[0] is the full match
		// match[1] is image link
		// match[2] is .md file with alt text
		// match[3] is alt text for .md file
		// match[4] is file with alt text
		// match[5] is alt text
		// match[6] is .md file without alt text
		// match[7] is file without alt text

		if match[1] != "" {
			links = append(links, match[1])
		} else if match[2] != "" {
			links = append(links, match[2])
		} else if match[4] != "" {
			links = append(links, match[4])
		} else if match[6] != "" {
			links = append(links, match[6])
		} else if match[7] != "" {
			links = append(links, match[7])
		}
	}

	return links
}

// ResolveLinks resolves links to their corresponding file paths
func ResolveLinks(links []string, allFiles []string, vaultPath string) map[string]string {
	resolved := make(map[string]string)
	
	for _, link := range links {
		paths := findLinkPaths(link, allFiles, vaultPath)
		for k, v := range paths {
			resolved[k] = v
		}
	}

	return resolved
}

// findLinkPaths finds matching file paths for a given link
func findLinkPaths(link string, allFiles []string, vaultPath string) map[string]string {
	result := make(map[string]string)
	downcasedLink := strings.ToLower(link)

	for _, path := range allFiles {
		basename := filepath.Base(path)
		downcasedBasename := strings.ToLower(basename)

		if strings.Contains(basename, link) || strings.Contains(downcasedBasename, downcasedLink) {
			relativePath, _ := filepath.Rel(vaultPath, path)
			result[link] = strings.ToLower(relativePath)
		}
	}

	return result
}

// ConvertLinks converts Obsidian-style links to standard markdown links
func ConvertLinks(content string, resolvedLinks map[string]string, currentFile string) string {
	// Sanitize resolved links
	sanitizedLinks := make(map[string]string)
	for k, v := range resolvedLinks {
		sanitizedKey := strings.ReplaceAll(k, `\|`, "|")
		sanitizedValue := strings.TrimSuffix(v, `\`)
		sanitizedLinks[sanitizedKey] = sanitizedValue
	}

	// Split content into code blocks and regular content
	parts := splitContentAndCodeBlocks(content)
	
	var result strings.Builder
	for _, part := range parts {
		if part.Type == "code" {
			result.WriteString(part.Content)
		} else {
			converted := part.Content
			converted = convertLinksWithAltText(converted, sanitizedLinks, currentFile)
			converted = convertLinksWithoutAltText(converted, sanitizedLinks, currentFile)
			converted = convertEmbeddedImages(converted, sanitizedLinks, currentFile)
			converted = convertMarkdownLinks(converted, sanitizedLinks, currentFile)
			result.WriteString(converted)
		}
	}

	return result.String()
}

// ContentPart represents a part of the content
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
		if match[0] > lastEnd {
			parts = append(parts, ContentPart{
				Type:    "content",
				Content: content[lastEnd:match[0]],
			})
		}
		
		parts = append(parts, ContentPart{
			Type:    "code",
			Content: content[match[0]:match[1]],
		})
		
		lastEnd = match[1]
	}
	
	if lastEnd < len(content) {
		parts = append(parts, ContentPart{
			Type:    "content",
			Content: content[lastEnd:],
		})
	}
	
	return parts
}

// convertLinksWithAltText converts wiki links with alt text
func convertLinksWithAltText(content string, resolvedLinks map[string]string, currentFile string) string {
	return wikiLinkWithAltPattern.ReplaceAllStringFunc(content, func(match string) string {
		submatches := wikiLinkWithAltPattern.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match
		}

		link := submatches[1]
		altText := submatches[2]

		resolvedPath := resolvedLinks[link]
		if resolvedPath == "" {
			resolvedPath = link
		}
		
		resolvedPath = strings.TrimSuffix(resolvedPath, `\`)
		resolvedPath = slugify.SlugifyLinkPath(resolvedPath)
		resolvedPath = removeIndexSuffix(resolvedPath)

		return buildLink(altText, resolvedPath, link, currentFile)
	})
}

// convertLinksWithoutAltText converts wiki links without alt text
func convertLinksWithoutAltText(content string, resolvedLinks map[string]string, currentFile string) string {
	return wikiLinkWithoutAltPattern.ReplaceAllStringFunc(content, func(match string) string {
		submatches := wikiLinkWithoutAltPattern.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}

		link := submatches[1]
		
		resolvedPath := resolvedLinks[link]
		if resolvedPath == "" {
			resolvedPath = link + ".md"
		}
		
		resolvedPath = strings.TrimSuffix(resolvedPath, `\`)
		resolvedPath = slugify.SlugifyLinkPath(resolvedPath)
		resolvedPath = removeIndexSuffix(resolvedPath)

		altText := strings.TrimSuffix(filepath.Base(resolvedPath), ".md")

		return buildLink(altText, resolvedPath, link, currentFile)
	})
}

// convertEmbeddedImages converts embedded images
func convertEmbeddedImages(content string, resolvedLinks map[string]string, currentFile string) string {
	return embeddedImagePattern.ReplaceAllStringFunc(content, func(match string) string {
		submatches := embeddedImagePattern.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}

		link := submatches[1]
		
		resolvedPath := resolvedLinks[link]
		if resolvedPath == "" {
			resolvedPath = link
		}
		
		resolvedPath = strings.TrimSuffix(resolvedPath, `\`)
		resolvedPath = slugify.SlugifyLinkPath(resolvedPath)

		if fileValid(link, currentFile, false) {
			return fmt.Sprintf("![](%s)", resolvedPath)
		}
		return "![]()"
	})
}

// convertMarkdownLinks converts standard markdown links
func convertMarkdownLinks(content string, resolvedLinks map[string]string, currentFile string) string {
	return markdownLinkPattern.ReplaceAllStringFunc(content, func(match string) string {
		submatches := markdownLinkPattern.FindStringSubmatch(match)
		if len(submatches) < 3 {
			return match
		}

		altText := submatches[1]
		link := submatches[2]
		
		resolvedPath := resolvedLinks[link]
		if resolvedPath == "" {
			resolvedPath = link
		}
		
		resolvedPath = strings.TrimSuffix(resolvedPath, `\`)
		resolvedPath = slugify.SlugifyLinkPath(resolvedPath)
		resolvedPath = removeIndexSuffix(resolvedPath)

		return buildLink(altText, resolvedPath, link, currentFile)
	})
}

// buildLink builds a markdown link
func buildLink(altText, resolvedPath, link, currentFile string) string {
	if fileValid(link, currentFile, false) {
		return fmt.Sprintf("[%s](%s)", altText, resolvedPath)
	}
	return fmt.Sprintf("[%s]()", altText)
}

// fileValid checks if a file link is valid
func fileValid(link, currentFile string, checkFrontmatter bool) bool {
	link = strings.ReplaceAll(link, "%20", " ")
	currentDir := filepath.Dir(currentFile)
	fullPath := filepath.Join(currentDir, link)
	normalizedPath, _ := filepath.Abs(fullPath)

	// Check if file exists
	if _, err := os.Stat(normalizedPath); err == nil {
		if checkFrontmatter {
			return frontmatter.ContainsRequiredKeys(normalizedPath)
		}
		return true
	}

	// For index/readme files, try case-insensitive matching
	filename := filepath.Base(link)
	lowercaseFilename := strings.ToLower(filename)
	
	if lowercaseFilename == "index.md" || lowercaseFilename == "readme.md" ||
	   lowercaseFilename == "index.mdx" || lowercaseFilename == "readme.mdx" {
		return caseInsensitiveFileExists(currentDir, filename)
	}

	return false
}

// caseInsensitiveFileExists checks if a file exists with case-insensitive matching
func caseInsensitiveFileExists(directory, targetFilename string) bool {
	targetLowercase := strings.ToLower(targetFilename)
	
	entries, err := os.ReadDir(directory)
	if err != nil {
		return false
	}

	for _, entry := range entries {
		if strings.ToLower(entry.Name()) == targetLowercase {
			return true
		}
	}

	return false
}

// removeIndexSuffix removes _index suffixes from paths
func removeIndexSuffix(path string) string {
	path = strings.ReplaceAll(path, "_index.md", ".md")
	path = strings.ReplaceAll(path, "_index", "")
	return path
}

// IsURL checks if a string is a URL
func IsURL(link string) bool {
	u, err := url.Parse(link)
	return err == nil && u.Scheme != "" && u.Host != ""
}
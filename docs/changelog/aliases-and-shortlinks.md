# Documentation for Global Folder-Level Aliases and Short Links

This document explains how to use global folder-level aliases and short links in your Markdown files and configuration files.

## Global Folder-Level Aliases

Global folder-level aliases allow you to create alternative paths for accessing content within a specific folder. This is useful for providing shorter or more memorable links to frequently accessed directories.

To create a global folder-level alias for a folder, you need to create or edit the `.config.yaml` or `.config.yml` file within that folder in the `vault` directory. Add an `aliases` key with a list of alias paths (starting with a `/`) that should point to this folder.

**Example:**

To create an alias `/culture-alias` that points to the `/vault/culture` folder, you would create or edit `vault/culture/config.yaml` and add the following:

```yaml
aliases:
  - /culture-alias
```

After adding the alias and running the export process, you can access any file within the `/vault/culture` folder using the `/culture-alias` path. For example, if you have a file at `/vault/culture/about.md`, you can access it via `/culture-alias/about`.

**Important:**

- Alias paths must start with a `/`.
- The `config.yaml` file should be placed in the root of the folder you want to alias.
- You need to run the export process after modifying `config.yaml` for the changes to take effect.

## Short Links (Redirects)

Short links allow you to create shorter or alternative URLs that generate static files for SEO purposes, referring to a different, usually longer, URL. This is useful for creating clean and easy-to-share links while improving search engine visibility.

To create a short link for a specific Markdown file, you need to add a `aliases` key to the frontmatter of that Markdown file in the `vault` directory. The `aliases` key should have a list of short link paths (starting with a `/`) that should refer to this file.

**Example:**

To create a short link `/share/ai-travel` that refers to the Markdown file at `/vault/updates/build-log/ai-ruby-travel-assistant-chatbot.md`, you would add the following to the frontmatter of `vault/updates/build-log/ai-ruby-travel-assistant-chatbot.md`:

```yaml
---
title: 'AI-powered Ruby travel assistant'
description: 'A case study exploring how we built an AI-powered travel assistant using Ruby and AWS Bedrock, demonstrating how choosing the right tools over popular choices led to a more robust and maintainable solution. This study examines our approach to integrating AI capabilities within existing Ruby infrastructure while maintaining enterprise security standards.'
date: '2024-11-21'
authors:
  - 'monotykamary'
tags:
  - 'agents'
  - 'ai'
aliases:
  - /share/ai-travel
---

> "When the easy path isn't the right path, true engineering shines in adapting the right tools for the job."

## The challenge: Beyond the obvious choice
...
```

After adding the short link and running the export process, a static file will be generated at `/share/ai-travel` that points to the `/updates/build-log/ai-ruby-travel-assistant-chatbot` page for SEO purposes.

**Important:**

- Short link paths must start with a `/`.
- The `aliases` key should be in the frontmatter of the target Markdown file.
- You can define multiple short links for a single file by adding more entries under the `aliases` key.
- You need to run the export process after modifying the Markdown file for the changes to take effect.

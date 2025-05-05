# Set UTF-8 Locale in Dockerfile

## Status

Accepted

## Context

Filenames containing special characters, such as the paragraph sign (¶), were not being correctly handled during the markdown export process and when serving the static files within Docker containers, particularly on Linux environments. This led to compilation errors and files not being rendered.

Initial attempts to fix this focused on refining the slugification logic in the application code. While improving slugification is still valuable, it was determined that the Docker environment's locale settings were a significant factor in the character handling issues.

## Decision

We will set the `LANG` and `LC_ALL` environment variables to `C.UTF-8` in both the `builder` and `runner` stages of the `Dockerfile`.

## Reasoning

Alpine Linux, often used as a base image for Docker containers due to its small size, may have limited default locale and character set support. Explicitly setting `LANG` and `LC_ALL` to a UTF-8 locale ensures that the Docker environment has the necessary configuration to correctly process and handle filenames and content containing UTF-8 characters throughout the build and serving processes. This is a standard practice for resolving character encoding issues in minimal Linux environments.

## Consequences

- Filenames and content with special characters should now be handled correctly within the Docker build and serving environment.
- The markdown export process should no longer encounter errors related to character encoding for valid UTF-8 characters.
- Files with special characters in their original names should be correctly slugified and served.
- This change provides a more robust solution for character handling at the environment level, complementing the application-level slugification.

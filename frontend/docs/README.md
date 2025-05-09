# Graphify GitHub Pages Deployment

This directory contains the production build of Graphify for GitHub Pages deployment. The contents are automatically generated through the GitHub Actions workflow.

## Deployment Process

The deployment is handled through GitHub Actions using the workflow defined in `.github/workflows/github-pages.yml`. When changes are pushed to the main branch, the workflow:

1. Builds the Angular application with the `github-pages` configuration
2. Deploys the build output to GitHub Pages

## Notes

- The site is accessible at: https://iixxixii.github.io/Graphify/
- Hash-based routing is used for compatibility with GitHub Pages
- Mock data is used since this is a frontend-only deployment

Do not manually edit files in this directory as they will be overwritten during the next deployment.

#!/bin/bash
# Graphify Codebase Cleanup Script
# Removes legacy files and directories based on CODEBASE_CLEANUP_PLAN.md

set -e # Exit on error

echo "🧹 Starting Graphify codebase cleanup..."

# Delete obsolete directories
echo "Removing obsolete directories..."
rm -rf src/cli/commands/
rm -rf src/cli/ui/
rm -rf src/plugins/patterns/
rm -rf src/core/patterns/
rm -rf src/core/analytics/
rm -rf src/domain/analytics/
rm -rf src/domain/patterns/
rm -rf src/models/

# Delete specific obsolete files
echo "Removing obsolete files..."
rm -f src/core/graphify.ts
rm -f src/config/schema.ts
rm -f src/plugins/basePatternPlugin.ts
rm -f src/plugins/patterns/basePatternPlugin.ts
rm -f src/plugins/patterns/randomPattern.ts
rm -f src/plugins/patterns/realisticPattern.ts

# Make clean script executable
chmod +x clean.sh

echo "✅ Cleanup complete!"
echo "Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Build the project: npm run build"
echo "3. Run tests: npm test"

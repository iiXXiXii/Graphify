#!/bin/bash
# Improved Graphify Codebase Cleanup & ESM Migration Script
# Works across different operating systems including Linux, macOS, and Windows (Git Bash)

set -e # Exit on error

echo "🧹 Starting Graphify codebase cleanup & ESM migration..."

# Step 1: Remove legacy files and directories
echo "Step 1: Removing obsolete directories..."
rm -rf src/cli/commands/ 2>/dev/null || true
rm -rf src/cli/ui/ 2>/dev/null || true
rm -rf src/plugins/patterns/ 2>/dev/null || true
rm -rf src/core/patterns/ 2>/dev/null || true
rm -rf src/core/analytics/ 2>/dev/null || true
rm -rf src/domain/analytics/ 2>/dev/null || true
rm -rf src/domain/patterns/ 2>/dev/null || true
rm -rf src/models/ 2>/dev/null || true

# Step 2: Remove specific obsolete files
echo "Step 2: Removing obsolete files..."
rm -f src/core/graphify.ts 2>/dev/null || true
rm -f src/config/schema.ts 2>/dev/null || true
rm -f src/plugins/basePatternPlugin.ts 2>/dev/null || true
rm -f src/config/user.ts 2>/dev/null || true
rm -f src/index.js 2>/dev/null || true

# Step 3: Set up ESM configuration
echo "Step 3: Setting up ESM configuration..."
# Create a Node.js script to update package.json
cat > update-package.js << 'EOL'
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

if (!packageJson.type) {
  packageJson.type = 'module';
  fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));
  console.log('- Added ESM type to package.json');
} else {
  console.log('- package.json already has "type" field');
}
EOL

# Run the script
node update-package.js
rm update-package.js

# Step 4: Update TypeScript configuration
echo "Step 4: Updating TypeScript configuration..."
cat > tsconfig.json << 'EOL'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOL

# Step 5: Update Jest configuration
echo "Step 5: Setting up Jest for ESM..."
cat > jest.config.mjs << 'EOL'
/**
 * Jest configuration for ESM compatibility
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  // Add coverage threshold if needed
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
EOL

# Step 6: Create a Node.js script to update imports
echo "Step 6: Updating import statements in TypeScript files to include .js extensions..."
cat > update-imports.js << 'EOL'
const fs = require('fs');
const path = require('path');

function findTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(findTsFiles(filePath));
    } else if (file.endsWith('.ts')) {
      results.push(filePath);
    }
  });

  return results;
}

function updateImports(filePath) {
  console.log(`- Processing ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Match import statements with relative paths that don't have file extensions
  // This handles both single and double quotes
  const doubleQuoteRegex = /from\s+"(\.\.?\/[^"]+)"/g;
  const singleQuoteRegex = /from\s+'(\.\.?\/[^']+)'/g;

  // Replace matches that don't already have .js extension
  content = content.replace(doubleQuoteRegex, (match, path) => {
    if (!path.endsWith('.js')) {
      return `from "${path}.js"`;
    }
    return match;
  });

  content = content.replace(singleQuoteRegex, (match, path) => {
    if (!path.endsWith('.js')) {
      return `from '${path}.js'`;
    }
    return match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
}

try {
  const tsFiles = findTsFiles('./src');
  tsFiles.forEach(updateImports);
  console.log(`Updated imports in ${tsFiles.length} files`);
} catch (error) {
  console.error('Error updating imports:', error);
}
EOL

# Run the script
node update-imports.js
rm update-imports.js

# Step 7: Install missing dependencies if needed
echo "Step 7: Checking for missing dependencies..."
if ! npm list ts-jest &>/dev/null; then
  echo "- Installing ts-jest for ESM compatibility"
  npm install --save-dev ts-jest@latest
fi

echo "✅ Cleanup and ESM migration complete!"
echo ""
echo "Next steps:"
echo "1. Review the files in src/ to fix any remaining issues"
echo "2. Install dependencies: npm install"
echo "3. Build the project: npm run build"
echo "4. Run tests: npm test"
echo ""
echo "Note: You may still need to manually fix certain files that reference"
echo "deleted modules or require more complex import updates."

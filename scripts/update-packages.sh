#!/bin/bash

echo "🔄 Updating root package dependencies..."
# Update root package dependencies
npx npm-check-updates

echo "📦 Updating individual package dependencies..."
echo "  ↳ Updating @docs.plus/webapp..."
npx lerna exec --scope=@docs.plus/webapp -- npx npm-check-updates
echo "  ↳ Updating @docs.plus/supabase_back..."
npx lerna exec --scope=@docs.plus/supabase_back -- npx npm-check-updates
echo "  ↳ Updating @docs.plus/hocuspocus..."
npx lerna exec --scope=@docs.plus/hocuspocus -- npx npm-check-updates
echo "  ↳ Updating @docs.plus/extension-hyperlink..."
npx lerna exec --scope=@docs.plus/extension-hyperlink -- npx npm-check-updates
echo "  ↳ Updating @docs.plus/extension-indent..."
npx lerna exec --scope=@docs.plus/extension-indent -- npx npm-check-updates

echo "✨ All packages updated successfully!"
echo ""
echo -e "\033[1;33m⚠️  IMPORTANT: Please review manually the updated package versions in package.json files.\033[0m"
echo -e "\033[1;37m   Once you've verified there are no incompatible or unsupported versions,\033[0m"
echo -e "\033[1;37m   run the following command to install the new dependencies:\033[0m"
echo ""
echo -e "\033[1;32m   yarn reinstall:all-packages\033[0m"
echo ""

#!/bin/bash

# Update root package dependencies
ncu -u

# Update individual package dependencies
npx lerna exec --scope=@docs.plus/webapp -- ncu -u
npx lerna exec --scope=@docs.plus/supabase_back -- ncu -u
npx lerna exec --scope=@docs.plus/hocuspocus -- ncu -u
npx lerna exec --scope=@docs.plus/extension-hyperlink -- ncu -u

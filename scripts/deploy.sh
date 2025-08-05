#!/bin/bash

# Deployment script for EasyPanel

echo "🚀 Starting deployment to EasyPanel..."

# Check if required environment variables are set
if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "❌ Error: VITE_SUPABASE_URL environment variable is not set"
    exit 1
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: VITE_SUPABASE_ANON_KEY environment variable is not set"
    exit 1
fi

echo "✅ Environment variables validated"

# Run build
echo "🔨 Building application..."
./scripts/build.sh

if [ $? -ne 0 ]; then
    echo "❌ Build failed, aborting deployment"
    exit 1
fi

echo "✅ Application built successfully"
echo "🎉 Ready for EasyPanel deployment!"
echo ""
echo "Next steps:"
echo "1. Push your code to your Git repository"
echo "2. Configure your EasyPanel app to use this repository"
echo "3. Set the environment variables in EasyPanel dashboard"
echo "4. Deploy!"
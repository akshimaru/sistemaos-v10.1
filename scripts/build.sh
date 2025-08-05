#!/bin/bash

# Build script for production deployment

echo "🚀 Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📁 Build output available in 'dist' directory"
else
    echo "❌ Build failed!"
    exit 1
fi

# Display build info
echo "📊 Build information:"
echo "- Build time: $(date)"
echo "- Node version: $(node --version)"
echo "- NPM version: $(npm --version)"

echo "🎉 Ready for deployment!"
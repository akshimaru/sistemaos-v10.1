# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Adiciona argumentos para as variáveis do Supabase
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_URL
ARG VITE_APP_ENV=production
ARG VITE_APP_VERSION=1.0.0

# Define as variáveis de ambiente para o build
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Copy package files explicitly (garantindo sincronização)
COPY package.json ./
COPY package-lock.json ./

# Install dependencies (npm ci com lockfile sincronizado)
RUN npm ci

# Copy arquivos de configuração
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./

# Copy código fonte
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
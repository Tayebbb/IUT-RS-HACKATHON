# Use official Node 20 Alpine for small footprint
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Set non-root user for security
USER node

# HuggingFace Spaces requires port 7860
EXPOSE 7860

# Healthcheck — uses PORT env var with fallback to 7860
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-7860}/api/usage || exit 1

# Start the application with dumb-init
CMD ["dumb-init", "node", "src/server.js"]

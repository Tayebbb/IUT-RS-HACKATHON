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
ENV PORT=7860
EXPOSE 7860

# Healthcheck — gives the Node.js server 60s to boot before checking
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7860/api/usage || exit 1

# Start the application with dumb-init
CMD ["dumb-init", "node", "src/server.js"]

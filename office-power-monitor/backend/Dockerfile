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

# Expose backend port
EXPOSE 4000

# Healthcheck to verify the server is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/usage || exit 1

# Start the application with dumb-init
CMD ["dumb-init", "node", "src/server.js"]

# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build args for Vite
ARG VITE_BACKEND_URL
ARG VITE_SOCKET_URL

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Build the production optimized bundle
RUN npm run build

# Stage 2: Serve the application with Nginx (Unprivileged)
FROM nginxinc/nginx-unprivileged:alpine

# Remove default nginx static assets
USER root
RUN rm -rf /usr/share/nginx/html/*
USER nginx

# Copy the custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from Stage 1
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Expose non-privileged port 8080
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

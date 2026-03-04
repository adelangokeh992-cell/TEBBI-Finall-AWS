# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* ./
RUN yarn install --frozen-lockfile || npm ci || npm install

COPY . .
RUN yarn build || npm run build

# Serve stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# SPA: fallback to index.html for client-side routing
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

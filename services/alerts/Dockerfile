FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p /app/logs && chown -R node:node /app/logs
USER node
EXPOSE 4000
CMD ["node", "src/index.js"]

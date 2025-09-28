FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production PORT=5001
EXPOSE 5001
CMD ["npm","start"]   # or ["node","src/app.js"] if you do not use npm start
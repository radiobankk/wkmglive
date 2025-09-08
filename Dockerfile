FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM node:18-slim
WORKDIR /app
COPY --from=build /app .
RUN apt-get update && apt-get install -y ffmpeg
EXPOSE 3000
CMD ["node", "server.js"]

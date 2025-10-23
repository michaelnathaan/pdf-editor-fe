FROM node:22-alpine AS build

WORKDIR /app

RUN npm install -g npm@latest

COPY package.json package-lock.json* ./

RUN npm pkg delete scripts.postinstall

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

FROM node:22-alpine AS production

RUN npm install -g serve

WORKDIR /app

COPY --from=build /app/dist ./dist

EXPOSE $VITE_API_PORT

CMD ["sh", "-c", "serve -s dist -l $VITE_API_PORT"]
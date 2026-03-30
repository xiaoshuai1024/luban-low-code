FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV NUXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=4173
ENV PORT=4173
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 4173
CMD ["node", ".output/server/index.mjs"]

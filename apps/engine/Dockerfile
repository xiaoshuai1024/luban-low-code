FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));delete p.pnpm;fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
RUN npm install && npm run build

FROM nginx:1.26-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/docker/nginx-manage.conf /etc/nginx/conf.d/default.conf
EXPOSE 4200

# Build
FROM golang:1.25-alpine AS build
WORKDIR /app

# 利用模块缓存
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

# Run
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /app/server /app/server

ENV APP_PORT=8080
ENV APP_ENV=dev
EXPOSE 8080
ENTRYPOINT ["/app/server"]

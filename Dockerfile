# Stage 1: Build the Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /app
# Copy go.mod and go.sum and install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the binary statically
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Create a minimal runtime image
FROM alpine:latest

WORKDIR /app

# Install ca-certificates and tzdata
RUN apk --no-cache add ca-certificates tzdata

# Copy the binary from the builder stage
COPY --from=builder /app/main .

# Copy static assets and templates
COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates

# Create data directory for volume mount
RUN mkdir -p /app/data

# Expose port (default 3000, can be overridden)
EXPOSE 3000

# Run the binary
CMD ["./main"]

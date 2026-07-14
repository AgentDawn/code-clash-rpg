#!/bin/bash
set -e

APP_NAME="code-clash-rpg"
PORT_1=3001
PORT_2=3002
NGINX_CONF_PATH="/etc/nginx/conf.d/code-clash.inc"
IMAGE=${IMAGE_TAG:-"ghcr.io/agentdawn/code-clash-rpg:latest"}

echo "Preparing deployment using image: $IMAGE"

# Ensure the data volume exists
docker volume create code-clash-data

# Pull the latest image
docker pull $IMAGE

# Determine active port by checking which container is running
ACTIVE_PORT=""
if docker ps --format '{{.Names}}' | grep -q "${APP_NAME}-${PORT_1}"; then
    ACTIVE_PORT=$PORT_1
elif docker ps --format '{{.Names}}' | grep -q "${APP_NAME}-${PORT_2}"; then
    ACTIVE_PORT=$PORT_2
fi

if [ "$ACTIVE_PORT" = "$PORT_1" ]; then
    IDLE_PORT=$PORT_2
else
    IDLE_PORT=$PORT_1
fi

echo "Active port is ${ACTIVE_PORT:-None}. Deploying to idle port: $IDLE_PORT"

# Stop and remove any old container on the idle port if it somehow exists
docker stop ${APP_NAME}-${IDLE_PORT} 2>/dev/null || true
docker rm ${APP_NAME}-${IDLE_PORT} 2>/dev/null || true

# Start new container on IDLE_PORT
echo "Starting new container ${APP_NAME}-${IDLE_PORT}..."
docker run -d \
    --name ${APP_NAME}-${IDLE_PORT} \
    -p $IDLE_PORT:3000 \
    -e PORT=3000 \
    -e DATA_DIR=/app/data \
    -v code-clash-data:/app/data \
    $IMAGE

echo "Waiting for health check..."

# Wait and health check
HEALTHY=false
for i in {1..15}; do
    if curl -s "http://localhost:$IDLE_PORT" > /dev/null; then
        echo "Health check passed!"
        HEALTHY=true
        break
    fi
    echo "Waiting for service to be healthy... ($i/15)"
    sleep 2
done

if [ "$HEALTHY" != "true" ]; then
    echo "Health check failed. Check docker logs:"
    docker logs ${APP_NAME}-${IDLE_PORT}
    echo "Rolling back (Killing new instance)..."
    docker stop ${APP_NAME}-${IDLE_PORT}
    docker rm ${APP_NAME}-${IDLE_PORT}
    exit 1
fi

echo "Switching Nginx routing to port $IDLE_PORT..."
echo "set \$upstream_port $IDLE_PORT;" | sudo tee $NGINX_CONF_PATH > /dev/null

# Reload Nginx
sudo systemctl reload nginx
echo "Nginx reloaded successfully."

# Stop old instance
if [ -n "$ACTIVE_PORT" ]; then
    echo "Stopping old container ${APP_NAME}-${ACTIVE_PORT}..."
    docker stop ${APP_NAME}-${ACTIVE_PORT}
    docker rm ${APP_NAME}-${ACTIVE_PORT}
fi

echo "Deployment complete! Application is now serving on port $IDLE_PORT via Docker."

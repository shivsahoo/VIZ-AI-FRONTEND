# Fix for "Enhance with AI" 404 Error in Deployment

## Problem

The "Enhance with AI" feature was working locally but showing a 404 error in deployment:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
Failed to enhance description: Error: Not Found
```

## Root Cause

The frontend was using `VITE_WEBSOCKET_URL` to determine the LLM service HTTP URL. In production:
1. `VITE_WEBSOCKET_URL` might not be set, causing it to default to `http://localhost:8001`
2. When accessed from a browser, `localhost:8001` refers to the user's local machine, not the server
3. This causes the API call to fail with a 404 error

## Solution

Added a dedicated environment variable `VITE_LLM_SERVICE_URL` for the LLM service HTTP API endpoint with proper fallback logic:

1. **Priority 1**: Use `VITE_LLM_SERVICE_URL` if set (recommended for production)
2. **Priority 2**: Convert `VITE_WEBSOCKET_URL` to HTTP if available
3. **Priority 3**: Default to `http://localhost:8001` for local development

## Changes Made

1. **Updated `src/vite-env.d.ts`**: Added `VITE_LLM_SERVICE_URL` to TypeScript definitions
2. **Updated `src/components/features/projects/ProjectCreationForm.tsx`**: Improved `getLLMServiceUrl()` function with proper fallback logic

## Deployment Instructions

### For Production Deployment

Set the `VITE_LLM_SERVICE_URL` environment variable to your LLM service HTTP URL:

```bash
# Example for production
VITE_LLM_SERVICE_URL=https://vizai-llm.webknot-dev.in
# or
VITE_LLM_SERVICE_URL=http://your-llm-service-host:8001
```

### For Docker Build

**Important**: Vite environment variables must be available at **build time**, not runtime. They are embedded in the JavaScript bundle.

#### Option 1: Build Args (Recommended)

Update your `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Build with environment variables
ARG VITE_LLM_SERVICE_URL
ARG VITE_API_BASE_URL
ARG VITE_WEBSOCKET_URL

ENV VITE_LLM_SERVICE_URL=$VITE_LLM_SERVICE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WEBSOCKET_URL=$VITE_WEBSOCKET_URL

RUN yarn build

# Serve the built files
FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build with:
```bash
docker build \
  --build-arg VITE_LLM_SERVICE_URL=https://vizai-llm.webknot-dev.in \
  --build-arg VITE_API_BASE_URL=https://vizai-be.webknot-dev.in \
  --build-arg VITE_WEBSOCKET_URL=wss://vizai-llm.webknot-dev.in \
  -t vizai-frontend .
```

#### Option 2: Environment File

Create a `.env.production` file:

```env
VITE_LLM_SERVICE_URL=https://vizai-llm.webknot-dev.in
VITE_API_BASE_URL=https://vizai-be.webknot-dev.in
VITE_WEBSOCKET_URL=wss://vizai-llm.webknot-dev.in
```

Then build:
```bash
docker build -t vizai-frontend .
```

#### Option 3: Docker Compose

Update `docker-compose.yml`:

```yaml
services:
  vizai_frontend:
    build:
      context: .
      args:
        VITE_LLM_SERVICE_URL: ${VITE_LLM_SERVICE_URL}
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
        VITE_WEBSOCKET_URL: ${VITE_WEBSOCKET_URL}
    ports:
      - "3000:3000"
    environment:
      - HOST=0.0.0.0
      - PORT=3000
    restart: always
```

### For Development

Create a `.env.local` file in the frontend root:

```env
VITE_LLM_SERVICE_URL=http://localhost:8001
VITE_API_BASE_URL=http://localhost:8000
VITE_WEBSOCKET_URL=ws://localhost:8001
```

## Verification

After deployment, verify the fix:

1. Open browser developer tools (F12)
2. Go to Network tab
3. Click "Enhance with AI" button
4. Check the request URL - it should point to your production LLM service, not `localhost:8001`
5. The request should succeed with a 200 status code

## API Endpoint

The endpoint being called is:
- **Method**: POST
- **URL**: `${VITE_LLM_SERVICE_URL}/api/v1/enhance-text`
- **Body**: `{ "text": "your description text" }`
- **Response**: `{ "enhanced_text": "...", "original_text": "..." }`

This endpoint is registered in `vizAi_LLM_service/app/main.py`:
```python
app.include_router(text_enhancement_router, prefix="/api/v1", tags=["Text Enhancement"])
```

## Notes

- Vite environment variables are **build-time** variables, not runtime variables
- They must be set during `yarn build` or `docker build`
- Changing environment variables after build requires rebuilding the application
- The `VITE_` prefix is required for Vite to expose the variable to the client code


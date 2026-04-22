#FROM node:18-alpine

#WORKDIR /app

#COPY package*.json yarn.lock ./
#RUN yarn install --frozen-lockfile

#COPY . .

# Expose port 3000
#EXPOSE 3000

# Start in development mode
#CMD ["yarn", "dev", "--host", "0.0.0.0", "--port", "3000"]
FROM node:18-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create working directory
WORKDIR /app

# Copy Yarn dependency files only
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Ensure correct permissions
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start app
CMD ["yarn", "dev", "--host", "0.0.0.0", "--port", "3000"]

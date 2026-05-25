# Base image with Node 20 and Playwright dependencies installed
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Set environment variables for Next.js and Playwright
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy package files and prisma schema (needed for postinstall hook)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# Set Node environment to production and set port for Hugging Face Spaces
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Start the application on port 7860
CMD ["npm", "start", "--", "-p", "7860"]

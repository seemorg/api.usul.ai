# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.17.1
ARG PNPM_VERSION=9.6.0
FROM node:${NODE_VERSION}-slim as base

# NestJS app lives here
WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential

# Throw-away build stage to reduce size of final image
FROM base as builder

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install pnpm
RUN npm install -g pnpm@$PNPM_VERSION

COPY . .
  
RUN pnpm install

ENV NODE_ENV="production"

RUN pnpm build
  
# Final stage for app image
FROM base AS runner

# Set production environment
ENV NODE_ENV="production"
ENV PORT=3000

# Copy built application
COPY --from=builder /app /app

RUN find /app -type d -name "src" -exec rm -rf {} +

# Start the server by default, this can be overwritten at runtime
EXPOSE ${PORT}

CMD [ "npm", "start" ]
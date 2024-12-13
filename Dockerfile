ARG NODE_VERSION=20.10.0
ARG PNPM_VERSION=9.6.0
FROM node:${NODE_VERSION}-slim as base

# NestJS app lives here
WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libcairo2-dev libpango1.0-dev

# Throw-away build stage to reduce size of final image
FROM base as builder

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install pnpm
RUN npm install -g pnpm@$PNPM_VERSION

COPY . .
  
RUN pnpm install --frozen-lockfile
# Set production environment
ENV NODE_ENV="production"

RUN pnpm build
  
# Final stage for app image
FROM base AS runner

ENV PORT=3000

# Copy built application
COPY --from=builder /app /app

RUN rm -rf /app/src
RUN rm -rf /app/backups
RUN rm -rf /app/workers
RUN rm -rf /app/scripts

# Set production environment
ENV NODE_ENV="production"

# Start the server by default, this can be overwritten at runtime
EXPOSE ${PORT}

CMD [ "npm", "start" ]
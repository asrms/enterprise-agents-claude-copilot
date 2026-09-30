# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Deploy by SSH and git pull
```bash
ssh prod-web-1
cd /var/www/shop && git pull origin main
composer install                    # dev dependencies installed in production
php artisan migrate:fresh --force   # wipes the production database
php artisan config:clear            # runs without caches; APP_DEBUG=true still in .env
# queue workers keep running old code; uploads stored in storage/app on this server only
```
**Why it's wrong:**
- Builds happen on the server, dev dependencies ship, and a destructive command wipes production data.
- Workers run stale code, debug mode leaks errors, and files live on one instance.

## Best Practice (How to do it right)

### 1. Multi-stage container image with PHP-FPM
```dockerfile
# syntax=docker/dockerfile:1
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-scripts --no-interaction --no-autoloader
COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM php:8.4-fpm-alpine AS runtime
RUN docker-php-ext-install pdo_pgsql opcache
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
WORKDIR /var/www/html
COPY --from=vendor --chown=www-data:www-data /app ./
COPY --from=assets --chown=www-data:www-data /app/public/build ./public/build
USER www-data
```
### 2. Release steps in the pipeline
```bash
# 1. migrations (one job, backward compatible)
kubectl -n shop run migrate-$GIT_SHA --image="$IMAGE" --restart=Never --rm -i -- php artisan migrate --force
# 2. rolling update of web, horizon, and scheduler deployments to the new image
kubectl -n shop set image deploy/web app="$IMAGE" deploy/horizon app="$IMAGE" deploy/scheduler app="$IMAGE"
kubectl -n shop rollout status deploy/web --timeout=5m
# 3. smoke test, automatic rollback on failure
curl -fsS https://shop.example.com/up || kubectl -n shop rollout undo deploy/web
```
```text
Container start command (web): php artisan optimize && php-fpm
Horizon container: php artisan horizon   (terminated gracefully on rollout, picks up new code)
Scheduler container: php artisan schedule:work   (single replica)
```
**Why it's right:**
- The image contains only production dependencies and compiled assets, runs as non-root, and caches are built at start with real configuration.
- Migrations run once before rollout, web and workers update together, and a smoke test triggers rollback.

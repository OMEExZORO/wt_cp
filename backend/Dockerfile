FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --ignore-platform-reqs

FROM php:8.3-apache
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql opcache \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite headers
ENV PORT=8080
ENV APACHE_DOCUMENT_ROOT=/var/www/backend/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf \
    && sed -ri -e 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf \
    && sed -ri -e 's!Listen 80!Listen ${PORT}!g' /etc/apache2/ports.conf \
    && sed -ri -e 's!<VirtualHost \*:80>!<VirtualHost *:${PORT}>!g' /etc/apache2/sites-available/*.conf \
    && echo "ServerTokens Prod" > /etc/apache2/conf-enabled/zz-hardening.conf \
    && echo "ServerSignature Off" >> /etc/apache2/conf-enabled/zz-hardening.conf \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf '%s\n' \
        'expose_php = Off' \
        'upload_max_filesize = 12M' \
        'post_max_size = 13M' \
        'opcache.enable = 1' \
        'opcache.memory_consumption = 128' \
        'opcache.max_accelerated_files = 10000' \
        'opcache.validate_timestamps = 1' \
        'opcache.revalidate_freq = 2' \
        > "$PHP_INI_DIR/conf.d/zz-diagnocare.ini"
WORKDIR /var/www/backend
COPY . /var/www/backend
COPY --from=vendor /app/vendor /var/www/backend/vendor
RUN mkdir -p /var/www/backend/storage/sessions /var/www/backend/storage/logs /var/www/backend/storage/reports /var/www/backend/storage/uploads \
    && chown -R www-data:www-data /var/www/backend/storage /var/run/apache2 /var/log/apache2 /var/lock/apache2
USER www-data
EXPOSE 8080

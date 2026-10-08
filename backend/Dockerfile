FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --ignore-platform-reqs

FROM php:8.3-apache
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite headers
ENV APACHE_DOCUMENT_ROOT=/var/www/backend/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf \
    && sed -ri -e 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && echo "expose_php = Off" > "$PHP_INI_DIR/conf.d/zz-diagnocare.ini" \
    && echo "upload_max_filesize = 12M" >> "$PHP_INI_DIR/conf.d/zz-diagnocare.ini" \
    && echo "post_max_size = 13M" >> "$PHP_INI_DIR/conf.d/zz-diagnocare.ini"
WORKDIR /var/www/backend
COPY . /var/www/backend
COPY --from=vendor /app/vendor /var/www/backend/vendor
RUN mkdir -p /var/www/backend/storage && chown -R www-data:www-data /var/www/backend/storage
EXPOSE 80

FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite

COPY . /var/www/html/
RUN mkdir -p /var/www/html/data \
 && chown -R www-data:www-data /var/www/html/data

VOLUME /var/www/html/data
EXPOSE 80

#!/bin/sh
set -eu
# Bind inputs remain read-only. The official entrypoint drops to mysql before
# processing init SQL; copy with that user's ownership, including private key.
install -d -m 700 -o mysql -g mysql /run/mysql-tls
install -m 444 -o mysql -g mysql /input/ca.pem /run/mysql-tls/ca.pem
install -m 444 -o mysql -g mysql /input/server.pem /run/mysql-tls/server.pem
install -m 400 -o mysql -g mysql /input/server.key /run/mysql-tls/server.key
install -m 400 -o mysql -g mysql /input/initialize.sql /docker-entrypoint-initdb.d/initialize.sql
exec /usr/local/bin/docker-entrypoint.sh "$@"

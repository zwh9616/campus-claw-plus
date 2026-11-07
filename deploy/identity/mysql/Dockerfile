FROM golang@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS gosu
WORKDIR /src
# Unmodified gosu 1.19 (6456aaa0f3c854d199d0f037f068eb97515b7513), Apache-2.0.
# The archive checksum fails closed if the upstream tag is moved.
ADD --checksum=sha256:cd9719b775dbfedae53923c9b0dc792b66d42c51e0b36652ed6f747fbadc0164 https://codeload.github.com/tianon/gosu/tar.gz/refs/tags/1.19 /tmp/gosu.tar.gz
RUN tar -xzf /tmp/gosu.tar.gz --strip-components=1 -C /src \
    && GOTOOLCHAIN=local CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/gosu .

FROM mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902
# mysqlsh and its bundled Python packages are unused by the official entrypoint,
# our offline Go admin, and the mysql/mysqladmin clients. Remove the actual RPM,
# including payload; never remove only vulnerability/package metadata.
RUN microdnf remove -y mysql-shell \
    && microdnf clean all \
    && ! command -v mysqlsh \
    && test ! -d /usr/lib/mysqlsh \
    && mysqld --version | grep '8.4.13' \
    && mysql --version
COPY --from=gosu /out/gosu /usr/local/bin/gosu
COPY --from=gosu /src/LICENSE /usr/share/licenses/campus-gosu/LICENSE
RUN gosu --version \
    && test "$(gosu mysql id -u)" = 999 \
    && test "$(gosu mysql id -g)" = 999

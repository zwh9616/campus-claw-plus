FROM golang@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS build
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 go build -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o /out/server ./cmd/server

FROM scratch
COPY --from=build /out/server /server
USER 65532:65532
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=5 CMD ["/server","--healthcheck"]
ENTRYPOINT ["/server"]

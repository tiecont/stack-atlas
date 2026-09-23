FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /atlas-demo-api ./cmd/server

FROM scratch
COPY --from=build /atlas-demo-api /atlas-demo-api
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/atlas-demo-api"]

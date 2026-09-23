.PHONY: test run image

test:
	go test -race ./...

run:
	go run ./cmd/server

image:
	docker build --tag atlas-demo-api:dev .

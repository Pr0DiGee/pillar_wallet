ARG CC_SERVER_PORT=9999

FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go env && go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/chaincode .

FROM alpine:3.18
ARG CC_SERVER_PORT=9999
COPY --from=builder /bin/chaincode /chaincode
EXPOSE ${CC_SERVER_PORT}
ENV CHAINCODE_SERVER_ADDRESS=0.0.0.0:${CC_SERVER_PORT}
ENTRYPOINT ["/chaincode"]

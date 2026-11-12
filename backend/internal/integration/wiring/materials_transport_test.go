package wiring

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

// MF-SC-12: deterministically reject after only a prefix was read. The sender
// cannot complete its write, but a valid 414 must still be observed. EOF or a
// different HTTP status is never accepted as an equivalent rejection.
func TestMFRequestLineEarlyResponse(t *testing.T) {
	for _, tc := range []struct {
		name, response string
		wantError      bool
	}{
		{"early 414", "HTTP/1.1 414 URI Too Long\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", false},
		{"incorrect success", "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n", true},
		{"transport close without status", "", true},
		{"incomplete headers", "HTTP/1.1 414 URI Too Long\r\n", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client, server := net.Pipe()
			done := make(chan struct{})
			go func() {
				defer close(done)
				defer server.Close()
				_ = server.SetDeadline(time.Now().Add(time.Second))
				prefix := make([]byte, 128)
				if _, err := io.ReadFull(server, prefix); err != nil {
					return
				}
				if !strings.HasPrefix(string(prefix), "GET /api/v1/search?q=") {
					return
				}
				_, _ = io.WriteString(server, tc.response)
			}()
			err := requestLineLimit(client, time.Second)
			<-done
			if (err != nil) != tc.wantError {
				t.Fatalf("error=%v wantError=%v", err, tc.wantError)
			}
		})
	}
}

// Nginx may reject an overlong line before the sender finishes writing it.
// Read the actual HTTP response concurrently with that write: net/http can
// otherwise surface the write error instead of the already available 414.
// No credentials or query content are included in diagnostics.
func requestLineLimit(connection net.Conn, timeout time.Duration) error {
	defer connection.Close()
	if err := connection.SetDeadline(time.Now().Add(timeout)); err != nil {
		return fmt.Errorf("set deadline: %T", err)
	}
	written := make(chan struct{})
	go func() {
		defer close(written)
		// The incomplete line alone exceeds 32 KiB. A conforming gateway must
		// reject it before it needs Host, authorization or any other headers.
		_, _ = io.WriteString(connection, "GET /api/v1/search?q="+strings.Repeat("x", 40000))
	}()
	response, err := http.ReadResponse(bufio.NewReader(connection), nil)
	_ = connection.SetWriteDeadline(time.Now())
	connection.Close()
	<-written
	if err != nil {
		return fmt.Errorf("read gateway response: %T", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusRequestURITooLong {
		return fmt.Errorf("status=%d want=414", response.StatusCode)
	}
	return nil
}

package probe

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"time"
)

// Check verifies the actual HTTP/JSON/header contract, not merely a running process.
func Check(ctx context.Context, url string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return errors.New("invalid health address")
	}
	client := &http.Client{Timeout: 2 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return errors.New("health request failed")
	}
	defer response.Body.Close()
	mediaType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if response.StatusCode != http.StatusOK || err != nil || mediaType != "application/json" {
		return errors.New("health status or content type invalid")
	}
	id, err := hex.DecodeString(response.Header.Get("X-Request-ID"))
	if err != nil || len(id) != 16 {
		return errors.New("health request identifier invalid")
	}
	var body struct {
		Status       string            `json:"status"`
		Dependencies map[string]string `json:"dependencies"`
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 4097))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&body); err != nil || body.Status != "ok" ||
		body.Dependencies == nil || len(body.Dependencies) != 0 {
		return errors.New("health body invalid")
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return errors.New("health body contains extra data")
	}
	return nil
}

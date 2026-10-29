package config

import (
	"errors"
	"strconv"
	"strings"
)

// ReadPort implements PB-03 / SC-04..06 without logging configuration values.
func ReadPort(lookup func(string) (string, bool)) (string, error) {
	raw, exists := lookup("HTTP_PORT")
	value := strings.TrimSpace(raw)
	if !exists || value == "" {
		return "", errors.New("HTTP_PORT is required")
	}
	for _, digit := range value {
		if digit < '0' || digit > '9' {
			return "", errors.New("HTTP_PORT must contain decimal digits only")
		}
	}
	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		return "", errors.New("HTTP_PORT must be in range 1..65535")
	}
	return strconv.Itoa(port), nil
}

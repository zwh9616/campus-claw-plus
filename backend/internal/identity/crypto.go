package identity

import (
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const passwordPrefix = "$argon2id$v=19$m=19456,t=2,p=1$"

func TextLength(s string, min, max int) bool {
	n := utf8.RuneCountInString(s)
	return utf8.ValidString(s) && n >= min && n <= max
}
func HashPassword(password string) (string, error) {
	if !TextLength(password, 12, 128) {
		return "", ErrInvalid
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", ErrUnavailable
	}
	hash := argon2.IDKey([]byte(password), salt, 2, 19456, 1, 32)
	return passwordPrefix + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(hash), nil
}
func VerifyPassword(encoded, password string) bool {
	if !strings.HasPrefix(encoded, passwordPrefix) {
		return false
	}
	parts := strings.Split(strings.TrimPrefix(encoded, passwordPrefix), "$")
	if len(parts) != 2 {
		return false
	}
	salt, e1 := base64.RawStdEncoding.Strict().DecodeString(parts[0])
	want, e2 := base64.RawStdEncoding.Strict().DecodeString(parts[1])
	if e1 != nil || e2 != nil || len(salt) != 16 || len(want) != 32 {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, 2, 19456, 1, 32)
	return subtle.ConstantTimeCompare(got, want) == 1
}
func token() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", ErrUnavailable
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func sessionID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", ErrUnavailable
	}
	return hex.EncodeToString(b), nil
}
func Digest(raw string) ([]byte, error) {
	b, err := base64.RawURLEncoding.Strict().DecodeString(raw)
	if err != nil || len(b) != 32 || base64.RawURLEncoding.EncodeToString(b) != raw {
		return nil, ErrUnauthenticated
	}
	sum := sha256.Sum256(b)
	return sum[:], nil
}
func CSRF(refresh, sid string) (string, error) {
	b, e := base64.RawURLEncoding.Strict().DecodeString(refresh)
	salt, e2 := hex.DecodeString(sid)
	if e != nil || e2 != nil || len(b) != 32 || len(salt) != 16 {
		return "", ErrUnauthenticated
	}
	key, e := hkdf.Key(sha256.New, b, salt, "campus-csrf/v1", 32)
	if e != nil {
		return "", ErrUnavailable
	}
	return base64.RawURLEncoding.EncodeToString(key), nil
}

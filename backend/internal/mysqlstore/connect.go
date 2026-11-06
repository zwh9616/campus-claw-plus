package mysqlstore

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"errors"
	"github.com/go-sql-driver/mysql"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"time"
)

// Connector never exposes the supplied DSN or driver diagnostics. The driver
// logger is disabled because some diagnostics contain packet/connection data.
func Connector(raw, caFile string, offline bool) (*mysql.Config, error) {
	bad := errors.New("database configuration invalid")
	cfg, e := mysql.ParseDSN(raw)
	if e != nil {
		return nil, bad
	}
	if raw == "" || raw != strings.TrimSpace(raw) || cfg.Net != "tcp" || cfg.DBName == "" || strings.EqualFold(cfg.User, "root") || cfg.User == "" || cfg.Passwd == "" || cfg.AllowAllFiles || cfg.AllowCleartextPasswords || cfg.AllowFallbackToPlaintext || cfg.AllowOldPasswords || (!offline && cfg.MultiStatements) || cfg.TLSConfig != "true" || len(cfg.Params) != 0 {
		return nil, bad
	}
	host, port, e := net.SplitHostPort(cfg.Addr)
	if e != nil || host == "" || port == "" {
		return nil, bad
	}
	pem, e := os.ReadFile(caFile)
	if e != nil {
		return nil, bad
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		return nil, bad
	}
	cfg.TLS = &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: pool, ServerName: host}
	cfg.Timeout = 3 * time.Second
	cfg.ReadTimeout = 3 * time.Second
	cfg.WriteTimeout = 3 * time.Second
	if offline {
		cfg.ReadTimeout = 30 * time.Second
		cfg.WriteTimeout = 30 * time.Second
	}
	cfg.ParseTime = true
	cfg.Loc = time.UTC
	cfg.InterpolateParams = false
	cfg.Logger = log.New(io.Discard, "", 0)
	return cfg, nil
}
func Open(raw, ca string, offline bool) (*sql.DB, error) {
	cfg, e := Connector(raw, ca, offline)
	if e != nil {
		return nil, e
	}
	c, e := mysql.NewConnector(cfg)
	if e != nil {
		return nil, errors.New("database configuration invalid")
	}
	db := sql.OpenDB(c)
	db.SetMaxOpenConns(16)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(3 * time.Minute)
	return db, nil
}

// Offline config is read only by migrate/initialize, never by server.
func OpenEnvironment(lookup func(string) (string, bool), offline bool) (*sql.DB, error) {
	raw, _ := lookup("MYSQL_DSN")
	ca, _ := lookup("MYSQL_CA_FILE")
	base, e := Connector(raw, ca, false)
	if e != nil {
		return nil, e
	}
	if offline {
		raw, _ = lookup("MYSQL_MIGRATION_DSN")
		cfg, e := Connector(raw, ca, true)
		if e != nil {
			return nil, e
		}
		if cfg.Addr != base.Addr || cfg.DBName != base.DBName || cfg.User == base.User {
			return nil, errors.New("offline database target or account invalid")
		}
	}
	return Open(raw, ca, offline)
}
func (s *Store) Ping(ctx context.Context) error { return s.DB.PingContext(ctx) }

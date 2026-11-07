package config

import "testing"

func TestIDFConfiguration(t *testing.T) {
	values := map[string]string{"AUTH_TRUSTED_ORIGIN": "https://campus.test:8443", "AUTH_TRUSTED_PROXY_CIDRS": "127.0.0.1/32,::1/128"}
	lookup := func(k string) (string, bool) { v, ok := values[k]; return v, ok }
	cfg, e := ReadIdentity(lookup)
	if e != nil {
		t.Fatal(e)
	}
	if cfg.Source("127.0.0.1:123", []string{"192.0.2.5"}) != "192.0.2.5" || cfg.Source("192.0.2.6:123", []string{"192.0.2.5"}) != "192.0.2.6" {
		t.Fatal("proxy trust")
	}
	// IDF-SC-18: valid TCP port boundaries, including a bracketed IPv6 host.
	for _, origin := range []string{"https://campus.test", "https://campus.test:1", "https://campus.test:65535", "https://[::1]", "https://[::1]:8443"} {
		values["AUTH_TRUSTED_ORIGIN"] = origin
		if _, e := ReadIdentity(lookup); e != nil {
			t.Fatal("valid origin port rejected")
		}
	}
	for _, bad := range []string{"", " ", "http://campus.test", "https://campus.test/", "https://user@campus.test", "https://*.test", "null", "https://campus.test?", "https://campus.test#x", "https://campus.test:", "https://campus.test:0", "https://campus.test:65536"} {
		values["AUTH_TRUSTED_ORIGIN"] = bad
		if _, e := ReadIdentity(lookup); e == nil {
			t.Fatalf("origin accepted %q", bad)
		}
	}
	values["AUTH_TRUSTED_ORIGIN"] = "https://campus.test"
	for _, bad := range []string{"", "0.0.0.0/0", "::/0", "127.0.0.1/32,", "garbage"} {
		values["AUTH_TRUSTED_PROXY_CIDRS"] = bad
		if _, e := ReadIdentity(lookup); e == nil {
			t.Fatal("proxy config accepted")
		}
	}
}

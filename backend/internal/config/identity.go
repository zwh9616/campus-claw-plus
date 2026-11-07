package config

import (
	"errors"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
)

type Identity struct {
	Origin  string
	Proxies []netip.Prefix
}

func ReadIdentity(lookup func(string) (string, bool)) (Identity, error) {
	raw, _ := lookup("AUTH_TRUSTED_ORIGIN")
	u, e := url.Parse(raw)
	if e != nil || raw != strings.TrimSpace(raw) || u.Scheme != "https" || u.Host == "" || u.Hostname() == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || strings.ContainsAny(raw, "*\\\r\n#") {
		return Identity{}, errors.New("AUTH_TRUSTED_ORIGIN invalid")
	}
	if strings.HasSuffix(u.Host, ":") {
		return Identity{}, errors.New("AUTH_TRUSTED_ORIGIN invalid")
	}
	if port := u.Port(); port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return Identity{}, errors.New("AUTH_TRUSTED_ORIGIN invalid")
		}
	}
	cidrs, _ := lookup("AUTH_TRUSTED_PROXY_CIDRS")
	c := Identity{Origin: raw}
	for _, v := range strings.Split(cidrs, ",") {
		p, e := netip.ParsePrefix(strings.TrimSpace(v))
		if e != nil || p.Bits() == 0 || p.Addr().Is4In6() {
			return Identity{}, errors.New("AUTH_TRUSTED_PROXY_CIDRS invalid")
		}
		c.Proxies = append(c.Proxies, p.Masked())
	}
	return c, nil
}
func (c Identity) Source(remote string, header []string) string {
	peer, e := netip.ParseAddrPort(remote)
	if e != nil {
		return "invalid-peer"
	}
	addr := peer.Addr().Unmap()
	for _, p := range c.Proxies {
		if p.Contains(addr) && len(header) == 1 {
			ip, e := netip.ParseAddr(header[0])
			if e == nil {
				return ip.Unmap().String()
			}
		}
	}
	return addr.String()
}

package identity

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"math"
	"sort"
	"sync"
	"time"
)

type Limiter struct {
	mu      sync.Mutex
	key     [32]byte
	buckets map[[32]byte][]time.Time
	now     Clock
}

func NewLimiter(now Clock) *Limiter {
	if now == nil {
		now = time.Now
	}
	l := &Limiter{buckets: make(map[[32]byte][]time.Time), now: now}
	rand.Read(l.key[:])
	return l
}
func (l *Limiter) keyFor(kind, value string) [32]byte {
	h := hmac.New(sha256.New, l.key[:])
	h.Write([]byte(kind + "\x00" + value))
	var k [32]byte
	copy(k[:], h.Sum(nil))
	return k
}

// Allow atomically reserves BOTH buckets, including capacity, or neither.
func (l *Limiter) Allow(source, username string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	cut := now.Add(-60 * time.Second)
	for k, ts := range l.buckets {
		start := 0
		for start < len(ts) && !ts[start].After(cut) {
			start++
		}
		if start == len(ts) {
			delete(l.buckets, k)
		} else {
			l.buckets[k] = ts[start:]
		}
	}
	keys := [][32]byte{l.keyFor("source", source), l.keyFor("username", username)}
	needed := 0
	wait := time.Duration(0)
	for _, k := range keys {
		ts := l.buckets[k]
		if len(ts) == 0 {
			needed++
		}
		if len(ts) >= 10 {
			wait = max(wait, ts[0].Add(time.Minute).Sub(now))
		}
	}
	free := 4096 - len(l.buckets)
	if needed > free {
		expires := make([]time.Time, 0, len(l.buckets))
		for _, ts := range l.buckets {
			expires = append(expires, ts[len(ts)-1].Add(time.Minute))
		}
		sort.Slice(expires, func(i, j int) bool { return expires[i].Before(expires[j]) })
		wait = max(wait, expires[needed-free-1].Sub(now))
	}
	if wait > 0 {
		return false, max(1, int(math.Ceil(wait.Seconds())))
	}
	for _, k := range keys {
		l.buckets[k] = append(l.buckets[k], now)
	}
	return true, 0
}

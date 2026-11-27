// SPDX-License-Identifier: GPL-3.0-only

package wireguard

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/netutil"
	"golang.zx2c4.com/wireguard/conn"
	"golang.zx2c4.com/wireguard/device"
	"app.morphe/wireguard/netstack"
)

const (
	maxConnections = 128
	dialTimeout    = 20 * time.Second
	idleTimeout    = 2 * time.Minute
)

var (
	errClosed   = errors.New("WireGuard proxy is stopped")
	errNoRoute  = errors.New("destination is not covered by AllowedIPs")
	errBadInput = errors.New("invalid proxy destination")
)

// Engine owns one WireGuard peer and an authenticated, IPv4-loopback-only HTTP
// proxy. A successful Start means ready to attempt traffic, not an established
// handshake or verified access to the Internet.
type Engine struct {
	config     *config
	stack      *netstack.Net
	device     *device.Device
	server     *http.Server
	transport  *http.Transport
	listener   net.Listener
	port       int
	authDigest [32]byte
	ctx        context.Context
	cancel     context.CancelFunc
	closeOnce  sync.Once
	done       chan struct{}

	mu          sync.Mutex
	closed      bool
	connections map[net.Conn]struct{}
}

// Start configures an entirely userspace tunnel and returns a local proxy.
// Numeric endpoints make startup independent of DNS and peer reachability.
// listenPort may be zero to request an ephemeral port. Credentials are required
// because Android apps can access each other's loopback TCP listeners.
func Start(text, username, password string, listenPort int) (*Engine, error) {
	return startWithBind(text, username, password, listenPort, conn.NewDefaultBind())
}

// startWithBind is a private test seam for upstream's in-memory ChannelBind.
// Production always uses Start's official default UDP transport; there is no
// alternate transport or permission fallback selected at runtime.
func startWithBind(text, username, password string, listenPort int, bind conn.Bind) (*Engine, error) {
	c, err := parseConfig(text)
	if err != nil {
		return nil, err
	}
	defer c.clearKeys()
	if !c.endpoint.IsValid() {
		resolveCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err = c.resolveEndpoint(resolveCtx, func(ctx context.Context, host string) ([]netip.Addr, error) {
			return net.DefaultResolver.LookupNetIP(ctx, "ip", host)
		})
		cancel()
		if err != nil { return nil, err }
	}
	if !validCredentials(username, password) || listenPort < 0 || listenPort > 65535 {
		return nil, errors.New("invalid local proxy credentials or port")
	}
	tun, stack, err := netstack.CreateNetTUN(c.addresses, c.dns, c.mtu)
	if err != nil {
		return nil, errors.New("could not initialize the userspace network stack")
	}
	// The default logger is deliberately silent, including UAPI failures.
	dev := device.NewDevice(tun, bind, device.NewLogger(device.LogLevelSilent, ""))
	if err := dev.IpcSet(c.uapi()); err != nil {
		closeWireGuardDevice(dev)
		return nil, errors.New("could not configure the WireGuard engine")
	}
	if err := dev.Up(); err != nil {
		closeWireGuardDevice(dev)
		return nil, errors.New("could not open the WireGuard transport")
	}
	listener, err := net.Listen("tcp4", net.JoinHostPort("127.0.0.1", strconv.Itoa(listenPort)))
	if err != nil {
		closeWireGuardDevice(dev)
		return nil, errors.New("could not bind the local proxy port")
	}
	ctx, cancel := context.WithCancel(context.Background())
	e := &Engine{
		config:      c,
		stack:       stack,
		device:      dev,
		listener:    netutil.LimitListener(listener, maxConnections),
		port:        listener.Addr().(*net.TCPAddr).Port,
		authDigest:  sha256.Sum256([]byte("Basic " + base64.StdEncoding.EncodeToString([]byte(username+":"+password)))),
		ctx:         ctx,
		cancel:      cancel,
		done:        make(chan struct{}),
		connections: make(map[net.Conn]struct{}),
	}
	e.transport = &http.Transport{
		Proxy:                 nil, // Never use environment/system proxies.
		DialContext:           e.dialContext,
		MaxIdleConns:          32,
		MaxIdleConnsPerHost:   8,
		MaxConnsPerHost:       32,
		IdleConnTimeout:       30 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
	e.server = &http.Server{
		Handler:           http.HandlerFunc(e.serveHTTP),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    32 * 1024,
		ErrorLog:          log.New(io.Discard, "", 0),
		BaseContext:       func(net.Listener) context.Context { return e.ctx },
		ConnState: func(c net.Conn, state http.ConnState) {
			switch state {
			case http.StateNew:
				e.track(c)
			case http.StateClosed:
				e.untrack(c)
			}
		},
	}
	go func() {
		defer close(e.done)
		// There is no secret-bearing log output or fallback on Serve failure.
		_ = e.server.Serve(e.listener)
	}()
	return e, nil
}

func validCredentials(username, password string) bool {
	if len(username) < 1 || len(username) > 128 || len(password) < 16 || len(password) > 256 || strings.Contains(username, ":") {
		return false
	}
	for _, v := range []string{username, password} {
		for _, r := range v {
			if r < 0x21 || r > 0x7e {
				return false
			}
		}
	}
	return true
}

// Port returns the bound 127.0.0.1 TCP port.
func (e *Engine) Port() int { return e.port }

// CheckEgress performs a real HTTPS request through the userspace WireGuard
// stack. A successful response proves that the peer handshake, AllowedIPs,
// tunneled DNS, proxy transport and remote egress all worked for this request.
// The returned IP/country are transient diagnostics; callers must not persist them.
func (e *Engine) CheckEgress(ctx context.Context) (map[string]any, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://ipwho.is/", nil)
	if err != nil { return nil, err }
	response, err := e.transport.RoundTrip(request)
	if err != nil { return nil, errors.New("tunneled HTTPS egress test failed") }
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("egress test service returned HTTP %d", response.StatusCode)
	}
	var result struct {
		Success bool   `json:"success"`
		IP string `json:"ip"`
		Country string `json:"country"`
		CountryCode string `json:"country_code"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64*1024)).Decode(&result); err != nil {
		return nil, errors.New("egress test response was invalid")
	}
	if !result.Success || net.ParseIP(result.IP) == nil || result.CountryCode == "" {
		return nil, errors.New("egress test service could not identify the tunnel exit")
	}
	return map[string]any{"ok": true, "ip": result.IP, "country": result.Country, "country_code": result.CountryCode}, nil
}


// PeerStatus reports WireGuard's actual peer handshake and transfer counters.
// A running userspace device is not considered connected until the peer has
// completed a handshake. The private key and raw UAPI text are never returned.
func (e *Engine) PeerStatus() map[string]any {
	result := map[string]any{"ok": true, "handshake": false, "rx_bytes": int64(0), "tx_bytes": int64(0), "last_handshake_unix": int64(0)}
	uapi, err := e.device.IpcGet()
	if err != nil {
		return map[string]any{"ok": false, "handshake": false, "message": "WireGuard peer status unavailable"}
	}
	var peerBlock bool
	var handshakeSec, handshakeNsec, rxBytes, txBytes int64
	for _, line := range strings.Split(uapi, "\\n") {
		if line == "" {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		switch key {
		case "public_key":
			peerBlock = value == base64.StdEncoding.EncodeToString(e.config.publicKey[:])
			handshakeSec, handshakeNsec, rxBytes, txBytes = 0, 0, 0, 0
		case "last_handshake_time_sec":
			if peerBlock { handshakeSec, _ = strconv.ParseInt(value, 10, 64) }
		case "last_handshake_time_nsec":
			if peerBlock { handshakeNsec, _ = strconv.ParseInt(value, 10, 64) }
		case "rx_bytes":
			if peerBlock { rxBytes, _ = strconv.ParseInt(value, 10, 64) }
		case "tx_bytes":
			if peerBlock { txBytes, _ = strconv.ParseInt(value, 10, 64) }
		}
	}
	result["handshake"] = handshakeSec > 0
	result["rx_bytes"] = rxBytes
	result["tx_bytes"] = txBytes
	result["last_handshake_unix"] = handshakeSec
	if handshakeSec > 0 {
		result["handshake_age_seconds"] = time.Now().Unix() - handshakeSec
	}
	_ = handshakeNsec // Kept parsed for future sub-second display without leaking UAPI.
	return result
}


func closeWireGuardDevice(dev *device.Device) {
	// Device.Close closes the TUN before stopping receivers. Drain/remove peers
	// first so an in-flight netstack write cannot race the TUN's channel close.
	// Removing them also prevents a delayed TUN-up event from restarting them.
	dev.RemoveAllPeers()
	dev.Close()
}

// Close is idempotent. It cancels pending requests and closes all streams,
// including CONNECT streams that net/http no longer owns after hijacking.
func (e *Engine) Close() {
	e.closeOnce.Do(func() {
		e.cancel()
		e.mu.Lock()
		e.closed = true
		connections := make([]net.Conn, 0, len(e.connections))
		for c := range e.connections {
			connections = append(connections, c)
		}
		e.mu.Unlock()
		_ = e.server.Close()
		for _, c := range connections {
			_ = c.Close()
		}
		e.transport.CloseIdleConnections()
		closeWireGuardDevice(e.device) // Owns and closes its userspace TUN exactly once.
		<-e.done
	})
}

func (e *Engine) track(c net.Conn) bool {
	e.mu.Lock()
	if e.closed {
		e.mu.Unlock()
		_ = c.Close()
		return false
	}
	e.connections[c] = struct{}{}
	e.mu.Unlock()
	return true
}

func (e *Engine) untrack(c net.Conn) {
	e.mu.Lock()
	delete(e.connections, c)
	e.mu.Unlock()
}

func (e *Engine) dialContext(parent context.Context, network, address string) (net.Conn, error) {
	if network != "tcp" && network != "tcp4" && network != "tcp6" {
		return nil, errBadInput
	}
	host, portText, err := net.SplitHostPort(address)
	if err != nil || host == "" || strings.ContainsAny(host, "\x00\r\n\t /\\@") {
		return nil, errBadInput
	}
	port, err := strconv.ParseUint(portText, 10, 16)
	if err != nil || port == 0 {
		return nil, errBadInput
	}
	ctx, cancel := context.WithTimeout(parent, dialTimeout)
	defer cancel()
	stopCancel := context.AfterFunc(e.ctx, cancel)
	defer stopCancel()
	if e.ctx.Err() != nil {
		return nil, errClosed
	}
	// This resolver uses ONLY DNS servers in the userspace stack. Never replace
	// it with net.Lookup*, net.DefaultResolver, or net.Dial(er).
	addresses, err := e.stack.LookupContextHost(ctx, host)
	if err != nil {
		return nil, errors.New("tunneled DNS resolution failed")
	}
	var candidates []netip.Addr
	for _, address := range addresses {
		addr, err := netip.ParseAddr(address)
		if err != nil {
			continue
		}
		addr = addr.Unmap()
		if !e.config.hasFamily(addr) || !e.config.allows(addr) || (network == "tcp4" && !addr.Is4()) || (network == "tcp6" && !addr.Is6()) {
			continue
		}
		candidates = append(candidates, addr)
	}
	if len(candidates) == 0 {
		return nil, errNoRoute
	}
	for i, addr := range candidates {
		if ctx.Err() != nil {
			break
		}
		deadline, _ := ctx.Deadline()
		budget := time.Until(deadline) / time.Duration(len(candidates)-i)
		attempt, cancelAttempt := context.WithTimeout(ctx, budget)
		c, err := e.stack.DialContextTCPAddrPort(attempt, netip.AddrPortFrom(addr, uint16(port)))
		cancelAttempt()
		if err != nil {
			continue
		}
		tracked := &trackedConn{idleConn: &idleConn{Conn: c, timeout: idleTimeout}, engine: e}
		if !e.track(tracked) {
			return nil, errClosed
		}
		return tracked, nil
	}
	return nil, errors.New("WireGuard destination connection failed")
}

// trackedConn applies a sliding idle deadline to bound abandoned streams while
// allowing active video transfers to last indefinitely.
type trackedConn struct {
	*idleConn
	engine *Engine
	once   sync.Once
}

func (c *trackedConn) Close() error {
	var err error
	c.once.Do(func() {
		err = c.Conn.Close()
		c.engine.untrack(c)
	})
	return err
}

func (c *trackedConn) CloseWrite() error {
	if half, ok := c.Conn.(interface{ CloseWrite() error }); ok {
		return half.CloseWrite()
	}
	return c.Close()
}

func (e *Engine) String() string {
	return fmt.Sprintf("WireGuard local proxy on 127.0.0.1:%d", e.port)
}

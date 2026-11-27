//go:build android || jni

// SPDX-License-Identifier: GPL-3.0-only

// This package is built with -buildmode=c-shared. The C shim exposes the exact
// NativeTunnel JNI methods; ordinary `go test ./...` tests the core without a JDK.
package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"errors"
	"context"
	"encoding/json"
	"sync"
	"strings"

	wg "app.morphe/wireguard"
)

var current struct {
	sync.Mutex
	engine *wg.Engine
}

//export morphe_wg_start
func morphe_wg_start(config, username, password *C.char, port C.int) (result C.int) {
	result = -3
	defer func() {
		if recover() != nil {
			result = -3
		}
	}()
	current.Lock()
	defer current.Unlock()
	if current.engine != nil {
		return -2
	}
	engine, err := wg.Start(C.GoString(config), C.GoString(username), C.GoString(password), int(port))
	if err != nil {
		var configErr *wg.ConfigError
		if errors.As(err, &configErr) {
			if strings.HasPrefix(configErr.Code, "endpoint_dns_") { return -4 }
			return -1
		}
		return -3
	}
	current.engine = engine
	return C.int(engine.Port())
}

//export morphe_wg_stop
func morphe_wg_stop() {
	current.Lock()
	defer current.Unlock()
	if current.engine != nil {
		current.engine.Close()
		current.engine = nil
	}
}

//export morphe_wg_check
func morphe_wg_check() *C.char {
	current.Lock()
	engine := current.engine
	current.Unlock()
	if engine == nil { return C.CString("{\"ok\":false,\"code\":\"not_running\"}") }
	result, err := engine.CheckEgress(context.Background())
	if err != nil {
		payload, _ := json.Marshal(map[string]any{"ok": false, "code": "egress_failed", "message": err.Error()})
		return C.CString(string(payload))
	}
	payload, err := json.Marshal(result)
	if err != nil { return C.CString("{\"ok\":false,\"code\":\"invalid_result\"}") }
	return C.CString(string(payload))
}

//export morphe_wg_peer_status
func morphe_wg_peer_status() *C.char {
	current.Lock()
	engine := current.engine
	current.Unlock()
	if engine == nil { return C.CString("{\"ok\":false,\"handshake\":false,\"code\":\"not_running\"}") }
	payload, err := json.Marshal(engine.PeerStatus())
	if err != nil { return C.CString("{\"ok\":false,\"handshake\":false,\"code\":\"status_failed\"}") }
	return C.CString(string(payload))
}

//export morphe_wg_validate
func morphe_wg_validate(config *C.char) *C.char {
	if err := wg.Validate(C.GoString(config)); err != nil {
		// The Java UI maps only known codes to localized resources.
		var configErr *wg.ConfigError
		if errors.As(err, &configErr) {
			return C.CString(configErr.Code)
		}
		return C.CString("invalid_config")
	}
	return nil
}

func main() {}

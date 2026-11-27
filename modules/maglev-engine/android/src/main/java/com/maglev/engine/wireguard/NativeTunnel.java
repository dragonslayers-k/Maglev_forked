// SPDX-License-Identifier: GPL-3.0-only
// App-local userspace WireGuard. Does not register Android VpnService or alter device routes.
package com.maglev.engine.wireguard;

public final class NativeTunnel {
    static {
        System.loadLibrary("morphewireguard");
    }

    private NativeTunnel() {}

    /** Returns the loopback proxy port; it does not prove a remote handshake. */
    public static native int start(String config, String username, String password, int port);
    public static native void stop();
    /** Runs a real HTTPS egress request through the active userspace WireGuard peer. */
    public static native String checkConnection();
    /** Returns actual peer handshake and RX/TX counters; local proxy state alone is not connected. */
    public static native String peerStatus();
    /** Validates supported config text without opening sockets or changing routing. */
    public static native void validate(String config);

    public static final class InvalidProfileException extends IllegalArgumentException {
        public InvalidProfileException(String code) {
            super(code);
        }
    }
}

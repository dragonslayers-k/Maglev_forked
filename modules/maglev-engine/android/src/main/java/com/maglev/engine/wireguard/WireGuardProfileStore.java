// SPDX-License-Identifier: GPL-3.0-only
package com.maglev.engine.wireguard;

import android.content.Context;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Private no-backup AES-GCM storage for WireGuard credentials and the previous proxy. */
public final class WireGuardProfileStore {
    private static final String ALIAS = "maglev.app-wireguard.profile.v1";
    private static final byte[] PROFILE_MAGIC = new byte[] {'M','A','W','G',1};
    private static final byte[] PROXY_MAGIC = new byte[] {'M','A','W','P',1};
    private static final int MAX_BYTES = 64 * 1024;
    private static final int IV_BYTES = 12;

    private WireGuardProfileStore() {}

    private static AtomicFile profile(Context c) {
        return new AtomicFile(new File(c.getNoBackupFilesDir(), "maglev-app-wireguard-profile.enc"));
    }
    private static AtomicFile proxy(Context c) {
        return new AtomicFile(new File(c.getNoBackupFilesDir(), "maglev-app-wireguard-proxy.enc"));
    }

    public static String readUri(Context c, Uri uri) throws IOException {
        byte[] bytes;
        try (InputStream in = c.getContentResolver().openInputStream(uri)) { bytes = readLimited(in); }
        try { return decode(bytes, false); }
        finally { Arrays.fill(bytes, (byte) 0); }
    }

    public static void saveProfile(Context c, String text) throws IOException, GeneralSecurityException {
        NativeTunnel.validate(text);
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        try {
            if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IOException("Profile size invalid");
            save(c, profile(c), PROFILE_MAGIC, bytes);
        } finally { Arrays.fill(bytes, (byte) 0); }
    }

    public static String loadProfile(Context c) throws IOException, GeneralSecurityException {
        byte[] bytes = load(c, profile(c), PROFILE_MAGIC);
        try {
            String text = decode(bytes, false);
            NativeTunnel.validate(text);
            return text;
        } finally { Arrays.fill(bytes, (byte) 0); }
    }

    public static boolean hasProfile(Context c) {
        try (InputStream in = profile(c).openRead()) { return true; }
        catch (IOException ex) { return false; }
    }

    public static void saveOriginalProxy(Context c, String value) throws IOException, GeneralSecurityException {
        byte[] bytes = (value == null ? "" : value).getBytes(StandardCharsets.UTF_8);
        try { save(c, proxy(c), PROXY_MAGIC, bytes); }
        finally { Arrays.fill(bytes, (byte) 0); }
    }

    public static boolean hasOriginalProxy(Context c) {
        try (InputStream in = proxy(c).openRead()) { return true; }
        catch (IOException ex) { return false; }
    }

    public static String loadOriginalProxy(Context c) throws IOException, GeneralSecurityException {
        byte[] bytes = load(c, proxy(c), PROXY_MAGIC);
        try {
            String value = decode(bytes, true);
            return value.isEmpty() ? null : value;
        } finally { Arrays.fill(bytes, (byte) 0); }
    }

    public static void clearOriginalProxy(Context c) { proxy(c).delete(); }

    private static byte[] readLimited(InputStream in) throws IOException {
        if (in == null) throw new FileNotFoundException("Profile document unavailable");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        try {
            while (true) {
                int n = in.read(buffer);
                if (n < 0) break;
                if (n == 0) continue;
                if (n > MAX_BYTES - out.size()) throw new IOException("Profile exceeds 64 KiB");
                out.write(buffer, 0, n);
            }
            return out.toByteArray();
        } finally { Arrays.fill(buffer, (byte) 0); }
    }

    private static String decode(byte[] bytes, boolean allowEmpty) throws IOException {
        try {
            String value = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
            if (!value.isEmpty() && value.charAt(0) == '\\uFEFF') value = value.substring(1);
            if (value.indexOf('\\0') >= 0 || (!allowEmpty && value.trim().isEmpty()))
                throw new IOException("Invalid profile text");
            return value;
        } catch (CharacterCodingException ex) { throw new IOException("Profile must be UTF-8"); }
    }

    // AndroidKeyStore.KeyStore.load() also declares IOException; preserve it for the
    // existing encrypted-file callers rather than hiding a key-store initialization failure.
    private static SecretKey key(boolean create) throws GeneralSecurityException, IOException {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        if (!create) throw new GeneralSecurityException("Profile key unavailable");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }

    private static void save(Context c, AtomicFile file, byte[] magic, byte[] plain)
            throws IOException, GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(true));
        cipher.updateAAD(magic);
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(plain);
        FileOutputStream out = null;
        try {
            out = file.startWrite();
            out.write(magic); out.write(iv); out.write(encrypted);
            file.finishWrite(out);
        } catch (IOException ex) {
            if (out != null) file.failWrite(out);
            throw new IOException("Could not save encrypted WireGuard data");
        } finally { Arrays.fill(iv, (byte) 0); Arrays.fill(encrypted, (byte) 0); }
    }

    private static byte[] load(Context c, AtomicFile file, byte[] magic)
            throws IOException, GeneralSecurityException {
        byte[] stored;
        try (InputStream in = file.openRead()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            try {
                while (true) {
                    int n = in.read(buffer);
                    if (n < 0) break;
                    if (n == 0) continue;
                    if (n > MAX_BYTES + 64 - out.size()) throw new IOException("Encrypted profile too large");
                    out.write(buffer, 0, n);
                }
                stored = out.toByteArray();
            } finally { Arrays.fill(buffer, (byte) 0); }
        }
        try {
            if (stored.length < magic.length + IV_BYTES + 16
                    || !Arrays.equals(magic, Arrays.copyOfRange(stored, 0, magic.length)))
                throw new GeneralSecurityException("Encrypted profile invalid");
            byte[] iv = Arrays.copyOfRange(stored, magic.length, magic.length + IV_BYTES);
            byte[] data = Arrays.copyOfRange(stored, magic.length + IV_BYTES, stored.length);
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, iv));
                cipher.updateAAD(magic);
                return cipher.doFinal(data);
            } finally { Arrays.fill(iv, (byte) 0); Arrays.fill(data, (byte) 0); }
        } finally { Arrays.fill(stored, (byte) 0); }
    }
}

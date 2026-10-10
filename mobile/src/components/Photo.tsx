import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { uploadsApi } from '../api/endpoints';
import { colors, font, radius, spacing } from '../theme';

/**
 * Authenticated photos can't be rendered by <Image> directly, so each thumbnail
 * exchanges the session for a short-lived signed URL first.
 */
export function PhotoThumb({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setUrl(null);
    setFailed(false);
    uploadsApi
      .sign(path)
      .then((r) => {
        if (mounted) setUrl(r.url);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [path]);

  return (
    <View style={styles.thumbWrap}>
      <Pressable
        onPress={() => (url ? setOpen(true) : undefined)}
        style={[styles.thumb, failed && styles.thumbFailed]}
      >
        {url ? (
          <Image source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" />
        ) : failed ? (
          <Ionicons name="image-outline" size={18} color={colors.textFaint} />
        ) : (
          <ActivityIndicator size="small" color={colors.textDim} />
        )}
      </Pressable>
      <Text style={styles.thumbLabel}>{label}</Text>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          {url ? <Image source={{ uri: url }} style={styles.modalImage} resizeMode="contain" /> : null}
          <View style={styles.modalClose}>
            <Ionicons name="close" size={22} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { alignItems: 'center', marginRight: spacing.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbFailed: { borderStyle: 'dashed' },
  thumbImage: { width: '100%', height: '100%' },
  thumbLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,7,14,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalImage: { width: '100%', height: '75%' },
  modalClose: {
    position: 'absolute',
    top: spacing.xxl + spacing.md,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

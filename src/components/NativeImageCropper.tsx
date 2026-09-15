import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { Pressable } from 'react-native-gesture-handler';
import * as ImageManipulator from 'expo-image-manipulator';

import { colors } from '@/lib/theme';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type Props = {
  uri: string;
  naturalWidth?: number;
  naturalHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  title?: string;
  onConfirm: (uri: string) => void;
  onCancel: () => void;
};

// Gesture-based crop: pan to move, pinch to zoom, inside a fixed-aspect frame —
// mirrors the web ImageCropper, but reads real pixels via expo-image-manipulator
// so the exported thumbnail is genuinely cropped (not just the OS's square edit).
export function NativeImageCropper({
  uri,
  naturalWidth,
  naturalHeight,
  outputWidth = 1280,
  outputHeight = 720,
  title = 'Position the Thumbnail',
  onConfirm,
  onCancel,
}: Props) {
  const aspect = outputWidth / outputHeight;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(
    naturalWidth && naturalHeight ? { w: naturalWidth, h: naturalHeight } : null
  );
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  const scaleRef = useRef(scale);
  const posRef = useRef(pos);
  useEffect(() => {
    scaleRef.current = scale;
    posRef.current = pos;
  }, [scale, pos]);

  // Resolve the source image's real pixel size if the caller didn't supply it.
  useEffect(() => {
    if (imgSize) return;
    RNImage.getSize(
      uri,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize({ w: 1280, h: 720 })
    );
  }, [uri, imgSize]);

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    setBox({ w, h: w / aspect });
  }

  function clampPos(x: number, y: number, s: number, size: { w: number; h: number }, b = box) {
    return {
      x: clamp(x, b.w - size.w * s, 0),
      y: clamp(y, b.h - size.h * s, 0),
    };
  }

  // Fit the image to cover the frame (minimum legal zoom) whenever box/image size
  // become known or change.
  useEffect(() => {
    if (!imgSize || box.w === 0) return;
    const s = Math.max(box.w / imgSize.w, box.h / imgSize.h);
    setMinScale(s);
    setScale(s);
    setPos({ x: (box.w - imgSize.w * s) / 2, y: (box.h - imgSize.h * s) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgSize?.w, imgSize?.h, box.w, box.h]);

  // --- Pan (single finger) ---
  const panStart = useRef({ x: 0, y: 0 });
  function onPanStateChange(e: PanGestureHandlerStateChangeEvent) {
    if (e.nativeEvent.state === State.BEGAN) {
      panStart.current = posRef.current;
    }
  }
  function onPanEvent(e: PanGestureHandlerGestureEvent) {
    if (!imgSize) return;
    const { translationX, translationY } = e.nativeEvent;
    const next = clampPos(
      panStart.current.x + translationX,
      panStart.current.y + translationY,
      scaleRef.current,
      imgSize
    );
    setPos(next);
  }

  // --- Pinch (two fingers), anchored at the pinch focal point ---
  const pinchStartScale = useRef(1);
  const pinchStartPos = useRef({ x: 0, y: 0 });
  const pinchFocal = useRef({ x: 0, y: 0 });
  function onPinchStateChange(e: PinchGestureHandlerStateChangeEvent) {
    if (e.nativeEvent.state === State.BEGAN) {
      pinchStartScale.current = scaleRef.current;
      pinchStartPos.current = posRef.current;
      pinchFocal.current = { x: e.nativeEvent.focalX, y: e.nativeEvent.focalY };
    }
  }
  function onPinchEvent(e: PinchGestureHandlerGestureEvent) {
    if (!imgSize) return;
    const newScale = clamp(pinchStartScale.current * e.nativeEvent.scale, minScale, minScale * 4);
    const anchor = pinchFocal.current;
    const imgPtX = (anchor.x - pinchStartPos.current.x) / pinchStartScale.current;
    const imgPtY = (anchor.y - pinchStartPos.current.y) / pinchStartScale.current;
    const rawX = anchor.x - imgPtX * newScale;
    const rawY = anchor.y - imgPtY * newScale;
    const next = clampPos(rawX, rawY, newScale, imgSize);
    setScale(newScale);
    setPos(next);
  }

  async function handleConfirm() {
    if (!imgSize) return;
    setProcessing(true);
    try {
      const sourceX = clamp(-pos.x / scale, 0, imgSize.w);
      const sourceY = clamp(-pos.y / scale, 0, imgSize.h);
      const sourceW = clamp(box.w / scale, 1, imgSize.w - sourceX);
      const sourceH = clamp(box.h / scale, 1, imgSize.h - sourceY);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: { originX: sourceX, originY: sourceY, width: sourceW, height: sourceH } },
          { resize: { width: outputWidth, height: outputHeight } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onConfirm(result.uri);
    } finally {
      setProcessing(false);
    }
  }

  const panRef = useRef(null);
  const pinchRef = useRef(null);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Drag to move. Pinch with two fingers to zoom.</Text>

          <View style={styles.frameWrap} onLayout={onLayout}>
            {box.w > 0 && imgSize && (
              <PinchGestureHandler
                ref={pinchRef}
                simultaneousHandlers={panRef}
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={onPinchStateChange}
              >
                <View style={StyleSheet.absoluteFill}>
                  <PanGestureHandler
                    ref={panRef}
                    simultaneousHandlers={pinchRef}
                    minPointers={1}
                    maxPointers={1}
                    onGestureEvent={onPanEvent}
                    onHandlerStateChange={onPanStateChange}
                  >
                    <View style={[styles.frame, { width: box.w, height: box.h }]}>
                      <RNImage
                        source={{ uri }}
                        style={{
                          position: 'absolute',
                          left: pos.x,
                          top: pos.y,
                          width: imgSize.w * scale,
                          height: imgSize.h * scale,
                        }}
                      />
                    </View>
                  </PanGestureHandler>
                </View>
              </PinchGestureHandler>
            )}
            {(!imgSize || box.w === 0) && (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} disabled={processing || !imgSize} style={styles.confirmBtn}>
              {processing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>Use This Photo</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: colors.surface, borderRadius: 20, padding: 18 },
  title: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 14 },
  frameWrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  frame: { overflow: 'hidden', backgroundColor: '#000' },
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, minWidth: 130, alignItems: 'center' },
  confirmText: { fontSize: 14, fontWeight: '700', color: colors.white },
});

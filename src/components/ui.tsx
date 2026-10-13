import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { colors, fg, fonts, text, trackingWide } from '@/lib/theme';

// Small building blocks that mirror the website admin's Tailwind classes, so
// every screen is put together the same way the web pages are.

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

// Text in the website's body font (Geist). Pass Tailwind-like size + weight.
export function T({
  size = 'sm',
  weight = 'regular',
  color = colors.foreground,
  style,
  ...rest
}: TextProps & {
  size?: keyof typeof text;
  weight?: Weight;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text {...rest} style={[text[size], { fontFamily: fonts[weight], color }, style]} />;
}

// `font-display tracking-wide` headings (Bebas Neue).
export function Display({
  size = '3xl',
  color = colors.foreground,
  style,
  ...rest
}: TextProps & { size?: keyof typeof text; color?: string; style?: StyleProp<TextStyle> }) {
  const t = text[size];
  return (
    <Text
      {...rest}
      style={[t, { fontFamily: fonts.display, color, letterSpacing: trackingWide(t.fontSize) }, style]}
    />
  );
}

// "← Back to admin" link above every sub-page title.
export function BackToAdmin() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.replace('/reviews');
      }}
      hitSlop={8}
      style={{ alignSelf: 'flex-start' }}
    >
      <T size="sm" weight="medium" color={colors.primary}>
        ← Back to admin
      </T>
    </Pressable>
  );
}

// The top of every sub-page: "← Back to admin", the big title, a description.
export function PageHeading({
  title,
  description,
  descriptionSize = 'base',
  backLink = true,
}: {
  title: string;
  description?: ReactNode;
  descriptionSize?: 'sm' | 'base';
  backLink?: boolean;
}) {
  return (
    <View>
      {backLink && <BackToAdmin />}
      <Display style={backLink ? { marginTop: 12 } : undefined}>{title}</Display>
      {description ? (
        <T size={descriptionSize} color={fg(0.6)} style={{ marginTop: 4 }}>
          {description}
        </T>
      ) : null}
    </View>
  );
}

// `rounded-2xl border border-border bg-surface` (+ optional shadow-sm).
export function Card({
  children,
  style,
  shadow,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  shadow?: boolean;
}) {
  return <View style={[styles.card, shadow && styles.shadow, style]}>{children}</View>;
}

type ButtonVariant =
  | 'primary' // bg-primary text-white
  | 'accent' // bg-accent text-white
  | 'outline' // border-border text-foreground/70
  | 'outlinePrimary' // border-primary text-primary
  | 'link'; // plain text

export function Button({
  label,
  onPress,
  variant = 'outline',
  size = 'xs',
  disabled,
  loading,
  style,
  textStyle,
  color,
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'xs' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  color?: string;
  icon?: ReactNode;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        variant !== 'link' && styles.btn,
        variant !== 'link' && (size === 'sm' ? styles.btnSm : styles.btnXs),
        v.box,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <T size={size} weight="semibold" color={color ?? v.text} style={textStyle}>
            {label}
          </T>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<ButtonVariant, { box: ViewStyle; text: string }> = {
  primary: { box: { backgroundColor: colors.primary }, text: colors.white },
  accent: { box: { backgroundColor: colors.accent }, text: colors.white },
  outline: { box: { borderWidth: 1, borderColor: colors.border }, text: fg(0.7) },
  outlinePrimary: { box: { borderWidth: 1, borderColor: colors.primary }, text: colors.primary },
  link: { box: {}, text: colors.primary },
};

// `rounded-full px-2.5 py-0.5 text-[11px] font-semibold` status pill.
export function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T size="xs11" weight="semibold" color={color}>
        {label}
      </T>
    </View>
  );
}

// `rounded-lg border border-border bg-background px-3 py-2 text-sm`.
export function Input({ style, ...rest }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  return (
    <TextInput
      placeholderTextColor={fg(0.4)}
      {...rest}
      style={[styles.input, rest.multiline && styles.textarea, style]}
    />
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorText({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ paddingVertical: 32, alignItems: 'center', gap: 12 }}>
      <T size="sm" color={colors.primary} style={{ textAlign: 'center' }}>
        {message}
      </T>
      {onRetry && <Button label="Try again" variant="primary" size="sm" onPress={onRetry} />}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  btn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnXs: { paddingHorizontal: 16, paddingVertical: 8 },
  btnSm: { paddingHorizontal: 20, paddingVertical: 10 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.foreground,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
});

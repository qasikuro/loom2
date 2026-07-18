import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useSignIn, useSSO } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { type Href, useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [catchError, setCatchError]     = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isLoading = fetchStatus === 'fetching';

  // entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 540, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 540, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    setCatchError('');
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace('/(tabs)' as Href);
          },
        });
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setCatchError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, router]);

  async function handleSignIn() {
    if (!signIn) { setCatchError('Auth not ready. Please try again.'); return; }
    setCatchError('');
    try {
      const { error } = await signIn.password({ emailAddress: email.trim(), password });
      if (error) { setCatchError(error.longMessage ?? error.message ?? 'Sign-in failed.'); return; }
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session }) => { if (session?.currentTask) return; router.replace('/(tabs)' as Href); },
        });
      } else {
        setCatchError('Sign-in failed. Please try again.');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setCatchError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Sign-in failed.');
    }
  }

  const fieldError = catchError || errors?.fields?.identifier?.message || errors?.fields?.password?.message || '';

  return (
    <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>

      {/* decorative floating stars */}
      <Text style={[styles.star, { top: '12%', left: '8%',  fontSize: 10 }]}>✦</Text>
      <Text style={[styles.star, { top: '22%', right: '12%', fontSize: 7  }]}>✦</Text>
      <Text style={[styles.star, { top: '38%', left: '5%',  fontSize: 6  }]}>✦</Text>
      <Text style={[styles.star, { top: '60%', right: '7%', fontSize: 9  }]}>✦</Text>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <Image source={Images.logo} style={styles.logo} contentFit="contain" />
            </View>

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>

            {/* ── Google button ──────────────────── */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || isLoading}
              activeOpacity={0.88}
            >
              {googleLoading ? (
                <ActivityIndicator color="#3C3C3C" size="small" />
              ) : (
                <>
                  <Text style={styles.googleLogo}>G</Text>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* ── Divider ────────────────────────── */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Email / password form ───────────── */}
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={[styles.inputBox, focusedField === 'email' && styles.inputBoxFocused]}>
                  <TextInput
                    style={styles.inputText}
                    value={email}
                    onChangeText={v => { setEmail(v); setCatchError(''); }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="your@email.com"
                    placeholderTextColor="rgba(200,184,232,0.35)"
                    autoComplete="email"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={[styles.inputBox, focusedField === 'password' && styles.inputBoxFocused]}>
                  <TextInput
                    style={[styles.inputText, { paddingRight: 52 }]}
                    value={password}
                    onChangeText={v => { setPassword(v); setCatchError(''); }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(200,184,232,0.35)"
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18}
                      color={focusedField === 'password' ? 'rgba(200,184,232,0.8)' : 'rgba(200,184,232,0.4)'} />
                  </TouchableOpacity>
                </View>
              </View>

              {!!fieldError && <Text style={styles.errorText}>{fieldError}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, (!email || !password || isLoading) && styles.primaryBtnDisabled]}
                onPress={handleSignIn}
                disabled={!email || !password || isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Sign in</Text>
                }
              </TouchableOpacity>

              <View nativeID="clerk-captcha" />
            </View>

            {/* ── Footer link ────────────────────── */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New here?</Text>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link href={'/(auth)/sign-up' as any} asChild>
                <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.footerLink}>Create account</Text>
                </Pressable>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  star: { position: 'absolute', color: 'rgba(200,184,232,0.18)', fontFamily: 'Satoshi-Regular' },
  container: { paddingHorizontal: 28, alignItems: 'stretch' },

  logoWrap: { alignItems: 'center', marginBottom: 10 },
  logo: { width: 110, height: 110 },

  title: {
    fontSize: 30, fontFamily: 'Satoshi-Bold', color: '#F0ECFF',
    textAlign: 'center', letterSpacing: -0.8, marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)',
    textAlign: 'center', lineHeight: 20, marginBottom: 32,
  },

  googleBtn: {
    height: 56, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  googleLogo: { fontSize: 20, fontFamily: 'Satoshi-Bold', color: '#4285F4', lineHeight: 24 },
  googleBtnText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#1F1F1F', letterSpacing: 0.1 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,91,149,0.22)' },
  dividerText: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.35)' },

  form: { gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.65)', marginLeft: 2 },
  inputBox: {
    height: 56, borderRadius: 12, borderWidth: 1.5,
    borderColor: 'rgba(107,91,149,0.28)', backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
  },
  inputBoxFocused: { borderColor: 'rgba(180,160,240,0.75)', backgroundColor: 'rgba(255,255,255,0.07)' },
  inputText: { flex: 1, fontSize: 16, fontFamily: 'Satoshi-Regular', color: '#F0ECFF', letterSpacing: 0.1 },
  eyeBtn: { position: 'absolute', right: 14, padding: 6 },

  errorText: {
    fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75',
    textAlign: 'center', backgroundColor: 'rgba(224,108,117,0.10)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
  },

  primaryBtn: {
    height: 56, borderRadius: 14, backgroundColor: '#6B5B95',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.38 },
  primaryBtnText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: 0.2 },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 },
  footerText: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)' },
  footerLink: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(180,160,240,0.85)' },
});

import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useSignUp, useSSO } from '@clerk/expo';
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

export default function SignUpScreen() {
  useWarmUpBrowser();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode]                 = useState('');
  const [catchError, setCatchError]     = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isLoading = fetchStatus === 'fetching';

  const needsVerification =
    signUp?.status === 'missing_requirements' &&
    Array.isArray(signUp?.unverifiedFields) &&
    signUp.unverifiedFields.includes('email_address') &&
    (signUp?.missingFields?.length ?? 0) === 0;

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

  const handleGoogleSignUp = useCallback(async () => {
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

  async function handleSignUp() {
    if (!signUp) return;
    setCatchError('');
    try {
      const { error } = await signUp.password({ emailAddress: email.trim(), password });
      if (error) { setCatchError(error.longMessage ?? error.message ?? 'Could not create account.'); return; }
      await signUp.verifications.sendEmailCode();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setCatchError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Could not create account.');
    }
  }

  async function handleVerify() {
    if (!signUp) return;
    setCatchError('');
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: ({ session }) => { if (session?.currentTask) return; router.replace('/(tabs)' as Href); },
        });
      } else {
        setCatchError('Verification failed. Please try again.');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setCatchError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Verification failed.');
    }
  }

  const fieldError = catchError || errors?.fields?.emailAddress?.message || errors?.fields?.password?.message || errors?.fields?.code?.message || '';

  // ── Email verification screen ─────────────────────────────────────────────
  if (needsVerification) {
    return (
      <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
        <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40, flex: 1 }]}>
            {/* icon */}
            <View style={styles.verifyIconWrap}>
              <Text style={styles.verifyIconEmoji}>✉️</Text>
            </View>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={{ color: 'rgba(200,184,232,0.85)', fontFamily: 'Satoshi-Bold' }}>{email}</Text>
            </Text>

            {/* OTP input row */}
            <View style={[styles.inputBox, focusedField === 'code' && styles.inputBoxFocused, { marginTop: 8 }]}>
              <TextInput
                style={[styles.inputText, { textAlign: 'center', letterSpacing: 8, fontSize: 22 }]}
                value={code}
                onChangeText={v => { setCode(v); setCatchError(''); }}
                onFocus={() => setFocusedField('code')}
                onBlur={() => setFocusedField(null)}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor="rgba(200,184,232,0.25)"
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
              />
            </View>

            {!!fieldError && <Text style={[styles.errorText, { marginTop: 10 }]}>{fieldError}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }, (!code.trim() || isLoading) && styles.primaryBtnDisabled]}
              onPress={handleVerify}
              disabled={!code.trim() || isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify & enter</Text>}
            </TouchableOpacity>

            <Text style={styles.verifyNote}>This is a one-time step — you'll stay signed in after this.</Text>

            <View style={styles.verifyFooter}>
              <TouchableOpacity onPress={() => signUp!.verifications.sendEmailCode()}>
                <Text style={styles.footerLink}>Resend code</Text>
              </TouchableOpacity>
              <Text style={styles.footerText}> · </Text>
              <TouchableOpacity onPress={() => { signUp!.reset(); setCode(''); setCatchError(''); }}>
                <Text style={styles.footerLink}>Start over</Text>
              </TouchableOpacity>
            </View>

            <View nativeID="clerk-captcha" />
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  // ── Main sign-up screen ───────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>

      {/* decorative stars */}
      <Text style={[styles.star, { top: '10%', right: '10%', fontSize: 9  }]}>✦</Text>
      <Text style={[styles.star, { top: '25%', left: '6%',  fontSize: 7  }]}>✦</Text>
      <Text style={[styles.star, { top: '55%', right: '5%', fontSize: 6  }]}>✦</Text>
      <Text style={[styles.star, { top: '72%', left: '9%',  fontSize: 10 }]}>✦</Text>

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

            <Text style={styles.title}>Begin your journey</Text>
            <Text style={styles.subtitle}>Create your GameJo account</Text>

            {/* ── Google button ──────────────────── */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignUp}
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
              <Text style={styles.dividerText}>or sign up with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Form ───────────────────────────── */}
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
                    placeholder="At least 8 characters"
                    placeholderTextColor="rgba(200,184,232,0.35)"
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
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
                onPress={handleSignUp}
                disabled={!email || !password || isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Create account</Text>
                }
              </TouchableOpacity>

              <View nativeID="clerk-captcha" />
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link href={'/(auth)/sign-in' as any} asChild>
                <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.footerLink}>Sign in</Text>
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

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,91,149,0.22)' },
  dividerText: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.32)', textAlign: 'center' },

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

  // Verification screen
  verifyIconWrap: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(107,91,149,0.18)',
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  verifyIconEmoji: { fontSize: 36 },
  verifyNote: {
    fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)',
    textAlign: 'center', marginTop: 14, lineHeight: 18, paddingHorizontal: 12,
  },
  verifyFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
});

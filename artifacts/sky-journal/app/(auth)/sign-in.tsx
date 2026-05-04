import { Icon } from '@/components/Icon';
import { useSignIn } from '@clerk/expo/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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

const SPARKLES = [
  { t: 60,  l: 30,  s: 4, o: 0.7 },
  { t: 120, r: 40,  s: 3, o: 0.5 },
  { t: 200, l: 60,  s: 5, o: 0.4 },
  { t: 90,  r: 80,  s: 2, o: 0.8 },
  { t: 300, l: 20,  s: 3, o: 0.35 },
  { t: 350, r: 50,  s: 4, o: 0.45 },
];

// Second-factor strategies Clerk may require, in preference order
const MFA_STRATEGIES = ['totp', 'phone_code', 'email_code', 'backup_code'] as const;
type MfaStrategy = typeof MFA_STRATEGIES[number];

function mfaLabel(strategy: MfaStrategy): string {
  switch (strategy) {
    case 'totp':        return 'Enter the code from your authenticator app';
    case 'phone_code':  return 'Enter the code sent to your phone';
    case 'email_code':  return 'Enter the code sent to your email';
    case 'backup_code': return 'Enter a backup recovery code';
    default:            return 'Enter the verification code';
  }
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');

  // MFA state — set when Clerk returns needs_second_factor
  const [mfaRequired, setMfaRequired]   = useState(false);
  const [mfaStrategy, setMfaStrategy]   = useState<MfaStrategy>('totp');
  const [mfaCode, setMfaCode]           = useState('');

  // ── helpers ───────────────────────────────────────────────────────────────

  async function activateSession(sessionId: string | null | undefined) {
    const sid = sessionId ?? signIn?.createdSessionId;
    if (sid && setActive) await setActive({ session: sid });
  }

  function pickStrategy(supported: Array<{ strategy: string }> | undefined): MfaStrategy {
    if (!supported?.length) return 'totp';
    for (const preferred of MFA_STRATEGIES) {
      if (supported.some(f => f.strategy === preferred)) return preferred;
    }
    return (supported[0].strategy as MfaStrategy) ?? 'totp';
  }

  function handleClerkError(err: any) {
    const clerkError = err?.errors?.[0];
    const code: string   = clerkError?.code ?? '';
    const rawMsg: string = clerkError?.longMessage || clerkError?.message || '';

    if (code === 'too_many_requests' || rawMsg.toLowerCase().includes('try again later')) {
      setError('Too many attempts — please wait a minute and try again.');
    } else if (code === 'form_password_incorrect') {
      setError('Incorrect password. Please try again.');
    } else if (code === 'form_identifier_not_found') {
      setError('No account found with that email address.');
    } else if (code === 'form_code_incorrect') {
      setError('Incorrect code. Please try again.');
    } else {
      setError(rawMsg || 'Something went wrong. Please try again.');
    }
  }

  // ── Step 1: password ──────────────────────────────────────────────────────

  async function handleSignIn() {
    if (!isLoaded || !signIn) return;
    setIsLoading(true);
    setError('');

    try {
      const attempt = await signIn.create({ identifier: email, password });

      if (attempt.status === 'complete') {
        await activateSession(attempt.createdSessionId);
        return;
      }

      if (attempt.status === 'needs_second_factor') {
        // Pick the best available MFA strategy and switch to the MFA screen
        const strategy = pickStrategy(attempt.supportedSecondFactors as any);
        setMfaStrategy(strategy);

        // For phone_code, Clerk needs us to prepare the factor first (sends the SMS)
        if (strategy === 'phone_code' || strategy === 'email_code') {
          await signIn.prepareSecondFactor({ strategy });
        }

        setMfaRequired(true);
        return;
      }

      setError(`Unexpected sign-in status: ${attempt.status ?? 'unknown'}`);
    } catch (err) {
      handleClerkError(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: MFA code ──────────────────────────────────────────────────────

  async function handleMfa() {
    if (!isLoaded || !signIn) return;
    setIsLoading(true);
    setError('');

    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: mfaStrategy,
        code: mfaCode.trim(),
      });

      if (attempt.status === 'complete') {
        await activateSession(attempt.createdSessionId);
        return;
      }

      setError(`Unexpected MFA status: ${attempt.status ?? 'unknown'}`);
    } catch (err) {
      handleClerkError(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── MFA screen ─────────────────────────────────────────────────────────────

  if (mfaRequired) {
    return (
      <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
        <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.iconWrap}>
            <LinearGradient colors={['#C8A84B', '#E8C870']} style={styles.iconCircle}>
              <Icon name="shield" size={26} color="#1A1630" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Verification required</Text>
          <Text style={styles.subtitle}>{mfaLabel(mfaStrategy)}</Text>

          <View style={[styles.field, { marginTop: 8 }]}>
            <View style={styles.inputWrap}>
              <Icon name="key" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={mfaCode}
                onChangeText={t => { setMfaCode(t); setError(''); }}
                keyboardType="number-pad"
                placeholder={mfaStrategy === 'backup_code' ? 'xxxxxxxx-xxxx' : '000000'}
                placeholderTextColor="rgba(200,184,232,0.4)"
                autoFocus
                autoComplete="one-time-code"
              />
            </View>
          </View>

          {!!error && <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, { marginTop: 24 }, (!mfaCode.trim() || isLoading) && styles.btnDisabled]}
            onPress={handleMfa}
            disabled={!mfaCode.trim() || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <><Text style={styles.btnText}>Verify</Text><Text style={styles.btnStar}>✦</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => { setMfaRequired(false); setMfaCode(''); setError(''); }}
          >
            <Text style={styles.textBtnText}>← Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── Password screen ────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
      {SPARKLES.map((sp, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: sp.t,
            left: 'l' in sp ? (sp as any).l : undefined,
            right: 'r' in sp ? (sp as any).r : undefined,
            width: sp.s,
            height: sp.s,
            borderRadius: sp.s,
            backgroundColor: '#C8A84B',
            opacity: sp.o,
          }}
        />
      ))}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <LinearGradient colors={['#C8A84B', '#E8C870']} style={styles.iconCircle}>
              <Text style={styles.iconStar}>✦</Text>
            </LinearGradient>
          </View>

          <Text style={styles.appName}>Sky Journal</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrap}>
                <Icon name="mail" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={t => { setEmail(t); setError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="your@email.com"
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="password"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(200,184,232,0.5)" />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <><Text style={styles.btnText}>Continue</Text><Text style={styles.btnStar}>✦</Text></>
              }
            </TouchableOpacity>

            {/* Clerk mounts its invisible bot-protection widget here */}
            <View nativeID="clerk-captcha" />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New to Sky Journal?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href={'/(auth)/sign-up' as any} asChild>
            <Pressable style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>Create an account</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 28, alignItems: 'stretch' },
  iconWrap: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  iconStar: { fontSize: 28, color: '#1A1630' },
  appName: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 3, color: '#C8A84B',
    textAlign: 'center', marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_700Bold',
    color: '#F0ECFF', textAlign: 'center', letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    color: 'rgba(200,184,232,0.65)', textAlign: 'center',
    marginBottom: 36, lineHeight: 20,
  },
  form: { gap: 18 },
  field: { gap: 8 },
  label: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8, color: 'rgba(200,184,232,0.75)',
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(45,31,94,0.5)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(107,91,149,0.45)',
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1, height: 52, paddingHorizontal: 12,
    fontSize: 15, fontFamily: 'Inter_400Regular',
    color: '#F0ECFF',
  },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },
  error: {
    fontSize: 13, fontFamily: 'Inter_400Regular',
    color: '#E06C75', textAlign: 'center',
    backgroundColor: 'rgba(224,108,117,0.12)',
    borderRadius: 10, padding: 10,
  },
  btn: {
    height: 54, borderRadius: 16, marginTop: 4,
    backgroundColor: '#6B5B95',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  btnStar: { fontSize: 12, color: '#C8A84B' },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginVertical: 28,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,91,149,0.3)' },
  dividerText: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: 'rgba(200,184,232,0.5)',
  },
  outlineBtn: {
    height: 54, borderRadius: 16, borderWidth: 1.5,
    borderColor: 'rgba(107,91,149,0.55)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(107,91,149,0.12)',
  },
  outlineBtnText: {
    fontSize: 15, fontFamily: 'Inter_600SemiBold',
    color: 'rgba(200,184,232,0.9)',
  },
  textBtn: { alignItems: 'center', marginTop: 20 },
  textBtnText: {
    fontSize: 14, fontFamily: 'Inter_500Medium',
    color: 'rgba(200,184,232,0.6)',
  },
});

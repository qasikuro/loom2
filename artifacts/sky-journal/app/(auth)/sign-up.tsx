import { Feather } from '@expo/vector-icons';
import { useSignUp } from '@clerk/expo';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
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
  { t: 80,  l: 20,  s: 3, o: 0.6 },
  { t: 140, r: 30,  s: 4, o: 0.5 },
  { t: 230, l: 50,  s: 2, o: 0.45 },
  { t: 100, r: 70,  s: 3, o: 0.7 },
  { t: 320, l: 15,  s: 4, o: 0.3 },
  { t: 380, r: 45,  s: 3, o: 0.4 },
];

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode]                 = useState('');
  const [pendingVerify, setPendingVerify] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');

  async function handleSignUp() {
    if (!isLoaded || !signUp) return;
    setIsLoading(true);
    setError('');
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerify(true);
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Could not create account. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded || !signUp) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)' as any);
      } else {
        setError('Verification could not be completed. Please try again.');
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Invalid code. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (!isLoaded || !signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch { /* silent */ }
  }

  if (pendingVerify) {
    return (
      <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
        <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.iconWrap}>
            <LinearGradient colors={['#C8A84B', '#E8C870']} style={styles.iconCircle}>
              <Text style={styles.iconStar}>✦</Text>
            </LinearGradient>
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to{'\n'}
            <Text style={{ color: '#C8A84B' }}>{email}</Text>
          </Text>

          <View style={[styles.field, { marginTop: 8 }]}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.inputWrap}>
              <Feather name="shield" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={t => { setCode(t); setError(''); }}
                keyboardType="number-pad"
                placeholder="Enter 6-digit code"
                placeholderTextColor="rgba(200,184,232,0.4)"
                autoFocus
              />
            </View>
          </View>

          {!!error && <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, { marginTop: 24 }, (!code || isLoading) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!code || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnText}>Verify & Enter</Text>
                <Text style={styles.btnStar}>✦</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.textBtn} onPress={handleResend}>
            <Text style={styles.textBtnText}>Resend code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textBtn} onPress={() => { setPendingVerify(false); setError(''); }}>
            <Text style={styles.textBtnText}>Start over</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

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
          <Text style={styles.title}>Begin your journey</Text>
          <Text style={styles.subtitle}>Create your account to save your sky memories</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
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
                <Feather name="lock" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  secureTextEntry={!showPassword}
                  placeholder="Create a strong password"
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="new-password"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(200,184,232,0.5)" />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.btnText}>Create account</Text>
                  <Text style={styles.btnStar}>✦</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Already have an account?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href={'/(auth)/sign-in' as any} asChild>
            <Pressable style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>Sign in</Text>
            </Pressable>
          </Link>

          <View nativeID="clerk-captcha" />
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
  textBtn: { alignItems: 'center', marginTop: 16 },
  textBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: 'rgba(200,184,232,0.6)' },
});

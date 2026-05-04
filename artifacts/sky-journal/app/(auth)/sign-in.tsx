import { Feather } from '@expo/vector-icons';
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

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const insets = useSafeAreaInsets();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');

  async function handleSignIn() {
    if (!isLoaded || !signIn) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // AuthNavigator in _layout.tsx detects isSignedIn=true and redirects to /(tabs)
        return;
      }

      // Clerk may return needs_first_factor when the identifier is accepted
      // but the password factor still needs to be submitted separately.
      if (result.status === 'needs_first_factor') {
        const attempt = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
        if (attempt.status === 'complete') {
          await setActive({ session: attempt.createdSessionId });
          return;
        }
      }

      setError('Sign-in could not be completed. Please try again.');
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Incorrect email or password.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>

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
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="password"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(200,184,232,0.5)" />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.btnText}>Continue</Text>
                  <Text style={styles.btnStar}>✦</Text>
                </>
              )}
            </TouchableOpacity>
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
});

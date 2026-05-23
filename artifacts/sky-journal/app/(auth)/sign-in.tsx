import { Icon } from '@/components/Icon';
import { useSignIn } from '@clerk/expo';
import { type Href, useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode]                 = useState('');
  const [catchError, setCatchError]     = useState('');

  const isLoading = fetchStatus === 'fetching';
  const needsMfa =
    signIn?.status === 'needs_client_trust' ||
    signIn?.status === 'needs_second_factor';

  async function sendMfaCode() {
    if (!signIn) return;
    const factors: any[] = (signIn as any).supportedSecondFactors ?? [];
    const hasEmail = factors.some((f: any) => f.strategy === 'email_code');
    const hasPhone = factors.some((f: any) => f.strategy === 'phone_code');
    if (hasEmail) {
      await signIn.mfa.sendEmailCode();
    } else if (hasPhone) {
      await signIn.mfa.sendPhoneCode();
    }
  }

  async function handleSignIn() {
    if (!signIn) {
      setCatchError(t('auth.clerkNotReady'));
      return;
    }
    setCatchError('');
    try {
      const { error } = await signIn.password({ emailAddress: email.trim(), password });
      if (error) {
        setCatchError(error.longMessage ?? error.message ?? t('auth.signInFailed'));
        return;
      }
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace('/(tabs)' as Href);
          },
        });
      } else if (
        signIn.status === 'needs_client_trust' ||
        signIn.status === 'needs_second_factor'
      ) {
        await sendMfaCode();
      } else {
        setCatchError(t('auth.unexpectedStatus'));
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        t('auth.signInFailed');
      setCatchError(msg);
    }
  }

  async function handleVerify() {
    if (!signIn) return;
    setCatchError('');
    try {
      await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace('/(tabs)' as Href);
          },
        });
      } else {
        setCatchError(t('auth.verifyFailed'));
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        t('auth.verifyFailed');
      setCatchError(msg);
    }
  }

  const fieldError =
    catchError ||
    errors?.fields?.identifier?.message ||
    errors?.fields?.password?.message ||
    errors?.fields?.code?.message ||
    '';

  if (needsMfa) {
    return (
      <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
        <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.iconWrap}>
            <LinearGradient colors={['#C8A84B', '#E8C870']} style={styles.iconCircle}>
              <Icon name="shield" size={26} color="#1A1630" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.verifySub')}</Text>

          <View style={[styles.field, { marginTop: 8 }]}>
            <View style={styles.inputWrap}>
              <Icon name="key" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={v => { setCode(v); setCatchError(''); }}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor="rgba(200,184,232,0.4)"
                autoFocus
                autoComplete="one-time-code"
              />
            </View>
          </View>

          {!!fieldError && <Text style={[styles.error, { marginTop: 12 }]}>{fieldError}</Text>}

          <TouchableOpacity
            style={[styles.btn, { marginTop: 24 }, (!code.trim() || isLoading) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!code.trim() || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <><Text style={styles.btnText}>{t('auth.verify')}</Text><Text style={styles.btnStar}>✦</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.textBtn} onPress={sendMfaCode}>
            <Text style={styles.textBtnText}>{t('auth.resendCode')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textBtn} onPress={() => { signIn.reset(); setCode(''); setCatchError(''); }}>
            <Text style={styles.textBtnText}>{t('auth.backToSignIn')}</Text>
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
            width: sp.s, height: sp.s, borderRadius: sp.s,
            backgroundColor: '#C8A84B', opacity: sp.o,
          }}
        />
      ))}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <LinearGradient colors={['#C8A84B', '#E8C870']} style={styles.iconCircle}>
              <Text style={styles.iconStar}>✦</Text>
            </LinearGradient>
          </View>

          <Text style={styles.appName}>Sky Journal</Text>
          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.signInSub')}</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="mail" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={v => { setEmail(v); setCatchError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="lock" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  value={password}
                  onChangeText={v => { setPassword(v); setCatchError(''); }}
                  secureTextEntry={!showPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="password"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(200,184,232,0.5)" />
                </TouchableOpacity>
              </View>
            </View>

            {!!fieldError && <Text style={styles.error}>{fieldError}</Text>}

            <TouchableOpacity
              style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <><Text style={styles.btnText}>{t('auth.continue')}</Text><Text style={styles.btnStar}>✦</Text></>
              }
            </TouchableOpacity>

            <View nativeID="clerk-captcha" />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.newHere')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href={'/(auth)/sign-up' as any} asChild>
            <Pressable style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>{t('auth.createAccount')}</Text>
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
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  iconStar: { fontSize: 28, color: '#1A1630' },
  appName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 3, color: '#C8A84B', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase' },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#F0ECFF', textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.65)', textAlign: 'center', marginBottom: 36, lineHeight: 20 },
  form: { gap: 18 },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, color: 'rgba(200,184,232,0.75)', textTransform: 'uppercase' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(45,31,94,0.5)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(107,91,149,0.45)' },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 52, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#F0ECFF' },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },
  error: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#E06C75', textAlign: 'center', backgroundColor: 'rgba(224,108,117,0.12)', borderRadius: 10, padding: 10 },
  btn: { height: 54, borderRadius: 16, marginTop: 4, backgroundColor: '#6B5B95', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  btnStar: { fontSize: 12, color: '#C8A84B' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 28 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,91,149,0.3)' },
  dividerText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.5)' },
  outlineBtn: { height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(107,91,149,0.55)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,91,149,0.12)' },
  outlineBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: 'rgba(200,184,232,0.9)' },
  textBtn: { alignItems: 'center', marginTop: 20 },
  textBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: 'rgba(200,184,232,0.6)' },
});

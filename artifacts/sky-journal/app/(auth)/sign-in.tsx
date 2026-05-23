import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useSignIn } from '@clerk/expo';
import { type Href, useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
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

type AuthMode = 'password' | 'emailCode';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [authMode, setAuthMode]           = useState<AuthMode>('password');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [code, setCode]                   = useState('');
  const [catchError, setCatchError]       = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [codeSentMsg, setCodeSentMsg]     = useState('');

  const isLoading = fetchStatus === 'fetching';

  const needsMfa =
    signIn?.status === 'needs_client_trust' ||
    signIn?.status === 'needs_second_factor';

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    setCatchError('');
    setCode('');
    setEmailCodeSent(false);
    setCodeSentMsg('');
  }

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
    if (!signIn) { setCatchError(t('auth.clerkNotReady')); return; }
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
      setCatchError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        t('auth.signInFailed')
      );
    }
  }

  async function handleMfaVerify() {
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
      setCatchError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        t('auth.verifyFailed')
      );
    }
  }

  async function handleSendEmailCode() {
    if (!signIn) { setCatchError(t('auth.clerkNotReady')); return; }
    if (!email.trim()) { setCatchError(t('auth.enterEmailFirst')); return; }
    setCatchError('');
    setCodeSentMsg('');
    try {
      await signIn.create({ identifier: email.trim() });
      const factors: any[] = (signIn as any).supportedFirstFactors ?? [];
      const emailFactor = factors.find((f: any) => f.strategy === 'email_code');
      await (signIn as any).prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor?.emailAddressId ?? '',
      });
      setEmailCodeSent(true);
      setCodeSentMsg(t('auth.codeSent'));
    } catch (err: any) {
      setCatchError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        t('auth.emailCodeFailed')
      );
    }
  }

  async function handleVerifyEmailCode() {
    if (!signIn) return;
    setCatchError('');
    try {
      const result = await (signIn as any).attemptFirstFactor({
        strategy: 'email_code',
        code: code.trim(),
      });
      if (result.status === 'complete') {
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
      setCatchError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        t('auth.verifyFailed')
      );
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
          <View style={styles.logoWrap}>
            <Image source={Images.logo} style={styles.logo} contentFit="contain" />
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
            onPress={handleMfaVerify}
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
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Skyloom logo */}
          <View style={styles.logoWrap}>
            <Image source={Images.logo} style={styles.logo} contentFit="contain" />
          </View>

          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.signInSub')}</Text>

          {/* Auth mode tab switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, authMode === 'password' && styles.tabActive]}
              onPress={() => switchMode('password')}
            >
              <Icon name="lock" size={13} color={authMode === 'password' ? '#F0ECFF' : 'rgba(200,184,232,0.5)'} />
              <Text style={[styles.tabText, authMode === 'password' && styles.tabTextActive]}>
                {t('auth.passwordTab')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, authMode === 'emailCode' && styles.tabActive]}
              onPress={() => switchMode('emailCode')}
            >
              <Icon name="mail" size={13} color={authMode === 'emailCode' ? '#F0ECFF' : 'rgba(200,184,232,0.5)'} />
              <Text style={[styles.tabText, authMode === 'emailCode' && styles.tabTextActive]}>
                {t('auth.emailCodeTab')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Email field — shared by both modes */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <View style={styles.inputWrap}>
                <Icon name="mail" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={v => { setEmail(v); setCatchError(''); setEmailCodeSent(false); setCodeSentMsg(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor="rgba(200,184,232,0.4)"
                  autoComplete="email"
                />
              </View>
            </View>

            {authMode === 'password' && (
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
            )}

            {authMode === 'emailCode' && emailCodeSent && (
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.verificationCode')}</Text>
                <View style={styles.inputWrap}>
                  <Icon name="shield" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={v => { setCode(v); setCatchError(''); }}
                    keyboardType="number-pad"
                    placeholder={t('auth.enterCode')}
                    placeholderTextColor="rgba(200,184,232,0.4)"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </View>
                {!!codeSentMsg && (
                  <Text style={styles.successMsg}>{codeSentMsg}</Text>
                )}
              </View>
            )}

            {!!fieldError && <Text style={styles.error}>{fieldError}</Text>}

            {authMode === 'password' && (
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
            )}

            {authMode === 'emailCode' && !emailCodeSent && (
              <TouchableOpacity
                style={[styles.btn, (!email.trim() || isLoading) && styles.btnDisabled]}
                onPress={handleSendEmailCode}
                disabled={!email.trim() || isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <><Text style={styles.btnText}>{t('auth.sendCode')}</Text><Icon name="send" size={14} color="#fff" /></>
                }
              </TouchableOpacity>
            )}

            {authMode === 'emailCode' && emailCodeSent && (
              <>
                <TouchableOpacity
                  style={[styles.btn, (!code.trim() || isLoading) && styles.btnDisabled]}
                  onPress={handleVerifyEmailCode}
                  disabled={!code.trim() || isLoading}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <><Text style={styles.btnText}>{t('auth.verifyEnter')}</Text><Text style={styles.btnStar}>✦</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.textBtn} onPress={handleSendEmailCode}>
                  <Text style={styles.textBtnText}>{t('auth.resendCode')}</Text>
                </TouchableOpacity>
              </>
            )}

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

  logoWrap: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 180, height: 180 },

  title: { fontSize: 26, fontFamily: 'Satoshi-Bold', color: '#F0ECFF', textAlign: 'center', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.65)', textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,31,94,0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(107,91,149,0.35)',
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11,
  },
  tabActive: { backgroundColor: 'rgba(107,91,149,0.65)' },
  tabText: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.5)' },
  tabTextActive: { color: '#F0ECFF' },

  form: { gap: 18 },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.8, color: 'rgba(200,184,232,0.75)', textTransform: 'uppercase' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(45,31,94,0.5)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(107,91,149,0.45)' },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 52, paddingHorizontal: 12, fontSize: 15, fontFamily: 'Satoshi-Regular', color: '#F0ECFF' },
  eyeBtn: { position: 'absolute', right: 14, padding: 4 },

  successMsg: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: '#6DD68E', marginTop: 2 },
  error: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75', textAlign: 'center', backgroundColor: 'rgba(224,108,117,0.12)', borderRadius: 10, padding: 10 },

  btn: { height: 54, borderRadius: 16, marginTop: 4, backgroundColor: '#6B5B95', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff' },
  btnStar: { fontSize: 12, color: '#C8A84B' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 28 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,91,149,0.3)' },
  dividerText: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.5)' },

  outlineBtn: { height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(107,91,149,0.55)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,91,149,0.12)' },
  outlineBtnText: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.9)' },

  textBtn: { alignItems: 'center', marginTop: 16 },
  textBtnText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.6)' },
});

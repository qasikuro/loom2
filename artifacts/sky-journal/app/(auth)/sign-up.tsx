import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useSignUp } from '@clerk/expo';
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
  { t: 80,  l: 20,  s: 3, o: 0.6 },
  { t: 140, r: 30,  s: 4, o: 0.5 },
  { t: 230, l: 50,  s: 2, o: 0.45 },
  { t: 100, r: 70,  s: 3, o: 0.7 },
  { t: 320, l: 15,  s: 4, o: 0.3 },
  { t: 380, r: 45,  s: 3, o: 0.4 },
];

type SignupMode = 'withPassword' | 'noPassword';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [signupMode, setSignupMode]         = useState<SignupMode>('withPassword');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [code, setCode]                     = useState('');
  const [catchError, setCatchError]         = useState('');
  const [emailCodeSent, setEmailCodeSent]   = useState(false);
  const [codeSentMsg, setCodeSentMsg]       = useState('');

  const isLoading = fetchStatus === 'fetching';

  const needsVerification =
    signUp?.status === 'missing_requirements' &&
    Array.isArray(signUp?.unverifiedFields) &&
    signUp.unverifiedFields.includes('email_address') &&
    (signUp?.missingFields?.length ?? 0) === 0;

  function switchMode(mode: SignupMode) {
    setSignupMode(mode);
    setCatchError('');
    setCode('');
    setEmailCodeSent(false);
    setCodeSentMsg('');
  }

  async function handleSignUp() {
    if (!signUp) return;
    setCatchError('');
    try {
      const { error } = await signUp.password({ emailAddress: email.trim(), password });
      if (error) {
        setCatchError(error.longMessage ?? error.message ?? 'Could not create account.');
        return;
      }
      await signUp.verifications.sendEmailCode();
    } catch (err: any) {
      setCatchError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Could not create account. Please check your connection and try again.'
      );
    }
  }

  async function handleVerify() {
    if (!signUp) return;
    setCatchError('');
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === 'complete') {
        await signUp.finalize({
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

  async function handleSendEmailCodeSignUp() {
    if (!signUp) { setCatchError(t('auth.clerkNotReady')); return; }
    if (!email.trim()) { setCatchError(t('auth.enterEmailFirst')); return; }
    setCatchError('');
    setCodeSentMsg('');
    try {
      await signUp.create({ emailAddress: email.trim() });
      await signUp.verifications.sendEmailCode();
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

  async function handleVerifyEmailCodeSignUp() {
    if (!signUp) return;
    setCatchError('');
    try {
      await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (signUp.status === 'complete') {
        await signUp.finalize({
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
    errors?.fields?.emailAddress?.message ||
    errors?.fields?.password?.message ||
    errors?.fields?.code?.message ||
    '';

  if (needsVerification) {
    return (
      <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
        <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.logoWrap}>
            <Image source={Images.logo} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>{t('auth.checkEmail')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.codeSentTo', { email })}
          </Text>

          <View style={[styles.field, { marginTop: 8 }]}>
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
              />
            </View>
          </View>

          {!!fieldError && <Text style={[styles.error, { marginTop: 12 }]}>{fieldError}</Text>}

          <TouchableOpacity
            style={[styles.btn, { marginTop: 24 }, (!code || isLoading) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!code || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <><Text style={styles.btnText}>{t('auth.verifyEnter')}</Text><Text style={styles.btnStar}>✦</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.textBtn} onPress={() => signUp.verifications.sendEmailCode()}>
            <Text style={styles.textBtnText}>{t('auth.resendCode')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textBtn} onPress={() => { signUp.reset(); setCode(''); setCatchError(''); }}>
            <Text style={styles.textBtnText}>{t('auth.startOver')}</Text>
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

          <Text style={styles.title}>{t('auth.beginJourney')}</Text>
          <Text style={styles.subtitle}>{t('auth.signUpSub')}</Text>

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

            {signupMode === 'withPassword' && (
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.password')}</Text>
                <View style={styles.inputWrap}>
                  <Icon name="lock" size={16} color="rgba(200,184,232,0.5)" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { paddingRight: 44 }]}
                    value={password}
                    onChangeText={v => { setPassword(v); setCatchError(''); }}
                    secureTextEntry={!showPassword}
                    placeholder={t('auth.passwordCreatePlaceholder')}
                    placeholderTextColor="rgba(200,184,232,0.4)"
                    autoComplete="new-password"
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} color="rgba(200,184,232,0.5)" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {signupMode === 'noPassword' && emailCodeSent && (
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

            {signupMode === 'withPassword' && (
              <>
                <TouchableOpacity
                  style={[styles.btn, (!email || !password || isLoading) && styles.btnDisabled]}
                  onPress={handleSignUp}
                  disabled={!email || !password || isLoading}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <><Text style={styles.btnText}>{t('auth.createAccountBtn')}</Text><Text style={styles.btnStar}>✦</Text></>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchLink} onPress={() => switchMode('noPassword')}>
                  <Text style={styles.switchLinkText}>{t('auth.noPasswordTab')} →</Text>
                </TouchableOpacity>
              </>
            )}

            {signupMode === 'noPassword' && !emailCodeSent && (
              <>
                <TouchableOpacity
                  style={[styles.btn, (!email.trim() || isLoading) && styles.btnDisabled]}
                  onPress={handleSendEmailCodeSignUp}
                  disabled={!email.trim() || isLoading}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <><Text style={styles.btnText}>{t('auth.sendCode')}</Text><Icon name="send" size={14} color="#fff" /></>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchLink} onPress={() => switchMode('withPassword')}>
                  <Text style={styles.switchLinkText}>{t('auth.withPasswordTab')} →</Text>
                </TouchableOpacity>
              </>
            )}

            {signupMode === 'noPassword' && emailCodeSent && (
              <>
                <TouchableOpacity
                  style={[styles.btn, (!code.trim() || isLoading) && styles.btnDisabled]}
                  onPress={handleVerifyEmailCodeSignUp}
                  disabled={!code.trim() || isLoading}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <><Text style={styles.btnText}>{t('auth.verifyEnter')}</Text><Text style={styles.btnStar}>✦</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.textBtn} onPress={handleSendEmailCodeSignUp}>
                  <Text style={styles.textBtnText}>{t('auth.resendCode')}</Text>
                </TouchableOpacity>
              </>
            )}

            <View nativeID="clerk-captcha" />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.alreadyHave')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href={'/(auth)/sign-in' as any} asChild>
            <Pressable style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>{t('auth.signIn')}</Text>
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

  switchLink: { alignItems: 'center', paddingVertical: 4 },
  switchLinkText: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.45)', letterSpacing: 0.2 },

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

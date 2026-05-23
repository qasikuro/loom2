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
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isLoading = fetchStatus === 'fetching';

  const needsMfa =
    signIn?.status === 'needs_client_trust' ||
    signIn?.status === 'needs_second_factor';

  async function sendMfaCode() {
    if (!signIn) return;
    const factors: any[] = (signIn as any).supportedSecondFactors ?? [];
    const hasEmail = factors.some((f: any) => f.strategy === 'email_code');
    const hasPhone = factors.some((f: any) => f.strategy === 'phone_code');
    if (hasEmail) await signIn.mfa.sendEmailCode();
    else if (hasPhone) await signIn.mfa.sendPhoneCode();
  }

  async function handleSignIn() {
    if (!signIn) { setCatchError(t('auth.clerkNotReady')); return; }
    setCatchError('');
    try {
      const { error } = await signIn.password({ emailAddress: email.trim(), password });
      if (error) { setCatchError(error.longMessage ?? error.message ?? t('auth.signInFailed')); return; }
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session }) => { if (session?.currentTask) return; router.replace('/(tabs)' as Href); },
        });
      } else if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
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
          navigate: ({ session }) => { if (session?.currentTask) return; router.replace('/(tabs)' as Href); },
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

  // ── MFA screen (only shown if account has 2FA configured) ─────────────────
  if (needsMfa) {
    return (
      <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
        <View style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.logoWrap}>
            <Image source={Images.logo} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.verifySub')}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('auth.verificationCode')}</Text>
            <View style={[styles.inputBox, focusedField === 'code' && styles.inputBoxFocused]}>
              <TextInput
                style={styles.inputText}
                value={code}
                onChangeText={v => { setCode(v); setCatchError(''); }}
                onFocus={() => setFocusedField('code')}
                onBlur={() => setFocusedField(null)}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor="rgba(200,184,232,0.35)"
                autoFocus
                autoComplete="one-time-code"
              />
            </View>
          </View>

          {!!fieldError && <Text style={[styles.errorText, { marginTop: 12 }]}>{fieldError}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 24 }, (!code.trim() || isLoading) && styles.primaryBtnDisabled]}
            onPress={handleMfaVerify}
            disabled={!code.trim() || isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('auth.verify')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={sendMfaCode}>
            <Text style={styles.ghostBtnText}>{t('auth.resendCode')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => { signIn.reset(); setCode(''); setCatchError(''); }}>
            <Text style={styles.ghostBtnText}>{t('auth.backToSignIn')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── Main sign-in screen ───────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0D0B1E', '#1A1630', '#2D1F5E']} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <Image source={Images.logo} style={styles.logo} contentFit="contain" />
          </View>

          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.signInSub')}</Text>

          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <View style={[styles.inputBox, focusedField === 'email' && styles.inputBoxFocused]}>
                <TextInput
                  style={styles.inputText}
                  value={email}
                  onChangeText={v => { setEmail(v); setCatchError(''); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor="rgba(200,184,232,0.35)"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
              <View style={[styles.inputBox, focusedField === 'password' && styles.inputBoxFocused]}>
                <TextInput
                  style={[styles.inputText, { paddingRight: 52 }]}
                  value={password}
                  onChangeText={v => { setPassword(v); setCatchError(''); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor="rgba(200,184,232,0.35)"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                  <Icon
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={focusedField === 'password' ? 'rgba(200,184,232,0.8)' : 'rgba(200,184,232,0.4)'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!!fieldError && <Text style={styles.errorText}>{fieldError}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, (!email || !password || isLoading) && styles.primaryBtnDisabled]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('auth.continue')}</Text>}
            </TouchableOpacity>

            <View nativeID="clerk-captcha" />
          </View>

          <View style={styles.dividerRow}>
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
  container: { paddingHorizontal: 24, alignItems: 'stretch' },

  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 130, height: 130 },

  title: {
    fontSize: 28,
    fontFamily: 'Satoshi-Bold',
    color: '#F0ECFF',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },

  form: { gap: 16 },

  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,184,232,0.7)',
    marginLeft: 2,
  },
  inputBox: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(107,91,149,0.3)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputBoxFocused: {
    borderColor: 'rgba(180,160,240,0.75)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Satoshi-Regular',
    color: '#F0ECFF',
    letterSpacing: 0.1,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    padding: 6,
  },

  errorText: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    color: '#E06C75',
    textAlign: 'center',
    backgroundColor: 'rgba(224,108,117,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  primaryBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#6B5B95',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },

  ghostBtn: { alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,184,232,0.55)',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(107,91,149,0.25)' },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.4)',
  },

  outlineBtn: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(107,91,149,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,91,149,0.08)',
  },
  outlineBtnText: {
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.85)',
    letterSpacing: 0.2,
  },
});

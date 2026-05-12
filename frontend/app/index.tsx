import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, radii } from '../src/theme';

export default function AuthScreen() {
  const { user, loading, login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.loadingWrap} testID="auth-loading">
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const showError = (e: any) => {
    const msg = e?.response?.data?.detail || e?.message || 'Algo salió mal';
    setError(msg);
    if (Platform.OS !== 'web') Alert.alert('Error', msg);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password || (mode === 'register' && !name)) {
      setError('Por favor completa todos los campos');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try { await loginWithGoogle(); }
    catch (e) { showError(e); }
    finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero} testID="auth-hero">
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.brand}>Control Financiero Pro</Text>
          <Text style={styles.tagline}>Tus finanzas con calma. Tus metas, claras.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            <TouchableOpacity
              testID="tab-login"
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => setMode('login')}>
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Iniciar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tab-register"
              style={[styles.tab, mode === 'register' && styles.tabActive]}
              onPress={() => setMode('register')}>
              <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>

          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                testID="input-name"
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="input-email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              testID="input-password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              secureTextEntry
            />
          </View>

          {error && <Text style={styles.error} testID="auth-error">{error}</Text>}

          <TouchableOpacity
            testID="auth-submit"
            style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerWrap}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>o continúa con</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            testID="auth-google"
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={submitting}>
            <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
            <Text style={styles.googleBtnText}>Continuar con Google</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Al continuar aceptas el uso responsable de tus datos financieros.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl * 2, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  brand: { fontFamily: 'Outfit_900Black', fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, marginTop: 4, fontSize: 15 },
  card: {
    backgroundColor: colors.bgSecondary, borderRadius: radii.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radii.full,
    padding: 4, marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.full },
  tabActive: { backgroundColor: colors.bgSecondary, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  tabText: { fontFamily: 'Manrope_600SemiBold', color: colors.textSecondary, fontSize: 14 },
  tabTextActive: { color: colors.textPrimary },
  field: { marginBottom: spacing.md },
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 14,
    fontFamily: 'Manrope_500Medium', color: colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  error: { color: colors.expense, fontFamily: 'Manrope_500Medium', marginBottom: spacing.sm, fontSize: 13 },
  primaryBtn: {
    backgroundColor: colors.brand, borderRadius: radii.full, paddingVertical: 16,
    alignItems: 'center', marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.textInverse, fontFamily: 'Manrope_700Bold', fontSize: 15, letterSpacing: 0.3 },
  dividerWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: 8 },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText: { color: colors.textSecondary, fontFamily: 'Manrope_500Medium', fontSize: 12 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.bgSecondary, borderRadius: radii.full, paddingVertical: 14,
    borderWidth: 1.5, borderColor: colors.borderSubtle,
  },
  googleBtnText: { fontFamily: 'Manrope_700Bold', color: colors.textPrimary, fontSize: 14 },
  footer: { textAlign: 'center', color: colors.textSecondary, fontFamily: 'Manrope_500Medium', fontSize: 12, marginTop: spacing.lg },
});

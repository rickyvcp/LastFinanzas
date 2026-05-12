import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';
import { CATEGORIES, CATEGORY_META, ACCOUNTS, currentMonth } from '../categories';
import { colors, radii, spacing } from '../theme';

type Props = { visible: boolean; onClose: () => void; onSaved: () => void };

export function AddTransactionSheet({ visible, onClose, onSaved }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Alimentación');
  const [account, setAccount] = useState<string>('Efectivo');
  const [month, setMonth] = useState<string>(currentMonth());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setType('expense'); setTitle(''); setAmount('');
      setCategory('Alimentación'); setAccount('Efectivo');
      setMonth(currentMonth()); setNote(''); setError(null);
    }
  }, [visible]);

  const handleSave = async () => {
    setError(null);
    const amt = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || isNaN(amt) || amt <= 0) {
      setError('Completa título y monto válido');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/transactions', {
        title: title.trim(), amount: amt, category, type, account, month, note, is_paid: true,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al guardar');
    } finally { setSubmitting(false); }
  };

  const scanReceipt = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permisos', 'Se requiere acceso a tus fotos para escanear recibos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        base64: true,
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setScanning(true);
      const r = await api.post('/analyze-receipt', {
        image_base64: result.assets[0].base64,
        mime_type: 'image/jpeg',
      });
      const data = r.data;
      setTitle(data.title || '');
      setAmount(String(data.amount ?? ''));
      if (data.category && CATEGORIES.includes(data.category)) setCategory(data.category);
      if (data.type === 'income' || data.type === 'expense') setType(data.type);
      if (data.month) setMonth(data.month);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo analizar el recibo');
    } finally { setScanning(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handleWrap}><View style={styles.handle} /></View>
          <View style={styles.header}>
            <Text style={styles.title}>Nuevo movimiento</Text>
            <TouchableOpacity testID="close-sheet" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
            <View style={styles.typeRow}>
              <TouchableOpacity
                testID="type-expense"
                onPress={() => setType('expense')}
                style={[styles.typeBtn, type === 'expense' && { backgroundColor: colors.expense, borderColor: colors.expense }]}>
                <MaterialCommunityIcons name="arrow-down" size={18} color={type === 'expense' ? '#fff' : colors.expense} />
                <Text style={[styles.typeText, type === 'expense' && { color: '#fff' }]}>Gasto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="type-income"
                onPress={() => setType('income')}
                style={[styles.typeBtn, type === 'income' && { backgroundColor: colors.income, borderColor: colors.income }]}>
                <MaterialCommunityIcons name="arrow-up" size={18} color={type === 'income' ? '#fff' : colors.income} />
                <Text style={[styles.typeText, type === 'income' && { color: '#fff' }]}>Ingreso</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="scan-receipt"
              onPress={scanReceipt}
              disabled={scanning}
              style={styles.scanBtn}>
              {scanning ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  <MaterialCommunityIcons name="auto-fix" size={20} color={colors.brand} />
                  <Text style={styles.scanText}>Escanear recibo con IA</Text>
                </>
              )}
            </TouchableOpacity>

            <Field label="Título">
              <TextInput
                testID="input-title"
                value={title}
                onChangeText={setTitle}
                placeholder="ej. Supermercado"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
            </Field>

            <Field label="Monto ($)">
              <TextInput
                testID="input-amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                keyboardType="decimal-pad"
              />
            </Field>

            <Field label="Categoría">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map((c) => {
                  const m = CATEGORY_META[c];
                  const active = c === category;
                  return (
                    <TouchableOpacity
                      key={c}
                      testID={`cat-${c}`}
                      onPress={() => setCategory(c)}
                      style={[styles.chip, active && { backgroundColor: m.color, borderColor: m.color }]}>
                      <MaterialCommunityIcons name={m.icon as any} size={14} color={active ? '#fff' : m.color} />
                      <Text style={[styles.chipText, active && { color: '#fff' }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Field>

            <Field label="Cuenta">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {ACCOUNTS.map((a) => (
                  <TouchableOpacity
                    key={a}
                    testID={`acc-${a}`}
                    onPress={() => setAccount(a)}
                    style={[styles.chip, a === account && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                    <Text style={[styles.chipText, a === account && { color: '#fff' }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Field>

            <Field label="Mes (YYYY-MM)">
              <TextInput
                testID="input-month"
                value={month}
                onChangeText={setMonth}
                placeholder="2026-02"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
            </Field>

            <Field label="Nota (opcional)">
              <TextInput
                testID="input-note"
                value={note}
                onChangeText={setNote}
                placeholder="Detalles…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { minHeight: 60 }]}
                multiline
              />
            </Field>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              testID="save-transaction"
              style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar movimiento</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: spacing.lg, maxHeight: '90%' },
  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.bgTertiary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: colors.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: colors.bgSecondary, borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.borderSubtle },
  typeText: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: colors.textPrimary },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 12, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle },
  scanText: { fontFamily: 'Manrope_700Bold', color: colors.brand, fontSize: 13 },
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  input: { backgroundColor: colors.bgSecondary, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Manrope_500Medium', color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderSubtle, fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderSubtle },
  chipText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radii.full, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 15 },
  error: { color: colors.expense, fontFamily: 'Manrope_500Medium', marginBottom: spacing.sm },
});

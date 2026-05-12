import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api/client';
import { CATEGORIES, CATEGORY_META, currentMonth } from '../categories';
import { colors, radii, spacing } from '../theme';

export function AddBudgetSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<string>('Alimentación');
  const [limit, setLimit] = useState('');
  const [month, setMonth] = useState<string>(currentMonth());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setCategory('Alimentación'); setLimit(''); setMonth(currentMonth()); setError(null); }
  }, [visible]);

  const save = async () => {
    setError(null);
    const lim = parseFloat(limit.replace(',', '.'));
    if (isNaN(lim) || lim <= 0) { setError('Monto inválido'); return; }
    setSubmitting(true);
    try {
      await api.post('/budgets', { category, limit: lim, month });
      onSaved(); onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al guardar');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handleWrap}><View style={styles.handle} /></View>
          <View style={styles.header}>
            <Text style={styles.title}>Nuevo presupuesto</Text>
            <TouchableOpacity testID="close-budget-sheet" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: spacing.md }}>
            {CATEGORIES.map((c) => {
              const m = CATEGORY_META[c];
              const active = c === category;
              return (
                <TouchableOpacity
                  key={c}
                  testID={`bcat-${c}`}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, active && { backgroundColor: m.color, borderColor: m.color }]}>
                  <MaterialCommunityIcons name={m.icon as any} size={14} color={active ? '#fff' : m.color} />
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Límite mensual ($)</Text>
          <TextInput
            testID="input-budget-limit"
            value={limit}
            onChangeText={setLimit}
            placeholder="500.00"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Mes</Text>
          <TextInput
            testID="input-budget-month"
            value={month}
            onChangeText={setMonth}
            placeholder="2026-02"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="save-budget"
            style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
            onPress={save}
            disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar presupuesto</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: spacing.lg },
  handleWrap: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.bgTertiary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: colors.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  input: { backgroundColor: colors.bgSecondary, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Manrope_500Medium', color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderSubtle, fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderSubtle },
  chipText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radii.full, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 15 },
  error: { color: colors.expense, fontFamily: 'Manrope_500Medium', marginTop: spacing.sm },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { colors, radii, spacing } from '../theme';

const COLORS = ['#386641', '#BC4749', '#E07A5F', '#5B7DB1', '#9B5DE5', '#D4A373', '#3D8BFD'];

export function AddGoalSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setName(''); setTarget(''); setSaved('0'); setDeadline(''); setColor(COLORS[0]); setError(null); }
  }, [visible]);

  const save = async () => {
    setError(null);
    const t = parseFloat(target.replace(',', '.'));
    const s = parseFloat(saved.replace(',', '.') || '0');
    if (!name.trim() || isNaN(t) || t <= 0) { setError('Completa nombre y monto objetivo'); return; }
    setSubmitting(true);
    try {
      await api.post('/goals', {
        name: name.trim(), target_amount: t, saved_amount: isNaN(s) ? 0 : s, deadline: deadline || null, color,
      });
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
            <Text style={styles.title}>Nueva meta</Text>
            <TouchableOpacity testID="close-goal-sheet" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nombre</Text>
          <TextInput testID="input-goal-name" value={name} onChangeText={setName} placeholder="ej. Fondo de viaje" placeholderTextColor={colors.textSecondary} style={styles.input} />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Monto objetivo ($)</Text>
          <TextInput testID="input-goal-target" value={target} onChangeText={setTarget} placeholder="2000" placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="decimal-pad" />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Ahorrado inicial ($)</Text>
          <TextInput testID="input-goal-saved" value={saved} onChangeText={setSaved} placeholder="0" placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="decimal-pad" />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Fecha límite (opcional)</Text>
          <TextInput testID="input-goal-deadline" value={deadline} onChangeText={setDeadline} placeholder="2026-12-31" placeholderTextColor={colors.textSecondary} style={styles.input} />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                testID={`goal-color-${c}`}
                onPress={() => setColor(c)}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorActive]}
              />
            ))}
          </ScrollView>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            testID="save-goal"
            style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
            onPress={save}
            disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar meta</Text>}
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
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorActive: { borderColor: colors.textPrimary },
  saveBtn: { backgroundColor: colors.brand, borderRadius: radii.full, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 15 },
  error: { color: colors.expense, fontFamily: 'Manrope_500Medium', marginTop: spacing.sm },
});

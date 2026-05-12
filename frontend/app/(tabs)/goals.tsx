import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { colors, radii, spacing } from '../../src/theme';
import { formatMoney } from '../../src/categories';
import { AddGoalSheet } from '../../src/components/AddGoalSheet';

type Goal = { id: string; name: string; target_amount: number; saved_amount: number; deadline?: string; color: string };

export default function Goals() {
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [contribAmount, setContribAmount] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await api.get('/goals');
      setItems(r.data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const contribute = async (id: string) => {
    const raw = contribAmount[id];
    const amt = parseFloat((raw || '').replace(',', '.'));
    if (!raw || isNaN(amt) || amt <= 0) return;
    try {
      await api.post(`/goals/${id}/contribute`, { amount: amt });
      setContribAmount((s) => ({ ...s, [id]: '' }));
      load();
    } catch (e) { console.warn(e); }
  };

  const handleDelete = (id: string) => {
    const doDelete = async () => { try { await api.delete(`/goals/${id}`); load(); } catch {} };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm('¿Eliminar esta meta?')) doDelete(); }
    else Alert.alert('Eliminar', '¿Eliminar esta meta?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: doDelete }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Metas</Text>
        <Text style={styles.sub}>Ahorra hacia lo que importa.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="trophy-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.empty}>Aún no tienes metas.</Text>
              <Text style={styles.emptySub}>Crea una con el botón +</Text>
            </View>
          ) : (
            items.map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, (g.saved_amount / g.target_amount) * 100) : 0;
              const done = g.saved_amount >= g.target_amount;
              return (
                <View key={g.id} style={styles.card} testID={`goal-${g.id}`}>
                  <View style={styles.rowHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                      {!!g.deadline && <Text style={styles.deadline}>Hasta {g.deadline}</Text>}
                    </View>
                    <TouchableOpacity testID={`delete-goal-${g.id}`} onPress={() => handleDelete(g.id)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: g.color || colors.brand }]} />
                  </View>
                  <View style={styles.rowFooter}>
                    <Text style={styles.saved}>
                      <Text style={{ color: g.color || colors.brand, fontFamily: 'Manrope_700Bold' }}>{formatMoney(g.saved_amount)}</Text>
                      {'  de  '}{formatMoney(g.target_amount)}
                    </Text>
                    <Text style={[styles.pct, { color: g.color || colors.brand }]}>{pct.toFixed(0)}%</Text>
                  </View>
                  {!done && (
                    <View style={styles.contribRow}>
                      <TextInput
                        testID={`contrib-input-${g.id}`}
                        value={contribAmount[g.id] || ''}
                        onChangeText={(v) => setContribAmount((s) => ({ ...s, [g.id]: v }))}
                        placeholder="Aportar $"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.contribInput}
                        keyboardType="decimal-pad"
                      />
                      <TouchableOpacity testID={`contrib-btn-${g.id}`} onPress={() => contribute(g.id)} style={[styles.contribBtn, { backgroundColor: g.color || colors.brand }]}>
                        <Text style={styles.contribBtnText}>Aportar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {done && <Text style={[styles.doneText, { color: g.color || colors.brand }]}>¡Meta completada! 🎉</Text>}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <TouchableOpacity testID="fab-add-goal" style={styles.fab} onPress={() => setShowSheet(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddGoalSheet visible={showSheet} onClose={() => setShowSheet(false)} onSaved={load} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  h1: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: colors.bgSecondary, padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  name: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: colors.textPrimary },
  deadline: { fontFamily: 'Manrope_500Medium', fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  progressTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  saved: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: colors.textSecondary },
  pct: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  contribRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  contribInput: { flex: 1, backgroundColor: colors.bg, borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Manrope_500Medium', color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderSubtle, fontSize: 13 },
  contribBtn: { paddingHorizontal: 18, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  contribBtnText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 13 },
  empty: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, marginTop: 8 },
  emptySub: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, fontSize: 12 },
  doneText: { fontFamily: 'Manrope_700Bold', marginTop: 10, fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});

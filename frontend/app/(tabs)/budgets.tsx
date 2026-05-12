import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { colors, radii, spacing } from '../../src/theme';
import { formatMoney, monthLabel, currentMonth, CATEGORY_META } from '../../src/categories';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { AddBudgetSheet } from '../../src/components/AddBudgetSheet';

type Budget = { id: string; category: string; limit: number; month: string; spent: number };

export default function Budgets() {
  const [items, setItems] = useState<Budget[]>([]);
  const [month, setMonth] = useState<string>(currentMonth());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/budgets', { params: { month } });
      setItems(r.data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: string) => {
    const doDelete = async () => { try { await api.delete(`/budgets/${id}`); load(); } catch {} };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm('¿Eliminar este presupuesto?')) doDelete(); }
    else Alert.alert('Eliminar', '¿Eliminar este presupuesto?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: doDelete }]);
  };

  const monthChange = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Presupuestos</Text>
        <View style={styles.monthSwitcher}>
          <TouchableOpacity testID="prev-month" onPress={() => monthChange(-1)} style={styles.monthBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthText} testID="current-month">{monthLabel(month)}</Text>
          <TouchableOpacity testID="next-month" onPress={() => monthChange(1)} style={styles.monthBtn}>
            <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="pie-chart-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.empty}>No tienes presupuestos para {monthLabel(month)}.</Text>
            </View>
          ) : (
            items.map((b) => {
              const pct = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 0;
              const color = pct >= 100 ? colors.expense : pct >= 75 ? colors.warning : colors.income;
              return (
                <TouchableOpacity
                  key={b.id}
                  testID={`budget-${b.id}`}
                  onLongPress={() => handleDelete(b.id)}
                  activeOpacity={0.85}
                  style={styles.card}>
                  <View style={styles.rowHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                      <CategoryIcon category={b.category} size={18} />
                      <Text style={styles.cardTitle}>{b.category}</Text>
                    </View>
                    <Text style={styles.cardLimit}>{formatMoney(b.limit)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <View style={styles.rowFooter}>
                    <Text style={styles.spent}><Text style={{ color }}>{formatMoney(b.spent)}</Text> de {formatMoney(b.limit)}</Text>
                    <Text style={[styles.pct, { color }]}>{pct.toFixed(0)}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <TouchableOpacity testID="fab-add-budget" style={styles.fab} onPress={() => setShowSheet(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddBudgetSheet visible={showSheet} onClose={() => setShowSheet(false)} onSaved={load} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  h1: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  monthSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  monthBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  monthText: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: colors.textPrimary, minWidth: 100, textAlign: 'center' },
  card: { backgroundColor: colors.bgSecondary, padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontFamily: 'Manrope_700Bold', fontSize: 15, color: colors.textPrimary },
  cardLimit: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: colors.textPrimary },
  progressTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  rowFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  spent: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: colors.textSecondary },
  pct: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  empty: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});

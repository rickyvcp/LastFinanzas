import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { colors, radii, spacing } from '../../src/theme';
import { formatMoney, monthLabel, currentMonth } from '../../src/categories';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { AddTransactionSheet } from '../../src/components/AddTransactionSheet';

type Tx = { id: string; title: string; amount: number; category: string; type: 'income' | 'expense'; account: string; month: string; note?: string };

export default function Transactions() {
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [month, setMonth] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.type = filter;
      if (month !== 'all') params.month = month;
      const r = await api.get('/transactions', { params });
      setItems(r.data);
    } catch (e) { console.warn('tx load', e); }
    finally { setLoading(false); }
  }, [filter, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: string) => {
    const doDelete = async () => {
      try { await api.delete(`/transactions/${id}`); load(); } catch (e) { console.warn(e); }
    };
    if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm('¿Eliminar este movimiento?')) doDelete(); }
    else Alert.alert('Eliminar', '¿Eliminar este movimiento?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: doDelete }]);
  };

  const months = Array.from(new Set(items.map((t) => t.month))).sort().reverse();
  const filtered = items.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Movimientos</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          testID="search-tx"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por título o categoría"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {(['all', 'income', 'expense'] as const).map((f) => (
          <TouchableOpacity key={f} testID={`filter-${f}`} onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
            <Text style={[styles.chipText, filter === f && { color: '#fff' }]}>
              {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity testID="filter-month-all" onPress={() => setMonth('all')}
          style={[styles.chip, month === 'all' && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
          <Text style={[styles.chipText, month === 'all' && { color: '#fff' }]}>Todos los meses</Text>
        </TouchableOpacity>
        {months.map((m) => (
          <TouchableOpacity key={m} testID={`filter-month-${m}`} onPress={() => setMonth(m)}
            style={[styles.chip, month === m && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
            <Text style={[styles.chipText, month === m && { color: '#fff' }]}>{monthLabel(m)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="receipt-outline" size={36} color={colors.textSecondary} />
              <Text style={styles.empty}>No hay movimientos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`tx-item-${item.id}`}
              onLongPress={() => handleDelete(item.id)}
              activeOpacity={0.8}
              style={styles.row}>
              <CategoryIcon category={item.category} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.category} · {item.account} · {monthLabel(item.month)}</Text>
              </View>
              <Text style={[styles.rowAmount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
                {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity testID="fab-add-tx" style={styles.fab} onPress={() => setShowSheet(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddTransactionSheet visible={showSheet} onClose={() => setShowSheet(false)} onSaved={load} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  h1: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: 12, backgroundColor: colors.bgSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderSubtle },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: 'Manrope_500Medium', color: colors.textPrimary, fontSize: 14 },
  chipsRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderSubtle, marginRight: 8 },
  chipText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  rowTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: colors.textPrimary },
  rowMeta: { fontFamily: 'Manrope_500Medium', fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rowAmount: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
  empty: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});

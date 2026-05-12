import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, radii, spacing } from '../../src/theme';
import { formatMoney, currentMonth, monthLabel, CATEGORY_META } from '../../src/categories';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { AddTransactionSheet } from '../../src/components/AddTransactionSheet';

const SCREEN_W = Dimensions.get('window').width;

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/summary', { params: { month: currentMonth() } });
      setSummary(r.data);
    } catch (e) {
      console.warn('summary load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.loadingWrap} testID="dashboard-loading">
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;
  const balance = summary?.balance ?? 0;
  const series = summary?.series ?? [];
  const byCat = (summary?.by_category ?? []).slice(0, 6);
  const recent = summary?.recent ?? [];

  const barData: any[] = [];
  series.forEach((s: any) => {
    barData.push({ value: s.income, label: s.month.slice(5), frontColor: colors.income, spacing: 2 });
    barData.push({ value: s.expense, frontColor: colors.expense });
  });

  const pieData = byCat.map((c: any) => ({
    value: c.total,
    color: (CATEGORY_META as any)[c.category]?.color ?? '#888',
    text: '',
  }));
  const pieTotal = pieData.reduce((a: number, b: any) => a + b.value, 0) || 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>HOLA</Text>
            <Text style={styles.userName} testID="user-name">{user?.name?.split(' ')[0] ?? 'Usuario'}</Text>
          </View>
          <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.profileBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard} testID="balance-card">
          <Text style={styles.heroLabel}>Balance del mes · {monthLabel(currentMonth())}</Text>
          <Text style={styles.heroAmount} testID="balance-amount">{formatMoney(balance)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="arrow-up" size={14} color="#A7C957" />
              <Text style={styles.heroPillText}>{formatMoney(income)}</Text>
            </View>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="arrow-down" size={14} color="#F2B6B5" />
              <Text style={styles.heroPillText}>{formatMoney(expense)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.income, borderLeftWidth: 3 }]}>
            <Text style={styles.statLabel}>Ingresos</Text>
            <Text style={[styles.statValue, { color: colors.income }]} testID="stat-income">{formatMoney(income)}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.expense, borderLeftWidth: 3 }]}>
            <Text style={styles.statLabel}>Gastos</Text>
            <Text style={[styles.statValue, { color: colors.expense }]} testID="stat-expense">{formatMoney(expense)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimos 6 meses</Text>
          {barData.length > 0 ? (
            <BarChart
              data={barData}
              barWidth={10}
              spacing={14}
              roundedTop
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              height={140}
              noOfSections={3}
              isAnimated
            />
          ) : (
            <Text style={styles.empty}>Sin datos aún</Text>
          )}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.income }]} /><Text style={styles.legendText}>Ingresos</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.expense }]} /><Text style={styles.legendText}>Gastos</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gastos por categoría</Text>
          {pieData.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <PieChart
                data={pieData}
                donut
                radius={70}
                innerRadius={48}
                innerCircleColor={colors.bgSecondary}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: colors.textPrimary }}>{formatMoney(pieTotal)}</Text>
                    <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 10, color: colors.textSecondary }}>Total</Text>
                  </View>
                )}
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                {byCat.map((c: any) => {
                  const pct = ((c.total / pieTotal) * 100).toFixed(0);
                  const color = (CATEGORY_META as any)[c.category]?.color ?? '#888';
                  return (
                    <View key={c.category} style={styles.catRow}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={styles.catName} numberOfLines={1}>{c.category}</Text>
                      <Text style={styles.catPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>Sin gastos este mes</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recientes</Text>
          {recent.length === 0 ? (
            <Text style={styles.empty}>Aún no hay movimientos. Agrega el primero con el botón +</Text>
          ) : (
            recent.map((t: any) => (
              <View key={t.id} style={styles.txItem} testID={`recent-tx-${t.id}`}>
                <CategoryIcon category={t.category} size={18} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.txTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={styles.txMeta}>{t.category} · {monthLabel(t.month)}</Text>
                </View>
                <Text style={[styles.txAmount, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity testID="fab-add-tx" style={styles.fab} onPress={() => setShowSheet(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddTransactionSheet visible={showSheet} onClose={() => setShowSheet(false)} onSaved={load} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  eyebrow: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.4 },
  userName: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: colors.textPrimary, marginTop: 2 },
  profileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle },
  heroCard: { backgroundColor: colors.brand, borderRadius: 24, padding: spacing.lg, marginBottom: spacing.md },
  heroLabel: { color: '#E5E2D9', fontFamily: 'Manrope_600SemiBold', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroAmount: { color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 36, marginTop: 8, letterSpacing: -1 },
  heroRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  heroPillText: { color: '#fff', fontFamily: 'Manrope_700Bold', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle },
  statLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2 },
  statValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, marginTop: 4 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: colors.textPrimary, marginBottom: 8 },
  empty: { fontFamily: 'Manrope_500Medium', color: colors.textSecondary, paddingVertical: 12, fontSize: 13 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: colors.textSecondary },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  catName: { flex: 1, fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: colors.textPrimary },
  catPct: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: colors.textSecondary },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  txTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: colors.textPrimary },
  txMeta: { fontFamily: 'Manrope_500Medium', fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txAmount: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});

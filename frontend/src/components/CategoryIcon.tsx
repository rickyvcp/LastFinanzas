import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { CATEGORY_META, CategoryKey } from '../categories';

export function CategoryIcon({ category, size = 22, bg = true }: { category: string; size?: number; bg?: boolean }) {
  const meta = (CATEGORY_META as any)[category] ?? CATEGORY_META['Otros'];
  const iconName = meta.icon as any;
  const color = meta.color as string;

  if (!bg) return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
  return (
    <View style={[styles.bubble, { backgroundColor: `${color}22`, width: size + 22, height: size + 22, borderRadius: (size + 22) / 2 }]}>
      <MaterialCommunityIcons name={iconName} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { alignItems: 'center', justifyContent: 'center' },
});

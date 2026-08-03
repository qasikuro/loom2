/**
 * /shop  — Dedicated shop screen.
 *
 * Opens the ShopModal immediately so navigating to this route gives the same
 * experience as opening the shop, but through a proper router URL so the FAB
 * can push here instead of toggling local modal state.
 */
import { ShopModal } from '@/components/ShopModal';
import { safeBack } from '@/utils/navigation';
import React, { useState } from 'react';
import { View } from 'react-native';

export default function ShopScreen() {
  const [visible, setVisible] = useState(true);

  function handleClose() {
    setVisible(false);
    safeBack();
  }

  return (
    // The underlying view is transparent; ShopModal's own backdrop covers it.
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ShopModal visible={visible} onClose={handleClose} />
    </View>
  );
}

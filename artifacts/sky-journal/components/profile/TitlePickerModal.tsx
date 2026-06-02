import { Icon } from '@/components/Icon';
import type { ConstellationState } from '@/components/ConstellationMap';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  constellation: ConstellationState | null;
  availableTitles: string[];
  saving: boolean;
  onSelect: (title: string) => void;
  onClose: () => void;
}

export function TitlePickerModal({ visible, constellation, availableTitles, saving, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: '#0E0B1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10, paddingBottom: 36 }}>
          <Text style={{ color: '#C8B8E8', fontFamily: 'Satoshi-Bold', fontSize: 16, marginBottom: 4 }}>Choose Title</Text>
          {availableTitles.map(title => {
            const active = constellation?.activeTitle === title;
            return (
              <TouchableOpacity key={title} onPress={() => onSelect(title)} disabled={saving}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 12, backgroundColor: active ? 'rgba(200,168,75,0.12)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: active ? 'rgba(200,168,75,0.30)' : 'rgba(255,255,255,0.07)' }}
              >
                <Text style={{ fontFamily: 'Satoshi-Medium', fontSize: 14, color: active ? '#C8A84B' : 'rgba(200,184,232,0.75)' }}>✦ {title}</Text>
                {active && <Icon name="check" size={14} color="#C8A84B" />}
              </TouchableOpacity>
            );
          })}
          {saving && <ActivityIndicator color="#C8A84B" style={{ marginTop: 4 }} />}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

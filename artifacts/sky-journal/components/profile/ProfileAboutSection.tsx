import { Icon } from '@/components/Icon';
import type { Character } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useUser } from '@clerk/expo';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SHADOW } from '@/constants/colors';
import {
  DAY_LABELS_G, GUIDE_TOPIC_COLORS, GUIDE_TOPICS, ROLES,
  SOCIAL_PLATFORMS, extractHandle, getPlatform, type SocialPlatform,
} from './profileConstants';

interface Props {
  character: Character;
  setCharacter: (c: Character) => void;
}

export function ProfileAboutSection({ character, setCharacter }: Props) {
  const colors = useColors();
  const { user } = useUser();

  const [editingBirthday,  setEditingBirthday]  = useState(false);
  const [birthdayVal,      setBirthdayVal]      = useState(character.birthday ?? '');
  const [editingCountry,   setEditingCountry]   = useState(false);
  const [countryVal,       setCountryVal]       = useState(character.country ?? '');
  const [linkMode,         setLinkMode]         = useState<'none' | 'picking' | 'entering'>('none');
  const [linkPlatform,     setLinkPlatform]     = useState<SocialPlatform | null>(null);
  const [linkHandle,       setLinkHandle]       = useState('');
  const [linkOtherLabel,   setLinkOtherLabel]   = useState('');
  const [linkEditIdx,      setLinkEditIdx]      = useState<number | null>(null);
  const [editingGuideBio,  setEditingGuideBio]  = useState(false);
  const [guideBioVal,      setGuideBioVal]      = useState(character.guideBio ?? '');
  const [guideAvailDays,   setGuideAvailDays]   = useState<number[]>(character.guideAvailability?.days ?? []);
  const [guideTimeFrom,    setGuideTimeFrom]    = useState(character.guideAvailability?.timeFrom ?? '20:00');
  const [guideTimeTo,      setGuideTimeTo]      = useState(character.guideAvailability?.timeTo ?? '23:00');
  const [editingGuideTime, setEditingGuideTime] = useState(false);

  function saveBirthday() { setCharacter({ ...character, birthday: birthdayVal.trim() || undefined }); setEditingBirthday(false); }
  function saveCountry()  { setCharacter({ ...character, country: countryVal.trim() || undefined }); setEditingCountry(false); }
  function saveGuideBio() { setCharacter({ ...character, guideBio: guideBioVal.trim() }); setEditingGuideBio(false); }
  function toggleGuideDay(day: number) {
    const next = guideAvailDays.includes(day)
      ? guideAvailDays.filter(d => d !== day)
      : [...guideAvailDays, day].sort((a, b) => a - b);
    setGuideAvailDays(next);
    setCharacter({ ...character, guideAvailability: next.length > 0 ? { days: next, timeFrom: guideTimeFrom, timeTo: guideTimeTo, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null });
    Haptics.selectionAsync();
  }
  function saveGuideTime() {
    setEditingGuideTime(false);
    if (guideAvailDays.length > 0) {
      setCharacter({ ...character, guideAvailability: { days: guideAvailDays, timeFrom: guideTimeFrom, timeTo: guideTimeTo, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    }
  }
  function openAddLink() { setLinkEditIdx(null); setLinkHandle(''); setLinkOtherLabel(''); setLinkPlatform(null); setLinkMode('picking'); }
  function openEditLink(idx: number) {
    const link = (character.links ?? [])[idx];
    if (!link) return;
    const plat = getPlatform(link.platform) ?? SOCIAL_PLATFORMS.find(p => link.url.startsWith(p.prefix) && p.key !== 'other') ?? getPlatform('other')!;
    const handle = extractHandle(link.url, plat.prefix);
    setLinkEditIdx(idx); setLinkPlatform(plat); setLinkHandle(handle); setLinkOtherLabel(plat.key === 'other' ? link.label : ''); setLinkMode('entering');
  }
  function selectPlatform(p: SocialPlatform) { setLinkPlatform(p); setLinkHandle(''); setLinkOtherLabel(''); setLinkMode('entering'); }
  function cancelLink() { setLinkMode('none'); setLinkPlatform(null); setLinkHandle(''); setLinkEditIdx(null); }
  function saveLink() {
    if (!linkPlatform) return;
    const handle = linkHandle.trim().replace(/^@/, '');
    if (!handle) { cancelLink(); return; }
    const url   = linkPlatform.key === 'other' ? handle : `${linkPlatform.prefix}${handle}`;
    const label = linkPlatform.key === 'other' ? (linkOtherLabel.trim() || 'Link') : linkPlatform.label;
    const links = [...(character.links ?? [])];
    const newLink = { label, url, platform: linkPlatform.key };
    if (linkEditIdx !== null) links[linkEditIdx] = newLink; else links.push(newLink);
    setCharacter({ ...character, links });
    cancelLink();
  }
  function removeLink(idx: number) { setCharacter({ ...character, links: (character.links ?? []).filter((_, i) => i !== idx) }); cancelLink(); }

  return (
    <>
      {/* ── About Me card ─── */}
      <View style={[s.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
        <View style={s.aboutCardHeader}>
          <View style={[s.aboutCardIcon, { backgroundColor: `${colors.primary}14` }]}>
            <Icon name="user" size={14} color={colors.primary} />
          </View>
          <Text style={[s.aboutCardTitle, { color: colors.foreground }]}>About Me</Text>
        </View>

        {/* Birthday */}
        <TouchableOpacity style={[s.aboutRow, { borderTopColor: colors.border }]} onPress={() => { setBirthdayVal(character.birthday ?? ''); setEditingBirthday(true); }} activeOpacity={0.75}>
          <View style={s.aboutRowLeft}>
            <Text style={[s.aboutRowLabel, { color: colors.mutedForeground }]}>BIRTHDAY</Text>
            {editingBirthday ? (
              <TextInput style={[s.aboutRowInput, { color: colors.foreground, borderColor: colors.primary }]} value={birthdayVal} onChangeText={setBirthdayVal} autoFocus returnKeyType="done" onSubmitEditing={saveBirthday} onBlur={saveBirthday} placeholder="e.g. 17 April" placeholderTextColor={`${colors.mutedForeground}70`} />
            ) : (
              <Text style={[s.aboutRowVal, { color: character.birthday ? colors.foreground : colors.mutedForeground }]}>{character.birthday || 'Add birthday'}</Text>
            )}
          </View>
          {!editingBirthday && <Icon name="edit-2" size={12} color={`${colors.primary}55`} />}
        </TouchableOpacity>

        {/* Country */}
        <TouchableOpacity style={[s.aboutRow, { borderTopColor: colors.border }]} onPress={() => { setCountryVal(character.country ?? ''); setEditingCountry(true); }} activeOpacity={0.75}>
          <View style={s.aboutRowLeft}>
            <Text style={[s.aboutRowLabel, { color: colors.mutedForeground }]}>COUNTRY</Text>
            {editingCountry ? (
              <TextInput style={[s.aboutRowInput, { color: colors.foreground, borderColor: colors.primary }]} value={countryVal} onChangeText={setCountryVal} autoFocus returnKeyType="done" onSubmitEditing={saveCountry} onBlur={saveCountry} placeholder="Where are you from?" placeholderTextColor={`${colors.mutedForeground}70`} />
            ) : (
              <Text style={[s.aboutRowVal, { color: character.country ? colors.foreground : colors.mutedForeground }]}>{character.country || 'Add location'}</Text>
            )}
          </View>
          {!editingCountry && <Icon name="edit-2" size={12} color={`${colors.primary}55`} />}
        </TouchableOpacity>

        {/* Role */}
        <View style={[s.aboutRow, { borderTopColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', gap: 10, paddingVertical: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Text style={[s.aboutRowLabel, { color: colors.mutedForeground }]}>ROLE</Text>
            {character.role && <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: `${colors.mutedForeground}80` }}>shown on your profile</Text>}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ROLES.map(r => {
              const sel = character.role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => { Haptics.selectionAsync(); setCharacter({ ...character, role: sel ? undefined : r.key }); }}
                  style={[s.roleChip, sel ? { backgroundColor: r.color + '22', borderColor: r.color + '70' } : { borderColor: colors.border }]}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                  <View style={{ gap: 1 }}>
                    <Text style={[s.roleChipLabel, { color: sel ? r.color : colors.foreground }]}>{r.key}</Text>
                    {sel && <Text style={[s.roleChipHint, { color: r.color + 'AA' }]}>{r.hint}</Text>}
                  </View>
                  {sel && <View style={[s.roleSelDot, { backgroundColor: r.color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {!character.role && <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: `${colors.mutedForeground}60` }}>Optional — tap a role to display it on your profile</Text>}
        </View>

        {/* Socials header */}
        <View style={[s.aboutRow, { borderTopColor: colors.border }]}>
          <Text style={[s.aboutRowLabel, { color: colors.mutedForeground, flex: 1 }]}>SOCIALS</Text>
          <TouchableOpacity style={[s.aboutAddBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]} onPress={openAddLink} activeOpacity={0.75}>
            <Icon name="plus" size={11} color={colors.primary} />
            <Text style={[s.aboutAddBtnText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Social links */}
        {(character.links ?? []).map((link, idx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const plat = getPlatform((link as any).platform);
          return (
            <View key={idx} style={[s.aboutLinkRow, { borderTopColor: colors.border }]}>
              <View style={[s.aboutLinkIcon, { backgroundColor: `${plat?.color ?? colors.primary}22` }]}>
                <Text style={{ fontSize: 16 }}>{plat?.icon ?? '🔗'}</Text>
              </View>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditLink(idx)} activeOpacity={0.75}>
                <Text style={[s.aboutLinkName, { color: colors.foreground }]}>{link.label}</Text>
                <Text style={[s.aboutLinkHandle, { color: colors.mutedForeground }]}>@{extractHandle(link.url, plat?.prefix ?? '')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeLink(idx)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Icon name="x" size={13} color={`${colors.mutedForeground}70`} />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Link picker */}
        {linkMode === 'picking' && (
          <View style={[s.aboutRow, { borderTopColor: colors.border, flexWrap: 'wrap', gap: 8 }]}>
            {SOCIAL_PLATFORMS.map(p => (
              <TouchableOpacity key={p.key} style={[s.platformChip, { borderColor: colors.border, backgroundColor: `${colors.primary}08` }]} onPress={() => selectPlatform(p)}>
                <View style={[s.platformChipIcon, { backgroundColor: p.color + '22' }]}>
                  <Text style={s.socialIcon}>{p.icon}</Text>
                </View>
                <Text style={[s.platformChipLabel, { color: colors.foreground }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {linkMode === 'entering' && linkPlatform && (
          <View style={[s.aboutRow, { borderTopColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.socialBadge, { backgroundColor: linkPlatform.color + '22' }]}>
                <Text style={s.socialIcon}>{linkPlatform.icon}</Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: colors.foreground }}>{linkPlatform.label}</Text>
              <TouchableOpacity onPress={cancelLink} style={{ marginLeft: 'auto' }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Icon name="x" size={14} color={`${colors.mutedForeground}80`} />
              </TouchableOpacity>
            </View>
            {linkPlatform.key === 'other' && (
              <TextInput style={[s.handleInput, { marginBottom: 4, color: colors.foreground, borderColor: `${colors.primary}50`, backgroundColor: `${colors.primary}08` }]} value={linkOtherLabel} onChangeText={setLinkOtherLabel} placeholder="Label (e.g. My Blog)" placeholderTextColor={`${colors.mutedForeground}70`} returnKeyType="next" />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {linkPlatform.key !== 'other' && <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: colors.mutedForeground }}>@</Text>}
              <TextInput style={[s.handleInput, { flex: 1, color: colors.foreground, borderColor: `${colors.primary}50`, backgroundColor: `${colors.primary}08` }]} value={linkHandle} onChangeText={setLinkHandle} placeholder={linkPlatform.placeholder} placeholderTextColor={`${colors.mutedForeground}70`} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={saveLink} autoFocus />
              <TouchableOpacity style={[s.saveLinkBtn, { backgroundColor: linkPlatform.color + 'CC' }]} onPress={saveLink}>
                <Icon name="check" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Constellation Guide Mode ─── */}
      <View style={[s.guideCard, { borderColor: 'rgba(120,70,255,0.22)' }, SHADOW.sm]}>
        <LinearGradient colors={['#0B0822', '#160D3A', '#0B0822']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.guideHero}>
          <View style={s.guideNebula1} />
          <View style={s.guideNebula2} />
          {([{ t: 12, l: 90, s: 1.5, o: 0.7 }, { t: 28, l: 160, s: 1.0, o: 0.45 }, { t: 8, r: 90, s: 1.5, o: 0.6 }, { t: 32, r: 148, s: 1.0, o: 0.4 }, { t: 20, l: 50, s: 1.0, o: 0.3 }] as Array<{ t: number; s: number; o: number; l?: number; r?: number }>).map((st, i) => (
            <View key={i} style={[s.guideStar, { top: st.t, left: st.l, right: st.r, width: st.s, height: st.s, opacity: st.o }]} />
          ))}
          <View style={s.guideHeroRow}>
            <View style={s.guideHeroTitleRow}>
              <View style={s.guideHeroIconWrap}><Icon name="star" size={13} color="#C8A84B" /></View>
              <View>
                <Text style={s.guideHeroTitle}>Constellation Guide</Text>
                <Text style={[s.guideHeroSub, { color: character.isGuide ? '#90D8A0' : 'rgba(200,184,232,0.42)' }]}>
                  {character.isGuide ? '● Visible in Discover' : 'Help wanderers find their way'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.guideTogglePill, character.isGuide ? s.guideToggleOn : s.guideToggleOff]}
              onPress={() => { Haptics.selectionAsync(); setCharacter({ ...character, isGuide: !character.isGuide }); }}
              activeOpacity={0.82}
            >
              <View style={[s.guideToggleKnob, { backgroundColor: character.isGuide ? '#A080F8' : 'rgba(200,184,232,0.35)' }]} />
              <Text style={[s.guideToggleLabel, { color: character.isGuide ? '#C0B0FF' : 'rgba(200,184,232,0.55)' }]}>
                {character.isGuide ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={[s.guideBody, { backgroundColor: colors.card }]}>
          {character.isGuide ? (
            <>
              {(() => {
                const items = [!!character.guideBio, (character.guideTopics ?? []).length > 0, !!character.guideAvailability, character.isPublic];
                const pct   = items.filter(Boolean).length * 25;
                const missing = ['Introduction', 'Topics', 'Availability', 'Public profile'].filter((_, i) => !items[i]);
                return (
                  <View style={s.guideCompletion}>
                    <View style={s.guideCompletionRow}>
                      <Text style={[s.guideCompletionLabel, { color: colors.mutedForeground }]}>Profile strength</Text>
                      <Text style={[s.guideCompletionPct, { color: pct === 100 ? '#60D890' : colors.primary }]}>{pct}%</Text>
                    </View>
                    <View style={[s.guideProgressBg, { backgroundColor: `${colors.border}90` }]}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <View style={[s.guideProgressFill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? '#60D890' : colors.primary }]} />
                    </View>
                    {pct < 100 && <Text style={[s.guideCompletionHint, { color: colors.mutedForeground }]}>Add: {missing.join(' · ')}</Text>}
                  </View>
                );
              })()}
              <View style={[s.guideDivider, { backgroundColor: colors.border }]} />

              {/* Guide bio */}
              <View style={s.guideSection}>
                <Text style={[s.guideSectionLabel, { color: colors.mutedForeground }]}>✦ Guide introduction</Text>
                {editingGuideBio ? (
                  <View style={{ gap: 10 }}>
                    <TextInput style={[s.guideTextArea, { color: colors.foreground, backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}28` }]} value={guideBioVal} onChangeText={setGuideBioVal} multiline placeholder="Tell wanderers how you can guide them…" placeholderTextColor={colors.mutedForeground} autoFocus maxLength={400} />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                      <TouchableOpacity onPress={() => { setGuideBioVal(character.guideBio ?? ''); setEditingGuideBio(false); }} style={[s.guideActionBtn, { borderColor: colors.border, backgroundColor: 'transparent' }]}>
                        <Text style={[s.guideActionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveGuideBio} style={[s.guideActionBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                        <Text style={[s.guideActionBtnText, { color: '#fff' }]}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => { setGuideBioVal(character.guideBio ?? ''); setEditingGuideBio(true); }} style={[s.guideBioTouchable, { borderColor: character.guideBio ? `${colors.primary}20` : colors.border, backgroundColor: character.guideBio ? `${colors.primary}06` : `${colors.border}40` }]} activeOpacity={0.75}>
                    {character.guideBio ? (
                      <Text style={[s.guideBioText, { color: colors.foreground }]}>{character.guideBio}</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Icon name="edit-3" size={13} color={colors.mutedForeground} />
                        <Text style={[s.guideBioPlaceholder, { color: colors.mutedForeground }]}>Tap to add your guide introduction…</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <View style={[s.guideDivider, { backgroundColor: colors.border }]} />

              {/* Topics */}
              <View style={s.guideSection}>
                <Text style={[s.guideSectionLabel, { color: colors.mutedForeground }]}>◎ Topics I support</Text>
                <View style={s.guideTopicsWrap}>
                  {GUIDE_TOPICS.map(topic => {
                    const selected = (character.guideTopics ?? []).includes(topic);
                    const tc = GUIDE_TOPIC_COLORS[topic] ?? colors.primary;
                    return (
                      <TouchableOpacity
                        key={topic}
                        onPress={() => {
                          Haptics.selectionAsync();
                          const topics = character.guideTopics ?? [];
                          setCharacter({ ...character, guideTopics: selected ? topics.filter(t => t !== topic) : [...topics, topic] });
                        }}
                        style={[s.guideTopicChip, { borderColor: selected ? tc : `${tc}38`, backgroundColor: selected ? `${tc}18` : 'transparent' }]}
                        activeOpacity={0.75}
                      >
                        <View style={[s.guideTopicDot, { backgroundColor: tc, opacity: selected ? 1 : 0.4 }]} />
                        <Text style={[s.guideTopicText, { color: selected ? tc : colors.mutedForeground }]}>{topic}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={[s.guideDivider, { backgroundColor: colors.border }]} />

              {/* Availability */}
              <View style={s.guideSection}>
                <Text style={[s.guideSectionLabel, { color: colors.mutedForeground }]}>◷ Availability</Text>
                <View style={s.guideDayRow}>
                  {DAY_LABELS_G.map((label, idx) => {
                    const active = guideAvailDays.includes(idx);
                    return (
                      <TouchableOpacity key={label} onPress={() => toggleGuideDay(idx)} style={[s.guideDayPill, { borderColor: active ? colors.primary : `${colors.border}80`, backgroundColor: active ? `${colors.primary}20` : 'transparent' }]} activeOpacity={0.75}>
                        <Text style={[s.guideDayText, { color: active ? colors.primary : colors.mutedForeground }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {editingGuideTime ? (
                  <View style={[s.guideTimeEditor, { borderColor: `${colors.primary}30`, backgroundColor: `${colors.primary}08` }]}>
                    <Icon name="clock" size={13} color={colors.primary} />
                    <TextInput style={[s.guideTimeInput, { color: colors.foreground, borderColor: `${colors.primary}30` }]} value={guideTimeFrom} onChangeText={setGuideTimeFrom} placeholder="20:00" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" maxLength={5} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium' }}>–</Text>
                    <TextInput style={[s.guideTimeInput, { color: colors.foreground, borderColor: `${colors.primary}30` }]} value={guideTimeTo} onChangeText={setGuideTimeTo} placeholder="23:00" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" maxLength={5} />
                    <TouchableOpacity onPress={saveGuideTime} style={[s.guideTimeSaveBtn, { backgroundColor: colors.primary }]}>
                      <Icon name="check" size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[s.guideTimeBadge, { borderColor: `${colors.border}80`, backgroundColor: `${colors.primary}08` }]} onPress={() => setEditingGuideTime(true)} activeOpacity={0.75}>
                    <Icon name="clock" size={12} color={colors.primary} />
                    <Text style={[s.guideTimeBadgeText, { color: colors.foreground }]}>
                      {character.guideAvailability ? `${character.guideAvailability.timeFrom} – ${character.guideAvailability.timeTo}` : 'Set your hours'}
                    </Text>
                    <Icon name="edit-2" size={11} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[s.guidePreviewBtn, { borderColor: `${colors.primary}30`, backgroundColor: `${colors.primary}0C` }]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onPress={() => router.push({ pathname: '/guide/[userId]', params: { userId: user?.id ?? '' } } as any)}
                activeOpacity={0.8}
              >
                <Icon name="eye" size={14} color={colors.primary} />
                <Text style={[s.guidePreviewBtnText, { color: colors.primary }]}>Preview your guide profile</Text>
                <Icon name="arrow-right" size={14} color={`${colors.primary}60`} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={s.guideInviteBody}>
              <View style={[s.guideInviteIconWrap, { backgroundColor: 'rgba(120,70,255,0.10)' }]}>
                <LinearGradient colors={['rgba(120,70,255,0.18)', 'rgba(60,140,240,0.12)']} style={StyleSheet.absoluteFill} />
                <Icon name="star" size={22} color="#C8A84B" />
              </View>
              <Text style={[s.guideInviteTitle, { color: colors.foreground }]}>Become a Constellation Guide</Text>
              <Text style={[s.guideInviteSub, { color: colors.mutedForeground }]}>Share your light with wanderers who feel lost on their sky journey.</Text>
              <View style={s.guideInviteBenefits}>
                {[
                  { icon: 'compass',        label: 'Be discovered in the Guides tab' },
                  { icon: 'message-circle', label: 'Chat directly with sky wanderers' },
                  { icon: 'zap',            label: 'Build your constellation of dreamers' },
                ].map(b => (
                  <View key={b.label} style={s.guideInviteBenefit}>
                    <View style={[s.guideInviteBenefitIcon, { backgroundColor: `${colors.primary}14` }]}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Icon name={b.icon as any} size={12} color={colors.primary} />
                    </View>
                    <Text style={[s.guideInviteBenefitText, { color: colors.mutedForeground }]}>{b.label}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={[s.guideEnableBtn, { backgroundColor: colors.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCharacter({ ...character, isGuide: true }); }} activeOpacity={0.85}>
                <Icon name="star" size={14} color="#fff" />
                <Text style={s.guideEnableBtnText}>Enable Guide Mode</Text>
                <Icon name="arrow-right" size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  aboutCard:        { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  aboutCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  aboutCardIcon:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aboutCardTitle:   { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1 },
  aboutRow:         { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  aboutRowLeft:     { flex: 1, gap: 3 },
  aboutRowLabel:    { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4, textTransform: 'uppercase' },
  aboutRowVal:      { fontSize: 14, fontFamily: 'Satoshi-Medium', lineHeight: 20 },
  aboutRowInput:    { fontSize: 14, fontFamily: 'Satoshi-Medium', borderBottomWidth: 1, paddingVertical: 2 },
  aboutAddBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  aboutAddBtnText:  { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  aboutLinkRow:     { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  aboutLinkIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aboutLinkName:    { fontSize: 13, fontFamily: 'Satoshi-Bold', lineHeight: 18 },
  aboutLinkHandle:  { fontSize: 11, fontFamily: 'Satoshi-Regular', lineHeight: 16 },
  roleChip:         { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  roleChipLabel:    { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1 },
  roleChipHint:     { fontSize: 10, fontFamily: 'Satoshi-Regular' },
  roleSelDot:       { width: 5, height: 5, borderRadius: 2.5, marginLeft: 2 },
  platformChip:     { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, backgroundColor: 'rgba(155,120,255,0.06)', paddingHorizontal: 10, paddingVertical: 7, minWidth: '43%', flexGrow: 1 },
  platformChipIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  platformChipLabel:{ fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#EDE8FF' },
  socialIcon:       { fontSize: 17, lineHeight: 20 },
  socialBadge:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  handleInput:      { fontSize: 13, fontFamily: 'Satoshi-Regular', backgroundColor: 'rgba(155,120,255,0.10)', borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  saveLinkBtn:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  guideCard:        { borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1 },
  guideHero:        { paddingHorizontal: 16, paddingVertical: 16, overflow: 'hidden' },
  guideNebula1:     { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(120,70,255,0.18)', top: -60, right: -30, pointerEvents: 'none' as const },
  guideNebula2:     { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(60,140,240,0.10)', bottom: -30, left: 10, pointerEvents: 'none' as const },
  guideStar:        { position: 'absolute', borderRadius: 100, backgroundColor: '#fff' },
  guideHeroRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guideHeroTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  guideHeroIconWrap:{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,168,75,0.20)' },
  guideHeroTitle:   { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.2 },
  guideHeroSub:     { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  guideTogglePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  guideToggleOn:    { backgroundColor: 'rgba(120,70,255,0.22)', borderColor: 'rgba(120,70,255,0.55)' },
  guideToggleOff:   { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(200,184,232,0.20)' },
  guideToggleKnob:  { width: 8, height: 8, borderRadius: 4 },
  guideToggleLabel: { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.5 },
  guideBody:        {},
  guideCompletion:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 6 },
  guideCompletionRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  guideCompletionLabel:{ fontSize: 11, fontFamily: 'Satoshi-Medium' },
  guideCompletionPct:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  guideProgressBg:  { height: 4, borderRadius: 2, overflow: 'hidden' },
  guideProgressFill:{ height: 4, borderRadius: 2 },
  guideCompletionHint:{ fontSize: 10, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  guideDivider:     { height: 1 },
  guideSection:     { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  guideSectionLabel:{ fontSize: 12, fontFamily: 'Satoshi-Medium' },
  guideBioTouchable:{ borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 60, justifyContent: 'center' },
  guideBioText:     { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 21, fontStyle: 'italic' },
  guideBioPlaceholder:{ fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  guideTextArea:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 21, minHeight: 90, textAlignVertical: 'top' },
  guideActionBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  guideActionBtnText:{ fontSize: 12, fontFamily: 'Satoshi-Bold' },
  guideTopicsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  guideTopicChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  guideTopicDot:    { width: 5, height: 5, borderRadius: 2.5 },
  guideTopicText:   { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  guideDayRow:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  guideDayPill:     { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, minWidth: 40, alignItems: 'center' },
  guideDayText:     { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  guideTimeEditor:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, marginTop: 8 },
  guideTimeInput:   { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Medium', borderBottomWidth: 1, paddingVertical: 2, textAlign: 'center' },
  guideTimeSaveBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  guideTimeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start', marginTop: 8 },
  guideTimeBadgeText:{ fontSize: 13, fontFamily: 'Satoshi-Medium' },
  guidePreviewBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 14, borderRadius: 14, borderWidth: 1.5, paddingVertical: 12 },
  guidePreviewBtnText:{ fontSize: 13, fontFamily: 'Satoshi-Bold' },
  guideInviteBody:  { paddingHorizontal: 16, paddingVertical: 22, alignItems: 'center', gap: 10 },
  guideInviteIconWrap:{ width: 56, height: 56, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  guideInviteTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold', textAlign: 'center', letterSpacing: -0.2 },
  guideInviteSub:   { fontSize: 13, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 20, fontStyle: 'italic', maxWidth: 280 },
  guideInviteBenefits:    { gap: 10, alignSelf: 'stretch', marginVertical: 6 },
  guideInviteBenefit:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideInviteBenefitIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  guideInviteBenefitText: { fontSize: 13, fontFamily: 'Satoshi-Regular' },
  guideEnableBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, alignSelf: 'stretch', justifyContent: 'center', marginTop: 4 },
  guideEnableBtnText:{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
});

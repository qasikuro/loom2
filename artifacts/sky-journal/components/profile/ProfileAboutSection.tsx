import { Icon } from '@/components/Icon';
import type { Character } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useUser } from '@clerk/expo';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SHADOW } from '@/constants/colors';
import { useTranslation } from 'react-i18next';
import {
  DAY_LABELS_G, GUIDE_TOPIC_COLORS, GUIDE_TOPICS, ROLES,
  SOCIAL_PLATFORMS, extractHandle, getPlatform, type SocialPlatform,
} from './profileConstants';

interface Props {
  character: Character;
  setCharacter: (c: Character) => void;
}

export function ProfileAboutSection({ character, setCharacter }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user } = useUser();
  const guideGradientColors: React.ComponentProps<typeof LinearGradient>['colors'] = isDark
    ? ['#1A152E', '#1B1431', '#22143F']
    : [colors.card, colors.card, `${colors.secondary}12`];
  const socialCount = character.links?.length ?? 0;
  const selectedRole = ROLES.find(role => role.key === character.role);

  const [editingBirthday,  setEditingBirthday]  = useState(false);
  const [aboutExpanded,    setAboutExpanded]    = useState(false);
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
  const [guideExpanded, setGuideExpanded] = useState(false);

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
    const label = linkPlatform.key === 'other' ? (linkOtherLabel.trim() || t('components.about.link')) : linkPlatform.label;
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
        <TouchableOpacity
          style={s.aboutCardHeader}
          onPress={() => setAboutExpanded(open => !open)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('components.about.toggleDetails', { action: aboutExpanded ? t('common.close') : t('common.edit') })}
          accessibilityState={{ expanded: aboutExpanded }}
        >
          <View style={[s.aboutCardIcon, { backgroundColor: `${colors.primary}14` }]}>
            <Icon name="user" size={14} color={colors.primary} />
          </View>
          <Text style={[s.aboutCardTitle, { color: colors.foreground, flex: 1 }]}>{t('profile.defineCharacter')}</Text>
          <View style={[s.aboutEditButton, { borderColor: `${colors.primary}38`, backgroundColor: `${colors.primary}12` }]}>
            <Text style={[s.aboutEditButtonText, { color: colors.primary }]}>{aboutExpanded ? t('common.close') : t('common.edit')}</Text>
            <Icon name={aboutExpanded ? 'chevron-down' : 'chevron-right'} size={13} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {aboutExpanded ? (<>
        {/* Birthday */}
        <TouchableOpacity style={[s.aboutRow, { borderTopColor: colors.border }]} onPress={() => { setBirthdayVal(character.birthday ?? ''); setEditingBirthday(true); }} activeOpacity={0.75}>
          <View style={s.aboutRowLeft}>
            <Text style={[s.aboutRowLabel, { color: colors.mutedForeground }]}>{t('components.about.birthday')}</Text>
            {editingBirthday ? (
              <TextInput style={[s.aboutRowInput, { color: colors.foreground, borderColor: colors.primary }]} value={birthdayVal} onChangeText={setBirthdayVal} autoFocus returnKeyType="done" onSubmitEditing={saveBirthday} onBlur={saveBirthday} placeholder={t('components.about.birthdayExample')} placeholderTextColor={`${colors.mutedForeground}70`} />
            ) : (
              <Text style={[s.aboutRowVal, { color: character.birthday ? colors.foreground : colors.mutedForeground }]}>{character.birthday || t('components.about.addBirthday')}</Text>
            )}
          </View>
          {!editingBirthday && <Icon name="edit-2" size={12} color={`${colors.primary}55`} />}
        </TouchableOpacity>

        {/* Country */}
        <TouchableOpacity style={[s.aboutRow, { borderTopColor: colors.border }]} onPress={() => { setCountryVal(character.country ?? ''); setEditingCountry(true); }} activeOpacity={0.75}>
          <View style={s.aboutRowLeft}>
            <Text style={[s.aboutRowLabel, { color: colors.mutedForeground }]}>{t('components.about.country')}</Text>
            {editingCountry ? (
              <TextInput style={[s.aboutRowInput, { color: colors.foreground, borderColor: colors.primary }]} value={countryVal} onChangeText={setCountryVal} autoFocus returnKeyType="done" onSubmitEditing={saveCountry} onBlur={saveCountry} placeholder={t('components.about.countryExample')} placeholderTextColor={`${colors.mutedForeground}70`} />
            ) : (
              <Text style={[s.aboutRowVal, { color: character.country ? colors.foreground : colors.mutedForeground }]}>{character.country || t('components.about.addLocation')}</Text>
            )}
          </View>
          {!editingCountry && <Icon name="edit-2" size={12} color={`${colors.primary}55`} />}
        </TouchableOpacity>

        {/* Role */}
        <View style={[s.aboutRow, { borderTopColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', gap: 10, paddingVertical: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Text style={[s.aboutRowLabel, { color: colors.mutedForeground }]}>{t('components.about.role')}</Text>
            {character.role && <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: `${colors.mutedForeground}80` }}>{t('components.about.roleShown')}</Text>}
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
          {!character.role && <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: `${colors.mutedForeground}60` }}>{t('components.about.roleOptional')}</Text>}
        </View>

        {/* Socials header */}
        <View style={[s.aboutRow, { borderTopColor: colors.border }]}>
          <Text style={[s.aboutRowLabel, { color: colors.mutedForeground, flex: 1 }]}>{t('components.about.socials')}</Text>
          <TouchableOpacity style={[s.aboutAddBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]} onPress={openAddLink} activeOpacity={0.75}>
            <Icon name="plus" size={11} color={colors.primary} />
            <Text style={[s.aboutAddBtnText, { color: colors.primary }]}>{t('profile.add')}</Text>
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
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: colors.foreground }}>{linkPlatform.key === 'other' ? t('components.about.otherPlatform') : linkPlatform.label}</Text>
              <TouchableOpacity onPress={cancelLink} style={{ marginLeft: 'auto' }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Icon name="x" size={14} color={`${colors.mutedForeground}80`} />
              </TouchableOpacity>
            </View>
            {linkPlatform.key === 'other' && (
              <TextInput style={[s.handleInput, { marginBottom: 4, color: colors.foreground, borderColor: `${colors.primary}50`, backgroundColor: `${colors.primary}08` }]} value={linkOtherLabel} onChangeText={setLinkOtherLabel} placeholder={t('components.about.otherLinkPlaceholder')} placeholderTextColor={`${colors.mutedForeground}70`} returnKeyType="next" />
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
        </>) : (
          <TouchableOpacity
            style={[s.aboutSummary, { borderTopColor: colors.border }]}
            onPress={() => setAboutExpanded(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('components.about.openDetails')}
          >
            <Text style={[s.aboutSummaryLine, { color: colors.foreground }]} numberOfLines={1}>
              {character.birthday || t('components.about.addBirthday')}  ·  {character.country || t('components.about.addCountry')}
            </Text>
            <Text style={[s.aboutSummaryMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {character.role ? `${selectedRole?.emoji ?? ''} ${character.role}` : t('components.about.chooseRole')}  ·  {socialCount > 0 ? t('components.about.socialLinks', { count: socialCount }) : t('components.about.addSocials')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Guide ─── */}
      <View style={[s.guideCard, SHADOW.sm, !isDark && { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setGuideExpanded(open => !open)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('components.about.guideAccess', { status: t(character.isGuide ? 'components.about.statusOn' : 'components.about.statusOff'), action: guideExpanded ? t('common.close') : t('components.about.openGuideSettings') })}
          accessibilityState={{ expanded: guideExpanded }}
          style={[s.guideHero, guideExpanded && s.guideHeroOpen]}
        >
          <LinearGradient colors={guideGradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[s.guideOrbit, !isDark && { borderColor: `${colors.primary}24` }]} />
          <View pointerEvents="none" style={[s.guidePlanet, !isDark && { backgroundColor: `${colors.primary}08` }]} />
          <View pointerEvents="none" style={s.guideSparkleOne} />
          <View pointerEvents="none" style={s.guideSparkleTwo} />
          <View style={s.guideHeroRow}>
            <View style={s.guideHeroTitleRow}>
              <View style={[s.guideHeroIconWrap, !isDark && { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}24` }]}><Icon name="star" size={24} color={isDark ? '#D7BE65' : colors.secondary} /></View>
              <View style={s.guideHeroCopy}>
                <Text style={[s.guideHeroTitle, !isDark && { color: colors.foreground }]} numberOfLines={2}>{t('social.guide')}</Text>
                <Text style={[s.guideHeroSub, !isDark && { color: colors.mutedForeground }]}>
                  {character.isGuide ? t('components.about.guideActive') : t('components.about.guideHelp')}
                </Text>
              </View>
            </View>
            <View style={s.guideHeroEnd}>
              <View style={[s.guideStatus, !isDark && { backgroundColor: colors.muted, borderColor: colors.border }, character.isGuide && s.guideStatusOn, character.isGuide && !isDark && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}50` }]}>
                <View style={[s.guideStatusDot, !isDark && { backgroundColor: colors.mutedForeground }, character.isGuide && s.guideStatusDotOn, character.isGuide && !isDark && { backgroundColor: colors.secondary }]} />
                <Text style={[s.guideStatusText, !isDark && { color: colors.mutedForeground }, character.isGuide && s.guideStatusTextOn, character.isGuide && !isDark && { color: colors.secondary }]}>{character.isGuide ? t('components.about.statusOn') : t('components.about.statusOff')}</Text>
              </View>
              <Icon name={guideExpanded ? 'chevron-down' : 'chevron-right'} size={16} color={isDark ? '#A49ABF' : colors.mutedForeground} />
            </View>
          </View>
        </TouchableOpacity>

        {guideExpanded && <View style={[s.guideBody, { backgroundColor: colors.card }]}>
          {character.isGuide ? (
            <>
              {(() => {
                const items = [!!character.guideBio, (character.guideTopics ?? []).length > 0, !!character.guideAvailability, character.isPublic];
                const pct   = items.filter(Boolean).length * 25;
                const missing = [t('components.about.introduction'), t('social.topics'), t('components.about.availability'), t('profile.publicProfile')].filter((_, i) => !items[i]);
                return (
                  <View style={s.guideCompletion}>
                    <View style={s.guideCompletionRow}>
                      <Text style={[s.guideCompletionLabel, { color: colors.mutedForeground }]}>{t('components.about.profileStrength')}</Text>
                      <Text style={[s.guideCompletionPct, { color: pct === 100 ? '#60D890' : colors.primary }]}>{pct}%</Text>
                    </View>
                    <View style={[s.guideProgressBg, { backgroundColor: `${colors.border}90` }]}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <View style={[s.guideProgressFill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? '#60D890' : colors.primary }]} />
                    </View>
                    {pct < 100 && <Text style={[s.guideCompletionHint, { color: colors.mutedForeground }]}>{t('components.about.addMissing', { items: missing.join(' · ') })}</Text>}
                  </View>
                );
              })()}
              <View style={[s.guideDivider, { backgroundColor: colors.border }]} />

              {/* Guide bio */}
              <View style={s.guideSection}>
                <Text style={[s.guideSectionLabel, { color: colors.mutedForeground }]}>✦ {t('components.about.introduction')}</Text>
                {editingGuideBio ? (
                  <View style={{ gap: 10 }}>
                    <TextInput style={[s.guideTextArea, { color: colors.foreground, backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}28` }]} value={guideBioVal} onChangeText={setGuideBioVal} multiline placeholder={t('components.about.guideBioPrompt')} placeholderTextColor={colors.mutedForeground} autoFocus maxLength={400} />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                      <TouchableOpacity onPress={() => { setGuideBioVal(character.guideBio ?? ''); setEditingGuideBio(false); }} style={[s.guideActionBtn, { borderColor: colors.border, backgroundColor: 'transparent' }]}>
                        <Text style={[s.guideActionBtnText, { color: colors.mutedForeground }]}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveGuideBio} style={[s.guideActionBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                        <Text style={[s.guideActionBtnText, { color: '#fff' }]}>{t('common.save')}</Text>
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
                        <Text style={[s.guideBioPlaceholder, { color: colors.mutedForeground }]}>{t('components.about.guideBioAdd')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <View style={[s.guideDivider, { backgroundColor: colors.border }]} />

              {/* Topics */}
              <View style={s.guideSection}>
                <Text style={[s.guideSectionLabel, { color: colors.mutedForeground }]}>◎ {t('components.about.topicsSupport')}</Text>
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
                <Text style={[s.guideSectionLabel, { color: colors.mutedForeground }]}>◷ {t('components.about.availability')}</Text>
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
                      {character.guideAvailability ? `${character.guideAvailability.timeFrom} – ${character.guideAvailability.timeTo}` : t('components.about.setHours')}
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
                <Text style={[s.guidePreviewBtnText, { color: colors.primary }]}>{t('components.about.previewGuide')}</Text>
                <Icon name="arrow-right" size={14} color={`${colors.primary}60`} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.guidePreviewBtn, { borderColor: `${colors.primary}30`, backgroundColor: colors.primary, marginTop: 8 }]}
                onPress={() => router.push('/create-guide-session')}
                activeOpacity={0.8}
              >
                <Icon name="calendar" size={14} color="#fff" />
                <Text style={[s.guidePreviewBtnText, { color: '#fff' }]}>{t('components.about.createGroupSession')}</Text>
                <Icon name="arrow-right" size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.guideDisableBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCharacter({ ...character, isGuide: false });
                  setGuideExpanded(false);
                }}
                accessibilityRole="button"
              >
                <Text style={s.guideDisableText}>{t('components.about.turnOffGuide')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={s.guideInviteBody}>
              <TouchableOpacity
                style={[s.guideEnableBtn, { backgroundColor: colors.primary }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCharacter({ ...character, isGuide: true }); }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('components.about.becomeGuide')}
              >
                <Text style={s.guideEnableBtnText}>{t('components.about.becomeGuide')}</Text>
                <Icon name="arrow-right" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  aboutCard:        { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  aboutCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  aboutCardIcon:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aboutCardTitle:   { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1 },
  aboutEditButton:  { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  aboutEditButtonText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  aboutSummary:     { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 13, gap: 4 },
  aboutSummaryLine: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  aboutSummaryMeta: { fontSize: 11, fontFamily: 'Satoshi-Regular' },
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
  platformChipLabel:{ fontSize: 12, fontFamily: 'Satoshi-Medium' },
  socialIcon:       { fontSize: 17, lineHeight: 20 },
  socialBadge:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  handleInput:      { fontSize: 13, fontFamily: 'Satoshi-Regular', backgroundColor: 'rgba(155,120,255,0.10)', borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  saveLinkBtn:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  guideCard:        { borderRadius: 18, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(145,109,222,0.23)', backgroundColor: '#181428' },
  guideHero:        { minHeight: 100, paddingHorizontal: 16, paddingVertical: 18, overflow: 'hidden', justifyContent: 'center' },
  guideHeroOpen:    { borderBottomWidth: 1, borderBottomColor: 'rgba(145,109,222,0.2)' },
  guideOrbit:       { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: 'rgba(181,140,255,0.16)', right: -34, bottom: -124 },
  guidePlanet:      { position: 'absolute', width: 156, height: 156, borderRadius: 78, backgroundColor: 'rgba(139,88,224,0.12)', right: -22, bottom: -110 },
  guideSparkleOne:  { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#D7BE65', right: 121, top: 18 },
  guideSparkleTwo:  { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#BA9BEE', right: 102, top: 48 },
  guideHeroRow:     { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  guideHeroTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },
  guideHeroIconWrap:{ width: 46, height: 46, flexShrink: 0, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(163,129,237,0.15)', borderWidth: 1, borderColor: 'rgba(192,165,255,0.10)' },
  guideHeroCopy:    { flex: 1, minWidth: 0 },
  guideHeroTitle:   { fontSize: 18, flexShrink: 1, fontFamily: 'Satoshi-Bold', color: '#F5F0FF', letterSpacing: -0.3 },
  guideHeroSub:     { fontSize: 12, lineHeight: 16, fontFamily: 'Satoshi-Regular', color: 'rgba(218,205,248,0.70)', marginTop: 3 },
  guideHeroEnd:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 },
  guideStatus:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,184,232,0.22)', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 9, paddingVertical: 7 },
  guideStatusOn:    { borderColor: 'rgba(172,139,246,0.55)', backgroundColor: 'rgba(149,105,240,0.18)' },
  guideStatusDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#77718E' },
  guideStatusDotOn: { backgroundColor: '#B394FF' },
  guideStatusText:  { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(214,204,234,0.58)', letterSpacing: 0.6 },
  guideStatusTextOn:{ color: '#D4C3FF' },
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
  guideInviteBody:  { paddingHorizontal: 14, paddingVertical: 12 },
  guideEnableBtn:   { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 13, alignSelf: 'stretch', justifyContent: 'center' },
  guideEnableBtnText:{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
  guideDisableBtn:  { alignItems: 'center', paddingVertical: 14, marginBottom: 4 },
  guideDisableText: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(210,195,240,0.62)' },
});

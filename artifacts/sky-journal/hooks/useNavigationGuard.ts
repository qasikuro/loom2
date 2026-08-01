import { useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * Intercepts ALL navigation-removal attempts (header back, Android hardware
 * back, iOS swipe-back, modal swipe-down) and shows a "Discard changes?"
 * alert when `isDirty` is true.
 *
 * Uses `usePreventRemove`, which works reliably for every presentation mode
 * including native-stack modals (where `beforeRemove`-based prevention is
 * unreliable for gesture dismissal).
 *
 * Returns a `markSaved` function. Call it immediately before any navigation
 * that follows a *successful* save so the guard does not interrupt it.
 *
 * @param isDirty            Whether the screen has unsaved changes.
 * @param onConfirmedDiscard Optional callback run only when the user
 *                           explicitly confirms "Discard" in the alert.
 *                           Example: DraftStore.discard() in panel-editor.
 *                           NOT called on clean (not-dirty) exits or after
 *                           markSaved(); this avoids clearing resources on
 *                           save-completion navigations.
 */
export function useNavigationGuard(
  isDirty: boolean,
  onConfirmedDiscard?: () => void,
): () => void {
  const navigation = useNavigation();

  // Refs so the callbacks always read the latest values without needing to be
  // re-registered on every render.
  const isDirtyRef               = useRef(isDirty);
  isDirtyRef.current             = isDirty;

  const onConfirmedDiscardRef    = useRef(onConfirmedDiscard);
  onConfirmedDiscardRef.current  = onConfirmedDiscard;

  // Set by markSaved() (successful save) OR the confirmed-discard handler.
  // Using a ref avoids a stale-closure problem: markSaved() is typically
  // called synchronously right before router.back() in the same event
  // handler, before React has a chance to re-render.  By reading the ref
  // inside the usePreventRemove callback (which useLatestCallback ensures is
  // always the latest version), we can let the action through even if the
  // last render still had `preventRemove = true`.
  const confirmingRef = useRef(false);

  /** Call this immediately before any navigation that follows a successful save. */
  const markSaved = useCallback(() => {
    confirmingRef.current = true;
  }, []);

  // `usePreventRemove` handles all presentation modes, including native-stack
  // modals.  The first arg is evaluated at render time; the callback is
  // wrapped with useLatestCallback (inside the hook) so it always reflects
  // the most recent render values.  We additionally re-read `confirmingRef`
  // inside the callback to handle the markSaved() → router.back() fast-path:
  // if markSaved() was called between the last render and this callback, the
  // ref is already true even though the rendered boolean was still true.
  usePreventRemove(!confirmingRef.current && isDirty, ({ data }: { data: { action: Parameters<typeof navigation.dispatch>[0] } }) => {
    if (confirmingRef.current) {
      // markSaved() was called just before the navigation; let it through.
      // We do NOT reset the flag here: React Navigation may re-invoke this
      // callback for the same dispatched action while the preventRemove
      // listener is still registered (component hasn't re-rendered yet).
      // Resetting the flag would cause that re-invocation to show the alert
      // instead of passing through.  The flag remains true until the screen
      // unmounts; markSaved() is always called immediately before a navigation
      // that removes the screen, so there is no window where a user can stay
      // on screen with the guard permanently disabled.
      navigation.dispatch(data.action);
      return;
    }

    Alert.alert(
      'Discard changes?',
      'You have unsaved work. Leave without saving?',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            confirmingRef.current = true;
            onConfirmedDiscardRef.current?.();
            navigation.dispatch(data.action);
          },
        },
      ],
    );
  });

  return markSaved;
}

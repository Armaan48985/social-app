import React from 'react'
import {View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {useLingui} from '@lingui/react'
import {msg, Trans} from '@lingui/macro'
import {useOnboardingDispatch} from '#/state/shell'
import {getAgent, isSessionDeactivated, useSessionApi} from '#/state/session'
import {logger} from '#/logger'
import {pluralize} from '#/lib/strings/helpers'

import {atoms as a, useTheme, useBreakpoints} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {isWeb} from '#/platform/detection'
import {H2, P} from '#/components/Typography'
import {ScrollView} from '#/view/com/util/Views'
import {Loader} from '#/components/Loader'
import {Logo} from '#/view/icons/Logo'

const COL_WIDTH = 400

export function Deactivated() {
  const {_} = useLingui()
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const {gtMobile} = useBreakpoints()
  const onboardingDispatch = useOnboardingDispatch()
  const {logout} = useSessionApi()

  const [isProcessing, setProcessing] = React.useState(false)
  const [estimatedTime, setEstimatedTime] = React.useState<string | undefined>(
    undefined,
  )
  const [placeInQueue, setPlaceInQueue] = React.useState<number | undefined>(
    undefined,
  )

  const checkStatus = React.useCallback(async () => {
    setProcessing(true)
    try {
      const res = await getAgent().com.atproto.temp.checkSignupQueue()
      if (res.data.activated) {
        // ready to go, exchange the access token for a usable one and kick off onboarding
        await getAgent().refreshSession()
        if (!isSessionDeactivated(getAgent().session?.accessJwt)) {
          onboardingDispatch({type: 'start'})
        }
      } else {
        // not ready, update UI
        setEstimatedTime(msToString(res.data.estimatedTimeMs))
        if (typeof res.data.placeInQueue !== 'undefined') {
          setPlaceInQueue(Math.max(res.data.placeInQueue, 1))
        }
      }
    } catch (e: any) {
      logger.error('Failed to check signup queue', {err: e.toString()})
    } finally {
      setProcessing(false)
    }
  }, [setProcessing, setEstimatedTime, setPlaceInQueue, onboardingDispatch])

  React.useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 60e3)
    return () => clearInterval(interval)
  }, [checkStatus])

  const checkBtn = (
    <Button
      variant="solid"
      color="primary"
      size="large"
      label={_(msg`Check my status`)}
      onPress={checkStatus}
      disabled={isProcessing}>
      <ButtonText>
        <Trans>Check my status</Trans>
      </ButtonText>
      {isProcessing && <ButtonIcon icon={Loader} />}
    </Button>
  )

  return (
    <View
      aria-modal
      role="dialog"
      aria-role="dialog"
      aria-label={_(msg`You're in line`)}
      accessibilityLabel={_(msg`You're in line`)}
      accessibilityHint=""
      style={[a.absolute, a.inset_0, a.flex_1, t.atoms.bg]}>
      <ScrollView
        style={[a.h_full, a.w_full]}
        contentContainerStyle={{borderWidth: 0}}>
        <View
          style={[a.flex_row, a.justify_center, gtMobile ? a.pt_4xl : a.px_xl]}>
          <View style={[a.flex_1, {maxWidth: COL_WIDTH}]}>
            <View
              style={[a.w_full, a.justify_center, a.align_center, a.my_4xl]}>
              <Logo width={120} />
            </View>

            <H2 style={[a.pb_sm]}>
              <Trans>You're in line</Trans>
            </H2>
            <P style={[t.atoms.text_contrast_700]}>
              <Trans>
                There's been a rush of new users to Bluesky! We'll activate your
                account as soon as we can.
              </Trans>
            </P>

            <View
              style={[
                a.rounded_sm,
                a.px_2xl,
                a.py_4xl,
                a.mt_2xl,
                t.atoms.bg_contrast_50,
              ]}>
              {typeof placeInQueue === 'number' && (
                <Text
                  style={[a.text_5xl, a.text_center, a.font_bold, a.mb_2xl]}>
                  {placeInQueue}
                </Text>
              )}
              <P style={[a.text_center]}>
                {typeof placeInQueue === 'number' ? (
                  <Trans>left to go.</Trans>
                ) : (
                  <Trans>You are in line.</Trans>
                )}{' '}
                {estimatedTime ? (
                  <Trans>
                    We estimate {estimatedTime} until your account is ready.
                  </Trans>
                ) : (
                  <Trans>
                    We will let you know when your account is ready.
                  </Trans>
                )}
              </P>
            </View>

            {isWeb && gtMobile && (
              <View style={[a.w_full, a.flex_row, a.justify_between, a.pt_5xl]}>
                <Button
                  variant="ghost"
                  size="large"
                  label={_(msg`Log out`)}
                  onPress={logout}>
                  <ButtonText style={[{color: t.palette.primary_500}]}>
                    <Trans>Log out</Trans>
                  </ButtonText>
                </Button>
                {checkBtn}
              </View>
            )}
          </View>

          <View style={{height: 200}} />
        </View>
      </ScrollView>

      {(!isWeb || !gtMobile) && (
        <View
          style={[
            a.align_center,
            gtMobile ? a.px_5xl : a.px_xl,
            {
              paddingBottom: Math.max(insets.bottom, a.pb_5xl.paddingBottom),
            },
          ]}>
          <View style={[a.w_full, a.gap_sm, {maxWidth: COL_WIDTH}]}>
            {checkBtn}
            <Button
              variant="ghost"
              size="large"
              label={_(msg`Log out`)}
              onPress={logout}>
              <ButtonText style={[{color: t.palette.primary_500}]}>
                <Trans>Log out</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

function msToString(ms: number | undefined): string | undefined {
  if (ms && ms > 0) {
    const estimatedTimeMins = Math.ceil(ms / 60e3)
    if (estimatedTimeMins > 59) {
      const estimatedTimeHrs = Math.round(estimatedTimeMins / 60)
      if (estimatedTimeHrs > 6) {
        // dont even bother
        return undefined
      }
      // hours
      return `${estimatedTimeHrs} ${pluralize(estimatedTimeHrs, 'hour')}`
    }
    // minutes
    return `${estimatedTimeMins} ${pluralize(estimatedTimeMins, 'minute')}`
  }
  return undefined
}

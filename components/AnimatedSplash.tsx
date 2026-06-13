import { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

type Props = {
  onFinish: () => void;
};

const PARTICLES = Array.from({ length: 14 }, (_, index) => ({
  id: index,
  left: 8 + (index * 6.5) % 84,
  top: 12 + ((index * 17) % 70),
  size: 4 + (index % 3) * 2,
  delay: index * 120,
}));

export default function AnimatedSplash({ onFinish }: Props) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const fadeOut = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    ring.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );

    shimmer.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    fadeOut.value = withDelay(
      3200,
      withTiming(1, { duration: 450, easing: Easing.in(Easing.cubic) }),
    );

    const timer = setTimeout(onFinish, 3700);
    return () => clearTimeout(timer);
  }, [fadeOut, onFinish, progress, pulse, ring, shimmer]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [28, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.92, 1]) },
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.2, 1], [0.55, 0.35, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.85, 1.45]) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.15, 0.45]),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-80, 80]) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1]),
    transform: [{ translateY: interpolate(progress.value, [0.4, 1], [16, 0]) }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1]),
    transform: [{ translateY: interpolate(progress.value, [0.55, 1], [12, 0]) }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} />
      <View style={styles.gradientMid} />
      <View style={styles.gradientBottom} />
      <View style={styles.glowOrb} />

      {PARTICLES.map((particle) => (
        <FloatingParticle key={particle.id} {...particle} />
      ))}

      <Animated.View style={[styles.hero, heroStyle]}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <View style={styles.logoShadow} />
          <Image
            source={require('assets/icon.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </Animated.View>

        <Animated.View style={[styles.badge, badgeStyle]}>
          <View style={styles.badgeDot} />
          <Animated.Text style={styles.badgeText}>PARTNER</Animated.Text>
        </Animated.View>

        <Animated.Text style={[styles.title, textStyle]}>
          Swasth Bite Partner
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, textStyle]}>
          Live orders. Quick actions. Always on.
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.fadeOverlay, overlayStyle]} />
    </View>
  );
}

function FloatingParticle({
  id,
  left,
  top,
  size,
  delay,
}: {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800 + (id % 4) * 200 }),
          withTiming(0, { duration: 1800 + (id % 4) * 200 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, float, id]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(float.value, [0, 1], [0.15, 0.7]),
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, -18]) },
      { scale: interpolate(float.value, [0, 1], [0.8, 1.15]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: `${left}%`,
          top: `${top}%`,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1220',
    zIndex: 100,
    overflow: 'hidden',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    backgroundColor: '#1D4ED8',
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
  },
  gradientMid: {
    position: 'absolute',
    top: height * 0.18,
    left: -width * 0.2,
    width: width * 1.4,
    height: height * 0.45,
    backgroundColor: '#2563EB',
    opacity: 0.55,
    borderRadius: 999,
    transform: [{ rotate: '-8deg' }],
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.35,
    backgroundColor: '#0F172A',
  },
  glowOrb: {
    position: 'absolute',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    backgroundColor: '#60A5FA',
    opacity: 0.12,
    top: height * 0.22,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  ring: {
    position: 'absolute',
    top: -18,
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: '#BFDBFE',
  },
  logoWrap: {
    width: 128,
    height: 128,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  logoShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    opacity: 0.08,
    borderRadius: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: '#FFFFFF',
    transform: [{ skewX: '-18deg' }],
  },
  badge: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
    marginRight: 8,
  },
  badgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: '#CBD5E1',
    textAlign: 'center',
    maxWidth: 280,
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#FDE68A',
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    zIndex: 10,
  },
});

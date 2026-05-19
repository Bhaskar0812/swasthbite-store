import { useEffect, useRef } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

type Props = {
  onFinish: () => void;
};

function useAnim(init = 0) {
  return useRef(new Animated.Value(init)).current;
}

export default function AnimatedSplash({ onFinish }: Props) {
  const shopBase = useAnim();
  const shopWalls = useAnim();
  const awning = useAnim();
  const door = useAnim();
  const shelf1 = useAnim();
  const shelf2 = useAnim();
  const shelf3 = useAnim();
  const signBoard = useAnim();
  const logoScale = useAnim();
  const logoRotate = useAnim();
  const sparkle = useAnim();
  const whiteOut = useAnim();
  const textOpacity = useAnim();
  const appNameOpacity = useAnim();

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const seq = Animated.sequence;
    const delay = Animated.delay;
    const timing = (val: Animated.Value, toValue: number, duration: number, easing = ease) =>
      Animated.timing(val, { toValue, duration, easing, useNativeDriver: true });
    const spring = (val: Animated.Value, toValue: number, friction = 5, tension = 200) =>
      Animated.spring(val, { toValue, friction, tension, useNativeDriver: true });

    Animated.parallel([
      // Base
      timing(shopBase, 1, 400),
      // Walls
      seq([delay(300), timing(shopWalls, 1, 500)]),
      // Awning
      seq([delay(700), timing(awning, 1, 400)]),
      // Door
      seq([delay(1000), timing(door, 1, 350)]),
      // Shelves
      seq([delay(1200), timing(shelf1, 1, 250)]),
      seq([delay(1350), timing(shelf2, 1, 250)]),
      seq([delay(1500), timing(shelf3, 1, 250)]),
      // Sign board
      seq([delay(1700), timing(signBoard, 1, 350)]),
      // Logo slam with bounce
      seq([
        delay(2100),
        spring(logoScale, 1.3, 3, 300),
        spring(logoScale, 1, 6, 200),
      ]),
      seq([
        delay(2100),
        timing(logoRotate, 10, 100, Easing.linear),
        spring(logoRotate, 0, 5, 200),
      ]),
      // Sparkles
      seq([delay(2500), timing(sparkle, 1, 500, Easing.linear)]),
      // App name
      seq([delay(2600), timing(appNameOpacity, 1, 300, Easing.linear)]),
      // Text
      seq([
        delay(500),
        timing(textOpacity, 1, 300, Easing.linear),
        delay(2200),
        timing(textOpacity, 0, 300, Easing.linear),
      ]),
      // White out
      seq([delay(3200), timing(whiteOut, 1, 400, Easing.in(Easing.cubic))]),
    ]).start();

    const timer = setTimeout(onFinish, 3700);
    return () => clearTimeout(timer);
  }, []);

  // Interpolations
  const awningTranslateY = awning.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const shelf1TranslateX = shelf1.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] });
  const shelf2TranslateX = shelf2.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });
  const shelf3TranslateX = shelf3.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] });
  const signTranslateY = signBoard.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] });
  const rotateDeg = logoRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
  const sparkleOpacity = sparkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <Animated.Text style={[styles.setupText, { opacity: textOpacity }]}>
        Setting up your store...
      </Animated.Text>

      <View style={styles.shopScene}>
        {/* Floor */}
        <Animated.View style={[styles.floor, { opacity: shopBase, transform: [{ scaleX: shopBase }] }]} />

        {/* Walls */}
        <Animated.View style={[styles.wallLeft, { opacity: shopWalls, transform: [{ scaleY: shopWalls }] }]} />
        <Animated.View style={[styles.wallRight, { opacity: shopWalls, transform: [{ scaleY: shopWalls }] }]} />
        <Animated.View style={[styles.backWall, { opacity: shopWalls, transform: [{ scaleY: shopWalls }] }]} />

        {/* Awning */}
        <Animated.View style={[styles.awning, { opacity: awning, transform: [{ translateY: awningTranslateY }, { scaleY: awning }] }]}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={[styles.awningStripe, { backgroundColor: i % 2 === 0 ? '#E23744' : '#FFFFFF' }]} />
          ))}
        </Animated.View>

        {/* Door */}
        <Animated.View style={[styles.door, { opacity: door, transform: [{ scaleX: door }] }]}>
          <View style={styles.doorHandle} />
        </Animated.View>

        {/* Shelves */}
        <Animated.View style={[styles.shelf, styles.shelf1Pos, { opacity: shelf1, transform: [{ translateX: shelf1TranslateX }] }]}>
          <View style={[styles.shelfItem, { backgroundColor: '#4CAF50', height: 10 }]} />
          <View style={[styles.shelfItem, { backgroundColor: '#FF9800', height: 13 }]} />
          <View style={[styles.shelfItem, { backgroundColor: '#2196F3', height: 9 }]} />
          <View style={styles.shelfBoard} />
        </Animated.View>

        <Animated.View style={[styles.shelf, styles.shelf2Pos, { opacity: shelf2, transform: [{ translateX: shelf2TranslateX }] }]}>
          <View style={[styles.shelfItem, { backgroundColor: '#9C27B0', height: 11 }]} />
          <View style={[styles.shelfItem, { backgroundColor: '#F44336', height: 9 }]} />
          <View style={[styles.shelfItem, { backgroundColor: '#FFEB3B', height: 12 }]} />
          <View style={styles.shelfBoard} />
        </Animated.View>

        <Animated.View style={[styles.shelf, styles.shelf3Pos, { opacity: shelf3, transform: [{ translateX: shelf3TranslateX }] }]}>
          <View style={[styles.shelfItem, { backgroundColor: '#00BCD4', height: 10 }]} />
          <View style={[styles.shelfItem, { backgroundColor: '#8BC34A', height: 8 }]} />
          <View style={[styles.shelfItem, { backgroundColor: '#FF5722', height: 13 }]} />
          <View style={styles.shelfBoard} />
        </Animated.View>

        {/* Sign Board */}
        <Animated.View style={[styles.signBoard, { opacity: signBoard, transform: [{ translateY: signTranslateY }, { scale: signBoard }] }]}>
          <Animated.View style={[styles.logoOnSign, { transform: [{ scale: logoScale }, { rotate: rotateDeg }] }]}>
            <Image source={require('assets/icon.png')} style={styles.logoImage} contentFit="contain" />
          </Animated.View>
        </Animated.View>

        {/* Sparkles */}
        <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity, transform: [{ scale: sparkle }] }]}>
          <View style={[styles.spark, { top: -20, left: -30 }]} />
          <View style={[styles.spark, { top: -25, right: -25 }]} />
          <View style={[styles.spark, { top: 5, left: -45 }]} />
          <View style={[styles.spark, { top: 10, right: -40 }]} />
          <View style={[styles.spark, { top: -35, left: 10 }]} />
          <View style={[styles.spark, { top: -10, right: 5 }]} />
        </Animated.View>
      </View>

      <Animated.Text style={[styles.appName, { opacity: appNameOpacity }]}>
        Swasth Bite Partner
      </Animated.Text>

      <Animated.View style={[styles.whiteOverlay, { opacity: whiteOut }]} />
    </View>
  );
}

const SHOP_WIDTH = width * 0.5;
const SHOP_HEIGHT = 140;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    zIndex: 100,
  },
  bgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
    backgroundColor: '#3B82F6',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  bgBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.1,
    backgroundColor: '#E8D5B7',
  },
  setupText: {
    position: 'absolute',
    top: height * 0.18,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  shopScene: {
    width: SHOP_WIDTH,
    height: SHOP_HEIGHT + 55,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  floor: {
    position: 'absolute',
    bottom: 0,
    width: SHOP_WIDTH + 14,
    height: 8,
    backgroundColor: '#8B7355',
    borderRadius: 3,
  },
  wallLeft: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    width: 7,
    height: SHOP_HEIGHT - 14,
    backgroundColor: '#D4A574',
    transformOrigin: 'bottom',
    borderTopLeftRadius: 3,
  },
  wallRight: {
    position: 'absolute',
    bottom: 8,
    right: 0,
    width: 7,
    height: SHOP_HEIGHT - 14,
    backgroundColor: '#D4A574',
    transformOrigin: 'bottom',
    borderTopRightRadius: 3,
  },
  backWall: {
    position: 'absolute',
    bottom: 8,
    left: 7,
    right: 7,
    height: SHOP_HEIGHT - 14,
    backgroundColor: '#FFF8EF',
    transformOrigin: 'bottom',
  },
  awning: {
    position: 'absolute',
    top: 8,
    left: -6,
    right: -6,
    height: 20,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  awningStripe: {
    flex: 1,
    height: '100%',
  },
  door: {
    position: 'absolute',
    bottom: 8,
    width: 34,
    height: 56,
    backgroundColor: '#8B4513',
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
  },
  doorHandle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  shelf: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  shelf1Pos: {
    bottom: 92,
    left: 14,
  },
  shelf2Pos: {
    bottom: 70,
    right: 14,
  },
  shelf3Pos: {
    bottom: 48,
    left: 14,
  },
  shelfBoard: {
    position: 'absolute',
    bottom: 0,
    left: -4,
    right: -4,
    height: 3,
    backgroundColor: '#A0522D',
    borderRadius: 1,
  },
  shelfItem: {
    width: 7,
    marginHorizontal: 1.5,
    borderRadius: 1.5,
  },
  signBoard: {
    position: 'absolute',
    top: -22,
    width: SHOP_WIDTH * 0.55,
    height: 50,
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoOnSign: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  sparkleContainer: {
    position: 'absolute',
    top: -22,
    width: SHOP_WIDTH * 0.55,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  appName: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.8,
  },
  whiteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F0F7FF',
    zIndex: 10,
  },
});

const trails = [
  // Left side — trail walking upward
  { top: "8%", left: "-4%", rotation: -30, scale: 1.8, opacity: 0.10, hue: 0 },
  // Right side — trail walking downward
  { top: "40%", right: "-6%", rotation: 150, scale: 2.2, opacity: 0.08, hue: 60 },
  // Bottom left — smaller trail
  { bottom: "5%", left: "2%", rotation: -50, scale: 1.4, opacity: 0.12, hue: 180 },
  // Top right — faint large trail
  { top: "60%", right: "0%", rotation: 45, scale: 1.6, opacity: 0.06, hue: 270 },
];

export default function FloatingDecorations() {
  return (
    <>
      {/* Decorative Watercolor Background Elements */}
      <div
        className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-brand-orange/15 dark:bg-brand-orange/5 rounded-full blur-[100px] pointer-events-none"
        style={{ contain: "strict" }}
      />
      <div
        className="fixed top-[20%] right-[-10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-brand-pink/15 dark:bg-brand-pink/5 rounded-full blur-[120px] pointer-events-none"
        style={{ contain: "strict" }}
      />
      <div
        className="fixed bottom-[-10%] left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-brand-olive/15 dark:bg-brand-olive/5 rounded-full blur-[100px] pointer-events-none"
        style={{ contain: "strict" }}
      />

      {/* Footprint trails — different hue per trail, light paws in dark mode, dark paws in light mode */}
      {trails.map((t, i) => (
        <div
          key={i}
          className="fixed pointer-events-none z-0 relative"
          style={{
            top: t.top,
            left: t.left,
            right: t.right,
            bottom: t.bottom,
            opacity: t.opacity,
            transform: `rotate(${t.rotation}deg) scale(${t.scale})`,
          }}
        >
          {/* Light mode: dark tinted paws — fades out in dark mode */}
          <img
            src="/footprints.gif"
            alt=""
            className="w-64 h-64 md:w-80 md:h-80 object-contain opacity-100 dark:opacity-0 transition-opacity duration-400"
            style={{
              filter: `sepia(1) saturate(2) hue-rotate(${t.hue}deg) brightness(0.4)`,
            }}
          />
          {/* Dark mode: light tinted paws — fades in during dark mode */}
          <img
            src="/footprints.gif"
            alt=""
            className="absolute inset-0 w-64 h-64 md:w-80 md:h-80 object-contain opacity-0 dark:opacity-100 transition-opacity duration-400"
            style={{
              filter: `invert(1) sepia(1) saturate(1.5) hue-rotate(${t.hue}deg) brightness(1.5)`,
            }}
          />
        </div>
      ))}
    </>
  );
}

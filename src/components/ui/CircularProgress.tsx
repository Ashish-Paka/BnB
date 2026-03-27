import { motion } from "motion/react";

interface Props {
  current: number;
  total: number;
  size?: number;
}

const FILLED_COLOR = "#22c55e"; // green-500

export default function CircularProgress({
  current,
  total,
  size = 80,
}: Props) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/20"
        />
        {/* Progress segments */}
        {Array.from({ length: total }).map((_, i) => {
          const segAngle = (360 / total);
          const gapAngle = 4;
          const segLength = ((segAngle - gapAngle) / 360) * circumference;
          const segOffset = ((i * segAngle + gapAngle / 2) / 360) * circumference;
          const isFilled = i < current;

          return (
            <motion.circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${segLength} ${circumference - segLength}`}
              strokeDashoffset={-segOffset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              stroke={isFilled ? FILLED_COLOR : "rgba(255,255,255,0.25)"}
            />
          );
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-white leading-none drop-shadow-md">
          {current}
        </span>
        <span className="text-[10px] font-extrabold text-white/90 uppercase tracking-wider drop-shadow-sm">
          /{total}
        </span>
      </div>
    </div>
  );
}

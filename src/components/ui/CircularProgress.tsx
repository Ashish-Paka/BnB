import { motion } from "motion/react";

interface Props {
  current: number;
  total: number;
  size?: number;
}

export default function CircularProgress({
  current,
  total,
  size = 80,
}: Props) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / total, 1);
  const dashOffset = circumference * (1 - progress);

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
          className="text-stone-200 dark:text-stone-700"
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
              className={
                isFilled
                  ? "text-brand-orange stroke-current"
                  : "text-stone-300 dark:text-stone-600 stroke-current"
              }
            />
          );
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-stone-800 dark:text-stone-200 leading-none">
          {current}
        </span>
        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
          /{total}
        </span>
      </div>
    </div>
  );
}

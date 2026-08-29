<template>
  <div class="lupb" :style="cssVars">
    <div class="lupb__track">
      <div
        class="lupb__fill"
        :class="{ 'lupb__fill--animated': animated && filling }"
        :style="{ width: clampedValue + '%' }"
      >
        <div v-if="animated && filling" class="lupb__shimmer" />
      </div>
    </div>
    <span v-if="showPercentage" class="lupb__text" :class="textColorClass">
      {{ clampedValue }}%
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Current progress value */
    value: number;
    /** Maximum value (default 100) */
    max?: number;
    /** Bar height (CSS value, e.g. '8px', '1rem') */
    height?: string;
    /** Whether to show the shimmer animation */
    animated?: boolean;
    /** Whether to show the percentage text */
    showPercentage?: boolean;
    /** Custom color for the fill bar (CSS color) */
    fillColor?: string;
    /** Custom color for the track background */
    trackColor?: string;
    /** Custom color for 0% text (default: gray) */
    zeroColor?: string;
    /** Custom color for 1-99% text (default: light blue) */
    activeColor?: string;
    /** Custom color for 100% text (default: green) */
    doneColor?: string;
    /** Custom color when in error state */
    errorColor?: string;
    /** Error state flag */
    error?: boolean;
  }>(),
  {
    max: 100,
    height: '8px',
    animated: true,
    showPercentage: true,
    fillColor: undefined,
    trackColor: undefined,
    zeroColor: '#9ca3af',
    activeColor: '#60a5fa',
    doneColor: '#34d399',
    errorColor: '#f87171',
    error: false,
  },
);

const clampedValue = computed(() => {
  const pct = Math.round((props.value / props.max) * 100);
  return Math.max(0, Math.min(100, pct));
});

const filling = computed(() => clampedValue.value > 0 && clampedValue.value < 100);

const textColorClass = computed(() => {
  if (props.error) return 'lupb__text--error';
  if (clampedValue.value >= 100) return 'lupb__text--done';
  if (clampedValue.value <= 0) return 'lupb__text--zero';
  return 'lupb__text--active';
});

const cssVars = computed(() => {
  const vars: Record<string, string> = {
    '--lupb-height': props.height,
    '--lupb-track': props.trackColor ?? '#e5e7eb',
    '--lupb-fill': props.fillColor ?? '#60a5fa',
    '--lupb-zero': props.zeroColor,
    '--lupb-active': props.activeColor,
    '--lupb-done': props.doneColor,
    '--lupb-error': props.errorColor,
  };
  return vars;
});
</script>

<style scoped>
.lupb {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  font-family: 'Inter', 'SF Pro Display', 'PingFang SC', system-ui, -apple-system, sans-serif;
}

/* ── Track ── */
.lupb__track {
  flex: 1;
  height: var(--lupb-height);
  background: var(--lupb-track);
  border-radius: 100px;          /* fully rounded pill */
  overflow: hidden;
  position: relative;
}

/* ── Fill ── */
.lupb__fill {
  height: 100%;
  width: 0%;
  background: var(--lupb-fill);
  border-radius: 100px;
  transition: width 0.45s cubic-bezier(0.25, 0.8, 0.25, 1.2);
  position: relative;
  min-width: 0;
}

/* animated shimmer overlay */
.lupb__fill--animated {
  overflow: hidden;
}

.lupb__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.35) 40%,
    rgba(255, 255, 255, 0.5) 50%,
    rgba(255, 255, 255, 0.35) 60%,
    transparent 100%
  );
  animation: lupb-shimmer 1.8s ease-in-out infinite;
  will-change: transform;
}

@keyframes lupb-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ── Percentage text ── */
.lupb__text {
  min-width: 3.2em;
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  transition: color 0.35s ease;
  user-select: none;
}

.lupb__text--zero   { color: var(--lupb-zero); }   /* gray */
.lupb__text--active { color: var(--lupb-active); }  /* light blue */
.lupb__text--done   { color: var(--lupb-done); }    /* green */
.lupb__text--error  { color: var(--lupb-error); }   /* red */
</style>

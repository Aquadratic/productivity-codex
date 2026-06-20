export interface SoundChoice {
  id: string;
  label: string;
  src: string;
}

export const soundChoices: SoundChoice[] = [
  { id: 'gentle-chime', label: 'Gentle chime', src: '/sounds/gentle-chime.wav' },
  { id: 'bright-success', label: 'Bright success', src: '/sounds/bright-success.wav' },
  { id: 'soft-bell', label: 'Soft bell', src: '/sounds/soft-bell.wav' },
  { id: 'focus-complete', label: 'Focus complete', src: '/sounds/focus-complete.wav' },
  { id: 'break-complete', label: 'Break complete', src: '/sounds/break-complete.wav' },
  { id: 'alert', label: 'Alert', src: '/sounds/alert.wav' }
];

export function getSoundChoice(id: string): SoundChoice {
  return soundChoices.find((choice) => choice.id === id) ?? soundChoices[0];
}

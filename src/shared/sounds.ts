export interface SoundChoice {
  id: string;
  label: string;
  src: string;
}

export const soundChoices: SoundChoice[] = [
  { id: 'classic-alarm', label: 'Classic Alarm', src: '/sounds/classic-alarm.wav' },
  { id: 'clean-bell', label: 'Clean Bell', src: '/sounds/clean-bell.wav' },
  { id: 'digital-pulse', label: 'Digital Pulse', src: '/sounds/digital-pulse.wav' },
  { id: 'calm-rise', label: 'Calm Rise', src: '/sounds/calm-rise.wav' }
];

export function getSoundChoice(id: string): SoundChoice {
  return soundChoices.find((choice) => choice.id === id) ?? soundChoices[0];
}

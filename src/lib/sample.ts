import type { RawComment } from './types.ts'

export const SAMPLE_COMMENTS: RawComment[] = [
  { id: 's1', username: 'noura', text: '2-1 @ahmad @sara @faisal', order: 0, missingUser: false, following: true },
  { id: 's2', username: 'fahad', text: 'السعودية 1 الكويت 0 @laila @omar @huda', order: 1, missingUser: false, following: true },
  { id: 's3', username: 'dana', text: '٠-٠ @a @b @c @d', order: 2, missingUser: false, following: true },
  { id: 's4', username: 'salem', text: '1-0 @x @y', order: 3, missingUser: false, following: true },
  { id: 's5', username: 'reem', text: 'بالتوفيق @a @b @c', order: 4, missingUser: false, following: true },
  { id: 's6', username: 'hassan', text: 'توقعي ٢:١ @mona @ali @noor', order: 5, missingUser: false, following: false },
  { id: 's7', username: 'latifa', text: 'الكويت 2 السعودية 3 @jad @rami @tura', order: 6, missingUser: false, following: true },
  { id: 's8', username: 'bader', text: 'صفر-صفر @w @e @r', order: 7, missingUser: false, following: false },
]

// Proud Moments, 2006 – 2026 (data/timeline.json → chapters "proud").
// The milestones of the family's later years, in the same automatic slideshow.

import { mountTimelineShow } from './timeline-show.js';

export async function mount(el, content) {
  return mountTimelineShow(el, content, { chapterId: 'proud', titleId: 'proud-title' });
}

// A Journey Through Time, 1976 – 2005 (data/timeline.json → chapters "journey").
// Her early years as an automatic slideshow of the family's photographs.

import { mountTimelineShow } from './timeline-show.js';

export async function mount(el, content) {
  return mountTimelineShow(el, content, { chapterId: 'journey', titleId: 'journey-title' });
}

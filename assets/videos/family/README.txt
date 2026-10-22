The family's films, prepared for the presentation
===================================================

These files are made by   npm run build:films   from the family's originals
in the VIDEOS folder (which are never changed):

  age-1-to-5-story.mp4   <- VIDEOS/age 1 to 5 story video.mp4   (web copy: 1440 x 1080, H.264 + AAC)
  age-1-to-50.mp4        <- VIDEOS/updated/AGE 1 TO 50 - real video-update.mp4 (copied as it is)
  life-journey.mp4       <- VIDEOS/updated/LIFE JOURNEY-update.mp4             (web copy, under 100 MB)

Each has a poster frame (.jpg). data/site.json -> videos lists them, with the
words shown beside each film. The story film plays after "Happy 50th
Birthday"; Age 1 to 50 and Her Life Journey play after the video wishes.

To replace a film: put the new original in VIDEOS/ under the same name and run
npm run build:films again. A film whose file is missing is left out of the
presentation, never replaced by anything else.

The family's video wishes are not here: they come from the
"Family video wishes" folder via   npm run build:wishes   (assets/videos/wishes/).

(needs: pip install imageio-ffmpeg)
